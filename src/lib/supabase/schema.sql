-- ==============================================================================
-- AI WELLNESS TWIN — POSTGRESQL & ROW-LEVEL SECURITY (RLS) SCHEMA
-- ==============================================================================

-- 1. Profiles Table (Extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('employee', 'hr')),
  created_at timestamp with time zone default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. Employee Daily Metrics Table (Private to Employee)
create table if not exists public.employee_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  source text not null default 'demo',
  working_hours numeric not null default 8,
  meeting_load numeric not null default 0,
  break_frequency numeric not null default 0,
  after_hours_activity numeric not null default 0,
  created_at timestamp with time zone default now(),
  unique (employee_id, date)
);

-- Enable RLS on employee_daily_metrics (Strictly private)
alter table public.employee_daily_metrics enable row level security;

create policy "Employees can read their own daily metrics"
  on public.employee_daily_metrics for select
  using (auth.uid() = employee_id);

create policy "Employees can insert their own daily metrics"
  on public.employee_daily_metrics for insert
  with check (auth.uid() = employee_id);

create policy "Employees can update their own daily metrics"
  on public.employee_daily_metrics for update
  using (auth.uid() = employee_id);

-- 3. HR Groups Table
create table if not exists public.hr_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- Enable RLS on hr_groups
alter table public.hr_groups enable row level security;

create policy "HR can view groups"
  on public.hr_groups for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'hr'
    )
  );

create policy "HR can manage groups"
  on public.hr_groups for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'hr'
    )
  );

-- 4. HR Group Members Junction Table
create table if not exists public.hr_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.hr_groups(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique (group_id, employee_id)
);

-- Enable RLS on hr_group_members
alter table public.hr_group_members enable row level security;

create policy "HR can view group memberships"
  on public.hr_group_members for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'hr'
    )
  );

create policy "HR can manage group memberships"
  on public.hr_group_members for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'hr'
    )
  );

-- 5. HR Group Observations Table (Aggregates with k-Anonymity)
create table if not exists public.hr_group_observations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.hr_groups(id) on delete cascade,
  date date not null,
  source text not null default 'imported',
  after_hours_activity numeric not null default 0,
  meeting_load numeric not null default 0,
  work_pattern_shift numeric not null default 0,
  created_at timestamp with time zone default now(),
  unique (group_id, date)
);

-- Enable RLS on hr_group_observations
alter table public.hr_group_observations enable row level security;

-- Enforce k-anonymity (>= 3 members) for viewing group observations
create policy "HR can view group observations for eligible groups"
  on public.hr_group_observations for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'hr'
    )
    and (
      select count(*) from public.hr_group_members
      where hr_group_members.group_id = hr_group_observations.group_id
    ) >= 3
  );

create policy "HR can insert group observations"
  on public.hr_group_observations for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'hr'
    )
  );
