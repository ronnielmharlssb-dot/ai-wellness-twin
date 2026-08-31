export type EmployeeDailyMetrics = {
  employeeId: string;

  date: string;

  source: "telemetry" | "github" | "google_calendar" | "microsoft365" | "manual" | "imported" | "demo";

  workingHours: number;

  meetingLoad: number;

  breakFrequency: number;

  afterHoursActivity: number;
};