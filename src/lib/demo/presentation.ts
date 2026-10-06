import { buildEmployeeAssessment } from "../wellbeing/employeeAssessment";
import type { EmployeeDailyMetrics, MetricName } from "../wellbeing/employeeTypes";

export type DemoScenario = "steady" | "busy" | "calibrating" | "partial";
export const DEMO_METRICS: MetricName[] = ["workingHours", "meetingLoad", "breakFrequency", "afterHoursActivity"];

/** Public, deterministic fiction. Never reads an account or writes observations. */
export function createPresentationSample(scenario: DemoScenario, now: number) {
  const end = Date.parse(new Date(now).toISOString().slice(0, 10) + "T00:00:00Z");
  const days: EmployeeDailyMetrics[] = [];
  for (let offset = scenario === "calibrating" ? 21 : 35; offset >= 1; offset--) {
    const recent = offset <= 7;
    const elevated = recent && scenario !== "steady";
    days.push({ employeeId: "public-fictional-sample", source: "demo",
      date: new Date(end - offset * 86400000).toISOString().slice(0, 10),
      workingHours: elevated ? 9 : 7.5, meetingLoad: elevated ? 3 : 2,
      breakFrequency: elevated ? 3 : 5, afterHoursActivity: elevated ? 35 : 15,
      observedMetrics: scenario === "partial" ? DEMO_METRICS.filter(name => name !== "afterHoursActivity") : [...DEMO_METRICS],
    });
  }
  return { days, assessment: buildEmployeeAssessment(days, { now }) };
}

/** Illustrates suppression using fictional contributors; real HR uses database policy. */
export function presentationGroup(consentingContributors: number) {
  if (consentingContributors < 3) return { available: false as const, contributors: consentingContributors, metrics: null };
  return { available: true as const, contributors: consentingContributors,
    metrics: { workingHours: 8.2, meetingLoad: 2.7, breakFrequency: 4, afterHoursActivity: 25 } };
}
