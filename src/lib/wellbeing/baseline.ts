import type { WellbeingObservation } from "./types";
import { BASELINE_REQUIRED_DAYS } from "./constants";

export { BASELINE_REQUIRED_DAYS };

export function getBaselineDays(
  observations: WellbeingObservation[]
): number {
  const uniqueDates = new Set(
    observations.map(
      (observation) => observation.date
    )
  );

  return uniqueDates.size;
}

export function isBaselineEstablished(
  observations: WellbeingObservation[]
): boolean {
  return (
    getBaselineDays(observations) >=
    BASELINE_REQUIRED_DAYS
  );
}

export function getBaselineStatus(
  observations: WellbeingObservation[]
): "building" | "established" {
  return isBaselineEstablished(observations)
    ? "established"
    : "building";
}