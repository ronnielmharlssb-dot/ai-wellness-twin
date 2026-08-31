import type { EmployeeDailyMetrics } from "./employeeTypes";
import { getMetricsForEmployee, saveEmployeeMetricsBatch, clearEmployeeMetrics } from "./employeeMetrics";

export const CALIBRATED_DEMO_ID = "usr-demo-calibrated";

/**
 * Generates 28 days of realistic baseline telemetry metrics for the demo account
 */
export function generate28DayMetrics(employeeId: string = CALIBRATED_DEMO_ID): EmployeeDailyMetrics[] {
  const metrics: EmployeeDailyMetrics[] = [];
  const today = new Date();

  // 28 days of realistic workday patterns across the 4 calibration weeks
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) {
      // Light weekend rest with minimal background telemetry
      metrics.push({
        employeeId,
        date: dateStr,
        source: "telemetry",
        workingHours: Number((Math.random() * 0.8).toFixed(1)),
        meetingLoad: 0,
        breakFrequency: Math.floor(Math.random() * 2),
        afterHoursActivity: Math.floor(Math.random() * 10),
      });
    } else {
      // Weekday knowledge worker realistic distribution
      // Base hours: ~7.5h to 8.5h
      const baseHours = 7.5 + Math.random() * 1.2;
      // Meeting load: ~2.0h to 3.5h
      const baseMeetings = 1.5 + Math.random() * 2.0;
      // Break frequency: 4 to 7 breaks
      const baseBreaks = 4 + Math.floor(Math.random() * 4);
      // After hours: 0m to 25m
      const baseAfterHours = Math.random() > 0.6 ? Math.floor(Math.random() * 30) : 0;

      metrics.push({
        employeeId,
        date: dateStr,
        source: i % 3 === 0 ? "github" : "telemetry",
        workingHours: Number(baseHours.toFixed(1)),
        meetingLoad: Number(baseMeetings.toFixed(1)),
        breakFrequency: baseBreaks,
        afterHoursActivity: baseAfterHours,
      });
    }
  }

  return metrics;
}

/**
 * Seeds all 28-day baseline telemetry and input data for the calibrated demo account
 */
export function seedCalibratedDemoAccount(): void {
  if (typeof window === "undefined") return;

  // 1. Generate and save 28 days of baseline metrics
  const full28Days = generate28DayMetrics(CALIBRATED_DEMO_ID);
  saveEmployeeMetricsBatch(full28Days);

  // 2. Pre-link realistic sample integrations for the demo account
  try {
    const existing = localStorage.getItem("wellness-integrations-config");
    let integrations = existing ? JSON.parse(existing) : [];
    
    // Ensure all core tools show as connected with verified handles
    const demoHandles: Record<string, string> = {
      github: "alex-rivera-dev",
      vscode: "alex-workstation-main",
      chatgpt: "alex.rivera@company.com",
      gemini: "alex.rivera@company.com",
      claude: "alex.rivera@company.com",
      google_calendar: "alex.rivera@company.com",
      figma: "alex-creative-workspace",
      slack: "alex-team-sync",
      discord: "alex_r#4092",
    };

    if (Array.isArray(integrations)) {
      integrations = integrations.map((item) => {
        if (demoHandles[item.provider]) {
          return {
            ...item,
            connected: true,
            config: {
              ...item.config,
              username: demoHandles[item.provider],
              workspaceName: demoHandles[item.provider],
              calendarEmail: demoHandles[item.provider],
            },
          };
        }
        return item;
      });
      localStorage.setItem("wellness-integrations-config", JSON.stringify(integrations));
    }
  } catch {
    // ignore
  }

  // 3. Dispatch telemetry update event for live UI reactivity
  window.dispatchEvent(new CustomEvent("wellness-telemetry-update"));
}

/**
 * Resets the demo account back to Day 0 (Uncalibrated) for testing the calibration flow
 */
export function resetCalibratedDemoAccount(): void {
  if (typeof window === "undefined") return;
  clearEmployeeMetrics(CALIBRATED_DEMO_ID);
  window.dispatchEvent(new CustomEvent("wellness-telemetry-update"));
}

/**
 * Check if the demo account is currently fully calibrated (has >= 28 days)
 */
export function isDemoAccountCalibrated(): boolean {
  if (typeof window === "undefined") return false;
  const metrics = getMetricsForEmployee(CALIBRATED_DEMO_ID);
  return metrics.length >= 28;
}
