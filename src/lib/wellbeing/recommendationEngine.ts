import type { EmployeeAssessment } from "./employeeAssessment";
import { metricLabels, formatChange } from "./formatters";
export type Recommendation = { title: string; reason: string; action: string };
export function buildRecommendations(assessment: EmployeeAssessment): Recommendation[] {
  return assessment.changes.map(change => {
    const increased = change.currentValue > change.baselineValue;
    const reason = change.percentageChange === null
      ? metricLabels[change.metric] + " was zero in your baseline and is now recorded. A percentage change is undefined."
      : metricLabels[change.metric] + (increased ? " increased" : " decreased") + " by " + formatChange(Math.abs(change.percentageChange)) + " in the observed daily averages.";
    switch (change.metric) {
      case "workingHours": return { title: "Reflect on working duration", reason,
        action: "Check whether the change reflects your workload or different recording coverage. Consider whether your schedule fits your priorities." };
      case "breakFrequency": return { title: "Reflect on recorded breaks", reason,
        action: increased ? "Notice what supported the extra pauses, and whether recording coverage changed."
          : "Check whether pauses went unrecorded. If you would like more breaks, consider reserving time between tasks." };
      case "afterHoursActivity": return { title: "Reflect on after-hours habits", reason,
        action: increased ? "Check your configured schedule and recording coverage. Consider whether you want a clearer end-of-day boundary."
          : "Notice whether the change reflects your intended schedule or reduced recording coverage." };
      case "meetingLoad": return { title: "Reflect on meeting load", reason,
        action: "Check whether your calendar was fully imported. Consider which meetings supported your priorities and whether you want to adjust them." };
    }
  });
}
