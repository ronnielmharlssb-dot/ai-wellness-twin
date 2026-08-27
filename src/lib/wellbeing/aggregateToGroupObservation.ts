import type { EmployeeDailyMetrics } from "./employeeTypes";
import type { WellbeingObservation } from "./types";

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce(
      (total, value) => total + value,
      0
    ) / values.length
  );
}

export function buildGroupObservation(
  groupId: string,
  metrics: EmployeeDailyMetrics[]
): WellbeingObservation {
  const date =
    metrics[0]?.date ??
    new Date()
      .toISOString()
      .split("T")[0];

  const avgAfterHours =
    average(
      metrics.map(
        (metric) =>
          metric.afterHoursActivity
      )
    );

  const avgMeetingLoad =
    average(
      metrics.map(
        (metric) =>
          metric.meetingLoad
      )
    );

  const avgWorkingHours =
    average(
      metrics.map(
        (metric) =>
          metric.workingHours
      )
    );

  return {
    id: crypto.randomUUID(),

    groupId,

    date,

    source: "imported",

    afterHoursActivity:
      avgAfterHours,

    meetingLoad:
      avgMeetingLoad,

    workPatternShift:
      avgWorkingHours,
  };
}