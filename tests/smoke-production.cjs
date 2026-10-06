const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");

async function main() {
  const reservation = net.createServer();
  await new Promise((resolve, reject) => reservation.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port), "--hostname", "127.0.0.1"], {
    cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", WELLNESS_APP_ORIGIN: "" }, stdio: ["ignore", "pipe", "pipe"],
  });
  let diagnostics = "", exited = false;
  server.stdout.on("data", (chunk) => { diagnostics = (diagnostics + chunk.toString()).slice(-4000); });
  server.stderr.on("data", (chunk) => { diagnostics = (diagnostics + chunk.toString()).slice(-4000); });
  const closed = new Promise((resolve) => server.once("close", () => { exited = true; resolve(); }));
  try {
    let ready = false;
    for (let attempt = 0; attempt < 30 && !exited; attempt++) {
      try { await fetch(base + "/login", { signal: AbortSignal.timeout(1000) }); ready = true; break; }
      catch { await new Promise((resolve) => setTimeout(resolve, 500)); }
    }
    assert.ok(ready && !exited, "Temporary production server did not start: " + diagnostics);
    for (const [endpoint, status] of [["/login", 200], ["/forgot-password", 200], ["/reset-password", 200], ["/dashboard", 307], ["/hr", 307], ["/settings", 307],
      ["/api/auth/session", 401], ["/api/telemetry/live-status", 401], ["/api/telemetry/history", 401], ["/api/hr/workspace", 401],
      ["/api/organizations/aggregate-consent", 401], ["/api/integrations/authorize?provider=github", 401]]) {
      const response = await fetch(base + endpoint, { redirect: "manual", signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, status, endpoint);
      if (status === 307) assert.equal(new URL(response.headers.get("location"), base).pathname, "/login");
      await response.text();
    }
    for (const endpoint of ["/api/telemetry/heartbeat", "/api/telemetry/calendar-webhook", "/api/telemetry/source-snapshots", "/api/organizations/aggregate-consent", "/api/integrations/verify-owner"]) {
      const response = await fetch(base + endpoint, { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: "{}" });
      assert.equal(response.status, 401, endpoint);
      const crossOrigin = await fetch(base + endpoint, { method: "POST", headers: { Origin: "https://other.example" }, body: "{}" });
      assert.equal(crossOrigin.status, 403, endpoint + " cross-origin");
    }
    const demo = await fetch(base + "/api/auth/session", { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ userId: "usr-ronnie" }) });
    assert.equal(demo.status, 403, "production demo login");
    function traces(directory) {
      return fs.readdirSync(directory, { withFileTypes: true }).flatMap((item) => item.isDirectory()
        ? traces(path.join(directory, item.name)) : item.name.endsWith(".nft.json") ? [path.join(directory, item.name)] : []);
    }
    const privateFiles = traces(".next").flatMap((filename) => JSON.parse(fs.readFileSync(filename, "utf8")).files ?? [])
      .filter((filename) => /(^|[\\/])\.data([\\/]|$)/.test(filename));
    assert.equal(privateFiles.length, 0, "private runtime files in build traces");
    console.log("Production HTTP access, cross-origin rejection, disabled demo login and private build tracing passed.");
  } finally {
    if (!exited) server.kill();
    await closed;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
