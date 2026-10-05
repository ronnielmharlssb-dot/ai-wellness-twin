import type { EmployeeDailyMetrics } from "../wellbeing/employeeTypes";

export type ImportSource = "github" | "google_calendar";
export type SourceSnapshot = Pick<EmployeeDailyMetrics, "employeeId" | "date" | "source" | "workingHours" | "meetingLoad" | "breakFrequency" | "afterHoursActivity" | "observedMetrics" | "githubEventCount">;
const allowed = new Set(["employeeId", "date", "source", "workingHours", "meetingLoad", "breakFrequency", "afterHoursActivity", "observedMetrics", "githubEventCount"]);
const MAX_AGE = 35 * 86400000;
/** Normalize metadata before storing it on the device or sending it to the cloud. */
export function validateSourceSnapshots(raw: unknown, employeeId: string, provider: ImportSource, capturedAt: string, now = Date.now()): SourceSnapshot[] {
  if (!["github", "google_calendar"].includes(provider) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(capturedAt) || !Number.isFinite(Date.parse(capturedAt)) ||
      new Date(capturedAt).toISOString() !== capturedAt || Date.parse(capturedAt) < now - MAX_AGE || Date.parse(capturedAt) > now + 300000 ||
      !Array.isArray(raw) || raw.length < 1 || raw.length > 36) throw new Error("This import is invalid or outside the 35-day upload window.");
  const seen = new Set<string>();
  const earliest = new Date(now - MAX_AGE).toISOString().slice(0, 10);
  const latest = new Date(now).toISOString().slice(0, 10);
  return raw.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid source snapshot.");
    const item = value as Record<string, unknown>;
    if (Object.keys(item).some((key) => !allowed.has(key)) || item.employeeId !== employeeId || item.source !== provider ||
        typeof item.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isFinite(Date.parse(item.date)) ||
        new Date(item.date).toISOString().slice(0, 10) !== item.date || item.date < earliest || item.date > latest || seen.has(item.date) ||
        item.workingHours !== 0 || item.breakFrequency !== 0 || typeof item.meetingLoad !== "number" || !Number.isFinite(item.meetingLoad) ||
        item.meetingLoad < 0 || item.meetingLoad > 24 || typeof item.afterHoursActivity !== "number" || !Number.isFinite(item.afterHoursActivity) ||
        item.afterHoursActivity < 0 || item.afterHoursActivity > 1440 || !Array.isArray(item.observedMetrics)) throw new Error("Invalid source metadata or ownership.");
    seen.add(item.date);
    if (provider === "google_calendar" && (!item.observedMetrics.includes("meetingLoad") ||
        item.observedMetrics.some(name => name !== "meetingLoad" && name !== "afterHoursActivity") ||
        new Set(item.observedMetrics).size !== item.observedMetrics.length ||
        (!item.observedMetrics.includes("afterHoursActivity") && item.afterHoursActivity !== 0) ||
        item.githubEventCount !== undefined)) throw new Error("Calendar snapshots cannot infer work or breaks.");
    if (provider === "github" && (item.meetingLoad !== 0 || item.afterHoursActivity !== 0 || item.observedMetrics.length !== 0 ||
        typeof item.githubEventCount !== "number" || !Number.isSafeInteger(item.githubEventCount) || item.githubEventCount < 0 || item.githubEventCount > 1000000)) {
      throw new Error("GitHub counts cannot infer duration.");
    }
    return { employeeId, date: item.date, source: provider, workingHours: 0, breakFrequency: 0,
      meetingLoad: item.meetingLoad, afterHoursActivity: item.afterHoursActivity,
      observedMetrics: provider === "google_calendar" ? item.observedMetrics.includes("afterHoursActivity") ? ["meetingLoad", "afterHoursActivity"] : ["meetingLoad"] : [],
      ...(provider === "github" ? { githubEventCount: item.githubEventCount as number } : {}) };
  });
}
