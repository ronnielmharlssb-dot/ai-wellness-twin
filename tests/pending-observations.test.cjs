const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader, plain } = require("./load-typescript.cjs");
const now = Date.parse("2026-10-04T10:00:00Z");
const packet = { eventId: "event-1", employeeId: "employee-1", organizationId: "personal:employee-1",
  timestamp: new Date(now - 45000).toISOString(), activeSeconds: 45, meetingMinutes: 0,
  isBreak: false, isEvening: false, source: "workstation" };
const queue = () => createLoader()("src/lib/telemetry/pendingObservations.ts");

test("expired and malformed legacy packets are retained separately from fresh observations", () => {
  const expired = { ...packet, eventId: "expired", timestamp: new Date(now - 36 * 86400000).toISOString() };
  const invalid = { ...packet, eventId: "invalid", activeSeconds: -1 };
  const otherUser = { ...packet, employeeId: "employee-2" };
  const result = queue().readPendingObservations(JSON.stringify([expired, invalid, otherUser, packet]), "employee-1", now);
  assert.deepEqual(plain(result.pending), [packet]);
  assert.deepEqual(plain(result.rejected.map((item) => item.observation)), [expired, invalid, otherUser]);
  assert.equal(result.rejected.every((item) => item.reason && item.rejectedAt === new Date(now).toISOString()), true);
  assert.deepEqual(plain(queue().readPendingObservations(JSON.stringify(result), "employee-1", now)), plain(result));
});

test("a corrupt saved queue preserves its original value for review", () => {
  for (const raw of ["broken-json", "{}", "null"]) {
    const result = queue().readPendingObservations(raw, "employee-1", now);
    assert.equal(result.pending.length, 0);
    assert.equal(result.rejected.length, 1);
    assert.ok(result.rejected[0].reason);
  }
  assert.equal(queue().readPendingObservations("broken-json", "employee-1", now).rejected[0].observation, "broken-json");
});
test("malformed saved review entries do not block a valid pending observation", () => {
  const result = queue().readPendingObservations(JSON.stringify({
    version: 1, pending: [packet], rejected: [null, "unrecognized", { observation: "original", reason: "reason", rejectedAt: "invalid" }],
  }), "employee-1", now);
  assert.deepEqual(plain(result.pending), [packet]);
  assert.equal(result.rejected.length, 3);
  assert.equal(result.rejected[2].observation.observation, "original");
});
