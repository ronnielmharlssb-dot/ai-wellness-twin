import type { WellbeingObservation } from "./types";
import {
  getGroupObservations,
  saveObservation,
} from "./storage";

type ImportedObservationInput = {
  groupId: string;
  date: string;
  afterHoursActivity: number;
  meetingLoad: number;
  workPatternShift: number;
};

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00`);

  return !Number.isNaN(parsed.getTime());
}

function isValidMetric(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function saveImportedObservation(
  input: ImportedObservationInput
): boolean {
  if (!input.groupId.trim()) {
    return false;
  }

  if (!isValidDate(input.date)) {
    return false;
  }

  if (
    !isValidMetric(input.afterHoursActivity) ||
    !isValidMetric(input.meetingLoad) ||
    !isValidMetric(input.workPatternShift)
  ) {
    return false;
  }

  const existingObservations =
    getGroupObservations(input.groupId);

  const alreadyExists =
    existingObservations.some(
      (observation) =>
        observation.date === input.date
    );

  if (alreadyExists) {
    return false;
  }

  const observation: WellbeingObservation = {
    id: crypto.randomUUID(),
    groupId: input.groupId,
    date: input.date,
    source: "imported",

    afterHoursActivity:
      input.afterHoursActivity,

    meetingLoad:
      input.meetingLoad,

    workPatternShift:
      input.workPatternShift,
  };

  saveObservation(observation);

  return true;
}