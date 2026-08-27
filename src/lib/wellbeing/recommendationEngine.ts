import type { EmployeeAssessment }
  from "./employeeAssessment";

export type Recommendation = {
  title: string;
  reason: string;
  action: string;
};

export function buildRecommendations(
  assessment: EmployeeAssessment
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  assessment.changes.forEach((change) => {
    switch (change.metric) {
      case "workingHours":
        recommendations.push({
          title: "Manage working duration",
          reason: `Working hours changed by ${Math.round(
            Math.abs(change.percentageChange)
          )}% compared with your typical schedule.`,
          action:
            "Consider prioritizing high-impact tasks and pacing your daily workload to avoid burnout.",
        });
        break;

      case "breakFrequency":
        recommendations.push({
          title: "Protect short breaks",
          reason: `Break frequency is ${Math.round(
            Math.abs(change.percentageChange)
          )}% below your usual pattern.`,
          action:
            "Consider taking short pauses between focused work sessions or meetings.",
        });
        break;

      case "afterHoursActivity":
        recommendations.push({
          title: "Create a clearer work cutoff",
          reason: `After-hours activity changed by ${Math.round(
            Math.abs(change.percentageChange)
          )}% compared with your normal pattern.`,
          action:
            "Consider setting a consistent end-of-day boundary and reducing notifications after work hours.",
        });
        break;

      case "meetingLoad":
        recommendations.push({
          title: "Review your meeting load",
          reason: `Meeting load changed by ${Math.round(
            Math.abs(change.percentageChange)
          )}% compared with your baseline.`,
          action:
            "Consider whether some meetings could be shortened, combined, or handled asynchronously.",
        });
        break;
    }
  });

  return recommendations;
}