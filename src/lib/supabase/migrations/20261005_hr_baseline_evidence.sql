-- Apply after 20261004_tenant_privacy.sql, including on existing installations.
-- Legacy NOT VALID constraints cannot prove calibration evidence is admissible.
begin;
create or replace function public.get_hr_group_observations()
returns table (organization_id uuid, group_id uuid, group_name text, date date,
  working_hours numeric, meeting_load numeric, break_frequency numeric, after_hours_activity numeric)
language sql stable security definer set search_path = '' as $$
  with authorized_groups as (
    select g.id, g.organization_id, g.name from public.hr_groups g
    where wellness_private.has_membership(g.organization_id, 'hr')
  ), consenting_members as (
    select g.organization_id, g.id group_id, g.name group_name, gm.employee_id
    from authorized_groups g
    join public.hr_group_members gm on gm.group_id = g.id
    join public.organization_members member on member.organization_id = g.organization_id
      and member.user_id = gm.employee_id and member.role = 'employee' and member.active and member.shares_aggregates
  ), valid_observations as (
    select d.employee_id, d.date,
      metric.name, metric.value
    from public.employee_daily_metrics d
    cross join lateral (values
      ('workingHours', d.working_hours), ('meetingLoad', d.meeting_load),
      ('breakFrequency', d.break_frequency), ('afterHoursActivity', d.after_hours_activity)
    ) metric(name, value)
    where d.date >= (now() at time zone 'UTC')::date - 90 and d.date < (now() at time zone 'UTC')::date
      and exists (select 1 from consenting_members member where member.employee_id = d.employee_id)
      and d.source <> 'demo' and metric.name = any(d.observed_metrics)
      and metric.value >= 0 and metric.value <> 'NaN'::numeric
      and metric.value <= case when metric.name in ('workingHours', 'meetingLoad') then 24
        when metric.name = 'afterHoursActivity' then 1440 else 1000 end
      and (metric.name <> 'breakFrequency' or metric.value = trunc(metric.value))
  ), calibrated as (
    -- employee_daily_metrics has a unique (employee_id, date) key. Count only
    -- earlier admissible dates for this employee/metric, never the release date.
    select v.*, count(*) over (partition by v.employee_id, v.name order by v.date
      rows between unbounded preceding and 1 preceding) prior_days
    from valid_observations v
  ), measurements as (
    select member.organization_id, member.group_id, member.group_name,
      v.employee_id, v.date, v.name, v.value
    from consenting_members member join calibrated v on v.employee_id = member.employee_id
    where v.prior_days >= 28
  ), released as (
    select m.organization_id, m.group_id, m.group_name, m.date, m.name,
      round(avg(m.value), 2) value
    from measurements m
    group by m.organization_id, m.group_id, m.group_name, m.date, m.name
    having count(distinct m.employee_id) >= 3
  )
  select r.organization_id, r.group_id, r.group_name, r.date,
    max(r.value) filter (where r.name = 'workingHours'),
    max(r.value) filter (where r.name = 'meetingLoad'),
    max(r.value) filter (where r.name = 'breakFrequency'),
    max(r.value) filter (where r.name = 'afterHoursActivity')
  from released r group by r.organization_id, r.group_id, r.group_name, r.date;
$$;
revoke all on function public.get_hr_group_observations() from public, anon;
grant execute on function public.get_hr_group_observations() to authenticated;
commit;
