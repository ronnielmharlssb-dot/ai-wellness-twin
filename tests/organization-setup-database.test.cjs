const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

test('organization requests persist under verified identity without granting tenant or HR authority', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb; $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid; $$;
    grant usage on schema auth to anon,authenticated;`);
  for (const file of ['schema.sql','migrations/20261004_tenant_privacy.sql']) await db.exec(fs.readFileSync('src/lib/supabase/' + file,'utf8'));
  for (const n of [1,2,3]) await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values($1,$2,$3,$4)`,
    [id(n),`owner${n}@requester.example`, n === 3 ? null : new Date().toISOString(), JSON.stringify({role:n === 2 ? 'hr':'employee'})]);
  const migration = fs.readFileSync('src/lib/supabase/migrations/20261006_organization_setup_requests.sql','utf8');
  await db.exec(migration); await db.exec(migration);
  async function asUser(n, role = 'employee', dbRole = 'authenticated') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:n ? id(n) : null,app_metadata:{role}})]);
    await db.exec('set role ' + dbRole);
  }
  const submit = (requestId = id(21), name = 'Example Organization', domain = 'example.com', size = '10-50') => db.query(
    'select public.submit_organization_setup_request($1::uuid,$2,$3,$4) receipt',[requestId,name,domain,size]);
  const own = async () => (await db.query('select * from public.organization_setup_requests order by id')).rows;
  const denied = (operation, code = '42501') => assert.rejects(operation, error => error.code === code);

  await t.test('normalized requests acknowledge a committed record and replay the same receipt', async () => {
    await asUser(1);
    const receipt = (await submit(id(21),' Example Organization ','EXAMPLE.COM')).rows[0].receipt;
    assert.equal(receipt.requester_id,id(1));
    assert.equal(receipt.contact_email,'owner1@requester.example');
    assert.equal(receipt.company_name,'Example Organization');
    assert.equal(receipt.domain,'example.com');
    assert.equal(receipt.status,'pending');
    assert.equal(receipt.reviewed_at,null); assert.equal(receipt.organization_id,null);
    assert.deepEqual((await submit()).rows[0].receipt,receipt);
    await denied(() => submit(id(21),'Different organization'),'23505');
    await denied(() => submit(id(25)),'23505');
    assert.equal((await own()).length,1);
    await db.exec('reset role');
    assert.equal((await db.query('select * from public.organization_members')).rows.length,0);
    assert.equal((await db.query('select * from public.organizations')).rows.length,0);
    assert.equal((await db.query("select role from public.profiles where id=$1",[id(1)])).rows[0].role,'employee');
  });
  await t.test('request history is private even to HR and one applicant cannot take another receipt', async () => {
    await asUser(2,'hr');
    assert.deepEqual(await own(),[]);
    const receipt = (await submit(id(22))).rows[0].receipt;
    assert.equal(receipt.requester_id,id(2));
    assert.deepEqual((await own()).map(row => row.id),[id(22)]);
    await denied(() => submit(id(21)),'23505');
    await asUser(1,'hr');
    assert.deepEqual((await own()).map(row => row.id),[id(21)]);
  });
  await t.test('browser roles cannot insert, approve, edit or delete requests directly', async () => {
    for (const n of [1,2]) {
      await asUser(n,n === 2 ? 'hr':'employee');
      await denied(() => db.query("update public.organization_setup_requests set status='approved',reviewed_at=now(),organization_id=$1 where requester_id=$2",[id(31),id(n)]));
      await denied(() => db.query("update public.organization_setup_requests set domain='attacker.example' where requester_id=$1",[id(n)]));
      await denied(() => db.query("delete from public.organization_setup_requests where requester_id=$1",[id(n)]));
      await denied(() => db.query("insert into public.organization_setup_requests(id,requester_id,contact_email,company_name,domain,team_size) values($1,$2,'fake@example.com','Fake','fake.example','10-50')",[id(26),id(n)]));
    }
  });
  await t.test('unconfirmed, missing and anonymous identities cannot submit requests', async () => {
    for (const n of [3,4,null]) {
      await asUser(n); await denied(() => submit(id(27)));
    }
    await asUser(null,'employee','anon');
    await denied(() => submit(id(27)));
    await denied(() => db.query('select * from public.organization_setup_requests'));
  });
  await t.test('direct RPC input validation cannot turn names, hints or malformed domains into verification', async () => {
    await asUser(1);
    for (const args of [[null,'Example','example.com','10-50'],[id(28),'','example.com','10-50'],
      [id(28),'x'.repeat(201),'example.com','10-50'],[id(28),'Line\nBreak','example.com','10-50'],
      [id(28),'Example','https://example.com','10-50'],[id(28),'Example','evil@example.com','10-50'],
      [id(28),'Example','127.0.0.1','10-50'],[id(28),'Example','a'.repeat(64)+'.com','10-50'],
      [id(28),'Example','example.com',null],[id(28),'Example','example.com','unbounded']]) {
      await denied(() => submit(...args),'22023');
    }
    assert.equal((await own()).length,1);
  });
  await t.test('administrative review is separate from membership, roles and consent; upgrades preserve history', async () => {
    await db.exec('reset role');
    await db.query("insert into public.organizations(id,name) values($1,'Reviewed Organization')",[id(31)]);
    await db.query("update public.organization_setup_requests set status='approved',reviewed_at=now(),organization_id=$1 where id=$2",[id(31),id(21)]);
    assert.equal((await db.query('select * from public.organization_members')).rows.length,0);
    assert.equal((await db.query('select role from public.profiles where id=$1',[id(1)])).rows[0].role,'employee');
    await asUser(1,'hr');
    assert.equal((await submit()).rows[0].receipt.status,'approved');
    assert.deepEqual((await db.query('select * from public.get_hr_group_observations()')).rows,[]);
    await submit(id(24),'Another Organization','another.example');
    assert.equal((await own()).length,2);
    await db.exec('reset role');
    const before = await own();
    await db.exec(migration); await db.exec(migration);
    assert.deepEqual(await own(),before);
    await asUser(1);
    await denied(() => db.query("update public.organization_setup_requests set status='declined',reviewed_at=now() where id=$1",[id(24)]));
  });
});
