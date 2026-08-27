export type WellbeingObservation = {
  id: string;
  groupId: string;
  date: string;
  source: "demo" | "imported" | "microsoft365";
  afterHoursActivity: number;
  meetingLoad: number;
  workPatternShift: number;
};
