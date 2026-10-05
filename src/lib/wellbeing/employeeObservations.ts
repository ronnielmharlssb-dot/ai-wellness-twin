import { METRIC_NAMES, mergeDailyMetrics, observedMetricNames } from "./employeeMetrics";
import type { EmployeeDailyMetrics, MetricName } from "./employeeTypes";

const limits: Record<MetricName, number> = { workingHours: 24, meetingLoad: 24, breakFrequency: 1000, afterHoursActivity: 1440 };
export function isObservedValue(metric: EmployeeDailyMetrics, name: MetricName) {
  return observedMetricNames(metric).includes(name) && Number.isFinite(metric[name]) && metric[name] >= 0 && metric[name] <= limits[name] &&
    (name !== "breakFrequency" || Number.isInteger(metric[name]));
}
/** Closed UTC dates only. An unfinished day cannot establish a baseline or comparison. */
export function completedEmployeeObservations(metrics: EmployeeDailyMetrics[], now = Date.now()): EmployeeDailyMetrics[] {
  if (new Set(metrics.map((metric) => metric.employeeId)).size > 1) return [];
  const today = new Date(now).toISOString().slice(0, 10);
  const unique = new Map<string, EmployeeDailyMetrics>();
  for (const metric of metrics) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(metric.date) || !Number.isFinite(Date.parse(metric.date)) ||
        new Date(metric.date).toISOString().slice(0, 10) !== metric.date || metric.date >= today) continue;
    const observedMetrics = METRIC_NAMES.filter((name) => isObservedValue(metric, name));
    if (!observedMetrics.length) continue;
    const normalized = { ...metric, observedMetrics };
    unique.set(metric.date, mergeDailyMetrics(unique.get(metric.date), normalized));
  }
  return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function observedAverage(metrics: EmployeeDailyMetrics[], name: MetricName): number | null {
  const values = metrics.filter((metric) => isObservedValue(metric, name)).map((metric) => metric[name]);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
