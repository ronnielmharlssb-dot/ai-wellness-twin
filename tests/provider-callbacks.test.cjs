const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./load-typescript.cjs");

test("callbacks reject missing or mismatched state before exchanging a code", async () => {
  let fetchCount = 0;
  const load = createLoader({
    process: { env: {
      GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret", GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret",
      DISCORD_CLIENT_ID: "id", DISCORD_CLIENT_SECRET: "secret", SLACK_CLIENT_ID: "id", SLACK_CLIENT_SECRET: "secret",
    } }, fetch: async () => { fetchCount++; throw new Error("Must not exchange a code"); },
  }, {
    "@/lib/supabase/serverAuth": { getAuthenticatedUser: async () => ({ id: "employee-1", role: "employee" }) },
    "@/lib/integrations/oauthFlow": { consumeOAuthFlow: async () => { throw new Error("Missing state"); } },
  });
  for (const provider of ["google", "github", "discord", "slack"]) {
    assert.equal((await load(`src/app/api/auth/callback/${provider}/route.ts`).GET(new Request(`http://localhost/api/auth/callback/${provider}?code=code`))).status, 400);
  }
  assert.equal(fetchCount, 0);
});

test("GitHub sends its PKCE verifier and identifies the authenticated employee in the callback", async () => {
  let calls = 0;
  const load = createLoader({ process: { env: { GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" } },
    fetch: async (url, options) => {
      calls++;
      if (calls === 1) {
        assert.equal(JSON.parse(options.body).code_verifier, "private-verifier");
        assert.equal(JSON.parse(options.body).redirect_uri, "http://localhost/api/auth/callback/github");
        return { ok: true, json: async () => ({ access_token: "token" }) };
      }
      return { ok: true, json: async () => ({ login: "verified-user" }) };
    },
  }, {
    "@/lib/supabase/serverAuth": { getAuthenticatedUser: async () => ({ id: "employee-1", role: "employee" }) },
    "@/lib/integrations/oauthFlow": { consumeOAuthFlow: async () => ({ origin: "http://localhost", codeVerifier: "private-verifier" }) },
  });
  const response = await load("src/app/api/auth/callback/github/route.ts").GET(new Request("http://localhost/api/auth/callback/github?code=code"));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('"employeeId":"employee-1"'));
  assert.equal(html.includes("private-verifier"), false);
});

test("Slack verifies users.identity with the returned user token", async () => {
  let calls = 0;
  const load = createLoader({ process: { env: { SLACK_CLIENT_ID: "id", SLACK_CLIENT_SECRET: "secret" } },
    fetch: async (url, options) => {
      calls++;
      if (calls === 1) return { ok: true, json: async () => ({ ok: true, authed_user: { access_token: "user-token" } }) };
      assert.equal(url, "https://slack.com/api/users.identity");
      assert.equal(options.headers.Authorization, "Bearer user-token");
      return { ok: true, json: async () => ({ ok: true, user: { id: "slack-user" }, team: { name: "Verified team" } }) };
    },
  }, {
    "@/lib/supabase/serverAuth": { getAuthenticatedUser: async () => ({ id: "employee-1", role: "employee" }) },
    "@/lib/integrations/oauthFlow": { consumeOAuthFlow: async () => ({ origin: "http://localhost" }) },
  });
  const response = await load("src/app/api/auth/callback/slack/route.ts").GET(new Request("http://localhost/api/auth/callback/slack?code=code"));
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes('"workspace":"Verified team"'));
});

test("provider callbacks do not report success without configured credentials", async () => {
  const load = createLoader({ process: { env: {} } }, {
    "@/lib/supabase/serverAuth": { getAuthenticatedUser: async () => ({ id: "employee-1", role: "employee" }) },
  });
  for (const provider of ["google", "slack", "github", "discord"]) {
    const { GET } = load(`src/app/api/auth/callback/${provider}/route.ts`);
    const response = await GET(new Request(`http://localhost/api/auth/callback/${provider}?code=code&state=${encodeURIComponent(JSON.stringify({ email: "attacker@example.com" }))}`));
    assert.equal(response.status, 503);
    const html = await response.text();
    assert.equal(html.includes("postMessage"), false);
    assert.equal(html.includes("attacker@example.com"), false);
  }
});

test("provider callbacks require an authenticated employee", async () => {
  const load = createLoader({}, { "@/lib/supabase/serverAuth": { getAuthenticatedUser: async () => null } });
  for (const provider of ["google", "slack", "github", "discord"]) {
    const { GET } = load(`src/app/api/auth/callback/${provider}/route.ts`);
    assert.equal((await GET(new Request(`http://localhost/api/auth/callback/${provider}?code=code`))).status, 401);
  }
});

test("popup identities are escaped in HTML and script data uses an explicit target origin", async () => {
  const { popupResponse } = createLoader()("src/lib/integrations/popupResponse.ts");
  const identity = "</script><script>alert('private data')</script>";
  const response = popupResponse("http://localhost", "Provider", identity, { type: "SUCCESS", username: identity });
  const html = await response.text();
  assert.equal(html.includes(identity), false);
  assert.ok(html.includes("&lt;/script&gt;"));
  assert.ok(html.includes("\\u003c/script>"));
  assert.ok(html.includes('"http://localhost"'));
  assert.equal(html.includes("}, '*')"), false);
});

test("a Google calendar fetch failure cannot become an empty successful import", async () => {
  let count = 0;
  const load = createLoader({ process: { env: { NEXT_PUBLIC_GOOGLE_CLIENT_ID: "test-id", GOOGLE_CLIENT_SECRET: "test-secret" } },
    fetch: async () => {
      count++;
      if (count === 1) return { ok: true, json: async () => ({ access_token: "test-token" }) };
      if (count === 2) return { ok: true, json: async () => ({ email: "employee@example.com", verified_email: true }) };
      return { ok: false, status: 403 };
    },
  }, {
    "@/lib/supabase/serverAuth": { getAuthenticatedUser: async () => ({ id: "employee-1", role: "employee" }) },
    "@/lib/integrations/oauthFlow": { consumeOAuthFlow: async () => ({ provider: "google_calendar", origin: "http://localhost" }) },
  });
  const response = await load("src/app/api/auth/callback/google/route.ts").GET(new Request("http://localhost/api/auth/callback/google?code=code"));
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes("GOOGLE_OAUTH_SUCCESS"), false);
});
