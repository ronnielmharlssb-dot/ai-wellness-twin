const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./load-typescript.cjs");

function endpoint(user) {
  const sideEffects = [];
  let authChecks = 0;
  const forbidden = new Proxy({}, { get: (_target, name) => (...args) => { sideEffects.push([name, args]); throw Error("Retired side effect"); } });
  const load = createLoader({ fetch: forbidden.fetch, console: forbidden, Math: forbidden,
    process: { env: { RESEND_API_KEY: "fixture-secret", NEXT_PUBLIC_SUPABASE_URL: "https://auth.example", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-key" } },
  }, {
    "@/lib/supabase/serverAuth": {
      getAuthenticatedUser: async () => { authChecks++; return user; },
      isSameOriginRequest: createLoader()("src/lib/http/requestOrigin.ts").isSameOriginRequest,
    },
    fs: forbidden, "node:fs": forbidden, "@supabase/supabase-js": forbidden,
  });
  return { POST: load("src/app/api/integrations/verify-owner/route.ts").POST, sideEffects, authChecks: () => authChecks };
}

function request(body = "{}", origin = "https://wellness.example") {
  const result = new Request("https://wellness.example/api/integrations/verify-owner", {
    method: "POST", headers: origin ? { origin } : {}, body,
  });
  result.json = async () => { throw Error("The retired route must not read submitted email or codes"); };
  return result;
}

test("retired verification rejects cross-origin and absent-origin calls before checking identity", async () => {
  const route = endpoint({ id: "employee-1", role: "employee" });
  for (const origin of ["https://other.example", "https://wellness.example.evil", null]) {
    const response = await route.POST(request("{}", origin));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(route.authChecks(), 0);
  assert.deepEqual(route.sideEffects, []);
});

test("anonymous and HR calls cannot invoke legacy email verification", async () => {
  for (const [user, status] of [[null, 401], [{ id: "hr-1", role: "hr" }, 403]]) {
    const route = endpoint(user);
    const response = await route.POST(request(JSON.stringify({ action: "send", email: "target@example.com" })));
    assert.equal(response.status, status);
    assert.equal((await response.json()).success, false);
    assert.deepEqual(route.sideEffects, []);
  }
});

test("employee legacy sends and PIN verification stay retired without parsing, logging, sending or saving", async () => {
  for (const source of ["supabase", "demo"]) {
    const route = endpoint({ id: "employee-1", role: "employee", source });
    for (const body of [JSON.stringify({ action: "send", email: "target@example.com" }), JSON.stringify({ action: "verify", email: "target@example.com", code: "123456" }), "not-json", "x".repeat(100000)]) {
      const response = await route.POST(request(body));
      assert.equal(response.status, 410);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const result = await response.json();
      assert.equal(result.success, false);
      assert.match(result.error, /OAuth/);
      assert.doesNotMatch(JSON.stringify(result), /target@example|123456|fixture-secret|dispatched|verified/);
    }
    assert.deepEqual(route.sideEffects, []);
  }
});
