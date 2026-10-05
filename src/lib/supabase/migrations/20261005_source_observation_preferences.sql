-- Apply after 20261005_cloud_ingestion.sql. Preserves unknown after-hours calendar measurements.
begin;
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
revoke all on function public.import_wellness_snapshots(jsonb,timestamptz) from public,anon;
grant execute on function public.import_wellness_snapshots(jsonb,timestamptz) to authenticated;
commit;
