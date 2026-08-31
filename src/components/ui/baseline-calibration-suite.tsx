"use client";

import { useEffect } from "react";
import {
  Calendar,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Zap,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getMetricsForEmployee,
} from "@/lib/wellbeing/employeeMetrics";
import { getStoredIntegrations } from "@/lib/integrations/syncEngine";
import {
  seedCalibratedDemoAccount,
  resetCalibratedDemoAccount,
  CALIBRATED_DEMO_ID,
} from "@/lib/wellbeing/calibratedAccountSeeder";

interface BaselineSuiteProps {
  employeeId: string;
  daysCollected: number;
  requiredDays?: number;
  onMetricsUpdated: () => void;
}

export function BaselineCalibrationSuite({
  employeeId,
  daysCollected,
  requiredDays = 28,
  onMetricsUpdated,
}: BaselineSuiteProps) {
  const isDemoAccount = employeeId === CALIBRATED_DEMO_ID;

  // Listen for real-time telemetry updates from browser tracker and integrations
  useEffect(() => {
    const handleTelemetryEvent = () => {
      onMetricsUpdated();
    };

    window.addEventListener("wellness-telemetry-update", handleTelemetryEvent);
    return () => {
      window.removeEventListener("wellness-telemetry-update", handleTelemetryEvent);
    };
  }, [onMetricsUpdated]);

  const percentage = Math.min(100, Math.round((daysCollected / requiredDays) * 100));
  const remainingDays = Math.max(0, requiredDays - daysCollected);

  const connectedIntegrations = getStoredIntegrations().filter((i) => i.connected);

  // Determine current phase
  const getPhaseInfo = () => {
    if (daysCollected <= 7) {
      return {
        phase: 1,
        title: "Week 1: Workstation Rhythm & Schedule Detection",
        desc: "Learning your daily start and end bounds, core focus windows, and natural session rhythm.",
      };
    } else if (daysCollected <= 14) {
      return {
        phase: 2,
        title: "Week 2: Meeting Load & Calendar Distribution Lock",
        desc: "Calibrating collaboration density, video call clustering, and focus time buffer requirements.",
      };
    } else if (daysCollected <= 21) {
      return {
        phase: 3,
        title: "Week 3: Rest & Micro-Pause Recovery Rhythm",
        desc: "Mapping restorative breaks, screen pauses, and evening boundary recovery intervals.",
      };
    } else {
      return {
        phase: 4,
        title: "Week 4: Final Behavioral Twin Profile Establishment",
        desc: "Synthesizing 28 days of variance into a personal behavioral baseline.",
      };
    }
  };

  const currentPhase = getPhaseInfo();
  const existingMetrics = getMetricsForEmployee(employeeId).sort((a, b) => a.date.localeCompare(b.date));

  const todayStr = new Date().toISOString().split("T")[0];
  const pastMetrics = existingMetrics.filter((m) => m.date < todayStr);
  const todayMetric = existingMetrics.find((m) => m.date === todayStr);

  const completedPastDays = pastMetrics.length;
  const currentDayIndex = Math.min(requiredDays, completedPastDays + 1);

  // Compute preliminary averages from data collected so far
  const avgWorkingHours =
    existingMetrics.length > 0
      ? (existingMetrics.reduce((acc, m) => acc + m.workingHours, 0) / existingMetrics.length).toFixed(1)
      : "0";
  const avgMeetings =
    existingMetrics.length > 0
      ? (existingMetrics.reduce((acc, m) => acc + m.meetingLoad, 0) / existingMetrics.length).toFixed(1)
      : "0";
  const avgBreaks =
    existingMetrics.length > 0
      ? (existingMetrics.reduce((acc, m) => acc + m.breakFrequency, 0) / existingMetrics.length).toFixed(1)
      : "0";

  return (
    <Card className="overflow-hidden border-slate-300 bg-white p-6 shadow-sm dark:border-[#383734] dark:bg-[#2c2b28]">
      <div className="space-y-6">
        
        {/* Top Header & Calibration Progress Status */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-[#60cdff]">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                28-Day Behavioral Baseline Calibration
              </h2>
              <Badge variant="neutral">
                Day {currentDayIndex} of {requiredDays} • In Progress
              </Badge>
            </div>

            <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
              {isDemoAccount
                ? "Demo Account: You can prefill all 28 days of baseline data using the option below."
                : "Calibrating your personal workday baseline without any pre-seeded demo data."}
            </p>
          </div>

          {/* Demo Account Prefill Action */}
          {isDemoAccount && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={() => {
                  seedCalibratedDemoAccount();
                  onMetricsUpdated();
                }}
                className="text-xs h-8 px-3 font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm"
              >
                <Zap className="mr-1.5 h-3.5 w-3.5 fill-current" />
                Prefill All 28 Days
              </Button>
            </div>
          )}
        </div>

        {/* Demo Account Notice Banner */}
        {isDemoAccount && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/30 text-xs">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300">
              <Zap className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Demo Mode Active:</strong> This separate account has full access to prefill all 28-day baseline and survey inputs.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  seedCalibratedDemoAccount();
                  onMetricsUpdated();
                }}
                className="text-xs h-7 px-2.5 font-bold border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200"
              >
                ⚡ Calibrate 28 Days
              </Button>
              {daysCollected > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    resetCalibratedDemoAccount();
                    onMetricsUpdated();
                  }}
                  className="text-xs h-7 px-2.5 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Reset to Day 0
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Phase Progress Bar & Banner */}
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50/70 to-indigo-50/50 p-4 dark:border-sky-950/50 dark:from-sky-950/20 dark:to-indigo-950/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-900 dark:text-[#60cdff]">
              <span>📍 {currentPhase.title}</span>
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-[#cfcfce]">
              {percentage}% Complete • {remainingDays === 0 ? "Established!" : `${remainingDays} days remaining`}
            </span>
          </div>

          {/* Progress Track */}
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-[#1f1e1c]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${Math.max(4, percentage)}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-600 dark:text-[#a6a6a6]">
            {currentPhase.desc}
          </p>
        </div>

        {/* 28-Day Interactive Calendar Matrix */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>28-Day Calibration Matrix</span>
            </span>
            <span className="text-[10px] text-slate-400">
              Each day strengthens the behavioral profile
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {Array.from({ length: requiredDays }, (_, i) => {
              const dayNum = i + 1;
              const isPastLogged = dayNum <= completedPastDays;
              const isTodayActive = dayNum === currentDayIndex;
              const metricForDay = isPastLogged
                ? pastMetrics[i]
                : isTodayActive
                ? todayMetric
                : undefined;

              return (
                <div
                  key={dayNum}
                  title={
                    metricForDay
                      ? `Day ${dayNum} (${metricForDay.date}): ${metricForDay.workingHours}h work, ${metricForDay.meetingLoad}h meetings, ${metricForDay.breakFrequency} breaks`
                      : `Day ${dayNum}: Pending calibration`
                  }
                  className={`relative flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all duration-200 border ${
                    isPastLogged
                      ? "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : isTodayActive
                      ? "border-sky-400 bg-sky-50/80 text-sky-900 ring-2 ring-sky-300/60 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-200"
                      : "border-slate-200/60 bg-slate-50/50 text-slate-400 dark:border-[#383734]/60 dark:bg-[#20201e]/60 dark:text-[#666]"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold">Day {dayNum}</span>
                    {isTodayActive && (
                      <span className="rounded-full bg-sky-500/20 px-1 text-[8px] font-extrabold text-sky-600 dark:text-sky-300">
                        Today
                      </span>
                    )}
                  </div>

                  {isPastLogged ? (
                    <CheckCircle2 className="mt-1 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : isTodayActive ? (
                    <span className="mt-1 flex h-3.5 w-3.5 items-center justify-center">
                      <span className="h-2 w-2 rounded-full bg-sky-500 animate-ping" />
                    </span>
                  ) : (
                    <span className="mt-1 text-[10px] font-medium opacity-50">—</span>
                  )}

                  {metricForDay && (
                    <span
                      className={`mt-1 text-[9px] font-semibold truncate max-w-full ${
                        isTodayActive
                          ? "text-sky-800 dark:text-sky-300"
                          : "text-emerald-800 dark:text-emerald-300"
                      }`}
                    >
                      {metricForDay.workingHours}h
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time Preliminary Baseline Metrics Calibrated So Far */}
        {existingMetrics.length > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center dark:border-[#383734] dark:bg-[#20201e]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Avg Working Hours
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {avgWorkingHours} <span className="text-xs font-normal text-slate-400">hrs/day</span>
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center dark:border-[#383734] dark:bg-[#20201e]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Avg Meeting Load
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {avgMeetings} <span className="text-xs font-normal text-slate-400">hrs/day</span>
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center dark:border-[#383734] dark:bg-[#20201e]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Avg Rest Pauses
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {avgBreaks} <span className="text-xs font-normal text-slate-400">breaks/day</span>
              </p>
            </div>
          </div>
        )}

        {/* Live Automatic Signal Telemetry Status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#383734] dark:bg-[#1f1e1c]">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Automatic Telemetry Bridge
                </span>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {connectedIntegrations.length > 0 ? `${connectedIntegrations.length} Apps Synced` : "Passive Listening Active"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#a6a6a6]">
                Genuine background signals from your workstation and connected tools stream organically into Day 1.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>100% Organic Recording</span>
          </div>
        </div>

      </div>
    </Card>
  );
}
