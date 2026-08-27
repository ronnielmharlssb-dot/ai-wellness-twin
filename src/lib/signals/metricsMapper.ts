import type { EmployeeDailyMetrics }
  from "@/lib/wellbeing/employeeTypes";

import type { EmployeeSignal }
  from "./types";

export function signalToMetrics(
  signal: EmployeeSignal
): EmployeeDailyMetrics {
  return {
    employeeId: signal.employeeId,

    date: signal.date,

    source: "demo",

    workingHours:
      Number(
        (signal.activeMinutes / 60).toFixed(1)
      ),

    meetingLoad:
      signal.meetingMinutes,

    breakFrequency:
      signal.breakCount,

    afterHoursActivity:
      signal.afterHoursMinutes,
  };
}