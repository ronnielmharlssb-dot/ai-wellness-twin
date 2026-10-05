-- AI Wellness Twin base tables. Apply migrations/20261004_tenant_privacy.sql next.
-- The base schema denies browser access until the verified-tenant migration is applied.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('employee', 'hr')),
  created_at timestamptz default now()
);

create table if not exists public.employee_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  source text not null default 'imported',
  working_hours numeric not null default 0,
  meeting_load numeric not null default 0,
  break_frequency numeric not null default 0,
  after_hours_activity numeric not null default 0,
  observed_metrics text[] not null default '{}',
  created_at timestamptz default now(),
  unique (employee_id, date)
);

create table if not exists public.hr_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.hr_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.hr_groups(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (group_id, employee_id)
);

-- Legacy aggregate storage is retained for migration compatibility. The new HR
-- function computes releases from consenting contributors; clients cannot use this table.
create table if not exists public.hr_group_observations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.hr_groups(id) on delete cascade,
  date date not null,
  source text not null default 'imported',
  after_hours_activity numeric not null default 0,
  meeting_load numeric not null default 0,
  work_pattern_shift numeric not null default 0,
  created_at timestamptz default now(),
  unique (group_id, date)
);

alter table public.profiles enable row level security;
alter table public.employee_daily_metrics enable row level security;
alter table public.hr_groups enable row level security;
alter table public.hr_group_members enable row level security;
alter table public.hr_group_observations enable row level security;
revoke all on public.profiles, public.employee_daily_metrics, public.hr_groups,
  public.hr_group_members, public.hr_group_observations from public, anon, authenticated;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles for select to authenticated using (id = auth.uid());
