const { loadEnvConfig } = require("@next/env");

class ProbeFailure extends Error {}
function origin(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new ProbeFailure(label + " must be an absolute HTTP(S) origin."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new ProbeFailure(label + " must use HTTPS (or local HTTP), with no credentials, path, query or fragment.");
  }
  return url.origin;
}
function publicKey(value) {
  if (typeof value !== "string" || value.trim() !== value) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(value)) return true;
  const parts = value.split(".");
  if (parts.length !== 3 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return false;
  try { return JSON.parse(Buffer.from(parts[1], "base64url").toString()).role === "anon"; }
  catch { return false; }
}
function networkFailure(error) {
  if (error instanceof ProbeFailure) return error.message;
  if (error?.cause?.code === "ENOTFOUND") return "Hostname does not resolve. Restore the service or correct its configured URL.";
  if (error?.name === "TimeoutError" || error?.name === "AbortError" || error?.cause?.code === "ETIMEDOUT") return "Request timed out; service availability could not be verified.";
  // Do not echo fetch errors: an upstream error can contain credentials or URLs.
  return "Request failed; service availability could not be verified.";
}
async function readBody(response, limit) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new ProbeFailure("Response is too large to verify safely."); }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { reader.releaseLock(); }
}

/** Read-only public probes. No account creation, sign-in, RPCs or telemetry writes. */
async function checkDeployment({ appOrigin, supabaseUrl, supabaseKey, timeoutMs = 10000, fetchImpl = fetch }) {
  const checks = [];
  const record = (name, ok, message) => checks.push({ name, ok, message });
  let app, backend;
  try {
    app = origin(appOrigin, "Application URL"); backend = origin(supabaseUrl, "Supabase URL");
    if (!publicKey(supabaseKey)) throw new ProbeFailure("Configure a public publishable or legacy anon key; secret and service-role keys are rejected.");
    record("configuration", true, "Expected application and public authentication configuration is valid.");
  } catch (error) {
    record("configuration", false, networkFailure(error));
    return { ok: false, checks };
  }
  const request = (url, headers) => fetchImpl(url, {
    method: "GET", headers, redirect: "manual", signal: AbortSignal.timeout(timeoutMs),
  });
  const probe = async (name, run) => {
    try { record(name, true, await run()); }
    catch (error) { record(name, false, networkFailure(error)); }
  };
  const pages = new Map();
  await Promise.all(["/login", "/register"].map(path => probe("page:" + path, async () => {
    const response = await request(app + path);
    const html = await readBody(response, 2 * 1024 * 1024);
    if (response.status !== 200 || !response.headers.get("content-type")?.includes("text/html") || !/Wellness Twin/i.test(html)) {
      throw new ProbeFailure("Expected Wellness Twin page is unavailable (HTTP " + response.status + ").");
    }
    pages.set(path, html);
    return "Wellness Twin page is reachable.";
  })));
  await probe("browser-configuration", async () => {
    const html = pages.get("/register");
    if (!html) throw new ProbeFailure("Cannot inspect configuration without the registration page.");
    const scripts = [...html.matchAll(/<script\b[^>]*\ssrc\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/gi)]
      .map(match => new URL(match[1] || match[2], app));
    const assets = [...new Set(scripts.filter(url => url.origin === app && url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js"))
      .map(url => url.href))];
    if (!assets.length || assets.length > 32) throw new ProbeFailure("Registration assets could not be verified.");
    // Bounded batches avoid overwhelming the deployment. Credentials are never sent to assets.
    let hasUrl = false, hasKey = false;
    for (let start = 0; start < assets.length; start += 4) {
      const code = await Promise.all(assets.slice(start, start + 4).map(async url => {
        const response = await request(url);
        if (response.status !== 200) throw new ProbeFailure("A registration asset is unavailable (HTTP " + response.status + ").");
        return readBody(response, 2 * 1024 * 1024);
      }));
      for (const bundle of code) { hasUrl ||= bundle.includes(supabaseUrl); hasKey ||= bundle.includes(supabaseKey); }
    }
    if (!hasUrl || !hasKey) throw new ProbeFailure("Served browser configuration differs from the expected Supabase URL/key or cannot be verified. Rebuild after environment changes.");
    return "Served browser assets contain the expected public Supabase configuration.";
  });
  await probe("authentication", async () => {
    const response = await request(backend + "/auth/v1/health", { apikey: supabaseKey });
    const body = await readBody(response, 65536);
    if (response.status !== 200) throw new ProbeFailure("Authentication service is unavailable (HTTP " + response.status + ").");
    let health;
    try { health = JSON.parse(body); } catch { throw new ProbeFailure("Authentication service returned an invalid health response."); }
    if (!health || typeof health.name !== "string" || !/gotrue/i.test(health.name) || typeof health.version !== "string") {
      throw new ProbeFailure("Authentication service returned an unexpected health response.");
    }
    const settings = await request(backend + "/auth/v1/settings", { apikey: supabaseKey });
    const raw = await readBody(settings, 65536);
    if (settings.status !== 200) throw new ProbeFailure("Authentication settings could not be read with the configured public key (HTTP " + settings.status + ").");
    let configuration;
    try { configuration = JSON.parse(raw); } catch { throw new ProbeFailure("Authentication service returned invalid settings."); }
    if (configuration?.disable_signup !== false || configuration?.external?.email !== true) {
      throw new ProbeFailure("Email self-registration is disabled or its availability could not be verified.");
    }
    return "Authentication responds with the configured public key and enables email registration.";
  });
  await Promise.all(["/dashboard", "/hr", "/settings"].map(path => probe("access:" + path, async () => {
    const response = await request(app + path);
    await readBody(response, 2 * 1024 * 1024);
    const location = response.headers.get("location");
    let destination;
    try { destination = new URL(location, app); } catch { /* Fail below. */ }
    if (response.status !== 307 || !location || destination?.origin !== app || destination?.pathname !== "/login") {
      throw new ProbeFailure("Unauthenticated access did not redirect to the same site's login page (HTTP " + response.status + ").");
    }
    return "Unauthenticated page access redirects to login.";
  })));
  await Promise.all(["/api/auth/session", "/api/telemetry/history", "/api/telemetry/live-status", "/api/hr/workspace", "/api/organizations/aggregate-consent"]
    .map(path => probe("access:" + path, async () => {
      const response = await request(app + path);
      await readBody(response, 65536);
      if (response.status !== 401) throw new ProbeFailure("Private endpoint did not require authentication (HTTP " + response.status + ").");
      return "Private endpoint rejects anonymous access.";
    })));
  return { ok: checks.every(check => check.ok), checks };
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] === "--help") {
    console.log("Usage: npm run check:deployment -- https://your-site.example\nReads Next.js production environment files. Uses only public configuration and read-only requests.");
    if (process.argv[2] !== "--help") process.exitCode = 1;
    return;
  }
  let envError = false;
  loadEnvConfig(process.cwd(), false, { info() {}, error() { envError = true; } });
  if (envError) throw new ProbeFailure("Environment configuration could not be loaded.");
  const report = await checkDeployment({ appOrigin: process.argv[2],
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
  for (const check of report.checks) console.log((check.ok ? "PASS " : "FAIL ") + check.name + ": " + check.message);
  console.log(report.ok ? "Public deployment checks passed." : "Deployment checks failed; do not claim registration is working.");
  console.log("Authenticated ingestion, email delivery, provider authorization and live tenant isolation are separate verification requirements.");
  if (!report.ok) process.exitCode = 1;
}
if (require.main === module) main().catch(error => { console.error(networkFailure(error)); process.exitCode = 1; });
module.exports = { checkDeployment };
