const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const A = '00000000-0000-4000-8000-000000000001', B = '00000000-0000-4000-8000-000000000002';

test('cloud ingestion commits private, replay-safe observations and unions actual intervals', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb; $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid; $$;
    grant usage on schema auth to anon,authenticated;`);
  for (const file of ['schema.sql','migrations/20261004_tenant_privacy.sql','migrations/20261005_cloud_ingestion.sql']) {
    await db.exec(fs.readFileSync('src/lib/supabase/' + file,'utf8'));
  }
  await db.exec(fs.readFileSync('src/lib/supabase/migrations/20261005_cloud_ingestion.sql','utf8'));
  await db.exec(fs.readFileSync('src/lib/supabase/migrations/20261005_source_observation_preferences.sql','utf8'));
  await db.exec(fs.readFileSync('src/lib/supabase/migrations/20261005_source_observation_preferences.sql','utf8'));
  await db.query('insert into auth.users(id) values($1),($2)',[A,B]);
  async function asUser(id,role='employee',dbRole='authenticated') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,app_metadata:{role}})]);
    await db.exec('set role ' + dbRole);
  }
  const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
  const packet = overrides => ({eventId:randomUUID(),employeeId:A,organizationId:'personal:'+A,
    timestamp:yesterday+'T10:00:00.000Z',activeSeconds:45,meetingMinutes:0,isBreak:false,isEvening:false,source:'workstation',...overrides});
  const ingest = async p => (await db.query('select public.record_wellness_heartbeat($1::jsonb) result',[JSON.stringify(p)])).rows[0].result.dailyMetrics;
  const history = async () => (await db.query('select public.get_employee_daily_metrics() result')).rows[0].result;
  await asUser(A);
  await t.test('one hour stays one hour; duplicate IDs never add time and changed retries conflict', async () => {
    const start=Date.parse(yesterday+'T09:00:00Z');
    let last, rows;
    for(let i=1;i<=80;i++) rows=await ingest(last=packet({timestamp:new Date(start+i*45000).toISOString()}));
    assert.equal(rows[0].workingHours,1);
    assert.equal(rows[0].toolActiveMinutes.workstation,60);
    assert.equal(rows[0].cloudRevision,80);
    assert.deepEqual(await ingest(last),rows);
    await assert.rejects(() => ingest({...last,activeSeconds:44}),e=>e.code==='23505');
    assert.deepEqual(await history(),rows);
  });
  await t.test('overlapping tools and calendars preserve provenance without inventing work or breaks', async () => {
    let rows=await ingest(packet({activeSeconds:60,source:'vscode'}));
    assert.equal(rows[0].workingHours,1);
    assert.equal(rows[0].toolActiveMinutes.vscode,1);
    rows=await ingest(packet({activeSeconds:0,meetingMinutes:60,source:'calendar',isEvening:true}));
    assert.equal(rows[0].meetingLoad,1);
    assert.equal(rows[0].workingHours,1);
    assert.equal(rows[0].afterHoursActivity,60);
    const day=new Date(Date.parse(yesterday+'T00:00:00Z')-86400000).toISOString().slice(0,10);
    rows=await ingest(packet({timestamp:day+'T10:00:00Z',activeSeconds:0,meetingMinutes:15,source:'calendar'}));
    assert.equal(rows[0].workingHours,0);
    assert.equal(rows[0].breakFrequency,0);
    assert.deepEqual(rows[0].observedMetrics.sort(),['afterHoursActivity','meetingLoad']);
  });
  await t.test('UTC midnight crossings and pure breaks remain observed and bounded', async () => {
    const rows=await ingest(packet({timestamp:yesterday+'T00:00:15Z',activeSeconds:45}));
    assert.equal(rows.length,2);
    assert.ok(rows[0].workingHours>=30/3600);
    assert.ok(rows[1].workingHours>=15/3600);
    const r=await ingest(packet({activeSeconds:0,isBreak:true}));
    assert.equal(r[0].breakFrequency,1);
    assert.equal(r[0].observedMetrics.includes('breakFrequency'),true);
  });
  await t.test('disabled after-hours collection is unknown rather than a measured zero', async () => {
    const day=new Date(Date.parse(yesterday)-4*86400000).toISOString().slice(0,10);
    let rows=await ingest(packet({timestamp:day+'T10:00:00Z',afterHoursObserved:false}));
    assert.equal(rows[0].observedMetrics.includes('afterHoursActivity'),false);
    await assert.rejects(()=>ingest(packet({timestamp:day+'T10:00:00Z',afterHoursObserved:false,isEvening:true})),e=>e.code==='22023');
    rows=await ingest(packet({timestamp:day+'T10:01:00Z',afterHoursObserved:true}));
    assert.equal(rows[0].observedMetrics.includes('afterHoursActivity'),true);
  });
  await t.test('calendar imports can withhold after-hours observations without inventing measured zeros', async () => {
    const day = new Date(Date.parse(yesterday)-5*86400000).toISOString().slice(0,10);
    const snapshot = { employeeId:A, date:day, source:'google_calendar', workingHours:0, meetingLoad:1,
      breakFrequency:0, afterHoursActivity:0, observedMetrics:['meetingLoad'] };
    const upload = item => db.query('select public.import_wellness_snapshots($1::jsonb,$2::timestamptz) result',
      [JSON.stringify([item]),new Date().toISOString()]);
    const migration = fs.readFileSync('src/lib/supabase/migrations/20261005_source_observation_preferences.sql','utf8');
    const currentFunction = migration.slice(migration.indexOf('create or replace function'),migration.indexOf('revoke all on function'));
    const oldFunction = currentFunction.replace(/if jsonb_array_length\(item->'observedMetrics'\) not in \(1,2\)[\s\S]*?\n        or item \? 'githubEventCount'/,
      "if jsonb_array_length(item->'observedMetrics')<>2 or not (item->'observedMetrics' ?& array['meetingLoad','afterHoursActivity'])\n        or item ? 'githubEventCount'")
      .replace("case when item->'observedMetrics' ? 'afterHoursActivity' then array['meetingLoad','afterHoursActivity'] else array['meetingLoad'] end",
        "array['meetingLoad','afterHoursActivity']");
    await db.exec('reset role'); await db.exec(oldFunction); await asUser(A);
    await assert.rejects(()=>upload(snapshot),e=>e.code==='22023');
    await db.exec('reset role'); await db.exec(migration); await asUser(A);
    const rows = (await upload(snapshot)).rows[0].result.dailyMetrics;
    assert.deepEqual(rows[0].observedMetrics,['meetingLoad']);
    assert.equal(rows[0].meetingLoad,1);
    await assert.rejects(()=>upload({...snapshot,afterHoursActivity:10}),e=>e.code==='22023');
    await assert.rejects(()=>upload({...snapshot,observedMetrics:['meetingLoad','meetingLoad']}),e=>e.code==='22023');
    await assert.rejects(()=>upload({...snapshot,observedMetrics:['workingHours']}),e=>e.code==='22023');
  });
  await t.test('invalid metadata and cross-account writes fail before changing history', async () => {
    const before=await history();
    for(const bad of [{content:'private'},{source:'invented'},{activeSeconds:301},{isBreak:'false'},
      {timestamp:'2026-02-30T12:00:00Z'},{timestamp:'2026-01-01T12:00:00'},
      {timestamp:new Date(Date.now()-36*86400000).toISOString()},{activeSeconds:0},
      {source:'calendar',activeSeconds:45},{meetingMinutes:10},{eventId:'not valid'}]) {
      await assert.rejects(()=>ingest(packet(bad)));
    }
    await assert.rejects(()=>ingest(packet({employeeId:B,organizationId:'personal:'+B})),e=>e.code==='42501');
    assert.deepEqual(await history(),before);
    await assert.rejects(()=>db.query('update public.employee_daily_metrics set working_hours=10'),/permission denied/);
    await assert.rejects(()=>db.query('select * from wellness_private.telemetry_receipts'),/permission denied/);
  });
  await t.test('source corrections retain workstation measurements, deduplicate and reject stale captures', async () => {
    const calendar = {employeeId:A,date:yesterday,source:'google_calendar',workingHours:0,meetingLoad:3,breakFrequency:0,
      afterHoursActivity:90,observedMetrics:['meetingLoad','afterHoursActivity']};
    const captured = Date.now()-10000;
    const imports = async (items,time=captured) => (await db.query('select public.import_wellness_snapshots($1::jsonb,$2::timestamptz) result',
      [JSON.stringify(items),new Date(time).toISOString()])).rows[0].result.dailyMetrics;
    let rows=await imports([calendar]);
    assert.ok(rows[0].workingHours>=1);
    assert.equal(rows[0].meetingLoad,3);
    const version=rows[0].cloudRevision;
    assert.deepEqual(await imports([calendar]),rows);
    await assert.rejects(()=>imports([{...calendar,meetingLoad:2}]),e=>e.code==='23505');
    rows=await imports([{...calendar,meetingLoad:0,afterHoursActivity:0}],captured+1000);
    assert.equal(rows[0].meetingLoad,1); // separately measured calendar heartbeat remains
    assert.equal(rows[0].contributions.google_calendar.meetingLoad,0);
    assert.equal(rows[0].cloudRevision,version+1);
    assert.deepEqual(await imports([calendar],captured-1000),rows);
    const github={...calendar,source:'github',meetingLoad:0,afterHoursActivity:0,observedMetrics:[],githubEventCount:7};
    rows=await imports([github],captured+2000);
    assert.equal(rows[0].githubEventCount,7);
    assert.equal(rows[0].workingHours>=1,true);
    assert.deepEqual(rows[0].contributions.github.observedMetrics,[]);
    const before=await history();
    for(const bad of [{...calendar,workingHours:1},{...calendar,content:'private'}, {...github,githubEventCount:-1},
      {...github,githubEventCount:1.1},{...calendar,source:'demo'}, {...calendar,employeeId:B}]) {
      await assert.rejects(()=>imports([{...calendar,meetingLoad:4},bad],captured+3000));
      assert.deepEqual(await history(),before); // even a preceding valid row rolls back
    }
    await assert.rejects(()=>imports([calendar,calendar],captured+3000));
    await assert.rejects(()=>imports(Array.from({length:37},()=>calendar),captured+3000));
    await assert.rejects(()=>imports([calendar],Date.now()+600000));
    const state=(await db.query('select public.get_employee_observation_state() result')).rows[0].result;
    assert.deepEqual(state.dailyMetrics,await history());
    assert.ok(Date.parse(state.lastHeartbeat));
  });
  await t.test('employees only read their own snapshots; HR and anonymous users cannot ingest', async () => {
    await asUser(B);
    assert.deepEqual(await history(),[]);
    assert.deepEqual((await db.query('select * from public.employee_metric_sources')).rows,[]);
    await asUser(B,'hr');
    await assert.rejects(()=>ingest(packet()),e=>e.code==='42501');
    assert.deepEqual(await history(),[]);
    await asUser(null,'employee','anon');
    await assert.rejects(history,/permission denied/);
    await assert.rejects(()=>ingest(packet()),/permission denied/);
  });
  await t.test('ingested calendar history reaches HR only through consenting calibrated tenant aggregates', async () => {
    const C='00000000-0000-4000-8000-000000000003', H='00000000-0000-4000-8000-000000000004';
    const O='00000000-0000-4000-8000-000000000020', G='00000000-0000-4000-8000-000000000030';
    await db.exec('reset role');
    await db.query("insert into auth.users(id,raw_app_meta_data) values($1,'{}'),($2,'{\"role\":\"hr\"}')",[C,H]);
    await db.query("insert into public.organizations(id,name) values($1,'Verified tenant')",[O]);
    await db.query("insert into public.hr_groups(id,name,organization_id) values($1,'Verified team',$2)",[G,O]);
    await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'hr')",[O,H]);
    for(const employee of [A,B,C]) {
      await db.query("insert into public.organization_members(organization_id,user_id,role,shares_aggregates) values($1,$2,'employee',true)",[O,employee]);
      await db.query('insert into public.hr_group_members(group_id,employee_id) values($1,$2)',[G,employee]);
    }
    for(const employee of [A,B,C]) {
      await asUser(employee);
      const items=Array.from({length:29},(_,n)=>({employeeId:employee,date:new Date(Date.parse(yesterday)-n*86400000).toISOString().slice(0,10),
        source:'google_calendar',workingHours:0,meetingLoad:n===0?2:1,breakFrequency:0,afterHoursActivity:0,
        observedMetrics:['meetingLoad','afterHoursActivity']}));
      await db.query('select public.import_wellness_snapshots($1::jsonb,$2::timestamptz)',[JSON.stringify(items),new Date().toISOString()]);
    }
    await asUser(H,'hr');
    const released=(await db.query('select * from public.get_hr_group_observations()')).rows;
    assert.equal(released.length,1);
    assert.equal(Number(released[0].meeting_load),2);
    assert.equal(released[0].working_hours,null);
    assert.equal(JSON.stringify(released).includes(A),false);
    await asUser(C);
    await db.query('update public.organization_members set shares_aggregates=false where user_id=$1',[C]);
    await asUser(H,'hr');
    assert.deepEqual((await db.query('select * from public.get_hr_group_observations()')).rows,[]);
  });
});
