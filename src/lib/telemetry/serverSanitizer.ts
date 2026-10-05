/** Only explicitly allowed metadata crosses the ingestion boundary. */
export const TELEMETRY_SOURCES = [
  "workstation", "ide", "calendar", "presence", "vscode", "gemini",
  "chatgpt", "claude", "figma", "slack", "discord", "github",
] as const;

export type ValidatedHeartbeat = {
  eventId: string;
  employeeId: string;
  organizationId: string;
  /** End of the observed interval, including an explicit UTC offset. */
  timestamp: string;
  activeSeconds: number;
  isBreak: boolean;
  isEvening: boolean;
  /** False when the collector's after-hours measurement is disabled. */
  afterHoursObserved?: boolean;
  meetingMinutes: number;
  source: typeof TELEMETRY_SOURCES[number];
};

const ALLOWED_KEYS = new Set([
  "eventId", "employeeId", "organizationId", "timestamp", "activeSeconds",
  "isBreak", "isEvening", "afterHoursObserved", "meetingMinutes", "source",
]);
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
export const MAX_EVENT_AGE_MS = 35 * 24 * 60 * 60 * 1000;

export function sanitizeAndValidateHeartbeat(
  raw: unknown,
  now = Date.now(),
): { valid: boolean; data?: ValidatedHeartbeat; error?: string } {
  const invalid = (error: string) => ({ valid: false, error });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return invalid("Expected a metadata object.");
  }
  const input = raw as Record<string, unknown>;
  if (Object.keys(input).some((key) => !ALLOWED_KEYS.has(key))) {
    return invalid("Unexpected fields. Only the documented telemetry metadata is accepted.");
  }
  for (const key of ["eventId", "employeeId", "organizationId"] as const) {
    if (typeof input[key] !== "string" || !ID_PATTERN.test(input[key])) {
      return invalid(`A valid ${key} is required.`);
    }
  }
  if (typeof input.timestamp !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(input.timestamp)) {
    return invalid("timestamp must be an ISO timestamp with an explicit timezone.");
  }
  const timestampMs = Date.parse(input.timestamp);
  const calendarDate = input.timestamp.slice(0, 10);
  const parsedDate = new Date(`${calendarDate}T00:00:00Z`);
  if (!Number.isFinite(timestampMs) || !Number.isFinite(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== calendarDate ||
      timestampMs > now + 5 * 60 * 1000 || timestampMs < now - MAX_EVENT_AGE_MS) {
    return invalid("timestamp is invalid, in the future, or older than the 35-day ingestion window.");
  }
  const { activeSeconds, isBreak, isEvening, source } = input;
  const meetingMinutes = input.meetingMinutes ?? 0;
  if (typeof activeSeconds !== "number" || !Number.isFinite(activeSeconds) || activeSeconds < 0 || activeSeconds > 300 ||
      typeof meetingMinutes !== "number" || !Number.isFinite(meetingMinutes) || meetingMinutes < 0 || meetingMinutes > 1440) {
    return invalid("Durations must be finite and within the documented limits.");
  }
  if (typeof isBreak !== "boolean" || typeof isEvening !== "boolean") {
    return invalid("isBreak and isEvening must be booleans measured by the collector.");
  }
  if (input.afterHoursObserved !== undefined && (typeof input.afterHoursObserved !== "boolean" || (!input.afterHoursObserved && isEvening))) {
    return invalid("Disabled after-hours measurement cannot report an evening observation.");
  }
  if (typeof source !== "string" || !TELEMETRY_SOURCES.includes(source as ValidatedHeartbeat["source"])) {
    return invalid("Unknown telemetry source.");
  }
  if (source !== "calendar" && meetingMinutes !== 0) {
    return invalid("Only calendar events may report meeting duration.");
  }
  if (source === "calendar" && (activeSeconds !== 0 || isBreak)) {
    return invalid("Calendar metadata must not imply measured workstation activity or breaks.");
  }
  if (activeSeconds === 0 && meetingMinutes === 0 && !isBreak) {
    return invalid("An event must contain an observed duration or break.");
  }
  return {
    valid: true,
    data: {
      eventId: input.eventId as string,
      employeeId: input.employeeId as string,
      organizationId: input.organizationId as string,
      timestamp: new Date(timestampMs).toISOString(),
      activeSeconds, isBreak, isEvening, meetingMinutes,
      ...(input.afterHoursObserved !== undefined ? { afterHoursObserved: input.afterHoursObserved as boolean } : {}),
      source: source as ValidatedHeartbeat["source"],
    },
  };
}
