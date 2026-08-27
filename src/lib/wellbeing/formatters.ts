export const metricLabels: Record<string, string> = {
  workingHours: "Working Hours",
  workDuration: "Work Duration",
  breakFrequency: "Break Frequency",
  afterHoursActivity: "After-hours Activity",
  meetingLoad: "Meeting Load",
};

export function formatChange(percentage: number): string {
  const rounded = Math.round(Math.abs(percentage));
  return percentage >= 0
    ? `${rounded}% above usual`
    : `${rounded}% below usual`;
}
