import { createClient } from "../supabase/server";
import { decodeCloudMetrics } from "../wellbeing/observationCodec";
import type { ValidatedHeartbeat } from "./serverSanitizer";
import type { LiveTelemetrySummary } from "./telemetryAggregator";

export class CloudObservationError extends Error {
  constructor(public readonly status: number) { super("Cloud observations are unavailable."); }
}
async function call(name: string, employeeId: string, args?: Record<string, unknown>) {
  const client = await createClient();
  if (!client) throw new CloudObservationError(503);
  const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(10_000));
  if (error) {
    const status = error.code === "23505" ? 409 : ["22023", "22007", "22008"].includes(error.code) ? 400 :
      error.code === "23514" ? 422 : error.code === "42501" ? 403 : 503;
    throw new CloudObservationError(status);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new CloudObservationError(503);
  const dailyMetrics = decodeCloudMetrics(data.dailyMetrics, employeeId);
  const lastHeartbeat = data.lastHeartbeat;
  if (lastHeartbeat !== null && (typeof lastHeartbeat !== "string" || !Number.isFinite(Date.parse(lastHeartbeat)))) {
    throw new CloudObservationError(503);
  }
  const stateRevision = data.stateRevision;
  if (name === "get_employee_observation_state" && (!Number.isSafeInteger(stateRevision) || stateRevision < 0 ||
      dailyMetrics.some((metric) => metric.cloudRevision! > stateRevision))) throw new CloudObservationError(503);
  return { dailyMetrics, lastHeartbeat: lastHeartbeat as string | null, ...(stateRevision !== undefined ? { stateRevision: stateRevision as number } : {}) };
}
export async function readCloudObservations(employeeId: string) {
  return call("get_employee_observation_state", employeeId);
}
export async function importCloudSnapshots(employeeId: string, snapshots: unknown[], capturedAt: string) {
  return call("import_wellness_snapshots", employeeId, { snapshots, captured_time: capturedAt });
}
export async function recordCloudHeartbeat(event: ValidatedHeartbeat): Promise<LiveTelemetrySummary> {
  const { dailyMetrics, lastHeartbeat } = await call("record_wellness_heartbeat", event.employeeId, { event });
  const todayMetrics = dailyMetrics.find((day) => day.date === event.timestamp.slice(0, 10)) ?? dailyMetrics.at(-1);
  if (!todayMetrics || !lastHeartbeat) throw new CloudObservationError(503);
  return { dailyMetrics, todayMetrics, lastHeartbeatTimestamp: lastHeartbeat,
    todayActiveMinutes: todayMetrics.workingHours * 60, todayBreakCount: todayMetrics.breakFrequency,
    todayMeetingMinutes: todayMetrics.meetingLoad * 60, todayAfterHoursMinutes: todayMetrics.afterHoursActivity };
}
