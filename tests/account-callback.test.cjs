const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createLoader, plain } = require('./load-typescript.cjs');

function callback(client, user = { role: 'employee' }) {
  return createLoader({ process: { env: {} } }, {
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/supabase/serverAuth': { getAuthenticatedUser: async () => user },
  })('src/app/api/auth/callback/route.ts').GET;
}
const request = suffix => new Request('https://wellness.example/api/auth/callback' + suffix);
const location = response => new URL(response.headers.get('location'));

test('account callback redirects only a verified session to the appropriate dashboard', async () => {
  const calls = [];
  const client = { auth: { exchangeCodeForSession: async (...args) => { calls.push(args); return { error: null }; } } };
  for (const [role, path] of [['employee','/dashboard'],['hr','/hr']]) {
    const response = await callback(client, { role })(request('?code=single-use&sb_flow_id=flow-1'));
    assert.equal(response.status,307);
    assert.equal(location(response).origin,'https://wellness.example');
    assert.equal(location(response).pathname,path);
  }
  assert.deepEqual(plain(calls[0]),['single-use',{ flowId:'flow-1' }]);
  assert.equal(location(await callback(client,null)(request('?code=valid'))).searchParams.get('error'),'authentication_failed');
});

test('cancelled and expired account flows return safe actionable login notices', async () => {
  const cancelled = await callback(null)(request('?error=access_denied&error_description=private-provider-detail'));
  assert.equal(location(cancelled).searchParams.get('error'),'sign_in_cancelled');
  assert.ok(!cancelled.headers.get('location').includes('private-provider-detail'));
  for (const code of ['flow_state_expired','flow_state_not_found','bad_code_verifier']) {
    const client = { auth: { exchangeCodeForSession: async () => ({ error: { code, message:'private detail' } }) } };
    assert.equal(location(await callback(client)(request('?code=expired'))).searchParams.get('error'),'session_expired');
  }
});

test('missing config, missing codes and provider exceptions do not crash the account callback', async () => {
  const throwing = { auth: { exchangeCodeForSession: async () => { throw new Error('provider unavailable'); } } };
  for (const [client,suffix] of [[null,''],[null,'?code=code'],[throwing,'?code=code']]) {
    const response = await callback(client)(request(suffix));
    assert.equal(response.status,307);
    assert.equal(location(response).pathname,'/login');
    assert.equal(location(response).searchParams.get('error'),'authentication_failed');
  }
});

test('login renders known callback notices without reflecting arbitrary query data', () => {
  for (const [code,expected] of [['authentication_failed',"couldn&#x27;t complete sign-in"],['session_expired','expired or could not be verified'],['sign_in_cancelled','sign-in was cancelled'],['<script>private-detail</script>',null]]) {
    const load = createLoader({}, {
      'next/navigation': { useRouter: () => ({ push() {} }), useSearchParams: () => new URLSearchParams({ error:code }) },
      '@/lib/supabase/auth': { isDemoModeEnabled: () => false },
    });
    const html = renderToStaticMarkup(React.createElement(load('src/app/login/page.tsx').default));
    if (expected) { assert.match(html,new RegExp(expected)); assert.match(html,/role="alert"/); }
    else assert.doesNotMatch(html,/private-detail|role="alert"/);
    assert.doesNotMatch(html,/Verifying registered account|alex\.morgan@gmail\.com/);
  }
});
