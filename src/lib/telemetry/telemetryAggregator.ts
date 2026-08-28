import type { ValidatedHeartbeat } from "./serverSanitizer";
import type { EmployeeDailyMetrics } from "../wellbeing/employeeTypes";
import { getMetricsForEmployee, saveEmployeeMetrics } from "../wellbeing/employeeMetrics";

export type LiveTelemetrySummary = {
  todayMetrics: EmployeeDailyMetrics;
  todayActiveMinutes: number;
  todayBreakCount: number;
  todayMeetingMinutes: number;
  todayAfterHoursMinutes: number;
  lastHeartbeatTimestamp: string;
};

const serverMetricsStore: Record<string, EmployeeDailyMetrics[]> = {};

/**
 * Atomically rolls up an incoming validated heartbeat into today's daily metric bucket.
 */
export function recordLiveHeartbeat(
  heartbeat: ValidatedHeartbeat
): LiveTelemetrySummary {
  const todayStr = new Date().toISOString().split("T")[0];
  
  let existingMetrics: EmployeeDailyMetrics[] = [];
  if (typeof window !== "undefined") {
    existingMetrics = getMetricsForEmployee(heartbeat.employeeId);
  } else {
    existingMetrics = serverMetricsStore[heartbeat.employeeId] || [];
  }

  const todayMetric = existingMetrics.find((m) => m.date === todayStr);

  const currentWorkingHours = todayMetric ? todayMetric.workingHours : 0;
  const currentMeetingLoad = todayMetric ? todayMetric.meetingLoad : 0;
  const currentBreakFrequency = todayMetric ? todayMetric.breakFrequency : 0;
  const currentAfterHours = todayMetric ? todayMetric.afterHoursActivity : 0;

  // 1. Calculate delta increments
  const additionalHours = heartbeat.activeSeconds / 3600;
  const additionalMeetingHours = heartbeat.meetingMinutes / 60;
  const additionalBreaks = heartbeat.isBreak ? 1 : 0;
  const additionalAfterHoursMinutes = heartbeat.isEvening ? heartbeat.activeSeconds / 60 : 0;

  // 2. Compute updated values with reasonable bounds
  const updatedWorkingHours = Math.min(24, Number((currentWorkingHours + additionalHours).toFixed(2)));
  const updatedMeetingLoad = Math.min(16, Number((currentMeetingLoad + additionalMeetingHours).toFixed(2)));
  const updatedBreakFrequency = Math.min(40, currentBreakFrequency + additionalBreaks);
  const updatedAfterHours = Math.min(480, Number((currentAfterHours + additionalAfterHoursMinutes).toFixed(1)));

  const updatedMetric: EmployeeDailyMetrics = {
    employeeId: heartbeat.employeeId,
    date: todayStr,
    source: "telemetry",
    workingHours: updatedWorkingHours,
    meetingLoad: updatedMeetingLoad,
    breakFrequency: updatedBreakFrequency,
    afterHoursActivity: updatedAfterHours,
  };

  // 3. Persist to server store & client storage
  if (typeof window !== "undefined") {
    saveEmployeeMetrics(updatedMetric);
  } else {
    const userMetrics = serverMetricsStore[heartbeat.employeeId] || [];
    const idx = userMetrics.findIndex((m) => m.date === todayStr);
    if (idx >= 0) {
      userMetrics[idx] = updatedMetric;
    } else {
      userMetrics.push(updatedMetric);
    }
    serverMetricsStore[heartbeat.employeeId] = userMetrics;
  }

  return {
    todayMetrics: updatedMetric,
    todayActiveMinutes: Math.round(updatedWorkingHours * 60),
    todayBreakCount: updatedBreakFrequency,
    todayMeetingMinutes: Math.round(updatedMeetingLoad * 60),
    todayAfterHoursMinutes: Math.round(updatedAfterHours),
    lastHeartbeatTimestamp: heartbeat.timestamp,
  };
}
