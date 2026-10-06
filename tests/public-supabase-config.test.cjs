const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader, plain } = require("./load-typescript.cjs");
const url = "https://project.supabase.co";
const publishable = "sb_publishable_0123456789abcdefghijklmnop";
const otherPublic = "sb_publishable_abcdefghijklmnop0123456789";
const legacy = role => "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".c2lnbmF0dXJl";
function fixture(env = {}) {
  const browserCalls = [], serverCalls = [];
  const load = createLoader({ process: { env: { NODE_ENV: "development", ...env } } }, {
    "@supabase/ssr": {
      createBrowserClient: (...args) => { browserCalls.push(args); return { browser: true }; },
      createServerClient: (...args) => { serverCalls.push(args); return { server: true }; },
    },
    "next/headers": { cookies: async () => ({ getAll: () => [], set() {} }) },
  });
  return { config: load("src/lib/supabase/publicConfig.ts"), browser: load("src/lib/supabase/client.ts"),
    server: load("src/lib/supabase/server.ts"), demo: load("src/lib/supabase/authTypes.ts"), browserCalls, serverCalls };
}
test("browser and server clients use the same publishable or legacy public configuration", async () => {
  for (const [variable, key] of [["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publishable], ["NEXT_PUBLIC_SUPABASE_ANON_KEY", legacy("anon")]]) {
    const f = fixture({ NEXT_PUBLIC_SUPABASE_URL: url, [variable]: key });
    assert.equal(f.browser.isSupabaseConfigured(), true);
    assert.deepEqual(plain(f.browser.createClient({ detectSessionInUrl: false })), { browser: true });
    assert.deepEqual(plain(await f.server.createClient()), { server: true });
    assert.deepEqual(plain(f.browserCalls[0]), [url, key, { auth: { detectSessionInUrl: false } }]);
    assert.deepEqual(f.serverCalls[0].slice(0, 2), [url, key]);
    assert.deepEqual(plain(f.serverCalls[0][2].cookies.getAll()), []);
    assert.equal(f.demo.isDemoModeEnabled(), false);
  }
});
test("partial cloud configuration disables demos while withholding both clients", async () => {
  for (const env of [{ NEXT_PUBLIC_SUPABASE_URL: url }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: legacy("anon") }, { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable }]) {
    const f = fixture(env);
    assert.equal(f.config.hasSupabaseConfiguration(), true);
    assert.equal(f.demo.isDemoModeEnabled(), false);
    assert.equal(f.browser.isSupabaseConfigured(), false);
    assert.equal(f.browser.createClient(), null);
    assert.equal(await f.server.createClient(), null);
    assert.equal(f.browserCalls.length + f.serverCalls.length, 0);
  }
});
test("malformed configuration and elevated keys are never sent into public SDK clients or demo sessions", async () => {
  for (const patch of [
    { NEXT_PUBLIC_SUPABASE_ANON_KEY: legacy("service_role") }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_0123456789abcdefghijklmnop" },
    { NEXT_PUBLIC_SUPABASE_ANON_KEY: "invalid" }, { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable + " " },
    { NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }, { NEXT_PUBLIC_SUPABASE_URL: "https://user:password@project.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co#token" }, { NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co?secret=1" },
    { NEXT_PUBLIC_SUPABASE_URL: "ftp://project.supabase.co" },
  ]) {
    const f = fixture({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: legacy("anon"), ...patch });
    assert.equal(f.config.getPublicSupabaseConfig(), null);
    assert.equal(f.browser.createClient(), null);
    assert.equal(await f.server.createClient(), null);
    assert.equal(f.demo.isDemoModeEnabled(), false);
    assert.equal(f.browserCalls.length + f.serverCalls.length, 0);
  }
});
test("the preferred publishable variable controls both clients and cannot silently fall back when invalid", async () => {
  const f = fixture({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable, NEXT_PUBLIC_SUPABASE_ANON_KEY: otherPublic });
  f.browser.createClient();
  await f.server.createClient();
  assert.equal(f.browserCalls[0][1], publishable);
  assert.equal(f.serverCalls[0][1], publishable);
  const invalid = fixture({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private", NEXT_PUBLIC_SUPABASE_ANON_KEY: legacy("anon") });
  assert.equal(invalid.browser.createClient(), null);
  assert.equal(await invalid.server.createClient(), null);
});
test("explicit local demos remain available only with no cloud configuration", () => {
  assert.equal(fixture().demo.isDemoModeEnabled(), true);
  assert.equal(fixture({ NODE_ENV: "production" }).demo.isDemoModeEnabled(), false);
  assert.equal(fixture({ NEXT_PUBLIC_ENABLE_DEMO: "false" }).demo.isDemoModeEnabled(), false);
});
