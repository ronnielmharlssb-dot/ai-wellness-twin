const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createLoader, memoryStorage } = require("./load-typescript.cjs");

function clientAuth(client, globals = {}) {
  const localStorage = memoryStorage();
  const load = createLoader({ window: { dispatchEvent() {}, location: { origin: "http://localhost" } },
    CustomEvent: class { constructor(type) { this.type = type; } }, localStorage,
    process: { env: { NODE_ENV: "development" } }, ...globals,
  }, { "./client": { createClient: () => client } });
  return { auth: load("src/lib/supabase/auth.ts"), localStorage };
}
function serverAuth(t, env = {}, client = null) {
  const root = path.resolve(".data");
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, "test-auth-"));
  t.after(() => {
    assert.ok(path.resolve(directory).startsWith(root + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const load = createLoader({ process: { env: { NODE_ENV: "development", ...env }, cwd: () => directory } }, {
    "./server": { createClient: async () => client }, "next/headers": { cookies: async () => ({ get: () => null }) },
  });
  return { auth: load("src/lib/supabase/serverAuth.ts"), load };
}

test("a missing or corrupt local session stays signed out", () => {
  const { auth, localStorage } = clientAuth(null);
  assert.equal(auth.getLocalSessionUser(), null);
  localStorage.setItem("wellness-auth-user", "invalid");
  assert.equal(auth.getLocalSessionUser(), null);
  localStorage.setItem("wellness-auth-user", JSON.stringify({ role: "hr" }));
  assert.equal(auth.getLocalSessionUser(), null);
});

test("a wrong password never falls through to an existing local account", async () => {
  const { auth } = clientAuth({ auth: { signInWithPassword: async () => ({ error: { message: "Invalid credentials" } }) } });
  const result = await auth.signInUser({ email: "ronnie@company.com", password: "wrong" });
  assert.equal(result.user, null);
  assert.equal(result.error, "Invalid credentials");
  assert.equal(auth.getLocalSessionUser(), null);
});

test("registration errors do not create a local user or session", async () => {
  const { auth } = clientAuth({ auth: { signUp: async () => ({ error: { message: "Password rejected" } }) } });
  const result = await auth.signUpUser({ email: "new@company.com", password: "weak", fullName: "New User", role: "employee" });
  assert.equal(result.user, null);
  assert.equal(auth.findRegisteredUser("new@company.com"), null);
  assert.equal(auth.getLocalSessionUser(), null);
});

test("registration waits for email verification without manufacturing a session", async () => {
  const { auth } = clientAuth({ auth: { signUp: async () => ({ data: { session: null }, error: null }) } });
  const result = await auth.signUpUser({ email: "new@company.com", password: "valid-password", fullName: "New User", role: "employee" });
  assert.equal(result.confirmationRequired, true);
  assert.equal(result.user, null);
  assert.equal(auth.getLocalSessionUser(), null);
});

test("sign-out remains signed out when the UI reads its cache again", async () => {
  const { auth } = clientAuth(null, { fetch: async () => ({ ok: true }) });
  auth.setLocalSessionUser({ id: "employee-1", email: "employee@company.com", fullName: "Employee", role: "employee" });
  await auth.signOutUser();
  assert.equal(auth.getLocalSessionUser(), null);
});

test("only server-managed roles can grant HR access", async (t) => {
  const user = { id: "employee-1", email: "employee@company.com", user_metadata: { full_name: "Employee", role: "hr" }, app_metadata: {} };
  const { auth } = serverAuth(t, {}, { auth: { getUser: async () => ({ data: { user }, error: null }) } });
  assert.equal((await auth.getAuthenticatedUser()).role, "employee");
  user.app_metadata.role = "hr";
  assert.equal((await auth.getAuthenticatedUser()).role, "hr");
});

test("demo cookies reject tampering and expiration", (t) => {
  const { auth } = serverAuth(t);
  const now = Date.now();
  const token = auth.createDemoSession("usr-ronnie", now);
  assert.equal(auth.verifyDemoSession(token, now).id, "usr-ronnie");
  const [payload, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ userId: "usr-hr-sarah", expires: now + 1000 })).toString("base64url");
  assert.equal(auth.verifyDemoSession(`${forged}.${signature}`, now), null);
  assert.equal(auth.verifyDemoSession(`${payload}.bad-signature`, now), null);
  assert.equal(auth.verifyDemoSession(token, now + 8 * 60 * 60 * 1000), null);
});

test("production and configured Supabase disable demo authentication", (t) => {
  for (const env of [{ NODE_ENV: "production" }, { NEXT_PUBLIC_SUPABASE_URL: "configured", NEXT_PUBLIC_SUPABASE_ANON_KEY: "configured" }]) {
    const { auth } = serverAuth(t, env);
    assert.throws(() => auth.createDemoSession("usr-hr-sarah"), /unavailable/);
    assert.equal(auth.verifyDemoSession("anything"), null);
  }
});
