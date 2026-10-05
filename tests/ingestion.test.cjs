const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createLoader, memoryStorage, plain } = require("./load-typescript.cjs");

function fixture(t, globals = {}, overrides = {}) {
  const root = path.resolve(".data");
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, "test-ingestion-"));
  t.after(() => {
    assert.ok(path.resolve(directory).startsWith(root + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const filename = path.join(directory, "store.json");
  const load = createLoader({ process: { env: { WELLNESS_TELEMETRY_STORE_PATH: filename }, cwd: () => process.cwd() }, ...globals }, {
    "../supabase/serverAuth": { getAuthenticatedUser: async () => ({ id: "employee-1", role: "employee" }), isSameOriginRequest: (request) => request.headers.get("origin") === new URL(request.url).origin },
    ...overrides,
  });
  return { filename, load, aggregator: load("src/lib/telemetry/telemetryAggregator.ts") };
}
function event(overrides = {}) {
  return { eventId: randomUUID(), employeeId: "employee-1", organizationId: "personal:employee-1",
    timestamp: new Date().toISOString(), activeSeconds: 45, isBreak: false, isEvening: false,
    meetingMinutes: 0, source: "workstation", ...overrides };
}

test("metadata validation rejects empty, non-finite, content-bearing and ambiguous observations", () => {
  const { sanitizeAndValidateHeartbeat: validate } = createLoader()("src/lib/telemetry/serverSanitizer.ts");
  for (const raw of [{}, null, [], event({ activeSeconds: Infinity }), event({ isBreak: "false" }),
    event({ content: { text: "private" } }), event({ timestamp: "2026-10-01T12:00:00" }),
    event({ source: "unknown" }), event({ employeeId: "" }), event({ timestamp: "2026-02-30T12:00:00Z" }),
    event({ timestamp: "2026-10-01T24:00:00Z" }), event({ activeSeconds: 0 })]) {
    assert.equal(validate(raw).valid, false, JSON.stringify(raw));
  }
  const now = Date.now();
  assert.equal(validate(event({ timestamp: new Date(now + 10 * 60000).toISOString() }), now).valid, false);
  assert.equal(validate(event({ timestamp: new Date(now - 36 * 86400000).toISOString() }), now).valid, false);
  assert.equal(validate(event()).valid, true);
});

test("one wall-clock hour remains 60 minutes, and replay cannot add time", (t) => {
  const { aggregator } = fixture(t);
  const start = Date.parse(new Date().toISOString().slice(0, 10) + "T09:00:00Z");
  let summary;
  let last;
  for (let i = 1; i <= 80; i++) {
    last = event({ timestamp: new Date(start + i * 45000).toISOString() });
    summary = aggregator.recordLiveHeartbeat(last);
  }
  assert.equal(summary.todayMetrics.workingHours, 1);
  assert.equal(summary.todayActiveMinutes, 60);
  assert.equal(summary.todayMetrics.toolActiveMinutes.workstation, 60);
  assert.deepEqual(plain(aggregator.recordLiveHeartbeat(last).todayMetrics), plain(summary.todayMetrics));
  assert.throws(() => aggregator.recordLiveHeartbeat({ ...last, activeSeconds: 44 }), /reused/);
});

test("overlapping collectors preserve tool provenance without multiplying working time", (t) => {
  const { aggregator } = fixture(t);
  const raw = event({ activeSeconds: 60 });
  aggregator.recordLiveHeartbeat(raw);
  const summary = aggregator.recordLiveHeartbeat({ ...raw, eventId: randomUUID(), source: "vscode" });
  assert.equal(summary.todayMetrics.workingHours, 1 / 60);
  assert.equal(summary.todayMetrics.toolActiveMinutes.workstation, 1);
  assert.equal(summary.todayMetrics.toolActiveMinutes.vscode, 1);
});

test("disabled after-hours measurements stay unknown, and a pure break is an observed count", (t) => {
  const { aggregator, load } = fixture(t);
  const raw = event({ afterHoursObserved: false });
  let summary = aggregator.recordLiveHeartbeat(raw);
  assert.equal(summary.todayMetrics.observedMetrics.includes("afterHoursActivity"), false);
  summary = aggregator.recordLiveHeartbeat(event({ activeSeconds: 0, isBreak: true, afterHoursObserved: false }));
  assert.equal(summary.todayMetrics.observedMetrics.includes("breakFrequency"), true);
  assert.equal(summary.todayMetrics.breakFrequency, 1);
  const validate = load("src/lib/telemetry/serverSanitizer.ts").sanitizeAndValidateHeartbeat;
  assert.equal(validate(event({ afterHoursObserved: false, isEvening: true })).valid, false);
  assert.equal(validate(event({ afterHoursObserved: "false" })).valid, false);
  summary = aggregator.recordLiveHeartbeat(event({ afterHoursObserved: true }));
  assert.equal(summary.todayMetrics.observedMetrics.includes("afterHoursActivity"), true);
});

test("a temporary replacement lock is retried atomically; a persistent failure remains unacknowledged", (t) => {
  let failures = 2;
  const wrappedFs = { ...fs, renameSync: (...args) => {
    if (failures-- > 0) throw Object.assign(new Error("Temporary lock"), { code: "EPERM" });
    return fs.renameSync(...args);
  } };
  const { aggregator, filename } = fixture(t, {}, { "node:fs": wrappedFs });
  const packet = event();
  assert.equal(aggregator.recordLiveHeartbeat(packet).todayMetrics.workingHours * 3600, 45);
  const before = fs.readFileSync(filename, "utf8");
  failures = 10;
  assert.throws(() => aggregator.recordLiveHeartbeat(event()), /Temporary lock/);
  assert.equal(fs.readFileSync(filename, "utf8"), before);
  assert.equal(fs.existsSync(filename + ".lock"), false);
  assert.equal(fs.readdirSync(path.dirname(filename)).filter((name) => name.endsWith(".tmp")).length, 0);
});

test("event-time bucketing splits midnight and isolates organizations", (t) => {
  const { aggregator } = fixture(t);
  const midnight = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:15Z");
  const summary = aggregator.recordLiveHeartbeat(event({ timestamp: new Date(midnight).toISOString(), activeSeconds: 45 }));
  assert.equal(summary.dailyMetrics.length, 2);
  assert.equal(summary.dailyMetrics.reduce((seconds, metric) => seconds + metric.workingHours * 3600, 0), 45);
  assert.equal(summary.dailyMetrics[0].workingHours * 3600, 30);
  assert.equal(summary.dailyMetrics[1].workingHours * 3600, 15);
  assert.equal(Object.keys(aggregator.getServerMetricsStore("other-organization")).length, 0);
});

test("unavailable or corrupt storage fails instead of acknowledging a write", async (t) => {
  const { load, filename } = fixture(t);
  const { ingestTelemetryRequest } = load("src/lib/telemetry/ingestRequest.ts");
  fs.writeFileSync(filename + ".lock", "locked");
  const request = () => new Request("http://localhost/api/telemetry/heartbeat", { method: "POST", headers: { origin: "http://localhost" }, body: JSON.stringify(event()) });
  const response = await ingestTelemetryRequest(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
  fs.unlinkSync(filename + ".lock");
  fs.writeFileSync(filename, "broken JSON");
  assert.equal((await ingestTelemetryRequest(request())).status, 503);
});

test("ingestion rejects malformed JSON and oversized bodies", async (t) => {
  const { load } = fixture(t);
  const { ingestTelemetryRequest } = load("src/lib/telemetry/ingestRequest.ts");
  const request = (body) => new Request("http://localhost", { method: "POST", headers: { origin: "http://localhost" }, body });
  assert.equal((await ingestTelemetryRequest(request("{"))).status, 400);
  assert.equal((await ingestTelemetryRequest(request("x".repeat(16385)))).status, 413);
  assert.equal((await ingestTelemetryRequest(request(JSON.stringify(event())), true)).status, 400);
});

test("ingestion refuses anonymous, HR, cross-origin and another employee's observations", async (t) => {
  let user = null;
  const { load } = fixture(t, {}, {
    "../supabase/serverAuth": { getAuthenticatedUser: async () => user,
      isSameOriginRequest: (request) => request.headers.get("origin") === new URL(request.url).origin },
  });
  const { ingestTelemetryRequest } = load("src/lib/telemetry/ingestRequest.ts");
  const request = (raw = event(), origin = "http://localhost") => new Request("http://localhost", { method: "POST", headers: { origin }, body: JSON.stringify(raw) });
  assert.equal((await ingestTelemetryRequest(request())).status, 401);
  user = { id: "employee-1", role: "hr" };
  assert.equal((await ingestTelemetryRequest(request())).status, 403);
  user.role = "employee";
  assert.equal((await ingestTelemetryRequest(request(event(), "http://other-host"))).status, 403);
  assert.equal((await ingestTelemetryRequest(request(event({ employeeId: "employee-2" })))).status, 403);
  assert.equal((await ingestTelemetryRequest(request())).status, 200);
});

test("fresh telemetry preserves calendar imports, corrections can decrease totals, stale acknowledgements cannot regress them", () => {
  const load = createLoader({ window: {}, localStorage: memoryStorage() });
  const { saveEmployeeMetrics, getEmployeeMetrics } = load("src/lib/wellbeing/employeeMetrics.ts");
  const base = { employeeId: "employee-1", date: "2026-10-01", source: "google_calendar",
    workingHours: 0, meetingLoad: 2, breakFrequency: 0, afterHoursActivity: 30,
    observedMetrics: ["meetingLoad", "afterHoursActivity"] };
  saveEmployeeMetrics(base);
  saveEmployeeMetrics({ ...base, source: "telemetry", workingHours: 45 / 3600, meetingLoad: 0,
    afterHoursActivity: 0, observedMetrics: ["workingHours", "breakFrequency", "afterHoursActivity"],
    telemetryRevision: 2, toolActiveMinutes: { workstation: 0.75 } });
  let metric = getEmployeeMetrics()[0];
  assert.equal(metric.meetingLoad, 2);
  assert.equal(metric.workingHours, 45 / 3600);
  saveEmployeeMetrics({ ...base, meetingLoad: 1 });
  assert.equal(getEmployeeMetrics()[0].meetingLoad, 1);
  saveEmployeeMetrics({ ...metric, source: "telemetry", contributions: undefined, workingHours: 0, telemetryRevision: 1 });
  assert.equal(getEmployeeMetrics()[0].workingHours, 45 / 3600);
});

test("calendar imports count overlapping blocks once, split dates and after-hours, and do not fabricate focus", () => {
  const { parseCalendarBlocksToSignals: parse } = createLoader()("src/lib/integrations/calendarConnector.ts");
  const options = { now: Date.parse("2026-10-03T12:00:00Z"), timeZone: "UTC" };
  const raw = [{ start: "2026-10-01T17:45:00Z", end: "2026-10-01T18:15:00Z" }];
  const signal = parse("employee-1", [...raw, ...raw], options)[0];
  assert.equal(signal.meetingMinutes, 30);
  assert.equal(signal.afterHoursMinutes, 15);
  assert.equal(signal.activeMinutes, 0);
  assert.equal(signal.breakCount, 0);
  assert.deepEqual(plain(signal.observedMetrics), ["meetingLoad", "afterHoursActivity"]);
  const overnight = parse("employee-1", [{ start: "2026-10-01T23:45:00Z", end: "2026-10-02T00:15:00Z" }], options);
  assert.deepEqual(plain(overnight.map((signal) => signal.meetingMinutes)), [15, 15]);
  assert.equal(parse("employee-1", [{ start: "2026-10-04T10:00:00Z", end: "2026-10-04T11:00:00Z" }], options).length, 0);
  assert.throws(() => parse("employee-1", [{ start: "invalid", end: "invalid" }], options), /timezone/);
});

test("a complete calendar resync clears cancelled meetings without inventing other observations", () => {
  const load = createLoader({ window: {}, localStorage: memoryStorage() });
  const { parseCalendarBlocksToSignals: parse } = load("src/lib/integrations/calendarConnector.ts");
  const { signalToMetrics } = load("src/lib/signals/metricsMapper.ts");
  const { saveEmployeeMetricsBatch, getEmployeeMetrics } = load("src/lib/wellbeing/employeeMetrics.ts");
  const options = { now: Date.parse("2026-10-03T12:00:00Z"), timeZone: "UTC",
    coverage: { start: "2026-10-01T00:00:00Z", end: "2026-10-03T12:00:00Z" } };
  const event = { start: "2026-10-01T10:00:00Z", end: "2026-10-01T11:00:00Z" };
  saveEmployeeMetricsBatch(parse("employee-1", [event], options).map(signalToMetrics));
  assert.equal(getEmployeeMetrics()[0].meetingLoad, 1);
  saveEmployeeMetricsBatch(parse("employee-1", [], options).map(signalToMetrics));
  assert.equal(getEmployeeMetrics()[0].meetingLoad, 0);
  assert.equal(getEmployeeMetrics().length, 3);
  assert.deepEqual(plain(getEmployeeMetrics()[0].observedMetrics), ["meetingLoad", "afterHoursActivity"]);
  const clipped = parse("employee-1", [{ start: "2026-09-30T23:30:00Z", end: "2026-10-01T00:30:00Z" }], options);
  assert.equal(clipped[0].meetingMinutes, 30);
  assert.throws(() => parse("employee-1", [], { ...options, coverage: { start: "invalid", end: options.coverage.end } }), /coverage/);
});

test("GitHub rate limits fail the sync instead of creating a zero-activity day", async () => {
  const { fetchGitHubSignals } = createLoader({ fetch: async () => ({ ok: false, status: 403 }) })("src/lib/integrations/githubConnector.ts");
  await assert.rejects(fetchGitHubSignals("employee", "employee-1"), /403/);
});

test("GitHub timestamps provide event counts without invented duration", async () => {
  let calls = 0;
  const timestamp = new Date().toISOString();
  const { fetchGitHubSignals } = createLoader({ fetch: async () => ++calls === 1 ? { ok: true } : {
    ok: true, json: async () => [{ id: "1", type: "PushEvent", created_at: timestamp },
      { id: "1", type: "PushEvent", created_at: timestamp }, { id: "2", type: "WatchEvent", created_at: timestamp }],
  } })("src/lib/integrations/githubConnector.ts");
  const signals = await fetchGitHubSignals("employee", "employee-1");
  assert.equal(signals[0].githubEventCount, 1);
  assert.equal(signals[0].activeMinutes, 0);
  assert.equal(signals[0].breakCount, 0);
  assert.deepEqual(plain(signals[0].observedMetrics), []);
});

test("unobserved metrics cannot produce changes or establish a baseline", () => {
  const load = createLoader();
  const { buildEmployeeAssessment } = load("src/lib/wellbeing/employeeAssessment.ts");
  const { detectEmployeeChanges } = load("src/lib/wellbeing/employeeChangeDetection.ts");
  const baseline = Array.from({ length: 28 }, (_, index) => ({ employeeId: "employee-1",
    date: new Date(Date.UTC(2026, 8, index + 1)).toISOString().slice(0, 10), source: "google_calendar",
    workingHours: 0, meetingLoad: 1, breakFrequency: 0, afterHoursActivity: 0, observedMetrics: ["meetingLoad", "afterHoursActivity"] }));
  const current = { ...baseline[0], date: "2026-10-01", meetingLoad: 2 };
  assert.deepEqual(plain(detectEmployeeChanges(baseline, current).map((change) => change.metric)), ["meetingLoad", "afterHoursActivity"]);
  const unknown = baseline.map((metric) => ({ ...metric, source: "github", observedMetrics: [] }));
  assert.equal(buildEmployeeAssessment([...unknown, { ...current, observedMetrics: [] }]).score, null);
});
