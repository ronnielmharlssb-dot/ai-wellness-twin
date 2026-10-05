import type { EmployeeDailyMetrics, MetricName } from "./employeeTypes";
import { BASELINE_REQUIRED_DAYS, MEANINGFUL_CHANGE_THRESHOLD } from "./constants";
import { METRIC_NAMES } from "./employeeMetrics";
import { completedEmployeeObservations, isObservedValue, observedAverage } from "./employeeObservations";

export type EmployeeBaselineAverages = Record<MetricName, number | null>;
export type EmployeeChangeResult = {
  metric: MetricName; baselineValue: number; currentValue: number;
  /** A percentage increase from zero is undefined, rather than an invented 100%. */
  percentageChange: number | null; meaningful: boolean;
};
export function calculateEmployeeBaselineAverages(metrics: EmployeeDailyMetrics[]): EmployeeBaselineAverages {
  return Object.fromEntries(METRIC_NAMES.map((name) => [name, observedAverage(metrics, name)])) as EmployeeBaselineAverages;
}
export function compareObservedValues(metric: MetricName, baselineValue: number, currentValue: number): EmployeeChangeResult {
  const percentageChange = baselineValue === 0 ? currentValue === 0 ? 0 : null : (currentValue - baselineValue) / baselineValue * 100;
  return { metric, baselineValue, currentValue, percentageChange,
    meaningful: percentageChange === null ? currentValue > baselineValue : Math.abs(percentageChange) >= MEANINGFUL_CHANGE_THRESHOLD };
}
/** A direct daily comparison still requires 28 distinct prior dates per metric. */
export function detectEmployeeChanges(baselineMetrics: EmployeeDailyMetrics[], currentMetric: EmployeeDailyMetrics): EmployeeChangeResult[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(currentMetric.date) || !Number.isFinite(Date.parse(currentMetric.date)) ||
      new Date(currentMetric.date).toISOString().slice(0, 10) !== currentMetric.date) return [];
  const baseline = completedEmployeeObservations(baselineMetrics, Date.parse(currentMetric.date + "T00:00:00Z"))
    .filter((day) => day.employeeId === currentMetric.employeeId);
  return METRIC_NAMES.flatMap((name) => {
    const observations = baseline.filter((day) => isObservedValue(day, name)).slice(-BASELINE_REQUIRED_DAYS);
    const value = observedAverage(observations, name);
    return isObservedValue(currentMetric, name) && observations.length === BASELINE_REQUIRED_DAYS && value !== null
      ? [compareObservedValues(name, value, currentMetric[name])] : [];
  });
}
