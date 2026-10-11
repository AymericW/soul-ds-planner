-- SOUL DS Planner - 0002: two events every Friday (Team A + Team B), public join page,
-- join requests and power history.
--
-- !!! DESTRUCTIVE !!!
-- This migration DELETES EVERY ROW of public.events: the current week AND the whole event
-- history (lineups, attendance, participation statistics). Members (roster, aliases, power),
-- suspensions, settings and accounts are kept. Export a backup in the app first
-- (Settings -> Export backup).
--
-- Run once, after 0001, in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Everything runs in one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Full reset of the events (user-approved). Old events have no Team A/B slot and
--    random ids; the app now uses deterministic ids "YYYY-MM-DD-A" / "YYYY-MM-DD-B".
--    Suspensions only mention their source event id as text (no foreign key), so they
--    stay valid and keep counting down.
-- ---------------------------------------------------------------------------
delete from public.events;

-- ---------------------------------------------------------------------------
-- 2. Leaders-only tables (same JSON-document style and rules as 0001).
-- ---------------------------------------------------------------------------
-- "I'm not in the list" requests from the public join page.
-- data: { id, status: pending|approved|rejected, name, normalisedName, power, choices: {A,B},
--         weekDate, createdAt, updatedAt, resolvedAt?, resolvedBy?, linkedMemberId? }
create table public.join_requests (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- Power history. data: { id, memberId, oldPower, newPower, source: self|leader,
--                        status: applied|pending|rejected, createdAt, resolvedAt?, resolvedBy? }
create table public.power_changes (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create index join_requests_pending_idx on public.join_requests ((data ->> 'status'), (data ->> 'normalisedName'));
create index power_changes_member_idx on public.power_changes ((data ->> 'memberId'), (data ->> 'status'));

create trigger join_requests_touch before insert or update on public.join_requests for each row execute function public.touch_row();
create trigger power_changes_touch before insert or update on public.power_changes for each row execute function public.touch_row();

alter table public.join_requests enable row level security;
alter table public.power_changes enable row level security;

-- Nothing is readable or writable by anonymous users: they only reach the join_* functions below.
create policy "leaders only" on public.join_requests for all to authenticated using (public.is_leader()) with check (public.is_leader());
create policy "leaders only" on public.power_changes for all to authenticated using (public.is_leader()) with check (public.is_leader());

alter publication supabase_realtime add table public.join_requests, public.power_changes;

-- ---------------------------------------------------------------------------
-- 3. Internal helpers in a schema the API does not expose.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema private from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on schema private from authenticated'; end if;
end $$;

-- Rate-limit log of the public functions (cleaned automatically after a day).
create table private.join_attempts (
  id         bigint generated always as identity primary key,
  kind       text not null,          -- 'submit' (key = member id) | 'request' (key = normalised name)
  key        text not null,
  created_at timestamptz not null default now()
);
create index join_attempts_lookup_idx on private.join_attempts (kind, key, created_at);
alter table private.join_attempts enable row level security;

-- Same format as JavaScript's Date.toISOString().
create function private.iso_now() returns text
language sql stable set search_path = '' as $$
  select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- Today when today (Paris time) is a Friday, otherwise the next Friday.
-- Same rule as upcomingEventDate() in src/domain/events/weekEvents.ts.
create function private.upcoming_friday() returns date
language sql stable set search_path = '' as $$
  select d + ((5 - extract(isodow from d)::int + 7) % 7)
  from (select (now() at time zone 'Europe/Paris')::date as d) t
$$;

create function private.event_id(p_date date, p_slot text) returns text
language sql immutable set search_path = '' as $$
  select to_char(p_date, 'YYYY-MM-DD') || '-' || p_slot
$$;

-- Approximation of normaliseName() (src/helpers/normalise.ts): lower case, common accents
-- removed, only letters and digits. Used to merge repeated unlisted requests.
create function private.normalise_name(p text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
    translate(lower(coalesce(p, '')), 'àáâãäåāçćčèéêëēěìíîïīñńòóôõöøōùúûüūýÿžšł', 'aaaaaaaccceeeeeeiiiiinnooooooouuuuuyyzsl'),
    '[^[:alnum:]]+', '', 'g')
$$;

-- The event document exactly as the app creates it (createWeekEvent in src/domain/events/weekEvents.ts).
create function private.event_doc(p_date date, p_slot text) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', private.event_id(p_date, p_slot),
    'label', 'Desert Storm Team ' || p_slot || ' – ' || to_char(p_date, 'Dy FMDD Mon YYYY'),
    'date', to_char(p_date, 'YYYY-MM-DD'),
    'slot', p_slot,
    'status', 'registration',
    'registrations', '[]'::jsonb,
    'assignments', '[]'::jsonb,
    'attendance', '[]'::jsonb,
    'suspensionIdsIssued', '[]'::jsonb,
    'createdAt', private.iso_now(),
    'updatedAt', private.iso_now()
  )
$$;

create function private.ensure_week_events() returns void
language plpgsql set search_path = '' as $$
declare
  d date := private.upcoming_friday();
  s text;
begin
  foreach s in array array['A', 'B'] loop
    insert into public.events (id, data) values (private.event_id(d, s), private.event_doc(d, s))
    on conflict (id) do nothing;
  end loop;
end $$;

-- Returns the settings document when the join code is right, otherwise raises join:bad_code.
-- An empty stored code disables the join page.
create function private.join_settings(p_code text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  s jsonb;
begin
  select data into s from public.settings where id = 'app';
  if s is null
     or coalesce(btrim(s ->> 'joinCode'), '') = ''
     or upper(btrim(coalesce(p_code, ''))) <> upper(btrim(s ->> 'joinCode')) then
    raise exception 'join:bad_code' using errcode = 'P0001';
  end if;
  return s;
end $$;

-- Power bounds: same values as JOIN_LIMITS in src/constants/rules.ts.
create function private.check_power(p_power numeric) returns bigint
language plpgsql immutable set search_path = '' as $$
begin
  if p_power is null or p_power < 1000000 or p_power > 5000000000 then
    raise exception 'join:invalid_power' using errcode = 'P0001';
  end if;
  return round(p_power)::bigint;
end $$;

-- {"A": none|play|sub, "B": ...} (missing slot = none); anything else raises join:invalid_choices.
create function private.parse_choices(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if p is null or jsonb_typeof(p) <> 'object'
     or exists (select 1 from jsonb_object_keys(p) k where k not in ('A', 'B'))
     or exists (select 1 from jsonb_each(p) e where jsonb_typeof(e.value) <> 'string' or (e.value #>> '{}') not in ('none', 'play', 'sub')) then
    raise exception 'join:invalid_choices' using errcode = 'P0001';
  end if;
  return jsonb_build_object('A', coalesce(p ->> 'A', 'none'), 'B', coalesce(p ->> 'B', 'none'));
end $$;

-- Sliding-window counter. Raises join:rate_limited when the limit is reached, else records the attempt.
create function private.rate_limit(p_kind text, p_key text, p_max integer, p_window interval) returns void
language plpgsql set search_path = '' as $$
begin
  delete from private.join_attempts where created_at < now() - interval '1 day';
  if (select count(*) from private.join_attempts where kind = p_kind and key = p_key and created_at > now() - p_window) >= p_max then
    raise exception 'join:rate_limited' using errcode = 'P0001';
  end if;
  insert into private.join_attempts (kind, key) values (p_kind, p_key);
end $$;

revoke all on all functions in schema private from public;
revoke all on all tables in schema private from public;

-- ---------------------------------------------------------------------------
-- 4. Public functions. SECURITY DEFINER with an empty search_path; each checks the join code
--    (except ensure_week_events, which only creates the two empty events of the upcoming Friday).
-- ---------------------------------------------------------------------------

-- Creates the missing Team A / Team B events of the upcoming Friday. Idempotent; no cron needed:
-- the leaders' app and the join page call it.
create function public.ensure_week_events() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.ensure_week_events();
end $$;

-- Active members (id + name only, never power or activity) and the upcoming Friday's events.
create function public.join_get_roster(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d date;
begin
  perform private.join_settings(p_code);
  perform private.ensure_week_events();
  d := private.upcoming_friday();
  return jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.data ->> 'name') order by lower(m.data ->> 'name'), m.id)
      from public.members m
      where coalesce((m.data ->> 'active')::boolean, false)
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'slot', e.data ->> 'slot', 'date', e.data ->> 'date', 'status', e.data ->> 'status') order by e.id)
      from public.events e
      where e.id in (private.event_id(d, 'A'), private.event_id(d, 'B'))
    ), '[]'::jsonb)
  );
end $$;

-- The member's current answer for the upcoming Friday: {choices: {A, B}, submittedAt?}.
create function public.join_get_submission(p_code text, p_member_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d date;
  v_choices jsonb := '{"A": "none", "B": "none"}'::jsonb;
  v_at text;
  v_reg jsonb;
  e record;
begin
  perform private.join_settings(p_code);
  if not exists (select 1 from public.members where id = p_member_id and coalesce((data ->> 'active')::boolean, false)) then
    raise exception 'join:invalid_member' using errcode = 'P0001';
  end if;
  d := private.upcoming_friday();
  for e in select ev.data from public.events ev where ev.id in (private.event_id(d, 'A'), private.event_id(d, 'B')) loop
    select x into v_reg from jsonb_array_elements(e.data -> 'registrations') x where x ->> 'memberId' = p_member_id limit 1;
    if v_reg is not null then
      v_choices := jsonb_set(v_choices, array[e.data ->> 'slot'],
        to_jsonb(case when coalesce((v_reg ->> 'substituteOnly')::boolean, false) then 'sub' else 'play' end));
      if v_reg ->> 'submittedAt' is not null and (v_at is null or v_reg ->> 'submittedAt' > v_at) then
        v_at := v_reg ->> 'submittedAt';
      end if;
    end if;
  end loop;
  return jsonb_build_object('choices', v_choices)
    || case when v_at is null then '{}'::jsonb else jsonb_build_object('submittedAt', v_at) end;
end $$;

-- Self-registration. All or nothing:
--  * member must exist and be active, power within bounds, choices valid;
--  * a play/sub choice for an event that is no longer in 'registration' rejects the whole call (join:closed);
--  * at most 6 successful submissions per member per 10 minutes (join:rate_limited);
--  * play/sub upserts the registration (source 'self', submittedAt, enteredPower); none removes only a
--    self-registration (a leader's registration is never undone); each changed event gets version + 1;
--  * power rule: within [-drop%, +rise%] of the roster power -> roster updated + 'applied' history row,
--    otherwise roster unchanged + one 'pending' row per member (updated on resubmit).
-- Returns {power: applied|pending|unchanged, choices: {A, B}}.
create function public.join_submit(p_code text, p_member_id text, p_power numeric, p_choices jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s jsonb;
  m jsonb;
  d date;
  v_choices jsonb;
  v_power bigint;
  v_old numeric;
  v_now text := private.iso_now();
  v_slot text;
  v_choice text;
  v_event jsonb;
  v_regs jsonb;
  v_existing jsonb;
  v_idx integer;
  v_reg jsonb;
  v_outcome text;
  v_change_id text;
begin
  s := private.join_settings(p_code);
  select data into m from public.members where id = p_member_id for update;
  if m is null or not coalesce((m ->> 'active')::boolean, false) then
    raise exception 'join:invalid_member' using errcode = 'P0001';
  end if;
  v_power := private.check_power(p_power);
  v_choices := private.parse_choices(p_choices);

  perform private.ensure_week_events();
  d := private.upcoming_friday();

  -- Lock both events (always A then B, so concurrent calls cannot deadlock) and check they are open.
  foreach v_slot in array array['A', 'B'] loop
    v_event := null;
    select data into v_event from public.events where id = private.event_id(d, v_slot) for update;
    if v_choices ->> v_slot <> 'none' and (v_event is null or v_event ->> 'status' <> 'registration') then
      raise exception 'join:closed' using errcode = 'P0001';
    end if;
  end loop;

  perform private.rate_limit('submit', p_member_id, 6, interval '10 minutes');

  foreach v_slot in array array['A', 'B'] loop
    v_choice := v_choices ->> v_slot;
    v_event := null;
    select data into v_event from public.events where id = private.event_id(d, v_slot);
    continue when v_event is null or v_event ->> 'status' <> 'registration';
    v_regs := coalesce(v_event -> 'registrations', '[]'::jsonb);
    v_existing := null;
    v_idx := null;
    select t.x, (t.ord - 1)::integer into v_existing, v_idx
    from jsonb_array_elements(v_regs) with ordinality as t(x, ord)
    where t.x ->> 'memberId' = p_member_id
    limit 1;

    if v_choice = 'none' then
      continue when v_existing is null or v_existing ->> 'source' <> 'self';
      v_regs := v_regs - v_idx;
    else
      v_reg := jsonb_build_object('memberId', p_member_id, 'source', 'self')
        || case when v_choice = 'sub' then '{"substituteOnly": true}'::jsonb else '{}'::jsonb end
        || jsonb_build_object('submittedAt', v_now, 'enteredPower', v_power);
      if v_existing is null then
        v_regs := v_regs || jsonb_build_array(v_reg);
      else
        v_regs := jsonb_set(v_regs, array[v_idx::text], v_reg);
      end if;
    end if;

    update public.events
    set data = v_event || jsonb_build_object('registrations', v_regs, 'updatedAt', v_now),
        version = version + 1
    where id = private.event_id(d, v_slot);
  end loop;

  -- Power rule (thresholds from the settings document, defaults 10 / 30).
  v_old := coalesce((m ->> 'power')::numeric, 0);
  if v_power = v_old then
    v_outcome := 'unchanged';
  elsif v_old <= 0
     or (v_power >= v_old * (1 - coalesce((s ->> 'powerDropTolerancePct')::numeric, 10) / 100)
         and v_power <= v_old * (1 + coalesce((s ->> 'powerRiseTolerancePct')::numeric, 30) / 100)) then
    v_outcome := 'applied';
  else
    v_outcome := 'pending';
  end if;

  if v_outcome = 'applied' then
    update public.members set data = data || jsonb_build_object('power', v_power, 'updatedAt', v_now) where id = p_member_id;
    v_change_id := gen_random_uuid()::text;
    insert into public.power_changes (id, data) values (v_change_id, jsonb_build_object(
      'id', v_change_id, 'memberId', p_member_id, 'oldPower', v_old, 'newPower', v_power,
      'source', 'self', 'status', 'applied', 'createdAt', v_now));
  elsif v_outcome = 'pending' then
    select id into v_change_id from public.power_changes
    where data ->> 'memberId' = p_member_id and data ->> 'status' = 'pending'
    order by data ->> 'createdAt' desc limit 1
    for update;
    if v_change_id is null then
      v_change_id := gen_random_uuid()::text;
      insert into public.power_changes (id, data) values (v_change_id, jsonb_build_object(
        'id', v_change_id, 'memberId', p_member_id, 'oldPower', v_old, 'newPower', v_power,
        'source', 'self', 'status', 'pending', 'createdAt', v_now));
    else
      update public.power_changes
      set data = data || jsonb_build_object('oldPower', v_old, 'newPower', v_power, 'source', 'self', 'createdAt', v_now)
      where id = v_change_id;
    end if;
  end if;

  return jsonb_build_object('power', v_outcome, 'choices', v_choices);
end $$;

-- "I'm not in the list": one pending request per normalised name and Friday (a repeat updates it).
-- Limits: name 2-32 characters, 3 requests per name per hour, 10 new requests per hour in total,
-- at most 30 pending requests.
create function public.join_request_unlisted(p_code text, p_name text, p_power numeric, p_choices jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_key text;
  v_power bigint;
  v_choices jsonb;
  v_week text := to_char(private.upcoming_friday(), 'YYYY-MM-DD');
  v_now text := private.iso_now();
  v_id text;
begin
  perform private.join_settings(p_code);
  v_key := private.normalise_name(v_name);
  if length(v_key) < 2 or length(v_name) > 32 then
    raise exception 'join:invalid_name' using errcode = 'P0001';
  end if;
  v_power := private.check_power(p_power);
  v_choices := private.parse_choices(p_choices);

  -- Serialise requests for the same name so two quick taps never create two rows.
  perform pg_advisory_xact_lock(hashtext('join_request:' || v_key));
  select id into v_id from public.join_requests
  where data ->> 'status' = 'pending' and data ->> 'normalisedName' = v_key and data ->> 'weekDate' = v_week
  limit 1;
  if v_id is null and (select count(*) from public.join_requests where data ->> 'status' = 'pending') >= 30 then
    raise exception 'join:too_many_requests' using errcode = 'P0001';
  end if;
  -- Global cap on NEW requests so made-up names cannot flood the leaders' list (limit 1 hour window).
  if v_id is null then
    perform private.rate_limit('request_all', 'all', 10, interval '1 hour');
  end if;
  perform private.rate_limit('request', v_key, 3, interval '1 hour');

  if v_id is null then
    v_id := gen_random_uuid()::text;
    insert into public.join_requests (id, data) values (v_id, jsonb_build_object(
      'id', v_id, 'status', 'pending', 'name', v_name, 'normalisedName', v_key, 'power', v_power,
      'choices', v_choices, 'weekDate', v_week, 'createdAt', v_now, 'updatedAt', v_now));
  else
    update public.join_requests
    set data = data || jsonb_build_object('name', v_name, 'power', v_power, 'choices', v_choices, 'updatedAt', v_now)
    where id = v_id;
  end if;
end $$;

revoke all on function public.ensure_week_events() from public;
revoke all on function public.join_get_roster(text) from public;
revoke all on function public.join_get_submission(text, text) from public;
revoke all on function public.join_submit(text, text, numeric, jsonb) from public;
revoke all on function public.join_request_unlisted(text, text, numeric, jsonb) from public;
grant execute on function public.ensure_week_events() to anon, authenticated;
grant execute on function public.join_get_roster(text) to anon, authenticated;
grant execute on function public.join_get_submission(text, text) to anon, authenticated;
grant execute on function public.join_submit(text, text, numeric, jsonb) to anon, authenticated;
grant execute on function public.join_request_unlisted(text, text, numeric, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Finalising now checks the suspension list it was computed from. With two events per
--    week, two R4s may finalise Team A and Team B at the same time; without this check the
--    second save would silently drop the first one's suspensions (and the once-per-week
--    countdown could run twice). SECURITY INVOKER: row-level security still applies.
-- ---------------------------------------------------------------------------
drop function public.finalise_event(text, jsonb, integer, jsonb);

create function public.finalise_event(p_id text, p_event jsonb, p_expected integer, p_suspensions jsonb, p_previous_suspensions jsonb) returns integer
language plpgsql set search_path = '' as $$
declare
  v integer;
  s jsonb;
begin
  lock table public.suspensions in share row exclusive mode;
  if (select coalesce(jsonb_agg(data order by id), '[]'::jsonb) from public.suspensions)
     is distinct from
     (select coalesce(jsonb_agg(x order by x ->> 'id'), '[]'::jsonb) from jsonb_array_elements(coalesce(p_previous_suspensions, '[]'::jsonb)) x) then
    raise exception 'conflict' using errcode = '40001';
  end if;

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
-- 6. The join code can only be changed through set_join_code(). A normal settings save (a
--    leader's page that is out of date, a backup restore...) can never re-enable, disable or
--    revert it: the trigger copies the stored code over whatever the client sent.
-- ---------------------------------------------------------------------------
create function public.settings_keep_join_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('app.join_code_write', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.data ? 'joinCode' then
    new.data := (new.data - 'joinCode') || jsonb_build_object('joinCode', old.data -> 'joinCode');
  else
    new.data := new.data - 'joinCode';
  end if;
  return new;
end $$;

create trigger settings_keep_join_code before insert or update on public.settings
  for each row execute function public.settings_keep_join_code();

-- Leaders only. Empty string disables the join page.
create function public.set_join_code(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v text := upper(btrim(coalesce(p_code, '')));
begin
  if not public.is_leader() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v <> '' and v !~ '^[A-Z0-9]{6,16}$' then
    raise exception 'invalid_code' using errcode = '22023';
  end if;
  perform set_config('app.join_code_write', 'on', true);
  insert into public.settings as st (id, data) values ('app', jsonb_build_object('joinCode', v))
  on conflict (id) do update set data = st.data || jsonb_build_object('joinCode', v);
  perform set_config('app.join_code_write', 'off', true);
end $$;

revoke all on function public.set_join_code(text) from public;
revoke all on function public.set_join_code(text) from anon;
grant execute on function public.set_join_code(text) to authenticated;

-- Create this week's events right away.
select private.ensure_week_events();

commit;
