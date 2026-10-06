const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader, plain } = require("./load-typescript.cjs");
const now = Date.parse("2026-10-07T09:00:00Z");
const trap = () => { throw Error("Public samples must never access account storage or network"); };
const sample = createLoader({ fetch: trap, localStorage: { getItem: trap, setItem: trap }, window: { dispatchEvent: trap } })("src/lib/demo/presentation.ts");

test("public samples use actual assessment logic with disjoint baseline and recent windows", () => {
  for (const scenario of ["busy", "steady"]) {
    const result = sample.createPresentationSample(scenario, now);
    assert.equal(result.days.length, 35);
    assert.ok(result.days.every(day => day.source === "demo" && day.date < "2026-10-07"));
    assert.equal(result.assessment.coverage.meetingLoad.baselineDays, 28);
    assert.equal(result.assessment.coverage.meetingLoad.recentDays, 7);
    assert.ok(result.assessment.coverage.meetingLoad.baselineEnd < result.assessment.comparisonStart);
    assert.equal(result.assessment.coverage.meetingLoad.baselineValue, 2);
    assert.equal(result.assessment.coverage.meetingLoad.recentValue, scenario === "busy" ? 3 : 2);
    assert.equal(result.assessment.score, scenario === "busy" ? 46 : 100);
    assert.deepEqual(plain(result), plain(sample.createPresentationSample(scenario, now)));
  }
});
test("incomplete and missing sample evidence cannot produce an overall index", () => {
  const calibrating = sample.createPresentationSample("calibrating", now).assessment;
  assert.equal(calibrating.status, "building");
  assert.equal(calibrating.daysCollected, 14);
  assert.equal(calibrating.score, null);
  assert.equal(calibrating.comparisons.length, 0);
  const partial = sample.createPresentationSample("partial", now).assessment;
  assert.equal(partial.status, "partial");
  assert.equal(partial.score, null);
  assert.equal(partial.comparisons.length, 3);
  assert.equal(partial.coverage.afterHoursActivity.recentValue, null);
  assert.equal(partial.coverage.afterHoursActivity.baselineDays, 0);
});
test("public group illustration suppresses every metric below three contributors", () => {
  for (const count of [0, 1, 2]) assert.equal(sample.presentationGroup(count).metrics, null);
  const result = sample.presentationGroup(3);
  assert.equal(result.available, true);
  assert.equal(result.metrics.meetingLoad, 2.7);
  assert.deepEqual(Object.keys(result).sort(), ["available", "contributors", "metrics"]);
});
