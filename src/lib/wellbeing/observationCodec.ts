import type { DailyMetricValues, EmployeeDailyMetrics, MetricName } from "./employeeTypes";

const limits = { workingHours: 24, meetingLoad: 24, breakFrequency: 1000, afterHoursActivity: 1440 };
const sources = ["telemetry", "github", "google_calendar"] as const;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid observation response.");
  return value as Record<string, unknown>;
}
function number(value: unknown, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) throw new Error("Invalid observation value.");
  return value;
}
function revision(value: unknown) {
  const result = number(value, Number.MAX_SAFE_INTEGER);
  if (!Number.isSafeInteger(result) || result < 1) throw new Error("Invalid observation revision.");
  return result;
}
function values(raw: unknown): DailyMetricValues {
  const input = object(raw);
  if (!Array.isArray(input.observedMetrics) || input.observedMetrics.some((name) => typeof name !== "string" || !Object.hasOwn(limits, name))) {
    throw new Error("Invalid observed metric names.");
  }
  const result: DailyMetricValues = {
    workingHours: number(input.workingHours, 24), meetingLoad: number(input.meetingLoad, 24),
    breakFrequency: number(input.breakFrequency, 1000), afterHoursActivity: number(input.afterHoursActivity, 1440),
    observedMetrics: [...new Set(input.observedMetrics as MetricName[])],
  };
  if (!Number.isInteger(result.breakFrequency)) throw new Error("Invalid break count.");
  return result;
}
/** Fail closed on wrong ownership, malformed data or unsupported source snapshots. */
export function decodeCloudMetrics(raw: unknown, employeeId: string): EmployeeDailyMetrics[] {
  if (!Array.isArray(raw)) throw new Error("Invalid private history response.");
  const seen = new Set<string>();
  return raw.map((item) => {
    const input = object(item);
    if (input.employeeId !== employeeId || typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
        !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date || seen.has(input.date) ||
        !sources.includes(input.source as typeof sources[number])) throw new Error("Invalid private observation scope.");
    seen.add(input.date);
    const contributions: EmployeeDailyMetrics["contributions"] = {};
    for (const [source, snapshot] of Object.entries(object(input.contributions))) {
      if (!sources.includes(source as typeof sources[number])) throw new Error("Invalid observation source.");
      contributions[source as typeof sources[number]] = values(snapshot);
    }
    const tools: Record<string, number> = {};
    for (const [tool, minutes] of Object.entries(object(input.toolActiveMinutes))) {
      if (!/^[a-z][a-z0-9_]{0,31}$/.test(tool)) throw new Error("Invalid tool duration.");
      tools[tool] = number(minutes, 1440);
    }
    const result: EmployeeDailyMetrics = { ...values(input), employeeId, date: input.date,
      source: input.source as typeof sources[number], contributions, toolActiveMinutes: tools,
      cloudRevision: revision(input.cloudRevision) };
    if (input.telemetryRevision != null) result.telemetryRevision = revision(input.telemetryRevision);
    if (input.githubEventCount != null) {
      result.githubEventCount = number(input.githubEventCount, 1_000_000);
      if (!Number.isInteger(result.githubEventCount)) throw new Error("Invalid event count.");
    }
    return result;
  });
}
