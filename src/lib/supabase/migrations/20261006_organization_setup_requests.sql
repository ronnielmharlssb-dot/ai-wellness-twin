-- Apply after the tenant-privacy migration using an administrative connection.
-- This records requests only. It never establishes domain ownership or HR authority.
begin;
create table if not exists public.organization_setup_requests (
  id uuid primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  contact_email text not null,
  company_name text not null check (char_length(btrim(company_name)) between 1 and 200 and company_name !~ '[[:cntrl:]]'),
  domain text not null check (char_length(domain) between 3 and 253 and domain = lower(domain)
    and domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
    and regexp_replace(domain, '^.*[.]', '') ~ '[a-z]'),
  team_size text not null check (team_size in ('1-10','10-50','50-200','200-1000','1000+')),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  organization_id uuid references public.organizations(id) on delete restrict,
  check ((status = 'pending' and reviewed_at is null and organization_id is null)
    or (status = 'declined' and reviewed_at is not null and organization_id is null)
    or (status = 'approved' and reviewed_at is not null and organization_id is not null))
);
create unique index if not exists wellness_one_pending_organization_request
  on public.organization_setup_requests(requester_id) where status = 'pending';
create index if not exists wellness_organization_request_history
  on public.organization_setup_requests(requester_id, created_at desc);
alter table public.organization_setup_requests enable row level security;
revoke all on public.organization_setup_requests from public, anon, authenticated;
grant select on public.organization_setup_requests to authenticated;
drop policy if exists "Own organization setup requests" on public.organization_setup_requests;
create policy "Own organization setup requests" on public.organization_setup_requests
  for select to authenticated using (requester_id = auth.uid());

create or replace function public.submit_organization_setup_request(
  p_request_id uuid, p_company_name text, p_domain text, p_team_size text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  verified_email text;
  clean_name text := btrim(p_company_name);
  clean_domain text := lower(btrim(p_domain));
  existing public.organization_setup_requests%rowtype;
begin
  select u.email into verified_email from auth.users u
    where u.id = actor and u.email_confirmed_at is not null and coalesce(u.email, '') <> '';
  if actor is null or verified_email is null then
    raise exception 'A verified account is required.' using errcode = '42501';
  end if;
  if p_request_id is null or clean_name is null or char_length(clean_name) not between 1 and 200 or clean_name ~ '[[:cntrl:]]'
    or clean_domain is null or char_length(clean_domain) not between 3 and 253
    or clean_domain !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
    or regexp_replace(clean_domain, '^.*[.]', '') !~ '[a-z]'
    or p_team_size is null or p_team_size not in ('1-10','10-50','50-200','200-1000','1000+') then
    raise exception 'Invalid organization request.' using errcode = '22023';
  end if;
  -- Serialize one account's requests. Replays retain the exact original receipt.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('organization-setup:' || actor::text, 0));
  select * into existing from public.organization_setup_requests r where r.id = p_request_id;
  if found then
    if existing.requester_id <> actor or existing.company_name <> clean_name
      or existing.domain <> clean_domain or existing.team_size <> p_team_size then
      raise exception 'Request conflict.' using errcode = '23505';
    end if;
    return to_jsonb(existing);
  end if;
  insert into public.organization_setup_requests(id, requester_id, contact_email, company_name, domain, team_size)
    values(p_request_id, actor, verified_email, clean_name, clean_domain, p_team_size) returning * into existing;
  return to_jsonb(existing);
end;
$$;
revoke all on function public.submit_organization_setup_request(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_organization_setup_request(uuid,text,text,text) to authenticated;
commit;
