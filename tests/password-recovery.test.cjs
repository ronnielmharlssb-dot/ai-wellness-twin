const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader, plain } = require("./load-typescript.cjs");

function recovery(auth, options = []) {
  return createLoader({ window: { location: { origin: "https://wellness.example" } } }, {
    "./client": { createClient: config => { options.push(config); return auth ? { auth } : null; } },
  })("src/lib/supabase/passwordRecovery.ts");
}

test("reset requests normalize the address and use the application's recovery page", async () => {
  const calls = [];
  const recoveryApi = recovery({ resetPasswordForEmail: async (...args) => { calls.push(args); return { error: null }; } });
  assert.equal(await recoveryApi.requestPasswordReset(" Ronnie@Example.com "), null);
  assert.deepEqual(plain(calls), [["ronnie@example.com", { redirectTo: "https://wellness.example/reset-password" }]]);
  assert.match(await recoveryApi.requestPasswordReset("not-an-email"), /valid email/);
  assert.equal(calls.length, 1);
});

test("missing configuration and provider failures never claim a reset email was requested", async () => {
  assert.match(await recovery(null).requestPasswordReset("ronnie@example.com"), /unavailable/);
  for (const resetPasswordForEmail of [async () => ({ error: { message: "Account-specific private detail" } }), async () => { throw Error("offline"); }]) {
    const result = await recovery({ resetPasswordForEmail }).requestPasswordReset("ronnie@example.com");
    assert.match(result, /unavailable/);
    assert.doesNotMatch(result, /private detail/);
  }
});

test("implicit recovery credentials are verified with the provider before showing a password form", async () => {
  const calls = [], options = [];
  const recoveryApi = recovery({
    setSession: async tokens => { calls.push(tokens); return { error: null }; },
    getUser: async () => ({ data: { user: { email: "ronnie@example.com" } }, error: null }),
  }, options);
  const result = await recoveryApi.initializePasswordRecovery("https://wellness.example/reset-password#type=recovery&access_token=access&refresh_token=refresh");
  assert.deepEqual(plain(result), { email: "ronnie@example.com", error: null });
  assert.deepEqual(plain(calls), [{ access_token: "access", refresh_token: "refresh" }]);
  assert.deepEqual(plain(options), [{ detectSessionInUrl: false }]);
});

test("PKCE recovery exchanges the single-use code with its flow identifier", async () => {
  const calls = [];
  const recoveryApi = recovery({
    exchangeCodeForSession: async (...args) => { calls.push(args); return { error: null }; },
    getUser: async () => ({ data: { user: { email: "ronnie@example.com" } }, error: null }),
  });
  assert.equal((await recoveryApi.initializePasswordRecovery("https://wellness.example/reset-password?code=single-use&sb_flow_id=flow-1")).error, null);
  assert.deepEqual(plain(calls), [["single-use", { flowId: "flow-1" }]]);
});

test("expired, incomplete, rejected and unverified recovery credentials stay denied", async () => {
  const noAuth = recovery({ getUser: async () => ({ data: { user: null }, error: null }) });
  for (const suffix of ["", "#error=access_denied&error_code=otp_expired", "#type=recovery&access_token=partial"]) {
    const result = await noAuth.initializePasswordRecovery("https://wellness.example/reset-password" + suffix);
    assert.equal(result.email, null);
    assert.match(result.error, /invalid or expired/);
  }
  for (const auth of [
    { setSession: async () => ({ error: Error("rejected") }) },
    { exchangeCodeForSession: async () => ({ error: Error("consumed") }) },
    { getUser: async () => ({ data: { user: { email: "forged@example.com" } }, error: Error("invalid") }) },
  ]) {
    const suffix = auth.setSession ? "#type=recovery&access_token=bad&refresh_token=bad" : auth.exchangeCodeForSession ? "?code=expired" : "";
    assert.equal((await recovery(auth).initializePasswordRecovery("https://wellness.example/reset-password" + suffix)).email, null);
  }
});

test("password validation and an expired provider session prevent password mutations", async () => {
  let updates = 0;
  const recoveryApi = recovery({ getUser: async () => ({ data: { user: null }, error: null }), updateUser: async () => { updates++; } });
  assert.match(await recoveryApi.completePasswordRecovery("short", "short"), /12 characters/);
  assert.match(await recoveryApi.completePasswordRecovery("long-password-1", "long-password-2"), /do not match/);
  assert.match(await recoveryApi.completePasswordRecovery("long-password-1", "long-password-1"), /expired/);
  assert.equal(updates, 0);
});

test("password changes report success only after the provider accepts the update", async () => {
  const calls = [];
  let error = { message: "password policy rejection" };
  const recoveryApi = recovery({
    getUser: async () => ({ data: { user: { id: "verified-user" } }, error: null }),
    updateUser: async change => { calls.push(change); return { error }; },
  });
  assert.match(await recoveryApi.completePasswordRecovery("long-password-1", "long-password-1"), /could not be changed/);
  error = null;
  assert.equal(await recoveryApi.completePasswordRecovery("long-password-1", "long-password-1"), null);
  assert.deepEqual(plain(calls), [{ password: "long-password-1" }, { password: "long-password-1" }]);
});

test("fallback recovery redirects stay within the app and preserve tokens without accepting arbitrary destinations", () => {
  const recoveryApi = recovery(null);
  assert.equal(recoveryApi.recoveryRedirect("https://wellness.example/#type=recovery&access_token=abc&refresh_token=def"), "/reset-password#type=recovery&access_token=abc&refresh_token=def");
  assert.equal(recoveryApi.recoveryRedirect("https://wellness.example/login#error=access_denied&error_code=otp_expired"), "/reset-password#error=access_denied&error_code=otp_expired");
  assert.equal(recoveryApi.recoveryRedirect("https://wellness.example/reset-password#type=recovery"), null);
  assert.equal(recoveryApi.recoveryRedirect("https://wellness.example/?next=https://evil.example"), null);
  assert.equal(recoveryApi.recoveryRedirect("https://wellness.example/#type=signup"), null);
});
