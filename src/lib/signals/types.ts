export type EmployeeSignal = {
  employeeId: string;

  date: string;

  activeMinutes: number;

  meetingMinutes: number;

  afterHoursMinutes: number;

  breakCount: number;

  appSwitches: number;

  source?: "demo" | "imported" | "microsoft365" | "github" | "google_calendar";
};