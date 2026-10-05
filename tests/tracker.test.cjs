const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const { IDBFactory, IDBKeyRange } = require("fake-indexeddb");
const { createLoader, memoryStorage } = require("./load-typescript.cjs");

function surface() {
  const listeners = new Map();
  return {
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
    dispatchEvent(event) { for (const listener of listeners.get(event.type) ?? []) listener(event); },
    emit(name) { this.dispatchEvent({ type: name }); },
  };
}
async function setup(t, upload = async () => ({ ok: false, status: 503 })) {
  let now = Date.parse("2026-10-01T10:00:00Z");
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const window = surface();
  const document = { ...surface(), hidden: false, hasFocus: () => true };
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const indexedDB = new IDBFactory();
  const user = { source: "supabase", id: "employee-1", email: "employee@company.com", role: "employee" };
  const settings = { profile: { timezone: "UTC" }, telemetry: { heartbeatTrackerEnabled: true, inactivityThresholdMinutes: 5,
    autoCaptureAfterHours: true, excludeWeekendActivity: false }, twin: { workdayStart: "09:00", workdayEnd: "18:00", workDays: ["Mon","Tue","Wed","Thu","Fri"] } };
  let tick;
  let cleared = false;
  const packets = [];
  let failSettlements = false;
  const storeLoad = createLoader({ indexedDB, IDBKeyRange, Date: Clock });
  const queueStore = storeLoad("src/lib/telemetry/heartbeatQueueStore.ts");
  const load = createLoader({ indexedDB, IDBKeyRange, window, document, localStorage, sessionStorage, Date: Clock, crypto: webcrypto,
    CustomEvent: class { constructor(type) { this.type = type; } },
    setInterval: (callback) => { tick = callback; return 1; }, clearInterval: () => { cleared = true; },
    fetch: async (url, init) => { const packet = JSON.parse(init.body); packets.push(packet); return upload(packet); },
  }, { "./heartbeatQueueStore": { ...queueStore, settleHeartbeatRow: (...args) => {
      if (failSettlements && args[4].status === "rejected") return Promise.reject(new Error("Storage is full"));
      return queueStore.settleHeartbeatRow(...args);
    } }, "../supabase/auth": { getLocalSessionUser: () => user }, "../settings/userSettings": { getUserSettings: () => settings, userSettingsKey: id => "settings:" + id } });
  const { WorkstationTrackerService } = load("src/lib/telemetry/workstationTracker.ts");
  const tracker = new WorkstationTrackerService();
  tracker.start();
  await tracker.flushPendingObservations();
  t.after(() => tracker.stop());
  return { tracker, packets, settings, user, window, document, localStorage,
    advance: (ms) => { now += ms; }, tick: async () => { await tick(); await tracker.flushPendingObservations(); },
    cleared: () => cleared,
    failSettlements: value => { failSettlements = value; },
    queued: async () => (await queueStore.listHeartbeatRows(user.id)).filter(row => row.status === "pending").map(row => row.observation),
  };
}

test("45 seconds of presence queues 45 seconds and retries the same event ID after failure", async (t) => {
  const context = await setup(t);
  context.advance(45000);
  await context.tick();
  assert.equal((await context.queued()).reduce((sum, packet) => sum + packet.activeSeconds, 0), 45);
  const firstId = context.packets[0].eventId;
  context.advance(45000);
  await context.tick();
  assert.equal(context.packets[1].eventId, firstId);
  assert.equal((await context.queued()).reduce((sum, packet) => sum + packet.activeSeconds, 0), 90);
  assert.equal(context.tracker.getState().todayActiveSeconds, 0);
  assert.ok(context.tracker.getState().error);
});

test("successful acknowledgement removes packets and reports saved activity", async (t) => {
  let total = 0;
  const context = await setup(t, async (packet) => {
    total += packet.activeSeconds;
    return { ok: true, json: async () => ({ success: true, summary: { dailyMetrics: [{
      employeeId: packet.employeeId, date: packet.timestamp.slice(0, 10), source: "telemetry",
      workingHours: total / 3600, meetingLoad: 0, afterHoursActivity: 0, breakFrequency: 0,
      toolActiveMinutes: { workstation: total / 60 }, telemetryRevision: total, cloudRevision: total,
      observedMetrics: ["workingHours", "breakFrequency", "afterHoursActivity"],
      contributions: { telemetry: { workingHours: total / 3600, meetingLoad: 0, afterHoursActivity: 0, breakFrequency: 0, observedMetrics: ["workingHours", "breakFrequency", "afterHoursActivity"] } },
    }] } }) };
  });
  context.advance(45000);
  await context.tick();
  assert.equal((await context.queued()).length, 0);
  assert.equal(context.tracker.getState().todayActiveSeconds, 45);
  assert.ok(context.tracker.getState().lastHeartbeatSentAt);
});

test("idle, hidden, paused and suspended intervals are excluded", async (t) => {
  const context = await setup(t);
  for (let i = 0; i < 8; i++) { context.advance(45000); await context.tick(); }
  assert.equal((await context.queued()).reduce((sum, packet) => sum + packet.activeSeconds, 0), 300);
  context.document.hidden = true;
  context.window.emit("blur");
  context.advance(45000);
  await context.tick();
  assert.equal((await context.queued()).reduce((sum, packet) => sum + packet.activeSeconds, 0), 300);
  context.document.hidden = false;
  context.window.emit("focus");
  context.tracker.pause();
  context.advance(45000);
  await context.tick();
  assert.equal((await context.queued()).reduce((sum, packet) => sum + packet.activeSeconds, 0), 300);
  context.tracker.resume();
  context.advance(10 * 60000);
  await context.tick();
  assert.equal((await context.queued()).reduce((sum, packet) => sum + packet.activeSeconds, 0), 300);
});

test("user changes stop the collector without attributing the next interval to another account", async (t) => {
  const context = await setup(t);
  context.advance(45000);
  context.user.id = "employee-2";
  await context.tick();
  assert.equal(context.tracker.getState().isRunning, false);
  assert.equal((await context.queued()).length, 0);
  assert.equal(context.cleared(), true);
});

test("disabled collection does not start measuring or uploading", async (t) => {
  const context = await setup(t);
  context.settings.telemetry.heartbeatTrackerEnabled = false;
  context.window.emit("wellness-settings-updated");
  context.advance(45000);
  await context.tick();
  assert.equal((await context.queued()).length, 0);
  assert.equal(context.packets.length, 0);
  assert.equal(context.tracker.getState().isPaused, true);
});
test("disabling after-hours measurement sends an explicit unknown flag",async(t)=>{
  const context=await setup(t);
  context.settings.telemetry.autoCaptureAfterHours=false;
  context.window.emit("wellness-settings-updated");
  context.advance(45000);
  await context.tick();
  assert.equal(context.packets[0].afterHoursObserved,false);
  assert.equal(context.packets[0].isEvening,false);
});

test("a permanent server rejection is retained for review while subsequent packets still upload", async (t) => {
  let requests = 0;
  let savedSeconds = 0;
  const context = await setup(t, async (packet) => {
    if (++requests === 1) return { ok: false, status: 400 };
    savedSeconds += packet.activeSeconds;
    return { ok: true, json: async () => ({ success: true, summary: { dailyMetrics: [{
      employeeId: packet.employeeId, date: packet.timestamp.slice(0, 10), source: "telemetry",
      workingHours: savedSeconds / 3600, meetingLoad: 0, afterHoursActivity: 0, breakFrequency: 0,
      toolActiveMinutes: { workstation: savedSeconds / 60 }, telemetryRevision: requests, cloudRevision: requests,
      observedMetrics: ["workingHours", "breakFrequency", "afterHoursActivity"],
      contributions: { telemetry: { workingHours: savedSeconds / 3600, meetingLoad: 0, afterHoursActivity: 0, breakFrequency: 0, observedMetrics: ["workingHours", "breakFrequency", "afterHoursActivity"] } },
    }] } }) };
  });
  context.advance(45000);
  await context.tick();
  assert.equal(context.tracker.getState().rejectedEvents, 1);
  assert.equal(context.tracker.getRejectedObservations()[0].observation.eventId, context.packets[0].eventId);
  context.advance(45000);
  await context.tick();
  assert.equal((await context.queued()).length, 0);
  assert.equal(context.tracker.getState().todayActiveSeconds, 45);
  assert.equal(context.tracker.getState().rejectedEvents, 1);
  context.user.id = "employee-2";
  assert.equal(context.tracker.getRejectedObservations().length, 0);
});

test("authentication and throttling failures retain pending packets for retry", async (t) => {
  let status = 401;
  const context = await setup(t, async () => ({ ok: false, status }));
  context.advance(45000);
  await context.tick();
  const firstId = context.packets[0].eventId;
  for (status of [403, 429, 503]) { context.advance(45000); await context.tick(); }
  assert.ok(context.packets.filter(packet => packet.eventId === firstId).length >= 2);
  assert.ok((await context.queued()).some(packet => packet.eventId === firstId));
  assert.equal(context.tracker.getState().rejectedEvents, 0);
});

test("a failed device write cannot discard a permanently rejected packet", async (t) => {
  const context = await setup(t, async () => ({ ok: false, status: 409 }));
  context.failSettlements(true);
  context.advance(45000); await context.tick();
  assert.equal((await context.queued()).length, 1);
  assert.equal(context.tracker.getState().pendingEvents, 1);
  assert.equal(context.tracker.getState().rejectedEvents, 0);
  const retainedId = context.packets[0].eventId;
  context.failSettlements(false);
  context.advance(60000); await context.tick();
  assert.equal(context.tracker.getState().pendingEvents, 0);
  assert.ok(context.tracker.getRejectedObservations().some(record => record.observation.eventId === retainedId));
});
test("frequent pointer movement does not create a packet for every input event", async t => {
  const context = await setup(t);
  for (let i = 0; i < 90; i++) { context.advance(500); context.window.emit("pointermove"); }
  assert.equal((await context.queued()).length, 0);
  await context.tick();
  assert.equal((await context.queued()).length, 1);
  assert.equal((await context.queued())[0].activeSeconds, 45);
});
test("changing a capture preference closes the prior interval under its original schedule", async t => {
  const context = await setup(t);
  context.advance(20000);
  context.settings.telemetry.autoCaptureAfterHours = false;
  context.window.emit("wellness-settings-updated");
  await context.tracker.flushPendingObservations();
  context.advance(20000); await context.tick();
  const queued = await context.queued();
  assert.equal(queued.filter(packet => packet.afterHoursObserved === true).reduce((sum, packet) => sum + packet.activeSeconds, 0), 20);
  assert.equal(queued.filter(packet => packet.afterHoursObserved === false).reduce((sum, packet) => sum + packet.activeSeconds, 0), 20);
});
test("a missed cross-tab pause drops the uncertain open interval and pauses collection", async t => {
  const context = await setup(t);
  context.advance(20000); context.settings.telemetry.heartbeatTrackerEnabled = false;
  await context.tick();
  assert.equal(context.tracker.getState().isPaused, true);
  assert.equal((await context.queued()).length, 0);
});
