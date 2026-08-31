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

    source: (signal.source as EmployeeDailyMetrics["source"]) || "telemetry",

    workingHours:
      Number(
        (signal.activeMinutes / 60).toFixed(1)
      ),

    meetingLoad:
      Number(
        (signal.meetingMinutes / 60).toFixed(1)
      ),

    breakFrequency:
      signal.breakCount,

    afterHoursActivity:
      signal.afterHoursMinutes,
  };
}