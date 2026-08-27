import type { EmployeeDailyMetrics } from "./employeeTypes";
import { BASELINE_REQUIRED_DAYS } from "./constants";

export const EMPLOYEE_BASELINE_DAYS = BASELINE_REQUIRED_DAYS;

export function getEmployeeBaselineDays(
  metrics: EmployeeDailyMetrics[]
): number {
  const uniqueDates = new Set(
    metrics.map((metric) => metric.date)
  );

  return uniqueDates.size;
}

export function isEmployeeBaselineEstablished(
  metrics: EmployeeDailyMetrics[]
): boolean {
  return (
    getEmployeeBaselineDays(metrics) >=
    EMPLOYEE_BASELINE_DAYS
  );
}

export function getEmployeeBaselineStatus(
  metrics: EmployeeDailyMetrics[]
): "building" | "established" {
  return isEmployeeBaselineEstablished(metrics)
    ? "established"
    : "building";
}