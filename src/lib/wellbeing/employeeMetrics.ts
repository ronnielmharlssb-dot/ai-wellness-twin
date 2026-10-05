import type { DailyMetricValues, EmployeeDailyMetrics, MetricName } from "./employeeTypes";

const STORAGE_KEY = "employee-daily-metrics";
export const METRIC_NAMES: MetricName[] = ["workingHours", "meetingLoad", "breakFrequency", "afterHoursActivity"];

export function observedMetricNames(metric: EmployeeDailyMetrics | DailyMetricValues): MetricName[] {
  if (metric.observedMetrics) return metric.observedMetrics;
  // Legacy calendar and GitHub records included fabricated focus/break estimates.
  if ("source" in metric && metric.source === "github") return [];
  if ("source" in metric && ["google_calendar", "microsoft365"].includes(metric.source as string)) {
    return ["meetingLoad", "afterHoursActivity"];
  }
  return METRIC_NAMES;
}

function values(metric: EmployeeDailyMetrics): DailyMetricValues {
  return {
    workingHours: metric.workingHours,
    meetingLoad: metric.meetingLoad,
    breakFrequency: metric.breakFrequency,
    afterHoursActivity: metric.afterHoursActivity,
    observedMetrics: observedMetricNames(metric),
  };
}

export function mergeDailyMetrics(existing: EmployeeDailyMetrics | undefined, metric: EmployeeDailyMetrics): EmployeeDailyMetrics {
  // Cloud replies contain every source. Replace the daily snapshot so corrections
  // and cancellations can lower totals; delayed acknowledgements cannot regress it.
  if (metric.cloudRevision !== undefined) {
    return (existing?.cloudRevision ?? -1) > metric.cloudRevision ? existing! : metric;
  }
  if (existing?.cloudRevision !== undefined) return existing;
  if (existing && metric.source === "telemetry" && metric.telemetryRevision !== undefined &&
      (existing.telemetryRevision ?? -1) > metric.telemetryRevision) return existing;
  const contributions = {
    ...(existing?.contributions ?? (existing ? { [existing.source]: values(existing) } : {})),
    ...(metric.contributions ?? { [metric.source]: values(metric) }),
  };
  // The legacy calendar parser used microsoft365 for Google imports. A fresh
  // calendar snapshot supersedes that legacy source instead of retaining stale totals.
  if (metric.source === "google_calendar") delete contributions.microsoft365;
  const snapshots = Object.values(contributions);
  const observedMetrics = METRIC_NAMES.filter((name) => snapshots.some((item) => observedMetricNames(item).includes(name)));
  const total = (name: MetricName) => Math.max(0, ...snapshots.filter((item) => observedMetricNames(item).includes(name)).map((item) => item[name]));
  // Sources can observe the same interval. Without interval evidence, summing them
  // would double count. Keep a conservative lower bound while preserving provenance.
  return {
    ...existing,
    ...metric,
    contributions,
    observedMetrics,
    workingHours: total("workingHours"),
    meetingLoad: total("meetingLoad"),
    breakFrequency: total("breakFrequency"),
    afterHoursActivity: total("afterHoursActivity"),
  };
}

export function getEmployeeMetrics(): EmployeeDailyMetrics[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to load employee metrics:", error);
    return [];
  }
}

export function saveEmployeeMetrics(metric: EmployeeDailyMetrics) {
  if (typeof window === "undefined") {
    return;
  }

  saveEmployeeMetricsBatch([metric]);
}

export function getMetricsForEmployee(
  employeeId: string
): EmployeeDailyMetrics[] {
  return getEmployeeMetrics().filter(
    (item) => item.employeeId === employeeId
  );
}

export function saveEmployeeMetricsBatch(
  metrics: EmployeeDailyMetrics[]
) {
  if (typeof window === "undefined") {
    return;
  }

  const updated = [...getEmployeeMetrics()];

  metrics.forEach((metric) => {
    const existingIndex = updated.findIndex(
      (item) =>
        item.employeeId === metric.employeeId &&
        item.date === metric.date
    );

    if (existingIndex >= 0) {
      updated[existingIndex] = mergeDailyMetrics(updated[existingIndex], metric);
    } else {
      updated.push(mergeDailyMetrics(undefined, metric));
    }
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/** Refresh this account from authoritative cloud history; never upload old demo estimates. */
export function replaceCloudEmployeeMetrics(employeeId: string, metrics: EmployeeDailyMetrics[], stateRevision = Number.MAX_SAFE_INTEGER) {
  if (typeof window === "undefined") return;
  if (metrics.some((metric) => metric.employeeId !== employeeId || metric.cloudRevision === undefined)) {
    throw new Error("Invalid private observation snapshot.");
  }
  const existing = getEmployeeMetrics();
  const refreshed = metrics.map((metric) => mergeDailyMetrics(
    existing.find((item) => item.employeeId === employeeId && item.date === metric.date), metric));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([
    ...existing.filter((item) => item.employeeId !== employeeId ||
      ((item.cloudRevision ?? -1) > stateRevision && !metrics.some((metric) => metric.date === item.date))), ...refreshed,
  ]));
}

/**
 * HR Data Governance: Clears an individual employee's metrics
 * without displaying or exposing the underlying metrics.
 */
export function clearEmployeeMetrics(employeeId: string): boolean {
  if (typeof window === "undefined") return false;

  const existing = getEmployeeMetrics();
  const filtered = existing.filter((item) => item.employeeId !== employeeId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * System Data Governance: Wipes all demo data across the entire client.
 */
export function wipeAllDemoData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("wellness-integrations-config");
  localStorage.removeItem("wellness-registered-users");
  localStorage.removeItem("wellness-auth-user");
  localStorage.removeItem("hr-wellbeing-observations");
  localStorage.removeItem("hr-groups");
  window.dispatchEvent(new CustomEvent("wellness-telemetry-update"));
}
