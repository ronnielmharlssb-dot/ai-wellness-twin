import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { MAX_EVENT_AGE_MS, type ValidatedHeartbeat } from "./serverSanitizer";
import type { EmployeeDailyMetrics } from "../wellbeing/employeeTypes";
import { intervalSeconds as seconds, unionIntervals, type Interval } from "../signals/intervals";

type DayBucket = {
  employeeId: string;
  organizationId: string;
  date: string;
  active: Record<string, Interval[]>;
  meetings: Interval[];
  afterHours: Interval[];
  afterHoursObserved?: boolean;
  breaks: number[];
  lastHeartbeatTimestamp: string;
  revision: number;
};
type Store = {
  version: 1;
  days: Record<string, DayBucket>;
  receipts: Record<string, { hash: string; timestamp: number }>;
};
export type LiveTelemetrySummary = {
  todayMetrics: EmployeeDailyMetrics;
  /** All daily buckets touched by this event, including midnight crossings. */
  dailyMetrics: EmployeeDailyMetrics[];
  todayActiveMinutes: number;
  todayBreakCount: number;
  todayMeetingMinutes: number;
  todayAfterHoursMinutes: number;
  lastHeartbeatTimestamp: string;
};

function storePath() {
  const configured = process.env.WELLNESS_TELEMETRY_STORE_PATH;
  if (process.env.NODE_ENV === "production" && (!configured || !path.isAbsolute(configured))) {
    throw new Error("Production telemetry requires an absolute path on a persistent single-host volume.");
  }
  return configured || path.join(process.cwd(), ".data", "telemetry-v1.json");
}
function readStore(): Store {
  const filename = storePath();
  // Runtime observations are private state, never build inputs to be bundled.
  if (!fs.existsSync(/* turbopackIgnore: true */ filename)) return { version: 1, days: {}, receipts: {} };
  const store = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ filename, "utf8")) as Store;
  if (store.version !== 1 || !store.days || !store.receipts) throw new Error("Invalid telemetry store.");
  return store;
}

function replaceSnapshot(temporaryPath: string, filename: string) {
  // Windows scanners may briefly hold the destination. Keep atomic replacement;
  // never delete the old snapshot or acknowledge a failed write.
  for (let attempt = 0; ; attempt++) {
    try { fs.renameSync(temporaryPath, filename); return; }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= 5 || !["EPERM", "EBUSY", "EACCES"].includes(code ?? "")) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10 * 2 ** attempt);
    }
  }
}

function metricFor(bucket: DayBucket): EmployeeDailyMetrics {
  return {
    employeeId: bucket.employeeId,
    date: bucket.date,
    source: "telemetry",
    telemetryRevision: bucket.revision,
    workingHours: seconds(Object.values(bucket.active).flat()) / 3600,
    meetingLoad: seconds(bucket.meetings) / 3600,
    breakFrequency: bucket.breaks.length,
    afterHoursActivity: seconds(bucket.afterHours) / 60,
    toolActiveMinutes: Object.fromEntries(Object.entries(bucket.active).map(([source, intervals]) => [source, seconds(intervals) / 60])),
    observedMetrics: [
      ...(Object.keys(bucket.active).length ? ["workingHours", "breakFrequency"] as const : bucket.breaks.length ? ["breakFrequency"] as const : []),
      ...(bucket.meetings.length ? ["meetingLoad"] as const : []),
      ...(bucket.afterHoursObserved !== false ? ["afterHoursActivity"] as const : []),
    ],
  };
}
export function getServerMetricsStore(organizationId: string): Record<string, EmployeeDailyMetrics[]> {
  const result: Record<string, EmployeeDailyMetrics[]> = Object.create(null);
  for (const bucket of Object.values(readStore().days)) {
    if (bucket.organizationId !== organizationId) continue;
    (result[bucket.employeeId] ??= []).push(metricFor(bucket));
  }
  return result;
}
export function getLastHeartbeat(organizationId: string, employeeId: string): string | null {
  return Object.values(readStore().days)
    .filter((bucket) => bucket.organizationId === organizationId && bucket.employeeId === employeeId)
    .map((bucket) => bucket.lastHeartbeatTimestamp).sort().at(-1) ?? null;
}

/** Local single-host storage: lock writers and atomically replace the durable snapshot.
 * Use a shared transactional backend before deploying multiple server instances.
 * Errors propagate so callers can retry; failed persistence is never acknowledged.
 */
export function recordLiveHeartbeat(heartbeat: ValidatedHeartbeat): LiveTelemetrySummary {
  const filename = storePath();
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const lockPath = `${filename}.lock`;
  const lock = fs.openSync(lockPath, "wx");
  const temporaryPath = `${filename}.${randomUUID()}.tmp`;
  try {
    const store = readStore();
    const receiptKey = JSON.stringify([heartbeat.organizationId, heartbeat.employeeId, heartbeat.source, heartbeat.eventId]);
    const hash = createHash("sha256").update(JSON.stringify(heartbeat)).digest("hex");
    const receipt = store.receipts[receiptKey];
    if (receipt && receipt.hash !== hash) throw new Error("Event ID was reused with different metadata.");
    const end = Date.parse(heartbeat.timestamp);
    const date = new Date(end).toISOString().slice(0, 10);
    const touched = new Set<string>();
    function bucketAt(time: number) {
      const day = new Date(time).toISOString().slice(0, 10);
      const key = JSON.stringify([heartbeat.organizationId, heartbeat.employeeId, day]);
      touched.add(key);
      return store.days[key] ??= {
        employeeId: heartbeat.employeeId, organizationId: heartbeat.organizationId, date: day,
        active: {}, meetings: [], afterHours: [], breaks: [], lastHeartbeatTimestamp: heartbeat.timestamp, revision: 0,
        afterHoursObserved: heartbeat.afterHoursObserved ?? true,
      };
    }
    function addDuration(durationSeconds: number, target: "active" | "meetings" | "afterHours") {
      let start = end - durationSeconds * 1000;
      while (start < end) {
        const dayEnd = (Math.floor(start / 86400000) + 1) * 86400000;
        const segmentEnd = Math.min(end, dayEnd);
        const bucket = bucketAt(start);
        if (!receipt) {
          const interval: Interval = [start, segmentEnd];
          if (target === "active") {
            bucket.active[heartbeat.source] = unionIntervals([...(bucket.active[heartbeat.source] || []), interval]);
          } else bucket[target] = unionIntervals([...bucket[target], interval]);
          bucket.lastHeartbeatTimestamp = [bucket.lastHeartbeatTimestamp, heartbeat.timestamp].sort().at(-1)!;
        }
        start = segmentEnd;
      }
    }
    addDuration(heartbeat.activeSeconds, "active");
    addDuration(heartbeat.meetingMinutes * 60, "meetings");
    if (heartbeat.isEvening) addDuration(Math.max(heartbeat.activeSeconds, heartbeat.meetingMinutes * 60), "afterHours");
    if (heartbeat.isBreak) {
      const bucket = bucketAt(end);
      if (!receipt && !bucket.breaks.includes(end)) bucket.breaks.push(end);
    }
    if (!receipt) {
      for (const key of touched) {
        const bucket = store.days[key];
        bucket.revision = (bucket.revision ?? 0) + 1;
        bucket.afterHoursObserved = (bucket.afterHoursObserved ?? true) || (heartbeat.afterHoursObserved ?? true);
        bucket.lastHeartbeatTimestamp = [bucket.lastHeartbeatTimestamp, heartbeat.timestamp].sort().at(-1)!;
      }
      store.receipts[receiptKey] = { hash, timestamp: end };
      for (const [key, value] of Object.entries(store.receipts)) {
        if (value.timestamp < Date.now() - MAX_EVENT_AGE_MS) delete store.receipts[key];
      }
      const fd = fs.openSync(temporaryPath, "wx", 0o600);
      try {
        fs.writeFileSync(fd, JSON.stringify(store));
        fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
      replaceSnapshot(temporaryPath, filename);
    }
    const dailyMetrics = [...touched].map((key) => metricFor(store.days[key]));
    const todayMetrics = dailyMetrics.find((metric) => metric.date === date) ?? dailyMetrics[dailyMetrics.length - 1];
    return {
      todayMetrics, dailyMetrics,
      todayActiveMinutes: Math.round(todayMetrics.workingHours * 60),
      todayBreakCount: todayMetrics.breakFrequency,
      todayMeetingMinutes: Math.round(todayMetrics.meetingLoad * 60),
      todayAfterHoursMinutes: Math.round(todayMetrics.afterHoursActivity),
      lastHeartbeatTimestamp: heartbeat.timestamp,
    };
  } finally {
    try {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    } finally {
      try { fs.closeSync(lock); }
      finally { fs.unlinkSync(lockPath); }
    }
  }
}
