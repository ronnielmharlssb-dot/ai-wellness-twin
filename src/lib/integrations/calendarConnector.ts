import type { EmployeeSignal } from "../signals/types";
import { intervalSeconds, unionIntervals, type Interval } from "../signals/intervals";
import { validateWorkSchedule, workSchedulePosition } from "../settings/workSchedule";

export type CalendarEventBlock = {
  start: string;
  end: string;
};
export type CalendarImportOptions = {
  now?: number;
  timeZone?: string;
  workdayStart?: string;
  workdayEnd?: string;
  workDays?: readonly string[];
  afterHoursObserved?: boolean;
  /** Complete fetched window, including days with no scheduled events. */
  coverage?: { start: string; end: string };
};

/** Calendar blocks measure scheduled meeting load. They do not measure focus or breaks.
 * Daily storage uses UTC consistently; work-hour classification uses the user's timezone.
 */
export function parseCalendarBlocksToSignals(
  employeeId: string,
  events: CalendarEventBlock[],
  options: CalendarImportOptions = {},
): EmployeeSignal[] {
  const now = options.now ?? Date.now();
  const coverageStart = options.coverage ? Date.parse(options.coverage.start) : -Infinity;
  const coverageEnd = options.coverage ? Date.parse(options.coverage.end) : now;
  if (options.coverage && (!Number.isFinite(coverageStart) || !Number.isFinite(coverageEnd) ||
      coverageEnd <= coverageStart || coverageEnd > now || coverageEnd - coverageStart > 35 * 86400000)) {
    throw new Error("Invalid calendar coverage window.");
  }
  const schedule = { timeZone: options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    workdayStart: options.workdayStart ?? "09:00", workdayEnd: options.workdayEnd ?? "18:00", workDays: options.workDays };
  validateWorkSchedule(schedule);
  const input: Interval[] = events.map((event) => {
    if (!event || typeof event.start !== "string" || typeof event.end !== "string" ||
        !/(?:Z|[+-]\d{2}:\d{2})$/.test(event.start) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(event.end)) {
      throw new Error("Calendar events require start and end timestamps with a timezone.");
    }
    const start = Date.parse(event.start);
    const end = Date.parse(event.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 7 * 86400000) {
      throw new Error("Invalid calendar interval.");
    }
    return [Math.max(start, coverageStart), Math.min(end, now, coverageEnd)];
  });
  const days = new Map<string, { meetings: Interval[]; afterHours: Interval[] }>();
  if (options.coverage) {
    for (let cursor = coverageStart; cursor < coverageEnd; cursor = (Math.floor(cursor / 86400000) + 1) * 86400000) {
      days.set(new Date(cursor).toISOString().slice(0, 10), { meetings: [], afterHours: [] });
    }
  }
  // Merge before splitting to count duplicates, overlapping meetings and midnight correctly.
  for (const [start, end] of unionIntervals(input)) {
    let cursor = start;
    while (cursor < end) {
      const segmentEnd = Math.min(end, (Math.floor(cursor / 60000) + 1) * 60000);
      const date = new Date(cursor).toISOString().slice(0, 10);
      const day = days.get(date) ?? { meetings: [], afterHours: [] };
      day.meetings.push([cursor, segmentEnd]);
      if (options.afterHoursObserved !== false && !workSchedulePosition(cursor, schedule).inWorkHours) day.afterHours.push([cursor, segmentEnd]);
      days.set(date, day);
      cursor = segmentEnd;
    }
  }
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, day]) => ({
    employeeId, date, source: "google_calendar",
    activeMinutes: 0,
    meetingMinutes: intervalSeconds(day.meetings) / 60,
    afterHoursMinutes: intervalSeconds(day.afterHours) / 60,
    breakCount: 0, appSwitches: 0,
    observedMetrics: options.afterHoursObserved === false ? ["meetingLoad"] : ["meetingLoad", "afterHoursActivity"],
  }));
}
