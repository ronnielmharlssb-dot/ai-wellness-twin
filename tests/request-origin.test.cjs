const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./load-typescript.cjs");
const load = (env = {}) => createLoader({ process: { env } })("src/lib/http/requestOrigin.ts");
test("a direct request validates against the actual Host rather than the internal hostname", () => {
  const request = new Request("http://localhost:3010/api/telemetry/heartbeat", { headers: { host: "127.0.0.1:3010", origin: "http://127.0.0.1:3010" } });
  assert.equal(load().getRequestOrigin(request), "http://127.0.0.1:3010");
  assert.equal(load().isSameOriginRequest(request), true);
  const cross = new Request(request, { headers: { host: "127.0.0.1:3010", origin: "https://other.example" } });
  assert.equal(load().isSameOriginRequest(cross), false);
});
test("a configured public origin supports a trusted reverse proxy without trusting forwarded hosts", () => {
  const request = new Request("http://internal:3000/api", { headers: { host: "internal:3000", "x-forwarded-host": "attacker.example", origin: "https://wellness.example" } });
  assert.equal(load({ WELLNESS_APP_ORIGIN: "https://wellness.example" }).isSameOriginRequest(request), true);
  assert.equal(load().getRequestOrigin(request), "http://internal:3000");
  assert.equal(load().isSameOriginRequest(request), false);
});
test("ambiguous host or public-origin configuration fails closed", () => {
  for (const host of ["attacker.example/path", "user@attacker.example", "localhost:3000,other.example"]) {
    assert.equal(load().isSameOriginRequest(new Request("http://localhost/api", { headers: { host, origin: "http://localhost" } })), false);
  }
  for (const configured of ["https://wellness.example/path", "https://user:pass@wellness.example", "file:///test", "invalid"]) {
    assert.equal(load({ WELLNESS_APP_ORIGIN: configured }).isSameOriginRequest(new Request("http://localhost/api", { headers: { origin: "http://localhost" } })), false);
  }
});
