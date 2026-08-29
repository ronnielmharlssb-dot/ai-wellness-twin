import type { EmployeeDailyMetrics } from "./employeeTypes";

const STORAGE_KEY = "employee-daily-metrics";

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
      const existing = updated[existingIndex];
      // Accumulate across multiple tools for the same day (capped at realistic daily bounds)
      const combinedHours = Number(
        Math.min(14, Number(existing.workingHours || 0) + Number(metric.workingHours || 0)).toFixed(1)
      );
      const combinedMeetings = Math.min(600, (existing.meetingLoad || 0) + (metric.meetingLoad || 0));
      const combinedBreaks = Math.min(12, (existing.breakFrequency || 0) + (metric.breakFrequency || 0));
      const combinedAfterHours = Math.min(300, (existing.afterHoursActivity || 0) + (metric.afterHoursActivity || 0));

      updated[existingIndex] = {
        ...existing,
        workingHours: combinedHours,
        meetingLoad: combinedMeetings,
        breakFrequency: combinedBreaks,
        afterHoursActivity: combinedAfterHours,
      };
    } else {
      updated.push(metric);
    }
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
}

