import {
  detectEmployeeChanges,
  type EmployeeChangeResult,
} from "./employeeChangeDetection";

import {
  getEmployeeBaselineStatus,
  EMPLOYEE_BASELINE_DAYS,
} from "./employeeBaseline";

import type { EmployeeDailyMetrics } from "./employeeTypes";

export type EmployeeAssessment = {
  score: number | null;

  status:
    | "building"
    | "stable"
    | "watch"
    | "attention";

  daysCollected: number;

  requiredDays: number;

  changes: EmployeeChangeResult[];
};

export function buildEmployeeAssessment(
  metrics: EmployeeDailyMetrics[]
): EmployeeAssessment {
  const sortedMetrics = [...metrics].sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  const baselineStatus =
    getEmployeeBaselineStatus(
      sortedMetrics
    );

  const daysCollected = sortedMetrics.length;

  if (
    baselineStatus !== "established" ||
    daysCollected <= EMPLOYEE_BASELINE_DAYS
  ) {
    return {
      score: null,
      status: "building",
      daysCollected,
      requiredDays: EMPLOYEE_BASELINE_DAYS,
      changes: [],
    };
  }

  const baselineMetrics =
    sortedMetrics.slice(0, EMPLOYEE_BASELINE_DAYS);

  const currentMetric =
    sortedMetrics[
      sortedMetrics.length - 1
    ];

  const allChanges =
    detectEmployeeChanges(
      baselineMetrics,
      currentMetric
    );

  const changes =
    allChanges.filter(
      (change) => change.meaningful
    );

  const score =
    calculateWellnessScore(changes);

  return {
    score,
    status: getStatus(score),
    daysCollected,
    requiredDays: EMPLOYEE_BASELINE_DAYS,
    changes,
  };
}

function calculateWellnessScore(
  changes: EmployeeChangeResult[]
): number {
  let risk = 0;

  const weights = {
    workingHours: 0.30,
    meetingLoad: 0.20,
    breakFrequency: 0.20,
    afterHoursActivity: 0.30,
  };

  for (const change of changes) {
    const cappedChange =
      Math.min(
        Math.abs(
          change.percentageChange
        ),
        100
      );

    switch (change.metric) {
      case "workingHours":
        if (change.percentageChange > 0) {
          risk += cappedChange * weights.workingHours;
        }
        break;

      case "meetingLoad":
        if (change.percentageChange > 0) {
          risk += cappedChange * weights.meetingLoad;
        }
        break;

      case "breakFrequency":
        if (change.percentageChange < 0) {
          risk += cappedChange * weights.breakFrequency;
        }
        break;

      case "afterHoursActivity":
        if (change.percentageChange > 0) {
          risk += cappedChange * weights.afterHoursActivity;
        }
        break;
    }
  }

  return Math.max(
    0,
    Math.round(
      100 - risk
    )
  );
}

function getStatus(
  score: number
):
  | "stable"
  | "watch"
  | "attention" {
  if (score >= 80) {
    return "stable";
  }

  if (score >= 60) {
    return "watch";
  }

  return "attention";
}