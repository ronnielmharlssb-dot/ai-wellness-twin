import type { WellbeingObservation } from "./types";

const STORAGE_KEY = "hr-wellbeing-observations";

export function getObservations(): WellbeingObservation[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(
      "Failed to load wellbeing observations:",
      error
    );

    return [];
  }
}

export function saveObservation(
  observation: WellbeingObservation
) {
  if (typeof window === "undefined") {
    return;
  }

  const existing = getObservations();

  const updated = existing.some(
    (item) =>
      item.groupId === observation.groupId &&
      item.date === observation.date
  )
    ? existing.map((item) =>
        item.groupId === observation.groupId &&
        item.date === observation.date
          ? observation
          : item
      )
    : [...existing, observation];

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(updated)
  );
}

export function saveObservations(
  observations: WellbeingObservation[]
) {
  if (typeof window === "undefined") {
    return;
  }

  const updated = [...getObservations()];

  observations.forEach((observation) => {
    const existingIndex = updated.findIndex(
      (item) =>
        item.groupId === observation.groupId &&
        item.date === observation.date
    );

    if (existingIndex >= 0) {
      updated[existingIndex] = observation;
    } else {
      updated.push(observation);
    }
  });

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(updated)
  );
}

export function getGroupObservations(
  groupId: string
): WellbeingObservation[] {
  return getObservations().filter(
    (observation) => observation.groupId === groupId
  );
}