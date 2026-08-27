export type EmployeeDailyMetrics = {
  employeeId: string;

  date: string;

  source: "demo" | "microsoft365";

  workingHours: number;

  meetingLoad: number;

  breakFrequency: number;

  afterHoursActivity: number;
};