export type EmployeeSignal = {
  employeeId: string;

  date: string;

  activeMinutes: number;

  meetingMinutes: number;

  afterHoursMinutes: number;

  breakCount: number;

  appSwitches: number;
  observedMetrics?: import("../wellbeing/employeeTypes").MetricName[];
  githubEventCount?: number;

  source?: "demo" | "imported" | "microsoft365" | "github" | "google_calendar";
};
