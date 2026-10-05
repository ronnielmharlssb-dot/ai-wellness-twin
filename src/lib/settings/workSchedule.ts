export const WORK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type WorkDay = typeof WORK_DAYS[number];
export type WorkSchedule = { timeZone: string; workdayStart: string; workdayEnd: string; workDays?: readonly string[] };
const formatters = new Map<string, Intl.DateTimeFormat>();
export function validateTimeZone(value: unknown): string {
  if (typeof value !== "string" || value.length > 100 || !value.trim()) throw new Error("Choose a valid IANA timezone, such as Asia/Singapore.");
  try { return new Intl.DateTimeFormat("en-US", { timeZone: value.trim() }).resolvedOptions().timeZone; }
  catch { throw new Error("Choose a valid IANA timezone, such as Asia/Singapore."); }
}
export function scheduleMinutes(value: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("Work times must use HH:mm between 00:00 and 23:59.");
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
export function validateWorkSchedule(schedule: WorkSchedule) {
  validateTimeZone(schedule.timeZone);
  if (scheduleMinutes(schedule.workdayStart) === scheduleMinutes(schedule.workdayEnd)) throw new Error("Work start and end times must differ. Overnight schedules are supported.");
  if (schedule.workDays && (schedule.workDays.some(day => !WORK_DAYS.includes(day as WorkDay)) || new Set(schedule.workDays).size !== schedule.workDays.length)) {
    throw new Error("Choose distinct workdays from Monday through Sunday.");
  }
}
/** Schedule classification is local; observation storage remains in UTC.
 * After midnight, an overnight shift belongs to the day on which it started.
 */
export function workSchedulePosition(time: number, schedule: WorkSchedule): { inWorkHours: boolean; scheduledDay: boolean } {
  let formatter = formatters.get(schedule.timeZone);
  if (!formatter) {
    const zone = validateTimeZone(schedule.timeZone);
    formatter = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    if (formatters.size >= 16) formatters.delete(formatters.keys().next().value!);
    formatters.set(schedule.timeZone, formatter);
  }
  const parts = formatter.formatToParts(time);
  const weekday = parts.find(part => part.type === "weekday")!.value as WorkDay;
  const minutes = Number(parts.find(part => part.type === "hour")!.value) * 60 + Number(parts.find(part => part.type === "minute")!.value);
  const start = scheduleMinutes(schedule.workdayStart), end = scheduleMinutes(schedule.workdayEnd);
  if (start === end) throw new Error("Work start and end times must differ.");
  const belongsToPreviousDay = start > end && minutes < end;
  const scheduleDay = belongsToPreviousDay ? WORK_DAYS[(WORK_DAYS.indexOf(weekday) + 6) % 7] : weekday;
  const scheduledDay = (schedule.workDays ?? WORK_DAYS).includes(scheduleDay);
  return { scheduledDay, inWorkHours: scheduledDay && (start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end) };
}
