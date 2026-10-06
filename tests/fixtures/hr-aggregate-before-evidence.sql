-- Previous aggregate contract retained solely for real PostgreSQL upgrade tests.
create or replace function public.get_hr_group_observations()
returns table (organization_id uuid, group_id uuid, group_name text, date date,
  working_hours numeric, meeting_load numeric, break_frequency numeric, after_hours_activity numeric)
language sql stable security definer set search_path = '' as $$
  with authorized_groups as (
    select g.id, g.organization_id, g.name from public.hr_groups g
    where wellness_private.has_membership(g.organization_id, 'hr')
  ), measurements as (
    select g.organization_id, g.id group_id, g.name group_name, d.employee_id, d.date,
      metric.name, metric.value
    from authorized_groups g
    join public.hr_group_members gm on gm.group_id = g.id
    join public.organization_members member on member.organization_id = g.organization_id
      and member.user_id = gm.employee_id and member.role = 'employee' and member.active and member.shares_aggregates
    join public.employee_daily_metrics d on d.employee_id = gm.employee_id
    cross join lateral (values
      ('workingHours', d.working_hours), ('meetingLoad', d.meeting_load),
      ('breakFrequency', d.break_frequency), ('afterHoursActivity', d.after_hours_activity)
    ) metric(name, value)
    where d.date >= (now() at time zone 'UTC')::date - 90 and d.date < (now() at time zone 'UTC')::date
      and d.source <> 'demo' and metric.name = any(d.observed_metrics)
      and metric.value >= 0 and metric.value <> 'NaN'::numeric
      and metric.value <= case when metric.name in ('workingHours', 'meetingLoad') then 24
        when metric.name = 'afterHoursActivity' then 1440 else 1000 end
      and (select count(distinct prior.date) from public.employee_daily_metrics prior
        where prior.employee_id = d.employee_id and prior.date < d.date and prior.source <> 'demo'
          and metric.name = any(prior.observed_metrics)) >= 28
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
