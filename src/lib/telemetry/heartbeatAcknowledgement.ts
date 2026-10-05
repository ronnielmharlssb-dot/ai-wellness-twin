import type { EmployeeDailyMetrics } from "../wellbeing/employeeTypes";
import { decodeCloudMetrics } from "../wellbeing/observationCodec";
import { sanitizeAndValidateHeartbeat, type ValidatedHeartbeat } from "./serverSanitizer";
export function decodeHeartbeatAcknowledgement(raw: unknown, event: ValidatedHeartbeat, cloud: boolean): EmployeeDailyMetrics[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid observation acknowledgement.");
  const input = raw as { success?: unknown; summary?: { dailyMetrics?: unknown } };
  if (input.success !== true || !input.summary || !Array.isArray(input.summary.dailyMetrics) || !input.summary.dailyMetrics.length) {
    throw new Error("Invalid observation acknowledgement.");
  }
  // Demonstrations use the local ledger, with the same metric decoder and no cloud revision.
  const metrics = cloud ? decodeCloudMetrics(input.summary.dailyMetrics, event.employeeId) : decodeCloudMetrics(
    input.summary.dailyMetrics.map(metric => ({ ...metric, cloudRevision: metric.telemetryRevision,
      contributions: { telemetry: metric } })), event.employeeId)
    .map(metric => { const { cloudRevision: ignored, ...local } = metric; void ignored; return local; });
  const valid = sanitizeAndValidateHeartbeat(event);
  if (!valid.data) throw new Error("Invalid queued observation.");
  const dates = new Set<string>();
  const duration = event.source === "calendar" ? event.meetingMinutes * 60000 : event.activeSeconds * 1000;
  if (duration > 0) {
    dates.add(new Date(Date.parse(event.timestamp) - duration).toISOString().slice(0, 10));
    dates.add(new Date(Date.parse(event.timestamp) - 1).toISOString().slice(0, 10));
  }
  if (event.isBreak) dates.add(event.timestamp.slice(0, 10));
  if ([...dates].some(date => !metrics.some(metric => metric.date === date && metric.contributions?.telemetry &&
      (metric.observedMetrics?.length ?? 0) > 0))) throw new Error("Incomplete observation acknowledgement.");
  return metrics;
}
