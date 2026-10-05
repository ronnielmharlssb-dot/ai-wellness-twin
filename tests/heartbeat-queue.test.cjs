const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const { IDBFactory, IDBKeyRange } = require("fake-indexeddb");
const { createLoader, memoryStorage, plain } = require("./load-typescript.cjs");
const start = Date.parse("2026-10-05T10:00:00Z");
function event(overrides = {}) {
  return { eventId: "stable-event", employeeId: "employee-1", organizationId: "personal:employee-1",
    timestamp: new Date(start - 45000).toISOString(), activeSeconds: 45, meetingMinutes: 0,
    isBreak: false, isEvening: false, afterHoursObserved: true, source: "workstation", ...overrides };
}
function acknowledgement(packet, overrides = {}) {
  const values = { workingHours: 45 / 3600, meetingLoad: 0, breakFrequency: 0, afterHoursActivity: 0,
    observedMetrics: ["workingHours", "breakFrequency", "afterHoursActivity"] };
  return { success: true, summary: { dailyMetrics: [{ ...values, employeeId: packet.employeeId, date: packet.timestamp.slice(0, 10),
    source: "telemetry", cloudRevision: 1, telemetryRevision: 1, toolActiveMinutes: { workstation: .75 },
    contributions: { telemetry: values }, ...overrides }] } };
}
function fixture(t, upload = async packet => ({ ok: true, json: async () => acknowledgement(packet) }), options = {}) {
  let now = start;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const database = options.database ?? new IDBFactory(), localStorage = options.localStorage ?? memoryStorage();
  const user = { id: "employee-1", role: "employee", source: "supabase" };
  const listeners = new Map();
  const window = {
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
    dispatchEvent(event) { for (const callback of listeners.get(event.type) ?? []) callback(event); },
  };
  const calls = [], cached = [];
  const load = createLoader({ window, localStorage, indexedDB: database, IDBKeyRange, Date: Clock, crypto: options.crypto ?? webcrypto,
    CustomEvent: class { constructor(type) { this.type = type; } },
    fetch: async (_, init) => { const packet = JSON.parse(init.body); calls.push(packet); return upload(packet, init); },
  }, { "../supabase/auth": { getLocalSessionUser: () => user },
    "../wellbeing/employeeMetrics": { saveEmployeeMetricsBatch: metrics => { cached.push(metrics); } } });
  const queues = [];
  const fresh = () => { const { HeartbeatQueueService } = load("src/lib/telemetry/heartbeatQueue.ts"); const queue = new HeartbeatQueueService(); queues.push(queue); return queue; };
  t.after(() => queues.forEach(queue => queue.stop()));
  return { user, database, localStorage, window, calls, cached, fresh, load,
    store: load("src/lib/telemetry/heartbeatQueueStore.ts"), advance: ms => { now += ms; } };
}
async function capture(queue, packet = event()) { queue.start(packet.employeeId, true); queue.enqueue(packet); await queue.flush(); }

test("a closed tab's pending packet is recovered by another worker with the original event ID", async t => {
  let online = false;
  const f = fixture(t, async packet => online ? { ok: true, json: async () => acknowledgement(packet) } : { ok: false, status: 503 });
  const old = f.fresh(); await capture(old); old.setPaused(false); await old.flush(); old.stop();
  assert.equal((await f.store.listHeartbeatRows(f.user.id))[0].status, "pending");
  f.advance(6000); online = true;
  const next = f.fresh(); next.start(f.user.id, false); await next.flush();
  assert.equal(f.calls.length, 2); assert.deepEqual(plain(f.calls[0]), plain(f.calls[1]));
  const receipt = (await f.store.listHeartbeatRows(f.user.id))[0];
  assert.equal(receipt.status, "acknowledged"); assert.equal(receipt.observation, undefined);
  assert.equal(next.getState().pendingEvents, 0); assert.equal(f.cached.length, 1);
});
test("two workers competing for the same packet receive one transactional claim", async t => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const f = fixture(t, async packet => { await held; return { ok: true, json: async () => acknowledgement(packet) }; });
  const first = f.fresh(); await capture(first);
  const second = f.fresh(); second.start(f.user.id, true); await second.flush();
  first.setPaused(false); second.setPaused(false);
  await second.flush();
  assert.equal(f.calls.length, 1);
  release(); await first.flush();
  assert.equal((await f.store.listHeartbeatRows(f.user.id))[0].status, "acknowledged");
});
test("expired leases can be recovered and a stale owner cannot settle the new claim", async t => {
  const f = fixture(t); const queue = f.fresh(); await capture(queue); queue.stop();
  const first = await f.store.claimHeartbeatRow(f.user.id, "crashed-tab", start);
  assert.equal(await f.store.claimHeartbeatRow(f.user.id, "new-tab", start + 59999), null);
  const next = await f.store.claimHeartbeatRow(f.user.id, "new-tab", start + 60000);
  assert.equal(next.id, first.id);
  assert.equal(await f.store.settleHeartbeatRow(f.user.id, next.id, "crashed-tab", start + 60000, { status: "acknowledged" }), false);
  assert.equal(await f.store.settleHeartbeatRow(f.user.id, next.id, "new-tab", start + 60000, { status: "acknowledged" }), true);
});
test("legacy per-tab queues recover for only their owner and retain the original storage bytes", async t => {
  const localStorage = memoryStorage();
  const legacyKey = "wellness-heartbeat-queue:employee-1:closed-tab";
  const raw = JSON.stringify([event()]);
  localStorage.setItem(legacyKey, raw);
  localStorage.setItem("wellness-heartbeat-queue:employee-2:other-tab", JSON.stringify([event({ employeeId: "employee-2", organizationId: "personal:employee-2" })]));
  localStorage.setItem("wellness-heartbeat-queue:employee-1:other:tab", JSON.stringify([event({ eventId: "ambiguous-key" })]));
  const f = fixture(t, undefined, { localStorage }); const queue = f.fresh(); queue.start(f.user.id, false); await queue.flush();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].eventId, "stable-event");
  assert.equal(localStorage.getItem(legacyKey), raw);
  queue.stop();
  const next = f.fresh(); next.start(f.user.id, false); await next.flush();
  assert.equal(f.calls.length, 1, "receipt prevents replaying the preserved legacy backup");
});
test("expired, corrupt and content-bearing legacy data is retained for review without upload", async t => {
  const localStorage = memoryStorage();
  localStorage.setItem("wellness-heartbeat-queue:employee-1:expired", JSON.stringify([event({ timestamp: new Date(start - 36 * 86400000).toISOString() })]));
  localStorage.setItem("wellness-heartbeat-queue:employee-1:corrupt", "broken-json");
  localStorage.setItem("wellness-heartbeat-queue:employee-1:content", JSON.stringify([event({ content: "private text" })]));
  const f = fixture(t, undefined, { localStorage }); const queue = f.fresh(); queue.start(f.user.id, false); await queue.flush();
  assert.equal(f.calls.length, 0); assert.equal(queue.getRejectedObservations().length, 3);
  assert.equal(localStorage.getItem("wellness-heartbeat-queue:employee-1:corrupt"), "broken-json");
});
test("same event IDs do not reset pending state, and conflicting metadata preserves both observations", async t => {
  const f = fixture(t); const queue = f.fresh(); await capture(queue);
  queue.enqueue(event()); queue.enqueue(event({ activeSeconds: 30 })); await queue.flush();
  const rows = await f.store.listHeartbeatRows(f.user.id);
  assert.equal(rows.length, 2); assert.equal(rows.filter(row => row.status === "pending").length, 1);
  assert.equal(rows.find(row => row.status === "pending").observation.activeSeconds, 45);
  assert.equal(rows.find(row => row.status === "rejected").observation.activeSeconds, 30);
});
test("a changed employee or HR authority cannot consume or cache an in-flight acknowledgement", async t => {
  for (const roleChange of [false, true]) {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const f = fixture(t, async packet => { await held; return { ok: true, json: async () => acknowledgement(packet) }; });
    const queue = f.fresh(); await capture(queue); queue.setPaused(false);
    while (!f.calls.length) await new Promise(setImmediate);
    if (roleChange) f.user.role = "hr"; else f.user.id = "employee-2";
    release(); await queue.flush();
    assert.equal(f.cached.length, 0); assert.equal(queue.getState().pendingEvents, 0);
    assert.equal((await f.store.listHeartbeatRows("employee-1"))[0].status, "pending");
    assert.equal(queue.getRejectedObservations().length, 0);
  }
});
test("wrong-owner, empty and malformed acknowledgements cannot update the cache or remove the packet", async t => {
  for (const response of [{ success: true, summary: { dailyMetrics: [] } }, acknowledgement(event(), { employeeId: "employee-2" }),
    acknowledgement(event(), { cloudRevision: 0 }), acknowledgement(event(), { observedMetrics: ["imaginary"] })]) {
    const f = fixture(t, async () => ({ ok: true, json: async () => response }));
    const queue = f.fresh(); await capture(queue); queue.setPaused(false); await queue.flush();
    assert.equal(f.cached.length, 0); assert.equal((await f.store.listHeartbeatRows(f.user.id))[0].status, "pending");
  }
});
test("permanent rejections preserve the payload and fresh observations continue uploading", async t => {
  const f = fixture(t, async packet => packet.eventId === "stable-event" ? { ok: false, status: 409 }
    : { ok: true, json: async () => acknowledgement(packet) });
  const queue = f.fresh(); await capture(queue); queue.enqueue(event({ eventId: "fresh" })); await queue.flush();
  queue.setPaused(false); await queue.flush();
  assert.equal(f.calls.length, 2); assert.equal(queue.getState().pendingEvents, 0);
  assert.equal(queue.getRejectedObservations()[0].observation.eventId, "stable-event");
});
test("an aborted acknowledgement transaction retains the packet for an identical replay", async t => {
  const f = fixture(t); const queue = f.fresh(); await capture(queue);
  let abort = true;
  const open = f.database.open.bind(f.database);
  f.database.open = (...args) => {
    const request = open(...args);
    request.addEventListener("success", () => {
      const db = request.result, transaction = db.transaction.bind(db);
      db.transaction = (...args) => {
        const tx = transaction(...args), objectStore = tx.objectStore.bind(tx);
        tx.objectStore = name => {
          const store = objectStore(name), put = store.put.bind(store);
          store.put = (value, ...args) => {
            const request = put(value, ...args);
            if (abort && value.status === "acknowledged") request.addEventListener("success", () => { abort = false; tx.abort(); });
            return request;
          };
          return store;
        };
        return tx;
      };
    });
    return request;
  };
  queue.setPaused(false); await queue.flush();
  const retained = (await f.store.listHeartbeatRows(f.user.id))[0];
  assert.equal(retained.status, "pending"); assert.ok(retained.observation); assert.equal(f.cached.length, 0);
  f.advance(60000); await queue.flush();
  assert.equal((await f.store.listHeartbeatRows(f.user.id))[0].status, "acknowledged");
  assert.deepEqual(plain(f.calls[0]), plain(f.calls[1]));
});
test("device storage failure remains explicit, and memory-only packets survive retries while the page stays open", async t => {
  let online = false;
  const unavailable = { open() { throw new Error("quota"); } };
  const f = fixture(t, async packet => online ? { ok: true, json: async () => acknowledgement(packet) } : { ok: false, status: 503 }, { database: unavailable });
  const queue = f.fresh(); await capture(queue); queue.setPaused(false); await queue.flush();
  assert.equal(queue.getState().pendingEvents, 1); assert.equal(queue.getState().memoryOnlyEvents, 1);
  assert.match(queue.getState().error, /Memory-only/);
  online = true; f.advance(6000); await queue.flush();
  assert.equal(f.cached.length, 1); assert.equal(queue.getState().pendingEvents, 0);
  assert.deepEqual(plain(f.calls[0]), plain(f.calls[1]));
});
test("receipt retention only prunes old acknowledged rows belonging to the current employee", async t => {
  const f = fixture(t); const queue = f.fresh(); await capture(queue); queue.setPaused(false); await queue.flush();
  const receipt = (await f.store.listHeartbeatRows(f.user.id))[0];
  await f.store.saveHeartbeatRows([{ ...receipt, id: "other-employee", employeeId: "employee-2", acknowledgedAt: start - 40 * 86400000 },
    { ...receipt, id: "rejected-old", status: "rejected", observation: { original: true }, createdAt: start - 40 * 86400000 },
    { ...receipt, id: "pending-old", status: "pending", observation: event(), createdAt: start - 40 * 86400000, nextAttemptAt: start + 100 * 86400000 }]);
  f.advance(36 * 86400000); await queue.flush();
  const rows = await f.store.listHeartbeatRows(f.user.id);
  assert.deepEqual(rows.map(row => row.id).sort(), ["pending-old", "rejected-old"]);
  assert.equal((await f.store.listHeartbeatRows("employee-2")).length, 1);
});
test("acknowledgements handle exact-midnight interval endings and require both dates for a crossing", () => {
  const decode = createLoader()("src/lib/telemetry/heartbeatAcknowledgement.ts").decodeHeartbeatAcknowledgement;
  const midnight = event({ timestamp: "2026-10-05T00:00:00Z" });
  const prior = acknowledgement(midnight, { date: "2026-10-04" });
  assert.equal(decode(prior, midnight, true).length, 1);
  const crossing = event({ timestamp: "2026-10-05T00:00:20Z" });
  assert.throws(() => decode(acknowledgement(crossing), crossing, true), /Incomplete/);
  const both = acknowledgement(crossing); both.summary.dailyMetrics.push({ ...both.summary.dailyMetrics[0], date: "2026-10-04" });
  assert.equal(decode(both, crossing, true).length, 2);
});
test("online recovery and manual retries reset backoff while paused workers keep packets retained", async t => {
  let online = false;
  const f = fixture(t, async packet => online ? { ok: true, json: async () => acknowledgement(packet) } : { ok: false, status: 429 });
  const queue = f.fresh(); await capture(queue); queue.setPaused(false); await queue.flush();
  assert.equal(f.calls.length, 1);
  online = true; queue.setPaused(true);
  f.window.dispatchEvent({ type: "online" }); await queue.retry();
  assert.equal(f.calls.length, 1);
  queue.setPaused(false); await queue.flush(); // Backoff still applies.
  assert.equal(f.calls.length, 1);
  await queue.retry();
  assert.equal(f.calls.length, 2);
  assert.equal(queue.getState().pendingEvents, 0);
});
test("a transient fingerprint failure retains the original captured packet for later preparation", async t => {
  let broken = true;
  const crypto = { randomUUID: () => webcrypto.randomUUID(), subtle: { digest: (...args) => broken ? Promise.reject(new Error("crypto unavailable")) : webcrypto.subtle.digest(...args) } };
  const f = fixture(t, undefined, { crypto }); const queue = f.fresh();
  await capture(queue); queue.setPaused(false); await queue.flush();
  assert.equal(queue.getState().pendingEvents, 1); assert.equal(queue.getState().memoryOnlyEvents, 1);
  assert.equal(f.calls.length, 0);
  broken = false; await queue.retry();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].eventId, event().eventId);
  assert.equal(queue.getState().pendingEvents, 0);
});
test("auth changes abort uploads and leave the original packet pending", async t => {
  let aborted = false;
  const f = fixture(t, async (_, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true });
  }));
  const queue = f.fresh(); await capture(queue); queue.setPaused(false);
  while (!f.calls.length) await new Promise(setImmediate);
  f.user.id = "employee-2"; f.window.dispatchEvent({ type: "wellness-auth-update" });
  await queue.flush();
  assert.equal(aborted, true); assert.equal(f.cached.length, 0);
  assert.equal((await f.store.listHeartbeatRows("employee-1"))[0].status, "pending");
});
test("paused capture is persisted and reports the shared pending count", async t => {
  const f = fixture(t); const queue = f.fresh();
  await capture(queue);
  assert.equal(queue.getState().pendingEvents, 1);
  assert.equal(queue.getState().memoryOnlyEvents, 0);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.store.listHeartbeatRows(f.user.id, false))[0].observation.eventId, event().eventId);
});
