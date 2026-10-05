-- Apply after schema.sql with an administrative database connection.
-- Existing groups have no verified tenant and remain hidden until an administrator
-- assigns them. Existing metric rows remain unobserved until genuinely reimported.
begin;

-- Auth owns identity and role provisioning. Clients never insert their own profile
-- role, and a new verified account receives the private-row foreign-key target.
create or replace function public.sync_verified_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, email, full_name, role)
  values (new.id, coalesce(new.email, ''),
    coalesce(nullif(left(new.raw_user_meta_data->>'full_name', 200), ''), 'Team Member'),
    case when new.raw_app_meta_data->>'role' = 'hr' then 'hr' else 'employee' end)
  on conflict (id) do update set email = excluded.email, role = excluded.role;
  return new;
end;
$$;
revoke all on function public.sync_verified_profile() from public, anon, authenticated;
drop trigger if exists wellness_verified_profile on auth.users;
create trigger wellness_verified_profile after insert or update of email, raw_app_meta_data on auth.users
  for each row execute function public.sync_verified_profile();
insert into public.profiles(id, email, full_name, role)
select u.id, coalesce(u.email, ''),
  coalesce(nullif(left(u.raw_user_meta_data->>'full_name', 200), ''), 'Team Member'),
  case when u.raw_app_meta_data->>'role' = 'hr' then 'hr' else 'employee' end
from auth.users u on conflict (id) do nothing;

create schema if not exists wellness_private;
revoke all on schema wellness_private from public, anon;
grant usage on schema wellness_private to authenticated;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  created_at timestamptz not null default now()
);
create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('employee', 'hr')),
  active boolean not null default true,
  shares_aggregates boolean not null default false,
  primary key (organization_id, user_id)
);
alter table public.hr_groups add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.employee_daily_metrics add column if not exists observed_metrics text[] not null default '{}';
alter table public.employee_daily_metrics alter column working_hours set default 0;
alter table public.employee_daily_metrics alter column source set default 'imported';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'wellness_metric_bounds' and conrelid = 'public.employee_daily_metrics'::regclass) then
    alter table public.employee_daily_metrics add constraint wellness_metric_bounds check (
      working_hours between 0 and 24 and meeting_load between 0 and 24 and
      break_frequency between 0 and 1000 and break_frequency = trunc(break_frequency) and
      after_hours_activity between 0 and 1440 and
      observed_metrics <@ array['workingHours','meetingLoad','breakFrequency','afterHoursActivity']::text[]
    ) not valid;
  end if;
end; $$;

create or replace function wellness_private.is_employee()
returns boolean language sql stable set search_path = '' as $$
  select auth.uid() is not null and coalesce(auth.jwt()->'app_metadata'->>'role', 'employee') = 'employee';
$$;
create or replace function wellness_private.has_membership(tenant uuid, required_role text default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members m
    where m.organization_id = tenant and m.user_id = auth.uid() and m.active
    and (required_role is null or m.role = required_role)
    and (required_role is distinct from 'hr' or (auth.jwt()->'app_metadata'->>'role' = 'hr'
      and exists (select 1 from auth.users u where u.id = auth.uid() and u.raw_app_meta_data->>'role' = 'hr'))));
$$;
revoke all on function wellness_private.is_employee(), wellness_private.has_membership(uuid, text) from public, anon;
grant execute on function wellness_private.is_employee(), wellness_private.has_membership(uuid, text) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
drop policy if exists "Verified members view organizations" on public.organizations;
create policy "Verified members view organizations" on public.organizations for select to authenticated
  using (wellness_private.has_membership(id));
drop policy if exists "Verified memberships" on public.organization_members;
create policy "Verified memberships" on public.organization_members for select to authenticated
  using (user_id = auth.uid() or wellness_private.has_membership(organization_id, 'hr'));
drop policy if exists "Employee aggregate consent" on public.organization_members;
create policy "Employee aggregate consent" on public.organization_members for update to authenticated
  using (user_id = auth.uid() and role = 'employee' and active and wellness_private.is_employee())
  with check (user_id = auth.uid() and role = 'employee' and active and wellness_private.is_employee());
revoke all on public.organizations, public.organization_members from public, anon, authenticated;
grant select on public.organizations, public.organization_members to authenticated;
grant update (shares_aggregates) on public.organization_members to authenticated;

-- Profile role/email/ID cannot be changed through a user's database client.
revoke all on public.profiles from public, anon, authenticated;
grant select, update (full_name) on public.profiles to authenticated;
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Employees can read their own daily metrics" on public.employee_daily_metrics;
drop policy if exists "Employees can insert their own daily metrics" on public.employee_daily_metrics;
drop policy if exists "Employees can update their own daily metrics" on public.employee_daily_metrics;
create policy "Employees can read their own daily metrics" on public.employee_daily_metrics for select to authenticated
  using (employee_id = auth.uid() and wellness_private.is_employee());
create policy "Employees can insert their own daily metrics" on public.employee_daily_metrics for insert to authenticated
  with check (employee_id = auth.uid() and wellness_private.is_employee());
create policy "Employees can update their own daily metrics" on public.employee_daily_metrics for update to authenticated
  using (employee_id = auth.uid() and wellness_private.is_employee())
  with check (employee_id = auth.uid() and wellness_private.is_employee());
revoke all on public.employee_daily_metrics from public, anon, authenticated;
grant select, insert, update on public.employee_daily_metrics to authenticated;

drop policy if exists "HR can view groups" on public.hr_groups;
drop policy if exists "HR can manage groups" on public.hr_groups;
drop policy if exists "Verified HR view groups" on public.hr_groups;
create policy "Verified HR view groups" on public.hr_groups for select to authenticated
  using (wellness_private.has_membership(organization_id, 'hr'));
drop policy if exists "HR can view group memberships" on public.hr_group_members;
drop policy if exists "HR can manage group memberships" on public.hr_group_members;
drop policy if exists "Verified HR view group memberships" on public.hr_group_members;
create policy "Verified HR view group memberships" on public.hr_group_members for select to authenticated
  using (exists (select 1 from public.hr_groups g where g.id = group_id and wellness_private.has_membership(g.organization_id, 'hr')));
-- Cohorts are provisioned by a trusted administrator. Browser clients cannot alter
-- cohorts or write aggregate values to probe individuals through overlapping groups.
revoke all on public.hr_groups, public.hr_group_members, public.hr_group_observations from public, anon, authenticated;
grant select on public.hr_groups, public.hr_group_members to authenticated;
drop policy if exists "HR can view group observations for eligible groups" on public.hr_group_observations;
drop policy if exists "HR can insert group observations" on public.hr_group_observations;

-- No employee identifiers, personal scores or individual rows leave this function.
-- Thresholds count distinct consenting contributors with 28 prior observed dates
-- for that metric, not the total membership or a browser-supplied eligibility count.
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
commit;
