import type { EmployeeDailyMetrics } from "./employeeTypes";
import { BASELINE_REQUIRED_DAYS } from "./constants";
import { buildEmployeeAssessment } from "./employeeAssessment";

export const EMPLOYEE_BASELINE_DAYS = BASELINE_REQUIRED_DAYS;

export function getEmployeeBaselineDays(
  metrics: EmployeeDailyMetrics[]
): number {
  return buildEmployeeAssessment(metrics).daysCollected;
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
