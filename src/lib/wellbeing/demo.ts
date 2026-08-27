import type { WellbeingObservation } from "./types";
import {
  saveObservation,
  getGroupObservations,
} from "./storage";

function dateForDaysAgo(daysAgo: number): string {
  const date = new Date();

  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);

  return date.toISOString().slice(0, 10);
}

export function generateDemoObservation(
  groupId: string,
  daysAgo: number
): WellbeingObservation {
  return {
    id: crypto.randomUUID(),
    groupId,
    date: dateForDaysAgo(daysAgo),
    
    source: "demo",

    afterHoursActivity: 10 + (daysAgo % 5),
    meetingLoad: 7 + (daysAgo % 4),
    workPatternShift: 2 + (daysAgo % 3),
  };
}

export function generateDemoBaseline(
  groupId: string,
  days: number = 28
) {
  const existingObservations =
    getGroupObservations(groupId);

  const existingDates = new Set(
    existingObservations.map(
      (observation) => observation.date
    )
  );

  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    const observation =
      generateDemoObservation(
        groupId,
        daysAgo
      );

    if (existingDates.has(observation.date)) {
      continue;
    }

    saveObservation(observation);
  }
}