const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");

const id = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const HR_A = id(1), HR_B = id(2), EMPLOYEES_A = [id(3), id(4), id(5)], EMPLOYEES_B = [id(6), id(7), id(8)];
const ORG_A = id(20), ORG_B = id(21), GROUP_A = id(30), GROUP_B = id(31), LEGACY_GROUP = id(32);
const migration = fs.readFileSync("src/lib/supabase/migrations/20261004_tenant_privacy.sql", "utf8");

test("database privacy policies enforce role authority, tenant membership and per-metric contributor thresholds", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
    $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid; $$;
    grant usage on schema auth to anon, authenticated;
  `);
  await db.exec(fs.readFileSync("src/lib/supabase/schema.sql", "utf8"));
  await db.exec("set role authenticated");
  await assert.rejects(() => db.query("select * from public.hr_groups"), /permission denied/);
  await assert.rejects(() => db.query("update public.profiles set role='hr'"), /permission denied/);
  await db.exec("reset role");
  for (const userId of [HR_A, HR_B, ...EMPLOYEES_A, ...EMPLOYEES_B]) {
    await db.query("insert into auth.users(id,raw_app_meta_data) values ($1,$2)", [userId, JSON.stringify({ role: [HR_A, HR_B].includes(userId) ? "hr" : "employee" })]);
    // Deliberately poison the legacy employee profile role to prove it is no longer authority.
    await db.query("insert into public.profiles(id,email,full_name,role) values($1,$2,'Test person','hr')", [userId, userId + "@example.com"]);
  }
  await db.query("insert into public.hr_groups(id,name) values ($1,'Unverified legacy group')", [LEGACY_GROUP]);
  // Recreate the old vulnerable grants/policies before exercising the upgrade.
  await db.exec(`
    create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);
    create policy "HR can manage groups" on public.hr_groups for all using (
      exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='hr')
    );
    -- The deployed legacy schema also used these HR/manager policy names.
    -- PostgreSQL combines permissive policies with OR, so they must be removed.
    create policy "HR and Managers can view groups" on public.hr_groups for select using (
      exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('hr','manager'))
    );
    create policy "HR and Managers can manage groups" on public.hr_groups for all using (
      exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('hr','manager'))
    );
    create policy "HR and Managers can view group memberships" on public.hr_group_members for select using (
      exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('hr','manager'))
    );
    create policy "HR and Managers can manage group memberships" on public.hr_group_members for all using (
      exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('hr','manager'))
    );
    create policy "HR and Managers can view group observations for eligible groups" on public.hr_group_observations for select using (
      exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('hr','manager'))
    );
    create policy "HR and Managers can insert group observations" on public.hr_group_observations for insert with check (
      exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('hr','manager'))
    );
    grant all on public.profiles, public.employee_daily_metrics, public.hr_groups,
      public.hr_group_members, public.hr_group_observations to authenticated;
  `);
  await db.exec(migration);
  await db.exec(migration); // Safe to reapply to a migrated installation.
  assert.equal((await db.query("select count(*)::integer remaining from pg_policies where schemaname='public' and policyname like 'HR and Managers%'")).rows[0].remaining, 0);
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'new@example.com',$2)", [id(99), JSON.stringify({ full_name: "New account", role: "hr" })]);
  const newProfile = (await db.query("select role, full_name from public.profiles where id=$1", [id(99)])).rows[0];
  assert.equal(newProfile.role, "employee");
  assert.equal(newProfile.full_name, "New account");
  await db.query("insert into public.organizations(id,name) values ($1,'Tenant A'),($2,'Tenant B')", [ORG_A, ORG_B]);
  for (const [organization, hr, members] of [[ORG_A, HR_A, EMPLOYEES_A], [ORG_B, HR_B, EMPLOYEES_B]]) {
    await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'hr')", [organization, hr]);
    for (const member of members) {
      await db.query("insert into public.organization_members(organization_id,user_id,role,shares_aggregates) values($1,$2,'employee',true)", [organization, member]);
      await db.query(`insert into public.employee_daily_metrics(employee_id,date,source,working_hours,meeting_load,break_frequency,after_hours_activity,observed_metrics)
        select $1,(now() at time zone 'UTC')::date - 1 - n,'telemetry',8,2,4,30,array['workingHours','meetingLoad','breakFrequency','afterHoursActivity']
        from generate_series(0,28) n`, [member]);
    }
  }
  await db.query("insert into public.hr_groups(id,name,organization_id) values ($1,'Team A',$2),($3,'Team B',$4)", [GROUP_A, ORG_A, GROUP_B, ORG_B]);
  for (const [group, members] of [[GROUP_A, EMPLOYEES_A], [GROUP_B, EMPLOYEES_B]]) {
    for (const member of members) await db.query("insert into public.hr_group_members(group_id,employee_id) values($1,$2)", [group, member]);
  }
  async function asUser(userId, role = "employee", databaseRole = "authenticated") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: userId, app_metadata: { role }, user_metadata: { role: "hr" } })]);
    await db.exec(databaseRole === "anon" ? "set role anon" : "set role authenticated");
  }
  const observations = async () => (await db.query("select * from public.get_hr_group_observations() order by date")).rows;

  await t.test("a profile role or user-editable claim cannot grant HR access", async () => {
    await asUser(EMPLOYEES_A[0]);
    assert.deepEqual((await db.query("select * from public.hr_groups")).rows, []);
    assert.deepEqual(await observations(), []);
    await assert.rejects(() => db.query("update public.profiles set role='hr' where id=$1", [EMPLOYEES_A[0]]), /permission denied/);
    await assert.rejects(() => db.query("update public.organization_members set role='hr' where user_id=$1", [EMPLOYEES_A[0]]), /permission denied/);
    await db.query("update public.profiles set full_name='Renamed' where id=$1", [EMPLOYEES_A[0]]);
  });
  await t.test("employees read only their own rows and cannot move observations to another account", async () => {
    await asUser(EMPLOYEES_A[0]);
    const rows = (await db.query("select employee_id from public.employee_daily_metrics")).rows;
    assert.equal(rows.length, 29);
    assert.equal(rows.every((row) => row.employee_id === EMPLOYEES_A[0]), true);
    await assert.rejects(() => db.query("update public.employee_daily_metrics set employee_id=$1", [EMPLOYEES_A[1]]), /row-level security/);
    await assert.rejects(() => db.query("update public.employee_daily_metrics set working_hours='NaN'::numeric"), /wellness_metric_bounds/);
    await assert.rejects(() => db.query("update public.employee_daily_metrics set observed_metrics=array['inventedMetric']"), /wellness_metric_bounds/);
  });
  await t.test("HR can read only its verified tenant and receives no individual identifiers", async () => {
    await asUser(HR_A, "hr");
    assert.deepEqual((await db.query("select id from public.hr_groups")).rows.map((row) => row.id), [GROUP_A]);
    assert.deepEqual((await db.query("select * from public.employee_daily_metrics")).rows, []);
    const rows = await observations();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].group_id, GROUP_A);
    assert.equal(Number(rows[0].working_hours), 8);
    assert.equal(Number(rows[0].meeting_load), 2);
    assert.equal(JSON.stringify(rows).includes("employee_id"), false);
    assert.equal(JSON.stringify(rows).includes(EMPLOYEES_A[0]), false);
    await assert.rejects(() => db.query("insert into public.hr_group_members(group_id,employee_id) values($1,$2)", [GROUP_A, EMPLOYEES_B[0]]), /permission denied/);
    await assert.rejects(() => db.query("insert into public.hr_group_observations(group_id,date) values($1,current_date)", [GROUP_A]), /permission denied/);
  });
  await t.test("three memberships cannot release a metric with only two calibrated contributors", async () => {
    await db.exec("reset role");
    await db.query("update public.employee_daily_metrics set observed_metrics=array['workingHours','breakFrequency','afterHoursActivity'] where employee_id=$1 and date=(now() at time zone 'UTC')::date-2", [EMPLOYEES_A[2]]);
    await asUser(HR_A, "hr");
    const rows = await observations();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].meeting_load, null);
    assert.equal(Number(rows[0].working_hours), 8);
  });
  await t.test("revoked aggregate consent immediately suppresses the cohort", async () => {
    await asUser(EMPLOYEES_A[2]);
    await db.query("update public.organization_members set shares_aggregates=false where user_id=$1", [EMPLOYEES_A[2]]);
    await asUser(HR_A, "hr");
    assert.deepEqual(await observations(), []);
  });
  await t.test("HR role alone cannot cross tenants and revoked membership takes effect immediately", async () => {
    await asUser(HR_B, "hr");
    assert.equal((await observations())[0].group_id, GROUP_B);
    await db.exec("reset role");
    await db.query("update public.organization_members set active=false where user_id=$1", [HR_B]);
    await asUser(HR_B, "hr");
    assert.deepEqual(await observations(), []);
  });
  await t.test("a stale HR token cannot override a freshly revoked server role", async () => {
    await db.exec("reset role");
    await db.query("update auth.users set raw_app_meta_data='{}'::jsonb where id=$1", [HR_A]);
    await asUser(HR_A, "hr");
    assert.deepEqual(await observations(), []);
    assert.deepEqual((await db.query("select * from public.hr_groups")).rows, []);
  });
  await t.test("anonymous clients cannot read personal rows or call the aggregate function", async () => {
    await asUser(null, "employee", "anon");
    await assert.rejects(() => db.query("select * from public.employee_daily_metrics"), /permission denied/);
    await assert.rejects(observations, /permission denied/);
  });
});
