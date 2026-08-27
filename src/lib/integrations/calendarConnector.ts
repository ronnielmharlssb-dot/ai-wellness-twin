import type { EmployeeSignal } from "../signals/types";

export type CalendarEventBlock = {
  start: string; // ISO string
  end: string;   // ISO string
};

export function parseCalendarBlocksToSignals(
  employeeId: string,
  events: CalendarEventBlock[]
): EmployeeSignal[] {
  const eventsByDate = new Map<string, CalendarEventBlock[]>();

  events.forEach((ev) => {
    const dateStr = ev.start.split("T")[0];
    const existing = eventsByDate.get(dateStr) || [];
    existing.push(ev);
    eventsByDate.set(dateStr, existing);
  });

  const signals: EmployeeSignal[] = [];

  eventsByDate.forEach((dayEvents, dateStr) => {
    let meetingMinutes = 0;
    let afterHoursMinutes = 0;

    dayEvents.forEach((ev) => {
      const s = new Date(ev.start);
      const e = new Date(ev.end);
      const duration = Math.max(0, (e.getTime() - s.getTime()) / (1000 * 60));
      meetingMinutes += duration;

      if (e.getHours() >= 18 || s.getHours() < 9) {
        afterHoursMinutes += duration;
      }
    });

    signals.push({
      employeeId,
      date: dateStr,
      activeMinutes: Math.min(540, meetingMinutes + 240), // meetings + focus time
      meetingMinutes,
      afterHoursMinutes,
      breakCount: Math.max(1, 5 - Math.floor(meetingMinutes / 60)),
      appSwitches: Math.round(meetingMinutes * 0.4),
      source: "microsoft365",
    });
  });

  return signals;
}

export function generateSimulatedCalendarSignals(
  employeeId: string,
  daysCount: number = 30
): EmployeeSignal[] {
  const signals: EmployeeSignal[] = [];
  const today = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

    if (isWeekend) continue;

    // Normal baseline: 120-180 min meetings, elevated on busy days
    const isHeavyMeetingWeek = i < 7;
    const meetingMinutes = isHeavyMeetingWeek ? 240 : 135;
    const afterHoursMinutes = isHeavyMeetingWeek ? 45 : 10;
    const breakCount = isHeavyMeetingWeek ? 2 : 4;

    signals.push({
      employeeId,
      date: dateStr,
      activeMinutes: 480,
      meetingMinutes,
      afterHoursMinutes,
      breakCount,
      appSwitches: 60,
      source: "microsoft365",
    });
  }

  return signals;
}
