const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const names = ["workingHours", "meetingLoad", "breakFrequency", "afterHoursActivity"];

test("HR calibration requires valid metric evidence within the last 90 closed UTC dates", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb; $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid; $$;
    grant usage on schema auth to anon,authenticated;`);
  await db.exec(fs.readFileSync("src/lib/supabase/schema.sql", "utf8"));
  const employees = [id(3), id(4), ...[5,6,7,8,9,10,11].map(id)];
  for (const employee of [id(1), ...employees]) {
    await db.query("insert into auth.users(id,raw_app_meta_data) values($1,$2)", [employee, JSON.stringify({ role: employee === id(1) ? "hr" : "employee" })]);
    await db.query("insert into public.profiles(id,email,full_name,role) values($1,'test@example.com','Test','employee')", [employee]);
  }
  async function day(employee, age, values = [8,2,4,30], observed = names, source = "telemetry") {
    await db.query(`insert into public.employee_daily_metrics(employee_id,date,source,working_hours,meeting_load,break_frequency,after_hours_activity,observed_metrics)
      values($1,(now() at time zone 'UTC')::date-$2::integer,$3,$4,$5,$6,$7,$8)`, [employee, age, source, ...values, observed]);
  }
  // Existing installations can contain invalid rows predating the NOT VALID constraint.
  for (const employee of employees) {
    await day(employee, 1);
    for (let age = 2; age <= 29; age++) {
      if (employee === id(5)) await day(employee, age + 90); // stale calibration
      else if (employee === id(6) && age === 2) await day(employee, age, ["NaN", "Infinity", 2.5, 1441]);
      else if (employee === id(7) && age === 2) await day(employee, age, [8,2,4,30], []);
      else if (employee === id(8) && age === 2) await day(employee, age, [8,2,4,30], names, "demo");
      else if (employee === id(9) && age === 2) await day(employee, 91);
      else if (employee === id(11) && age === 2) await day(employee, age, [-1,-1,-1,-1]);
      else await day(employee, age, age === 2 ? [0,0,0,0] : undefined);
    }
  }
  await day(id(7), 0); await day(id(7), -1); // unfinished/future rows cannot replace unknown evidence
  await db.exec(fs.readFileSync("src/lib/supabase/migrations/20261004_tenant_privacy.sql", "utf8"));
  await db.query("insert into public.organizations(id,name) values($1,'Verified')", [id(20)]);
  for (const employee of [id(1), ...employees]) {
    await db.query("insert into public.organization_members(organization_id,user_id,role,shares_aggregates) values($1,$2,$3,true)", [id(20), employee, employee === id(1) ? "hr" : "employee"]);
  }
  const groups = new Map();
  for (const n of [5,6,7,8,9,10,11]) {
    groups.set(n, id(30 + n));
    await db.query("insert into public.hr_groups(id,name,organization_id) values($1,$2,$3)", [groups.get(n), "Cohort " + n, id(20)]);
    for (const employee of [id(3), id(4), id(n)]) await db.query("insert into public.hr_group_members(group_id,employee_id) values($1,$2)", [groups.get(n), employee]);
  }
  async function observations() {
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id(1), app_metadata: { role: "hr" } })]);
    await db.exec("set role authenticated");
    try { return (await db.query("select * from public.get_hr_group_observations() where date=(now() at time zone 'UTC')::date-1")).rows; }
    finally { await db.exec("reset role"); }
  }
  // The fresh installation uses the same corrected gate.
  assert.deepEqual((await observations()).map(row => row.group_id), [groups.get(10)]);
  await db.exec(fs.readFileSync("tests/fixtures/hr-aggregate-before-evidence.sql", "utf8"));
  const legacy = new Set((await observations()).map(row => row.group_id));
  for (const n of [5,6,9,11]) assert.ok(legacy.has(groups.get(n)), "Prior contract exposes inadmissible calibration evidence");
  const upgrade = fs.readFileSync("src/lib/supabase/migrations/20261005_hr_baseline_evidence.sql", "utf8");
  await db.exec(upgrade);
  await db.exec(upgrade); // The existing-installation upgrade is idempotent.
  const released = await observations();
  assert.deepEqual(released.map(row => row.group_id), [groups.get(10)]);
  assert.equal(Number(released[0].working_hours), 8);
  assert.equal(Number(released[0].meeting_load), 2);
  assert.equal(Number(released[0].break_frequency), 4);
  assert.equal(Number(released[0].after_hours_activity), 30);

  // Exactly 90 dates back is admissible; 91 is outside the current evidence window.
  await day(id(9), 90);
  assert.deepEqual(new Set((await observations()).map(row => row.group_id)), new Set([groups.get(9), groups.get(10)]));
  // One repaired metric may qualify without releasing the still-invalid others.
  await db.query("update public.employee_daily_metrics set working_hours=8,meeting_load=2,break_frequency=4,after_hours_activity=30,observed_metrics=array['workingHours'] where employee_id=$1 and date=(now() at time zone 'UTC')::date-2", [id(6)]);
  const partial = (await observations()).find(row => row.group_id === groups.get(6));
  assert.equal(Number(partial.working_hours), 8);
  assert.equal(partial.meeting_load, null);
  assert.equal(partial.break_frequency, null);
  assert.equal(partial.after_hours_activity, null);
  assert.equal(JSON.stringify(await observations()).includes(id(6)), false);
});
