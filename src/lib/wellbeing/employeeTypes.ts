export type EmployeeDailyMetrics = {
  employeeId: string;

  date: string;

  source: "demo" | "microsoft365" | "telemetry" | "manual";

  workingHours: number;

  meetingLoad: number;

  breakFrequency: number;

  afterHoursActivity: number;
};