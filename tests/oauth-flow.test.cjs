const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { createLoader } = require("./load-typescript.cjs");

const env = {
  NODE_ENV: "production", WELLNESS_OAUTH_STATE_SECRET: "test-only-state-secret-with-at-least-32-characters",
  GITHUB_CLIENT_ID: "github-id", GITHUB_CLIENT_SECRET: "github-secret",
  GOOGLE_CLIENT_ID: "google-id", GOOGLE_CLIENT_SECRET: "google-secret",
  DISCORD_CLIENT_ID: "discord-id", DISCORD_CLIENT_SECRET: "discord-secret",
  SLACK_CLIENT_ID: "slack-id", SLACK_CLIENT_SECRET: "slack-secret",
};
const origin = "https://wellness.example";
const now = Date.now();
const loadFlow = (options = {}, overrides = {}) => createLoader({ process: { env: { ...env, ...options } } }, overrides)("src/lib/integrations/oauthFlow.ts");

test("authorization uses unpredictable state and an encrypted GitHub PKCE verifier", () => {
  const oauth = loadFlow();
  const first = oauth.createOAuthAuthorization("github", "employee-1", origin, now);
  const second = oauth.createOAuthAuthorization("github", "employee-1", origin, now);
  const url = new URL(first.url);
  assert.match(first.flow.state, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.flow.state, second.flow.state);
  assert.equal(url.searchParams.get("state"), first.flow.state);
  assert.equal(url.searchParams.get("redirect_uri"), origin + "/api/auth/callback/github");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("code_challenge"), createHash("sha256").update(first.flow.codeVerifier).digest("base64url"));
  assert.equal(first.token.includes(first.flow.codeVerifier), false);
  assert.equal(oauth.openOAuthFlow(first.token).codeVerifier, first.flow.codeVerifier);
});

test("callback state is tied to employee, provider, origin and expiry", () => {
  const oauth = loadFlow();
  const { flow } = oauth.createOAuthAuthorization("google_calendar", "employee-1", origin, now);
  assert.equal(oauth.validateOAuthFlow(flow, flow.state, "google", "employee-1", origin, now), true);
  for (const parameters of [
    [flow, "wrong-state", "google", "employee-1", origin, now],
    [flow, flow.state, "github", "employee-1", origin, now],
    [flow, flow.state, "google", "employee-2", origin, now],
    [flow, flow.state, "google", "employee-1", "https://other.example", now],
    [flow, flow.state, "google", "employee-1", origin, flow.expires],
    [null, flow.state, "google", "employee-1", origin, now],
  ]) assert.equal(oauth.validateOAuthFlow(...parameters), false);
});

test("tampered flow cookies and a missing production encryption key are rejected", () => {
  const oauth = loadFlow();
  const { token } = oauth.createOAuthAuthorization("github", "employee-1", origin);
  const altered = Buffer.from(token, "base64url");
  altered[altered.length - 1] ^= 1;
  assert.equal(oauth.openOAuthFlow(altered.toString("base64url")), null);
  assert.throws(() => loadFlow({ WELLNESS_OAUTH_STATE_SECRET: undefined }).createOAuthAuthorization("github", "employee-1", origin), /STATE_SECRET/);
  assert.throws(() => loadFlow({ WELLNESS_OAUTH_STATE_SECRET: "short" }).createOAuthAuthorization("github", "employee-1", origin), /32 random characters/);
});

test("consuming a callback removes its cookie and prevents replay", async () => {
  const entries = new Map();
  const oauth = loadFlow({}, { "next/headers": { cookies: async () => ({
    get: (name) => entries.has(name) ? { value: entries.get(name) } : undefined,
    set: (name, value, options) => { assert.equal(options.path, "/api/auth/callback/google"); entries.delete(name); },
  }) } });
  const { flow, token } = oauth.createOAuthAuthorization("gemini", "employee-1", origin);
  entries.set(oauth.flowCookieName("google"), token);
  const request = new Request(origin + "/api/auth/callback/google?state=" + flow.state);
  assert.equal((await oauth.consumeOAuthFlow(request, "google", "employee-1")).provider, "gemini");
  await assert.rejects(() => oauth.consumeOAuthFlow(request, "google", "employee-1"), /state/);
});

test("identity-only Google authorization does not request calendar access", () => {
  const oauth = loadFlow();
  const calendar = new URL(oauth.createOAuthAuthorization("google_calendar", "employee-1", origin).url);
  const identity = new URL(oauth.createOAuthAuthorization("gemini", "employee-1", origin).url);
  assert.ok(calendar.searchParams.get("scope").includes("calendar.events.readonly"));
  assert.equal(identity.searchParams.get("scope").includes("calendar"), false);
});
