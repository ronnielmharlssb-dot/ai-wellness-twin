export const metricLabels: Record<string, string> = {
  workingHours: "Recorded Active Time",
  workDuration: "Work Duration",
  breakFrequency: "Recorded Breaks",
  afterHoursActivity: "Recorded After-hours Activity",
  meetingLoad: "Scheduled Meeting Load",
};

export function formatChange(percentage: number | null): string {
  if (percentage === null) return "New recorded activity";
  const rounded = Math.round(Math.abs(percentage));
  return percentage >= 0
    ? `${rounded}% above usual`
    : `${rounded}% below usual`;
}
