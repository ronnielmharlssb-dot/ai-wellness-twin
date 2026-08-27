import type { EmployeeSignal } from "./types";

export function generateDemoSignal(
  employeeId: string,
  daysAgo = 0
): EmployeeSignal {
  const date = new Date();

  date.setDate(date.getDate() - daysAgo);

  return {
    employeeId,

    date: date.toISOString().split("T")[0],

    activeMinutes: 420 + (daysAgo % 30),

    meetingMinutes: 120 + (daysAgo % 40),

    afterHoursMinutes: 30 + (daysAgo % 20),

    breakCount: 4 + (daysAgo % 3),

    appSwitches: 50 + (daysAgo % 15),
  };
}