-- SOUL DS Planner - 0003: players can sign up on the join page until Wednesday 22:00
-- (Paris time) before the Friday, even after a leader ran the selection.
--
-- Before: join_submit rejected any play/sub choice once the event left 'registration'
-- (i.e. as soon as an R4 ran the selection). Now an event is open for self-registration:
--   * always while its status is 'registration';
--   * while 'planned' (selection run, plan not published/locked) until Wednesday 22:00 Paris time.
-- The leaders see the late sign-ups ("Registrations changed since the selection") and re-run it.
-- Same rule as isOpenForSelfRegistration() in src/domain/join/joinRules.ts.
--
-- Not destructive. Run once, after 0002, in the Supabase dashboard:
-- SQL Editor -> New query -> paste -> Run. Everything runs in one transaction.

begin;

-- Is this event (events.data, may be null) open for self-registration right now?
create or replace function private.join_open(p_event jsonb) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(
    p_event ->> 'status' = 'registration'
    or (p_event ->> 'status' = 'planned'
        and (now() at time zone 'Europe/Paris') < ((p_event ->> 'date')::date - 2) + time '22:00'),
    false)
$$;

revoke all on function private.join_open(jsonb) from public;

-- Same as in 0002, plus 'open' per event so the join page shows the right state.
create or replace function public.join_get_roster(p_code text) returns jsonb
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
      select jsonb_agg(jsonb_build_object('id', e.id, 'slot', e.data ->> 'slot', 'date', e.data ->> 'date', 'status', e.data ->> 'status',
        'open', private.join_open(e.data)) order by e.id)
      from public.events e
      where e.id in (private.event_id(d, 'A'), private.event_id(d, 'B'))
    ), '[]'::jsonb)
  );
end $$;

-- Same as in 0002, with the open check replaced by private.join_open().
create or replace function public.join_submit(p_code text, p_member_id text, p_power numeric, p_choices jsonb) returns jsonb
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
    if v_choices ->> v_slot <> 'none' and not private.join_open(v_event) then
      raise exception 'join:closed' using errcode = 'P0001';
    end if;
  end loop;

  perform private.rate_limit('submit', p_member_id, 6, interval '10 minutes');

  foreach v_slot in array array['A', 'B'] loop
    v_choice := v_choices ->> v_slot;
    v_event := null;
    select data into v_event from public.events where id = private.event_id(d, v_slot);
    continue when not private.join_open(v_event);
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

commit;
