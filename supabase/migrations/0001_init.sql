-- SOUL DS Planner - initial schema.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run only on an empty project (it creates objects without "if not exists").

-- ---------------------------------------------------------------------------
-- Accounts and roles
-- ---------------------------------------------------------------------------
-- pending  : account exists but has not been approved yet (sees nothing)
-- r4       : leadership, can edit all alliance data
-- r5       : like r4, plus manages accounts and can reset/restore data in the UI
-- disabled : locked out
create type public.app_role as enum ('pending', 'r4', 'r5', 'disabled');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  display_name text not null default '',
  role        public.app_role not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Role helpers. SECURITY DEFINER so policies can read profiles without recursing into RLS.
create function public.user_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_leader() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.user_role() in ('r4', 'r5'), false)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.user_role() = 'r5', false)
$$;

-- Every new auth user gets a profile. The very first account becomes r5 so the
-- project owner can bootstrap; everyone after that starts as 'pending'.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    coalesce(new.email, ''),
    case when exists (select 1 from public.profiles) then 'pending'::public.app_role else 'r5'::public.app_role end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Never leave the alliance without an administrator.
create function public.guard_last_admin() returns trigger
language plpgsql as $$
declare
  losing_admin boolean;
begin
  if tg_op = 'DELETE' then
    losing_admin := old.role = 'r5';
  else
    losing_admin := old.role = 'r5' and new.role <> 'r5';
  end if;
  if losing_admin and not exists (select 1 from public.profiles where role = 'r5' and id <> old.id) then
    raise exception 'There must always be at least one r5 account.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_guard_last_admin
  before update or delete on public.profiles
  for each row execute function public.guard_last_admin();

alter table public.profiles enable row level security;

create policy "read own profile or any as admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

-- Only an admin changes roles; nobody edits email/id through the API.
create policy "admins manage profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Alliance data. Documents are stored as JSON so the app models stay unchanged.
-- ---------------------------------------------------------------------------
create table public.members (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create table public.suspensions (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- Events carry a version for optimistic concurrency: two R4s editing the same
-- event can never silently overwrite each other (see save_event below).
create table public.events (
  id         text primary key,
  data       jsonb not null,
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create table public.settings (
  id         text primary key default 'app',
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  constraint settings_single_row check (id = 'app')
);

-- Keep updated_at / updated_by honest regardless of what the client sends.
create function public.touch_row() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end $$;

create trigger members_touch     before insert or update on public.members     for each row execute function public.touch_row();
create trigger suspensions_touch before insert or update on public.suspensions for each row execute function public.touch_row();
create trigger events_touch      before insert or update on public.events      for each row execute function public.touch_row();
create trigger settings_touch    before insert or update on public.settings    for each row execute function public.touch_row();

alter table public.members     enable row level security;
alter table public.suspensions enable row level security;
alter table public.events      enable row level security;
alter table public.settings    enable row level security;

-- Only approved leaders (r4/r5) can read or write anything.
create policy "leaders only" on public.members     for all to authenticated using (public.is_leader()) with check (public.is_leader());
create policy "leaders only" on public.suspensions for all to authenticated using (public.is_leader()) with check (public.is_leader());
create policy "leaders only" on public.events      for all to authenticated using (public.is_leader()) with check (public.is_leader());
create policy "leaders only" on public.settings    for all to authenticated using (public.is_leader()) with check (public.is_leader());

-- ---------------------------------------------------------------------------
-- Version-checked event save. p_expected = null means "create".
-- Raises SQLSTATE 40001 ('conflict') when someone else saved first.
-- SECURITY INVOKER (default): row-level security above still applies.
-- ---------------------------------------------------------------------------
create function public.save_event(p_id text, p_data jsonb, p_expected integer) returns integer
language plpgsql as $$
declare
  v integer;
begin
  if p_expected is null then
    insert into public.events (id, data) values (p_id, p_data)
    on conflict (id) do nothing
    returning version into v;
  else
    update public.events set data = p_data, version = version + 1
    where id = p_id and version = p_expected
    returning version into v;
  end if;
  if v is null then
    raise exception 'conflict' using errcode = '40001';
  end if;
  return v;
end $$;

-- Atomic finalise: the event and the new suspension list are written together,
-- or not at all.
create function public.finalise_event(p_id text, p_event jsonb, p_expected integer, p_suspensions jsonb) returns integer
language plpgsql as $$
declare
  v integer;
  s jsonb;
begin
  update public.events set data = p_event, version = version + 1
  where id = p_id and version = p_expected
  returning version into v;
  if v is null then
    raise exception 'conflict' using errcode = '40001';
  end if;

  delete from public.suspensions where true;
  for s in select * from jsonb_array_elements(p_suspensions) loop
    insert into public.suspensions (id, data) values (s ->> 'id', s);
  end loop;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime: other R4s see changes without refreshing.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.members, public.events, public.suspensions, public.settings;
