const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader, memoryStorage, plain } = require("./load-typescript.cjs");
const now = Date.parse("2026-10-05T12:00:00Z");
const end = Date.parse("2026-10-05T00:00:00Z");
const names = ["workingHours", "meetingLoad", "breakFrequency", "afterHoursActivity"];
const load = createLoader();
const { buildEmployeeAssessment: build } = load("src/lib/wellbeing/employeeAssessment.ts");
const { detectEmployeeChanges, calculateEmployeeBaselineAverages: averages } = load("src/lib/wellbeing/employeeChangeDetection.ts");
function day(offset, overrides = {}) {
  return { employeeId: "employee-1", date: new Date(end - offset * 86400000).toISOString().slice(0, 10),
    source: "telemetry", workingHours: 8, meetingLoad: 2, breakFrequency: 4, afterHoursActivity: 10, observedMetrics: names, ...overrides };
}
function history(overrides = {}) { return Array.from({ length: 35 }, (_, i) => day(i + 1, overrides)); }
const assess = metrics => build(metrics, { now });

test("complete assessment compares seven closed dates with 28 separate earlier dates", () => {
  const result = assess(history());
  assert.equal(result.score, 100);
  assert.equal(result.status, "stable");
  assert.equal(result.comparisonStart, "2026-09-28");
  assert.equal(result.comparisonEnd, "2026-10-04");
  for (const evidence of Object.values(result.coverage)) {
    assert.equal(evidence.baselineDays, 28); assert.equal(evidence.recentDays, 7);
    assert.ok(evidence.baselineEnd < result.comparisonStart);
  }
});
test("a final-day outlier is averaged across the week, not presented as the whole week", () => {
  const metrics = history(); metrics[0].workingHours = 16;
  const result = assess(metrics);
  assert.equal(result.coverage.workingHours.recentValue, 64 / 7);
  assert.equal(result.changes.some(change => change.metric === "workingHours"), false);
});
test("calendar-only history stays partial and cannot claim an overall score", () => {
  const result = assess(history({ source: "google_calendar", observedMetrics: ["meetingLoad", "afterHoursActivity"] }));
  assert.equal(result.score, null); assert.equal(result.status, "partial");
  assert.deepEqual(plain(result.comparableMetrics), ["meetingLoad", "afterHoursActivity"]);
  assert.equal(result.coverage.workingHours.baselineValue, null);
});
test("28 total observations cannot serve as both baseline and recent evidence", () => {
  const result = assess(history().slice(0, 28));
  assert.equal(result.status, "building"); assert.equal(result.score, null);
  assert.equal(result.coverage.workingHours.baselineDays, 21);
});
test("today and future observations cannot alter a completed-day comparison", () => {
  const result = assess([...history(), day(0, { workingHours: 24 }), day(-1, { workingHours: 24 })]);
  assert.equal(result.score, 100); assert.equal(result.coverage.workingHours.recentValue, 8);
});
test("missing values never contribute fabricated zero to an average", () => {
  const result = averages([day(1, { workingHours: 10 }), day(2, { workingHours: 0, observedMetrics: ["meetingLoad"] })]);
  assert.equal(result.workingHours, 10);
  assert.equal(averages([day(1, { observedMetrics: [] })]).workingHours, null);
});
test("duplicate dates cannot establish a baseline; direct comparisons require prior unique dates", () => {
  assert.equal(assess(Array.from({ length: 35 }, () => day(8))).score, null);
  assert.equal(detectEmployeeChanges(Array.from({ length: 28 }, () => day(8)), day(1)).length, 0);
  assert.equal(detectEmployeeChanges(history(), day(1, { date: "2026-02-30" })).length, 0);
});
test("a newly nonzero value has an undefined percentage rather than an invented 100%", () => {
  const metrics = history({ afterHoursActivity: 0 }); metrics[0].afterHoursActivity = 30;
  const result = assess(metrics);
  const change = result.changes.find(change => change.metric === "afterHoursActivity");
  assert.equal(change.percentageChange, null); assert.equal(change.meaningful, true);
  assert.equal(result.score, null); assert.equal(result.status, "partial");
});
test("a single recent observed date supplies a scoped comparison but no overall index", () => {
  const metrics = history().filter(metric => metric.date < "2026-09-28" || metric.date === "2026-10-04");
  const result = assess(metrics);
  assert.equal(result.comparisons.length, 4); assert.equal(result.coverage.workingHours.recentDays, 1);
  assert.equal(result.score, null); assert.equal(result.status, "partial");
});
test("invalid values, impossible dates, stale history and mixed employees do not calibrate", () => {
  for (const metrics of [history({ workingHours: Infinity }), history({ workingHours: -1 }),
    history({ breakFrequency: 1.5 }), history({ date: "2026-02-30" }),
    history().map(metric => ({ ...metric, date: "2026-01-01" })),
    [...history(), day(40, { employeeId: "someone-else" })]]) {
    assert.equal(assess(metrics).score, null);
  }
});
test("baseline uses the most recent 28 earlier observations, not the first old records", () => {
  const metrics = [...history(), ...Array.from({ length: 20 }, (_, i) => day(i + 36, { workingHours: 20 }))];
  assert.equal(assess(metrics).coverage.workingHours.baselineValue, 8);
});
test("recommendations describe the actual direction and never infer burnout", () => {
  const metrics = history(); for (const metric of metrics.slice(0, 7)) metric.breakFrequency = 8;
  const recommendations = load("src/lib/wellbeing/recommendationEngine.ts").buildRecommendations(assess(metrics));
  assert.match(recommendations[0].reason, /increased/);
  assert.doesNotMatch(recommendations[0].reason, /below|burnout/);
});
test("the evidence view reveals missing coverage without claiming health or full-day capture", () => {
  const React = require("react"); const { renderToStaticMarkup } = require("react-dom/server");
  const { AssessmentEvidence } = load("src/components/ui/assessment-evidence.tsx");
  const html = renderToStaticMarkup(React.createElement(AssessmentEvidence, {
    assessment: assess(history({ source: "google_calendar", observedMetrics: ["meetingLoad", "afterHoursActivity"] })) }));
  assert.match(html, /overall pattern index is unavailable/);
  assert.match(html, /Closed dates do not prove full-day capture/);
  assert.doesNotMatch(html, /employee-1/);
});
test("private reflections use account-scoped keys and reject a changed or HR session", () => {
  const localStorage = memoryStorage(); let user = { id: "employee-1", role: "employee" };
  const scopedLoad = createLoader({ localStorage }, { "../supabase/auth": { getLocalSessionUser: () => user } });
  const store = scopedLoad("src/lib/wellbeing/privateReflectionStore.ts");
  localStorage.setItem("friday-survey-2026-W40", JSON.stringify({ feeling: "drained", note: "legacy private note" }));
  assert.equal(store.readPrivateReflection("employee-1", "2026-09-28"), null);
  store.savePrivateReflection("employee-1", "2026-09-28", "balanced", "private employee 1");
  user = { id: "employee-2", role: "employee" };
  assert.equal(store.readPrivateReflection("employee-2", "2026-09-28"), null);
  assert.throws(() => store.readPrivateReflection("employee-1", "2026-09-28"));
  assert.throws(() => store.savePrivateReflection("employee-1", "2026-09-28", "balanced", "overwrite"));
  user = { id: "employee-1", role: "hr" };
  assert.throws(() => store.readPrivateReflection("employee-1", "2026-09-28"));
});
test("corrupt or mismatched saved reflections are not accepted; storage failure remains explicit", () => {
  const localStorage = memoryStorage(); const user = { id: "employee-1", role: "employee" };
  const store = createLoader({ localStorage }, { "../supabase/auth": { getLocalSessionUser: () => user } })("src/lib/wellbeing/privateReflectionStore.ts");
  localStorage.setItem("wellness-reflection-v1:employee-1:2026-09-28", JSON.stringify({ employeeId: "employee-2" }));
  assert.equal(store.readPrivateReflection(user.id, "2026-09-28"), null);
  localStorage.setItem = () => { throw new Error("quota"); };
  assert.throws(() => store.savePrivateReflection(user.id, "2026-09-28", "balanced", "not saved"), /quota/);
});
