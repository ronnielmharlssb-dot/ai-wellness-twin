import { compareObservedValues, type EmployeeChangeResult } from "./employeeChangeDetection";
import { BASELINE_REQUIRED_DAYS } from "./constants";
import { METRIC_NAMES } from "./employeeMetrics";
import { completedEmployeeObservations, isObservedValue, observedAverage } from "./employeeObservations";
import type { EmployeeDailyMetrics, MetricName } from "./employeeTypes";

export type MetricEvidence = {
  baselineDays: number; recentDays: number; baselineValue: number | null; recentValue: number | null;
  baselineStart: string | null; baselineEnd: string | null; comparable: boolean;
};
export type EmployeeAssessment = {
  score: number | null; status: "building" | "partial" | "stable" | "watch" | "attention";
  daysCollected: number; requiredDays: number; changes: EmployeeChangeResult[];
  comparisons: EmployeeChangeResult[]; coverage: Record<MetricName, MetricEvidence>;
  comparisonStart: string; comparisonEnd: string; comparableMetrics: MetricName[];
};
/** Seven closed UTC dates, compared with 28 earlier observed dates per metric.
 * Missing dates never become zero, and baseline/comparison windows never overlap.
 */
export function buildEmployeeAssessment(metrics: EmployeeDailyMetrics[], options: { now?: number } = {}): EmployeeAssessment {
  const now = options.now ?? Date.now();
  const end = Date.parse(new Date(now).toISOString().slice(0, 10) + "T00:00:00Z");
  const comparisonStart = new Date(end - 7 * 86400000).toISOString().slice(0, 10);
  const comparisonEnd = new Date(end - 86400000).toISOString().slice(0, 10);
  const earliest = new Date(end - 90 * 86400000).toISOString().slice(0, 10);
  const completed = completedEmployeeObservations(metrics, now).filter((day) => day.date >= earliest);
  const prior = completed.filter((day) => day.date < comparisonStart);
  const recent = completed.filter((day) => day.date >= comparisonStart);
  const coverage = {} as Record<MetricName, MetricEvidence>;
  const comparisons: EmployeeChangeResult[] = [];
  for (const name of METRIC_NAMES) {
    const baseline = prior.filter((day) => isObservedValue(day, name)).slice(-BASELINE_REQUIRED_DAYS);
    const current = recent.filter((day) => isObservedValue(day, name));
    const baselineValue = observedAverage(baseline, name), recentValue = observedAverage(current, name);
    const comparable = baseline.length === BASELINE_REQUIRED_DAYS && baselineValue !== null && recentValue !== null;
    coverage[name] = { baselineDays: baseline.length, recentDays: current.length, baselineValue, recentValue,
      baselineStart: baseline[0]?.date ?? null, baselineEnd: baseline.at(-1)?.date ?? null, comparable };
    if (comparable) comparisons.push(compareObservedValues(name, baselineValue!, recentValue!));
  }
  const comparableMetrics = comparisons.map((change) => change.metric);
  const changes = comparisons.filter((change) => change.meaningful);
  // Partial evidence supplies scoped comparisons; the overall index requires every
  // metric on every comparison day and defined percentage changes.
  const full = comparisons.length === METRIC_NAMES.length && METRIC_NAMES.every((name) => coverage[name].recentDays === 7) &&
    comparisons.every((change) => change.percentageChange !== null);
  const score = full ? calculatePatternIndex(changes) : null;
  return { score, status: !comparisons.length ? "building" : score === null ? "partial" : score >= 80 ? "stable" : score >= 60 ? "watch" : "attention",
    daysCollected: Math.min(...METRIC_NAMES.map((name) => coverage[name].baselineDays)), requiredDays: BASELINE_REQUIRED_DAYS,
    changes, comparisons, coverage, comparisonStart, comparisonEnd, comparableMetrics };
}
function calculatePatternIndex(changes: EmployeeChangeResult[]): number {
  const weights: Record<MetricName, number> = { workingHours: 0.3, meetingLoad: 0.2, breakFrequency: 0.2, afterHoursActivity: 0.3 };
  let deviation = 0;
  for (const change of changes) {
    const percentage = change.percentageChange ?? 0;
    if ((change.metric === "breakFrequency" && percentage < 0) || (change.metric !== "breakFrequency" && percentage > 0)) {
      deviation += Math.min(Math.abs(percentage), 100) * weights[change.metric];
    }
  }
  return Math.max(0, Math.round(100 - deviation));
}
