export type DailyMetricValues = {
  workingHours: number;
  meetingLoad: number;
  breakFrequency: number;
  afterHoursActivity: number;
  /** Missing observations are unknown, rather than evidence of zero activity. */
  observedMetrics?: MetricName[];
};
export type MetricName = "workingHours" | "meetingLoad" | "breakFrequency" | "afterHoursActivity";

export type EmployeeDailyMetrics = DailyMetricValues & {
  employeeId: string;

  date: string;

  source: "telemetry" | "github" | "google_calendar" | "microsoft365" | "manual" | "imported" | "demo";

  /** Latest daily snapshot per source; refreshing one source must not erase another. */
  contributions?: Partial<Record<EmployeeDailyMetrics["source"], DailyMetricValues>>;
  /** Measured tool durations only, supplied by the telemetry collector. */
  toolActiveMinutes?: Record<string, number>;
  githubEventCount?: number;
  telemetryRevision?: number;
  /** Database revision of the complete daily snapshot, including every source. */
  cloudRevision?: number;
};
