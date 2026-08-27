import type { WellbeingObservation } from "./types";
import { MEANINGFUL_CHANGE_THRESHOLD } from "./constants";

type BaselineAverages = {
  afterHoursActivity: number;
  meetingLoad: number;
  workPatternShift: number;
};

type ChangeResult = {
  metric:
    | "afterHoursActivity"
    | "meetingLoad"
    | "workPatternShift";

  baselineValue: number;
  currentValue: number;
  percentageChange: number;
  meaningful: boolean;
};

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce((total, value) => total + value, 0) /
    values.length
  );
}

export function calculateBaselineAverages(
  observations: WellbeingObservation[]
): BaselineAverages {
  return {
    afterHoursActivity: average(
      observations.map(
        (observation) =>
          observation.afterHoursActivity
      )
    ),

    meetingLoad: average(
      observations.map(
        (observation) => observation.meetingLoad
      )
    ),

    workPatternShift: average(
      observations.map(
        (observation) =>
          observation.workPatternShift
      )
    ),
  };
}

function calculatePercentageChange(
  baselineValue: number,
  currentValue: number
): number {
  if (baselineValue === 0) {
    return currentValue === 0 ? 0 : 100;
  }

  return (
    ((currentValue - baselineValue) /
      baselineValue) *
    100
  );
}

export function detectMeaningfulChanges(
  baselineObservations: WellbeingObservation[],
  currentObservation: WellbeingObservation
): ChangeResult[] {
  const baseline =
    calculateBaselineAverages(
      baselineObservations
    );

  const metrics: Array<{
    metric: ChangeResult["metric"];
    baselineValue: number;
    currentValue: number;
  }> = [
    {
      metric: "afterHoursActivity",
      baselineValue:
        baseline.afterHoursActivity,
      currentValue:
        currentObservation.afterHoursActivity,
    },

    {
      metric: "meetingLoad",
      baselineValue: baseline.meetingLoad,
      currentValue:
        currentObservation.meetingLoad,
    },

    {
      metric: "workPatternShift",
      baselineValue:
        baseline.workPatternShift,
      currentValue:
        currentObservation.workPatternShift,
    },
  ];

  return metrics.map((item) => {
    const percentageChange =
      calculatePercentageChange(
        item.baselineValue,
        item.currentValue
      );

    return {
      metric: item.metric,
      baselineValue: item.baselineValue,
      currentValue: item.currentValue,
      percentageChange,
      meaningful:
        Math.abs(percentageChange) >=
        MEANINGFUL_CHANGE_THRESHOLD,
    };
  });
}