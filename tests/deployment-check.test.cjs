const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { checkDeployment } = require("../scripts/check-deployment.cjs");
const key = "sb_publishable_0123456789abcdefghijklmnop";
const legacy = role => "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".c2lnbmF0dXJl";

async function fixture(t, changes = {}) {
  const requests = [];
  let base;
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, path: req.url, key: req.headers.apikey });
    const path = req.url.split("?")[0];
    if (changes.respond?.(path, req, res)) return;
    if (["/login", "/register"].includes(path)) {
      res.setHeader("Content-Type", "text/html");
      res.end(`<main>AI WELLNESS TWIN</main><script src="/_next/static/main.js"></script>`);
    } else if (path === "/_next/static/main.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(JSON.stringify({ url: changes.bundleUrl ?? base, key: changes.bundleKey ?? key }));
    } else if (path === "/auth/v1/health") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ name: "GoTrue", version: "v2.0.0" }));
    } else if (path === "/auth/v1/settings") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ disable_signup: false, external: { email: true } }));
    } else if (["/dashboard", "/hr", "/settings"].includes(path)) {
      res.writeHead(307, { Location: "/login" }); res.end();
    } else if (path.startsWith("/api/")) {
      res.writeHead(401, { "Content-Type": "application/json" }); res.end('{"error":"Authentication required"}');
    } else { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return { base, requests, check: options => checkDeployment({ appOrigin: base, supabaseUrl: base, supabaseKey: key, ...options }) };
}
const failure = (report, name) => report.checks.find(check => check.name === name && !check.ok);

test("deployment probes check real HTTP pages, public auth and anonymous access without writes", async t => {
  const f = await fixture(t);
  const report = await f.check();
  assert.equal(report.ok, true);
  assert.ok(report.checks.length >= 10);
  assert.ok(f.requests.every(req => req.method === "GET"));
  assert.deepEqual(f.requests.filter(req => req.key).map(req => req.path).sort(), ["/auth/v1/health", "/auth/v1/settings"]);
  assert.ok(f.requests.filter(req => req.key).every(req => req.key === key));
  assert.equal(JSON.stringify(report).includes(key), false);
});

test("a reachable app cannot hide an unresolved auth hostname and errors do not disclose keys", async t => {
  const f = await fixture(t);
  const report = await f.check({ fetchImpl: (url, init) => {
    if (url.endsWith("/auth/v1/health")) throw Object.assign(new Error("fetch failed: " + key), { cause: { code: "ENOTFOUND" } });
    return fetch(url, init);
  } });
  assert.equal(report.ok, false);
  assert.match(failure(report, "authentication").message, /Hostname does not resolve/);
  assert.equal(report.checks.find(check => check.name === "page:/register").ok, true);
  assert.equal(JSON.stringify(report).includes(key), false);
  assert.ok(!f.requests.some(req => req.path.includes("/auth/v1/settings")));
});

test("stale frontend URL or key prevents a healthy backend from passing the deployment check", async t => {
  for (const changes of [{ bundleUrl: "https://old-project.supabase.co" }, { bundleKey: "old-public-key" }]) {
    const f = await fixture(t, changes);
    const report = await f.check();
    assert.equal(report.ok, false);
    assert.match(failure(report, "browser-configuration").message, /Rebuild/);
    assert.equal(report.checks.find(check => check.name === "authentication").ok, true);
  }
});

test("auth redirects never forward a configured key to the redirect target", async t => {
  const receiver = await fixture(t);
  const f = await fixture(t, { respond(path, req, res) {
    if (path !== "/auth/v1/health") return false;
    res.writeHead(302, { Location: receiver.base + "/auth/v1/health" }); res.end(); return true;
  } });
  const report = await f.check();
  assert.equal(report.ok, false);
  assert.match(failure(report, "authentication").message, /HTTP 302/);
  assert.equal(receiver.requests.length, 0);
});

test("invalid health, unavailable settings and disabled email signup cannot become readiness", async t => {
  for (const [endpoint, status, body] of [
    ["/auth/v1/health", 200, "not-json"], ["/auth/v1/health", 200, '{"ok":true}'],
    ["/auth/v1/settings", 401, '{"error":"bad key"}'],
    ["/auth/v1/settings", 200, '{"disable_signup":true,"external":{"email":true}}'],
    ["/auth/v1/settings", 200, '{"disable_signup":false,"external":{"email":false}}'],
  ]) {
    const f = await fixture(t, { respond(path, req, res) {
      if (path !== endpoint) return false;
      res.writeHead(status, { "Content-Type": "application/json" }); res.end(body); return true;
    } });
    assert.ok(failure(await f.check(), "authentication"), endpoint + ": " + body);
  }
});

test("leaked private access and redirects to another origin are deployment failures", async t => {
  for (const [endpoint, status, headers] of [
    ["/dashboard", 200, {}], ["/hr", 307, { Location: "https://other.example/login" }],
    ["/api/telemetry/history", 200, {}], ["/api/hr/workspace", 500, {}],
  ]) {
    const f = await fixture(t, { respond(path, req, res) {
      if (path !== endpoint) return false;
      res.writeHead(status, headers); res.end("private payload must not be reported"); return true;
    } });
    const report = await f.check();
    assert.equal(report.ok, false);
    assert.ok(failure(report, "access:" + endpoint));
    assert.equal(JSON.stringify(report).includes("private payload"), false);
  }
});

test("invalid origins and elevated keys fail before any network request", async () => {
  let requests = 0;
  const options = { appOrigin: "https://app.example", supabaseUrl: "https://project.supabase.co", supabaseKey: key,
    fetchImpl: () => { requests++; throw new Error("must not fetch"); } };
  for (const patch of [
    { appOrigin: "https://user:password@app.example" }, { appOrigin: "https://app.example/other" },
    { appOrigin: "http://app.example" }, { appOrigin: "https://app.example?secret=value" },
    { supabaseUrl: "https://project.supabase.co/auth/v1" }, { supabaseUrl: undefined },
    { supabaseKey: "sb_secret_0123456789abcdefghijklmnop" }, { supabaseKey: legacy("service_role") },
    { supabaseKey: "bad-key" }, { supabaseKey: undefined },
  ]) {
    const report = await checkDeployment({ ...options, ...patch });
    assert.equal(report.ok, false); assert.ok(failure(report, "configuration"));
    assert.equal(JSON.stringify(report).includes("password@app"), false);
  }
  assert.equal(requests, 0);
});

test("the legacy anon key remains supported without entering the report", async t => {
  const anon = legacy("anon");
  const f = await fixture(t, { bundleKey: anon });
  const report = await f.check({ supabaseKey: anon });
  assert.equal(report.ok, true); assert.equal(JSON.stringify(report).includes(anon), false);
});

test("timeouts, oversized assets and missing app pages remain failed probes", async t => {
  const f = await fixture(t);
  const timed = await f.check({ fetchImpl: (url, init) => {
    if (url.endsWith("/auth/v1/health")) throw Object.assign(new Error(key), { name: "TimeoutError" });
    return fetch(url, init);
  } });
  assert.match(failure(timed, "authentication").message, /timed out/);
  const oversized = await fixture(t, { respond(path, req, res) {
    if (path !== "/_next/static/main.js") return false;
    res.end("x".repeat(2 * 1024 * 1024 + 1)); return true;
  } });
  assert.match(failure(await oversized.check(), "browser-configuration").message, /too large/);
  const unavailable = await fixture(t, { respond(path, req, res) {
    if (path !== "/register") return false;
    res.writeHead(503); res.end("unavailable"); return true;
  } });
  const report = await unavailable.check();
  assert.ok(failure(report, "page:/register")); assert.ok(failure(report, "browser-configuration"));
});

test("the command exits successfully for a passing deployment and nonzero for unavailable signup", async t => {
  async function run(base, env = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["scripts/check-deployment.cjs", base], {
        env: { ...process.env, NODE_ENV: "test", NEXT_PUBLIC_SUPABASE_URL: base, NEXT_PUBLIC_SUPABASE_ANON_KEY: key, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", data => { output += data; }); child.stderr.on("data", data => { output += data; });
      const timeout = setTimeout(() => { child.kill(); reject(new Error("Deployment check did not finish")); }, 20000);
      child.once("error", error => { clearTimeout(timeout); reject(error); });
      child.once("close", code => { clearTimeout(timeout); resolve({ code, output }); });
    });
  }
  const healthy = await fixture(t);
  const passed = await run(healthy.base);
  assert.equal(passed.code, 0); assert.match(passed.output, /Public deployment checks passed/);
  assert.equal(passed.output.includes(key), false);
  const preferred = await run(healthy.base, { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key, NEXT_PUBLIC_SUPABASE_ANON_KEY: "old-key" });
  assert.equal(preferred.code, 0);
  assert.equal(preferred.output.includes(key), false);
  const rejected = await run(healthy.base, { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private" });
  assert.equal(rejected.code, 1);
  assert.match(rejected.output, /FAIL configuration/);
  assert.equal(rejected.output.includes("sb_secret_private"), false);
  const disabled = await fixture(t, { respond(path, req, res) {
    if (path !== "/auth/v1/settings") return false;
    res.end('{"disable_signup":true,"external":{"email":true}}'); return true;
  } });
  const failed = await run(disabled.base);
  assert.equal(failed.code, 1); assert.match(failed.output, /FAIL authentication/);
  assert.match(failed.output, /do not claim registration is working/);
  assert.equal(failed.output.includes(key), false);
});
