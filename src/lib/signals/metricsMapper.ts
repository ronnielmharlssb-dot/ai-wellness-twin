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
    observedMetrics: signal.observedMetrics,
    githubEventCount: signal.githubEventCount,

    workingHours:
      signal.activeMinutes / 60,

    meetingLoad:
      signal.meetingMinutes / 60,

    breakFrequency:
      signal.breakCount,

    afterHoursActivity:
      signal.afterHoursMinutes,
  };
}
