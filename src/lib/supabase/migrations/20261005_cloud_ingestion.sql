-- Apply after 20261004_tenant_privacy.sql. Private observations are owned by auth.uid().
-- All event receipts, interval unions, source snapshots and daily materializations
-- commit together. No service-role credential is required by the application.
begin;
create table if not exists wellness_private.telemetry_receipts (
  employee_id uuid not null references public.profiles(id) on delete cascade,
  source text not null, event_id text not null, observed_at timestamptz not null,
  payload jsonb not null, primary key (employee_id, source, event_id)
);
create index if not exists telemetry_receipt_age on wellness_private.telemetry_receipts(employee_id, observed_at);
create table if not exists wellness_private.telemetry_days (
  employee_id uuid not null references public.profiles(id) on delete cascade,
  date date not null, source text not null,
  active nummultirange not null default '{}', meetings nummultirange not null default '{}',
  after_hours nummultirange not null default '{}', breaks numeric[] not null default '{}',
  after_hours_observed boolean not null default true,
  last_heartbeat timestamptz not null, primary key (employee_id, date, source)
);
alter table wellness_private.telemetry_days add column if not exists after_hours_observed boolean not null default true;
create table if not exists wellness_private.observation_versions (
  employee_id uuid primary key references public.profiles(id) on delete cascade,
  revision bigint not null default 0
);
create table if not exists public.employee_metric_sources (
  employee_id uuid not null references public.profiles(id) on delete cascade,
  date date not null, source text not null, snapshot jsonb not null,
  captured_at timestamptz not null, primary key(employee_id,date,source)
);
alter table public.employee_metric_sources enable row level security;
drop policy if exists "Private employee source snapshots" on public.employee_metric_sources;
create policy "Private employee source snapshots" on public.employee_metric_sources for select to authenticated
  using (employee_id = auth.uid() and wellness_private.is_employee());
revoke all on public.employee_metric_sources from public, anon, authenticated;
grant select on public.employee_metric_sources to authenticated;
revoke all on wellness_private.telemetry_receipts, wellness_private.telemetry_days,
  wellness_private.observation_versions from public, anon, authenticated;
-- Only the validated RPCs can mutate derived metrics.
revoke insert, update, delete on public.employee_daily_metrics from public, anon, authenticated;
alter table public.employee_daily_metrics add column if not exists contributions jsonb not null default '{}';
alter table public.employee_daily_metrics add column if not exists tool_active_minutes jsonb not null default '{}';
alter table public.employee_daily_metrics add column if not exists github_event_count integer;
alter table public.employee_daily_metrics add column if not exists telemetry_revision bigint;
alter table public.employee_daily_metrics add column if not exists cloud_revision bigint;
alter table public.employee_daily_metrics add column if not exists last_heartbeat timestamptz;

create or replace function wellness_private.interval_seconds(intervals nummultirange)
returns numeric language sql immutable set search_path = '' as $$
  select coalesce(sum(upper(r)-lower(r)),0)/1000 from unnest(intervals) r;
$$;
create or replace function wellness_private.metric_json(d public.employee_daily_metrics)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('employeeId',d.employee_id,'date',d.date,'source',d.source,
    'workingHours',d.working_hours,'meetingLoad',d.meeting_load,'breakFrequency',d.break_frequency,
    'afterHoursActivity',d.after_hours_activity,'observedMetrics',d.observed_metrics,
    'contributions',d.contributions,'toolActiveMinutes',d.tool_active_minutes,
    'githubEventCount',d.github_event_count,'telemetryRevision',d.telemetry_revision,'cloudRevision',d.cloud_revision);
$$;
create or replace function wellness_private.next_revision(employee uuid)
returns bigint language sql volatile set search_path = '' as $$
  insert into wellness_private.observation_versions(employee_id,revision) values(employee,1)
  on conflict(employee_id) do update set revision=wellness_private.observation_versions.revision+1 returning revision;
$$;
create or replace function wellness_private.refresh_day(employee uuid, day date, revision bigint)
returns void language plpgsql set search_path = '' as $$
declare snapshots jsonb; observed text[]; telemetry jsonb; github jsonb; origin text;
begin
  select array_agg(distinct metric.name)
    into observed from public.employee_metric_sources s
    left join lateral jsonb_array_elements_text(s.snapshot->'observedMetrics') metric(name) on true
    where s.employee_id=employee and s.date=day;
  -- Aggregate separately: the lateral metric expansion must not duplicate sources.
  select jsonb_object_agg(s.source,s.snapshot) into snapshots from public.employee_metric_sources s where s.employee_id=employee and s.date=day;
  observed := array_remove(observed,null);
  telemetry := snapshots->'telemetry'; github := snapshots->'github';
  select s.source into origin from public.employee_metric_sources s where s.employee_id=employee and s.date=day
    order by (s.source='telemetry') desc,s.captured_at desc,s.source limit 1;
  insert into public.employee_daily_metrics(employee_id,date,source,working_hours,meeting_load,break_frequency,after_hours_activity,
    observed_metrics,contributions,tool_active_minutes,github_event_count,telemetry_revision,cloud_revision,last_heartbeat)
  select employee,day,origin,
    coalesce(max((s.snapshot->>'workingHours')::numeric) filter(where s.snapshot->'observedMetrics' ? 'workingHours'),0),
    coalesce(max((s.snapshot->>'meetingLoad')::numeric) filter(where s.snapshot->'observedMetrics' ? 'meetingLoad'),0),
    coalesce(max((s.snapshot->>'breakFrequency')::numeric) filter(where s.snapshot->'observedMetrics' ? 'breakFrequency'),0),
    coalesce(max((s.snapshot->>'afterHoursActivity')::numeric) filter(where s.snapshot->'observedMetrics' ? 'afterHoursActivity'),0),
    coalesce(observed,'{}'),coalesce(snapshots,'{}'),coalesce(telemetry->'toolActiveMinutes','{}'),
    (github->>'githubEventCount')::integer,(telemetry->>'telemetryRevision')::bigint,revision,(telemetry->>'lastHeartbeat')::timestamptz
  from public.employee_metric_sources s where s.employee_id=employee and s.date=day
  on conflict(employee_id,date) do update set source=excluded.source,working_hours=excluded.working_hours,meeting_load=excluded.meeting_load,
    break_frequency=excluded.break_frequency,after_hours_activity=excluded.after_hours_activity,observed_metrics=excluded.observed_metrics,
    contributions=excluded.contributions,tool_active_minutes=excluded.tool_active_minutes,github_event_count=excluded.github_event_count,
    telemetry_revision=excluded.telemetry_revision,cloud_revision=excluded.cloud_revision,last_heartbeat=excluded.last_heartbeat;
end; $$;
create or replace function public.get_employee_daily_metrics()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(wellness_private.metric_json(d) order by d.date),'[]') from public.employee_daily_metrics d
    where d.employee_id=auth.uid() and wellness_private.is_employee() and d.cloud_revision is not null;
$$;
create or replace function public.get_employee_observation_state()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dailyMetrics',public.get_employee_daily_metrics(),
    'stateRevision',coalesce((select v.revision from wellness_private.observation_versions v where v.employee_id=auth.uid() and wellness_private.is_employee()),0),
    'lastHeartbeat',(select max(d.last_heartbeat) from public.employee_daily_metrics d
      where d.employee_id=auth.uid() and wellness_private.is_employee()));
$$;

create or replace function public.record_wellness_heartbeat(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare employee uuid := auth.uid(); ending timestamptz; ending_ms numeric; active_seconds numeric; meeting_seconds numeric;
  origin text; receipt_id text; receipt jsonb; cursor_ms numeric; segment_end numeric; duration numeric;
  target text; day date; touched date[] := '{}'; revision bigint; snapshot jsonb; known text[]; tools jsonb; latest timestamptz;
begin
  if employee is null or not wellness_private.is_employee() then raise exception 'Employee access required' using errcode='42501'; end if;
  if jsonb_typeof(event) is distinct from 'object' or event->>'employeeId' is distinct from employee::text
    or event->>'organizationId' is distinct from 'personal:'||employee::text then raise exception 'Invalid observation ownership' using errcode='42501'; end if;
  if exists(select 1 from jsonb_object_keys(event) k where k not in ('eventId','employeeId','organizationId','timestamp','activeSeconds','meetingMinutes','isBreak','isEvening','afterHoursObserved','source'))
    or jsonb_typeof(event->'activeSeconds') is distinct from 'number' or jsonb_typeof(event->'meetingMinutes') is distinct from 'number'
    or jsonb_typeof(event->'isBreak') is distinct from 'boolean' or jsonb_typeof(event->'isEvening') is distinct from 'boolean'
    or (event ? 'afterHoursObserved' and jsonb_typeof(event->'afterHoursObserved') is distinct from 'boolean')
    or jsonb_typeof(event->'timestamp') is distinct from 'string' or jsonb_typeof(event->'source') is distinct from 'string'
    or jsonb_typeof(event->'eventId') is distinct from 'string' then raise exception 'Invalid observation metadata' using errcode='22023'; end if;
  origin := event->>'source'; receipt_id := event->>'eventId';
  if origin not in ('workstation','ide','calendar','presence','vscode','gemini','chatgpt','claude','figma','slack','discord','github')
    or receipt_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$'
    or event->>'timestamp' !~ '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,3})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$'
    then raise exception 'Invalid observation metadata' using errcode='22023'; end if;
  ending := (event->>'timestamp')::timestamptz; ending_ms := extract(epoch from ending)*1000;
  active_seconds := (event->>'activeSeconds')::numeric; meeting_seconds := (event->>'meetingMinutes')::numeric*60;
  if ending > now()+interval '5 minutes' or ending < now()-interval '35 days' or active_seconds not between 0 and 300
    or (not coalesce((event->>'afterHoursObserved')::boolean,true) and (event->>'isEvening')::boolean)
    or meeting_seconds not between 0 and 86400 or (origin<>'calendar' and meeting_seconds<>0)
    or (origin='calendar' and (active_seconds<>0 or (event->>'isBreak')::boolean))
    or (active_seconds=0 and meeting_seconds=0 and not (event->>'isBreak')::boolean)
    then raise exception 'Invalid observation duration or date' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('wellness:'||employee::text,0));
  select r.payload into receipt from wellness_private.telemetry_receipts r where r.employee_id=employee and r.source=origin and r.event_id=receipt_id;
  if receipt is not null and receipt<>event then raise exception 'Event ID conflicts with an existing observation' using errcode='23505'; end if;
  if receipt is null then
    insert into wellness_private.telemetry_receipts values(employee,origin,receipt_id,ending,event);
    revision := wellness_private.next_revision(employee);
  end if;
  foreach target in array array['active','meetings','after_hours'] loop
    duration := case target when 'active' then active_seconds when 'meetings' then meeting_seconds
      else case when (event->>'isEvening')::boolean then greatest(active_seconds,meeting_seconds) else 0 end end;
    cursor_ms := ending_ms-duration*1000;
    while cursor_ms<ending_ms loop
      day := date '1970-01-01'+floor(cursor_ms/86400000)::integer;
      segment_end := least(ending_ms,(floor(cursor_ms/86400000)+1)*86400000);
      if not day=any(touched) then touched := array_append(touched,day); end if;
      if receipt is null then
        insert into wellness_private.telemetry_days(employee_id,date,source,last_heartbeat,after_hours_observed)
          values(employee,day,origin,ending,coalesce((event->>'afterHoursObserved')::boolean,true))
          on conflict(employee_id,date,source) do nothing;
        update wellness_private.telemetry_days d set
          active=d.active+case when target='active' then nummultirange(numrange(cursor_ms,segment_end,'[)')) else '{}'::nummultirange end,
          meetings=d.meetings+case when target='meetings' then nummultirange(numrange(cursor_ms,segment_end,'[)')) else '{}'::nummultirange end,
          after_hours=d.after_hours+case when target='after_hours' then nummultirange(numrange(cursor_ms,segment_end,'[)')) else '{}'::nummultirange end,
          last_heartbeat=greatest(d.last_heartbeat,ending)
          ,after_hours_observed=d.after_hours_observed or coalesce((event->>'afterHoursObserved')::boolean,true)
          where d.employee_id=employee and d.date=day and d.source=origin;
      end if;
      cursor_ms := segment_end;
    end loop;
  end loop;
  if (event->>'isBreak')::boolean then
    day := (ending at time zone 'UTC')::date;
    if not day=any(touched) then touched := array_append(touched,day); end if;
    if receipt is null then
      insert into wellness_private.telemetry_days(employee_id,date,source,last_heartbeat,after_hours_observed)
        values(employee,day,origin,ending,coalesce((event->>'afterHoursObserved')::boolean,true))
        on conflict(employee_id,date,source) do nothing;
      update wellness_private.telemetry_days d set breaks=case when ending_ms=any(d.breaks) then d.breaks else array_append(d.breaks,ending_ms) end,
        last_heartbeat=greatest(d.last_heartbeat,ending),after_hours_observed=d.after_hours_observed or coalesce((event->>'afterHoursObserved')::boolean,true)
        where d.employee_id=employee and d.date=day and d.source=origin;
    end if;
  end if;
  if receipt is null then
    foreach day in array touched loop
      known := '{}';
      if exists(select 1 from wellness_private.telemetry_days d where d.employee_id=employee and d.date=day and d.after_hours_observed) then known := array_append(known,'afterHoursActivity'); end if;
      if exists(select 1 from wellness_private.telemetry_days d where d.employee_id=employee and d.date=day and d.active<>'{}'::nummultirange) then known := known||array['workingHours','breakFrequency']; end if;
      if exists(select 1 from wellness_private.telemetry_days d where d.employee_id=employee and d.date=day and cardinality(d.breaks)>0) and not 'breakFrequency'=any(known) then known := array_append(known,'breakFrequency'); end if;
      if exists(select 1 from wellness_private.telemetry_days d where d.employee_id=employee and d.date=day and d.meetings<>'{}'::nummultirange) then known := array_append(known,'meetingLoad'); end if;
      select coalesce(jsonb_object_agg(d.source,wellness_private.interval_seconds(d.active)/60),'{}') into tools
        from wellness_private.telemetry_days d where d.employee_id=employee and d.date=day and d.active<>'{}'::nummultirange;
      select max(d.last_heartbeat) into latest from wellness_private.telemetry_days d where d.employee_id=employee and d.date=day;
      select jsonb_build_object('workingHours',wellness_private.interval_seconds(coalesce(range_agg(d.active),'{}'))/3600,
        'meetingLoad',wellness_private.interval_seconds(coalesce(range_agg(d.meetings),'{}'))/3600,
        'afterHoursActivity',wellness_private.interval_seconds(coalesce(range_agg(d.after_hours),'{}'))/60,
        'breakFrequency',(select count(distinct b) from wellness_private.telemetry_days x cross join lateral unnest(x.breaks) b where x.employee_id=employee and x.date=day),
        'observedMetrics',known,'toolActiveMinutes',tools,'telemetryRevision',revision,'lastHeartbeat',latest)
      into snapshot from wellness_private.telemetry_days d where d.employee_id=employee and d.date=day;
      insert into public.employee_metric_sources values(employee,day,'telemetry',snapshot,now())
        on conflict(employee_id,date,source) do update set snapshot=excluded.snapshot,captured_at=excluded.captured_at;
      perform wellness_private.refresh_day(employee,day,revision);
    end loop;
    -- Raw receipts and interval ledgers are needed only for the accepted replay window.
    -- Derived daily observations remain available for personal baselines/history.
    delete from wellness_private.telemetry_receipts r where r.employee_id=employee and r.observed_at<now()-interval '35 days';
    delete from wellness_private.telemetry_days d where d.employee_id=employee and d.date<(now() at time zone 'UTC')::date-36;
  end if;
  return (select jsonb_build_object('dailyMetrics',coalesce(jsonb_agg(wellness_private.metric_json(d) order by d.date),'[]'),
    'lastHeartbeat',(select max(x.last_heartbeat) from public.employee_daily_metrics x where x.employee_id=employee))
    from public.employee_daily_metrics d where d.employee_id=employee and d.date=any(touched));
end; $$;
-- Complete source snapshots can correct cancelled calendar meetings. A stale
-- provider response cannot replace a newer snapshot; all rows commit atomically.
create or replace function public.import_wellness_snapshots(snapshots jsonb, captured_time timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare employee uuid := auth.uid(); item jsonb; snapshot jsonb; origin text; day date;
  touched date[] := '{}'; keys text[] := '{}'; key text; prior jsonb; prior_time timestamptz; revision bigint;
begin
  if employee is null or not wellness_private.is_employee() then raise exception 'Employee access required' using errcode='42501'; end if;
  if captured_time is null or captured_time>now()+interval '5 minutes' or captured_time<now()-interval '35 days'
    or jsonb_typeof(snapshots) is distinct from 'array' then raise exception 'Invalid snapshot batch' using errcode='22023'; end if;
  if jsonb_array_length(snapshots)>36 then raise exception 'Snapshot batch exceeds 36 dates' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('wellness:'||employee::text,0));
  for item in select value from jsonb_array_elements(snapshots) loop
    if jsonb_typeof(item) is distinct from 'object' or item->>'employeeId' is distinct from employee::text then
      raise exception 'Invalid observation ownership' using errcode='42501'; end if;
    if exists(select 1 from jsonb_object_keys(item) k where k not in ('employeeId','date','source','workingHours','meetingLoad','breakFrequency','afterHoursActivity','observedMetrics','githubEventCount'))
      or jsonb_typeof(item->'source') is distinct from 'string' or jsonb_typeof(item->'date') is distinct from 'string'
      or item->>'date' !~ '^\d{4}-\d{2}-\d{2}$'
      or jsonb_typeof(item->'workingHours') is distinct from 'number' or jsonb_typeof(item->'meetingLoad') is distinct from 'number'
      or jsonb_typeof(item->'breakFrequency') is distinct from 'number' or jsonb_typeof(item->'afterHoursActivity') is distinct from 'number'
      or jsonb_typeof(item->'observedMetrics') is distinct from 'array' then
      raise exception 'Invalid source metadata' using errcode='22023'; end if;
    origin := item->>'source'; day := (item->>'date')::date; key := day::text||':'||origin;
    if origin not in ('google_calendar','github') or key=any(keys) or day<(now() at time zone 'UTC')::date-35
      or day>(now() at time zone 'UTC')::date or (item->>'workingHours')::numeric<>0 or (item->>'breakFrequency')::numeric<>0
      or (item->>'meetingLoad')::numeric not between 0 and 24 or (item->>'afterHoursActivity')::numeric not between 0 and 1440 then
      raise exception 'Invalid source observation bounds' using errcode='22023'; end if;
    if origin='google_calendar' then
      if jsonb_array_length(item->'observedMetrics') not in (1,2) or not (item->'observedMetrics' ? 'meetingLoad')
        or exists(select 1 from jsonb_array_elements_text(item->'observedMetrics') metric where metric not in ('meetingLoad','afterHoursActivity'))
        or (jsonb_array_length(item->'observedMetrics')=2 and not (item->'observedMetrics' ? 'afterHoursActivity'))
        or (not (item->'observedMetrics' ? 'afterHoursActivity') and (item->>'afterHoursActivity')::numeric<>0)
        or item ? 'githubEventCount' then raise exception 'Calendar cannot infer work or breaks' using errcode='22023'; end if;
      snapshot := jsonb_build_object('workingHours',0,'meetingLoad',(item->>'meetingLoad')::numeric,'breakFrequency',0,
        'afterHoursActivity',(item->>'afterHoursActivity')::numeric,'observedMetrics',case when item->'observedMetrics' ? 'afterHoursActivity' then array['meetingLoad','afterHoursActivity'] else array['meetingLoad'] end);
    else
      if jsonb_array_length(item->'observedMetrics')<>0 or (item->>'meetingLoad')::numeric<>0 or (item->>'afterHoursActivity')::numeric<>0
        or jsonb_typeof(item->'githubEventCount') is distinct from 'number'
        or (item->>'githubEventCount')::numeric not between 0 and 1000000
        or trunc((item->>'githubEventCount')::numeric)<>(item->>'githubEventCount')::numeric then
        raise exception 'GitHub counts cannot infer duration' using errcode='22023'; end if;
      snapshot := jsonb_build_object('workingHours',0,'meetingLoad',0,'breakFrequency',0,'afterHoursActivity',0,
        'observedMetrics','[]'::jsonb,'githubEventCount',(item->>'githubEventCount')::integer);
    end if;
    keys := array_append(keys,key);
    if not day=any(touched) then touched := array_append(touched,day); end if;
    select s.snapshot,s.captured_at into prior,prior_time from public.employee_metric_sources s
      where s.employee_id=employee and s.date=day and s.source=origin;
    if prior_time=captured_time and prior<>snapshot then raise exception 'Snapshot conflicts with an existing capture' using errcode='23505'; end if;
    if prior_time is null or prior_time<captured_time then
      if revision is null then revision := wellness_private.next_revision(employee); end if;
      insert into public.employee_metric_sources values(employee,day,origin,snapshot,captured_time)
        on conflict(employee_id,date,source) do update set snapshot=excluded.snapshot,captured_at=excluded.captured_at;
      perform wellness_private.refresh_day(employee,day,revision);
    end if;
  end loop;
  return (select jsonb_build_object('dailyMetrics',coalesce(jsonb_agg(wellness_private.metric_json(d) order by d.date),'[]'),
    'lastHeartbeat',(select max(x.last_heartbeat) from public.employee_daily_metrics x where x.employee_id=employee))
    from public.employee_daily_metrics d where d.employee_id=employee and d.date=any(touched));
end; $$;
revoke all on function wellness_private.interval_seconds(nummultirange), wellness_private.metric_json(public.employee_daily_metrics),
  wellness_private.next_revision(uuid), wellness_private.refresh_day(uuid,date,bigint) from public,anon,authenticated;
revoke all on function public.get_employee_daily_metrics(), public.get_employee_observation_state(), public.record_wellness_heartbeat(jsonb), public.import_wellness_snapshots(jsonb,timestamptz) from public,anon;
grant execute on function public.get_employee_daily_metrics(), public.get_employee_observation_state(), public.record_wellness_heartbeat(jsonb), public.import_wellness_snapshots(jsonb,timestamptz) to authenticated;
commit;
