import type { EmployeeDailyMetrics } from "./employeeTypes";
import { MEANINGFUL_CHANGE_THRESHOLD } from "./constants";

type EmployeeBaselineAverages = {
  workingHours: number;
  meetingLoad: number;
  breakFrequency: number;
  afterHoursActivity: number;
};

export type EmployeeChangeResult = {
  metric:
    | "workingHours"
    | "meetingLoad"
    | "breakFrequency"
    | "afterHoursActivity";

  baselineValue: number;
  currentValue: number;
  percentageChange: number;
  meaningful: boolean;
};

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

export function calculateEmployeeBaselineAverages(
  metrics: EmployeeDailyMetrics[]
): EmployeeBaselineAverages {
  return {
    workingHours: average(
      metrics.map(
        (metric) => metric.workingHours
      )
    ),

    meetingLoad: average(
      metrics.map(
        (metric) => metric.meetingLoad
      )
    ),

    breakFrequency: average(
      metrics.map(
        (metric) => metric.breakFrequency
      )
    ),

    afterHoursActivity: average(
      metrics.map(
        (metric) =>
          metric.afterHoursActivity
      )
    ),
  };
}

function calculatePercentageChange(
  baselineValue: number,
  currentValue: number
): number {
  if (baselineValue === 0) {
    return currentValue === 0
      ? 0
      : 100;
  }

  return (
    ((currentValue - baselineValue) /
      baselineValue) *
    100
  );
}

export function detectEmployeeChanges(
  baselineMetrics: EmployeeDailyMetrics[],
  currentMetric: EmployeeDailyMetrics
): EmployeeChangeResult[] {
  const baseline =
    calculateEmployeeBaselineAverages(
      baselineMetrics
    );

  const metrics: Array<{
    metric: EmployeeChangeResult["metric"];
    baselineValue: number;
    currentValue: number;
  }> = [
    {
      metric: "workingHours",
      baselineValue:
        baseline.workingHours,
      currentValue:
        currentMetric.workingHours,
    },

    {
      metric: "meetingLoad",
      baselineValue:
        baseline.meetingLoad,
      currentValue:
        currentMetric.meetingLoad,
    },

    {
      metric: "breakFrequency",
      baselineValue:
        baseline.breakFrequency,
      currentValue:
        currentMetric.breakFrequency,
    },

    {
      metric: "afterHoursActivity",
      baselineValue:
        baseline.afterHoursActivity,
      currentValue:
        currentMetric.afterHoursActivity,
    },
  ];

  return metrics.map((item) => {
    const percentageChange =
      calculatePercentageChange(
        item.baselineValue,
        item.currentValue
      );

    return {
      metric: item.metric,
      baselineValue: item.baselineValue,
      currentValue: item.currentValue,
      percentageChange,
      meaningful:
        Math.abs(
          percentageChange
        ) >=
        MEANINGFUL_CHANGE_THRESHOLD,
    };
  });
}