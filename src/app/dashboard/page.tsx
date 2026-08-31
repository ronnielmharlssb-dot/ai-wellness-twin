"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
  ChevronRight,
  Sparkles,
  RotateCcw,
} from "lucide-react";

import {
  buildEmployeeAssessment,
  type EmployeeAssessment,
} from "@/lib/wellbeing/employeeAssessment";
import { getMetricsForEmployee } from "@/lib/wellbeing/employeeMetrics";
import { formatChange, metricLabels } from "@/lib/wellbeing/formatters";
import { getLocalSessionUser, type AuthUser } from "@/lib/supabase/auth";
import {
  seedCalibratedDemoAccount,
  resetCalibratedDemoAccount,
  CALIBRATED_DEMO_ID,
} from "@/lib/wellbeing/calibratedAccountSeeder";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { BaselineCalibrationSuite } from "@/components/ui/baseline-calibration-suite";
import { ToolActivityBreakdown } from "@/components/ui/tool-activity-breakdown";
import { LensCard } from "@/components/ui/lens-card";

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [assessment, setAssessment] = useState<EmployeeAssessment | null>(null);

  const loadUserData = (currentUserId: string) => {
    const metrics = getMetricsForEmployee(currentUserId);
    const result = buildEmployeeAssessment(metrics);
    setAssessment(result);
  };

  useEffect(() => {
    const sessionUser = getLocalSessionUser();
    setUser(sessionUser);
    const employeeId = sessionUser?.id || "usr-ronnie";
    loadUserData(employeeId);
  }, []);

  const isBuilding = assessment?.status === "building";

  // Dynamic time greeting and formatted date
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.fullName ? user.fullName.split(" ")[0] : "there";

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const getMetricInspectionDetails = (metric: string, isIncrease: boolean) => {
    switch (metric) {
      case "afterHoursActivity":
        return {
          title: "Peak Window",
          detail: "8:15 PM – 9:00 PM evening workstation session",
          source: "VS Code & Slack active signals",
          footer: "Metadata timestamps only 🔒",
        };
      case "meetingLoad":
        return {
          title: "Calendar Density",
          detail: isIncrease ? "Multiple back-to-back blocks detected" : "Light schedule with open focus hours",
          source: "Google Calendar sync",
          footer: "Meeting titles excluded 🔒",
        };
      case "breakFrequency":
        return {
          title: "Rest Rhythm",
          detail: isIncrease ? "Frequent healthy pauses taken today" : "Longest focus stretch: 3.8 hrs without pause",
          source: "Workstation gap detector",
          footer: "Goal: 5m pause / 2h",
        };
      case "workingHours":
      default:
        return {
          title: "Session Rhythm",
          detail: "Active workstation timeline across day",
          source: "Unified Google identity sync",
          footer: "Private to your twin 🔒",
        };
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      
      {/* Clean Greeting Header */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-[#a6a6a6]">
            {todayFormatted}
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            {timeGreeting}, {firstName}
          </h1>

          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-[#a6a6a6]">
            Here is your calm daily reflection on how your work rhythms are flowing.
          </p>
        </div>

        <Link href="/dashboard/integrations">
          <Button variant="outline" className="flex items-center gap-2 text-xs">
            <Layers className="h-3.5 w-3.5" />
            <span>Connected Tools</span>
          </Button>
        </Link>
      </section>

      {/* Baseline Calibration in Progress Suite */}
      {isBuilding ? (
        <div className="space-y-6">
          <BaselineCalibrationSuite
            employeeId={user?.id || "usr-ronnie"}
            daysCollected={assessment?.daysCollected ?? 0}
            requiredDays={assessment?.requiredDays ?? 28}
            onMetricsUpdated={() => loadUserData(user?.id || "usr-ronnie")}
          />

          <ToolActivityBreakdown employeeId={user?.id || "usr-ronnie"} />
        </div>
      ) : (
        <>
          {/* Demo Account Controls Banner for Calibrated Account */}
          {user?.id === CALIBRATED_DEMO_ID && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/30 text-xs">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-semibold">
                <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Demo Mode:</strong> 28-Day Baseline is fully established with active signals & behavioral patterns.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    seedCalibratedDemoAccount();
                    loadUserData(user.id);
                  }}
                  className="text-xs h-7 px-2.5 font-bold border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200"
                >
                  ⚡ Re-Seed Telemetry
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetCalibratedDemoAccount();
                    loadUserData(user.id);
                  }}
                  className="text-xs h-7 px-2.5 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Reset to Day 0
                </Button>
              </div>
            </div>
          )}

          <ToolActivityBreakdown employeeId={user?.id || "usr-ronnie"} />

          {/* Unified Primary Hero Reflection Card */}
          <Card className="p-6 sm:p-7">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              
              {/* Left Column: Key Insights */}
              <div className="space-y-4 max-w-xl">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      assessment?.status === "stable"
                        ? "positive"
                        : assessment?.status === "watch"
                        ? "neutral"
                        : "warning"
                    }
                  >
                    {assessment?.status === "stable"
                      ? "Steady & Balanced"
                      : assessment?.status === "watch"
                      ? "Noticing Changes"
                      : "Gentle Pacing Check"}
                  </Badge>
                  <span className="text-xs text-slate-400 dark:text-[#888884]">
                    Based on your 28-day baseline
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
                    {assessment?.changes && assessment.changes.length > 0
                      ? "A few recent work rhythms differed from your typical pacing."
                      : "Your work habits are steady and match your natural pace."}
                  </h2>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-[#a6a6a6]">
                    Your twin reflects shifts in focus hours, evening communication, meetings, and restorative micro-pauses to help you maintain healthy boundaries.
                  </p>
                </div>

                <div className="pt-2">
                  <Link
                    href="/dashboard/assessment"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:underline dark:text-[#60cdff]"
                  >
                    <span>Explore Contributing Factors</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* Right Column: Score Gauge */}
              <div className="flex shrink-0 flex-col items-center justify-center border-t border-slate-100 pt-5 md:border-t-0 md:border-l md:pl-8 md:pt-0 dark:border-[#383734]">
                <ScoreGauge score={assessment?.score ?? null} size={135} />
                <p className="mt-2 text-[11px] text-slate-400 dark:text-[#888884]">
                  Non-judgmental reflection
                </p>
              </div>

            </div>
          </Card>

          {/* Clean Observed Patterns Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Observed Patterns
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
                  Shifts of ≥ 20% compared with your usual 28-day baseline.
                </p>
              </div>
            </div>

            {assessment?.changes && assessment.changes.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {assessment.changes.map((change) => {
                  const isIncrease = change.percentageChange > 0;
                  const inspection = getMetricInspectionDetails(change.metric, isIncrease);

                  return (
                    <LensCard
                      key={change.metric}
                      topContent={
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <p className="text-xs font-semibold text-slate-700 dark:text-[#e3e2dd]">
                              {metricLabels[change.metric] ?? change.metric}
                            </p>
                            <span
                              className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold ${
                                isIncrease
                                  ? change.metric === "breakFrequency"
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                    : "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                                  : change.metric === "breakFrequency"
                                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                              }`}
                            >
                              {isIncrease ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {formatChange(change.percentageChange)}
                            </span>
                          </div>

                          <div className="flex items-baseline gap-2.5">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                              {Math.round(change.currentValue)}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-[#888884]">
                              usual: {Math.round(change.baselineValue)}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 dark:text-[#888884] italic">
                            Move cursor to inspect sensor log...
                          </p>
                        </div>
                      }
                      behindContent={
                        <div className="flex h-full flex-col justify-between p-1">
                          <div>
                            <div className="flex items-center justify-between text-amber-400">
                              <span className="text-[10px] font-bold uppercase tracking-wider">
                                🔬 {inspection.title}
                              </span>
                              <span className="text-[10px] font-bold">TELEMETRY</span>
                            </div>

                            <div className="mt-2 space-y-0.5">
                              <p className="text-xs font-semibold text-white">
                                {inspection.detail}
                              </p>
                              <p className="text-[11px] text-slate-300">
                                {inspection.source}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 border-t border-slate-700/80 pt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                            <span>Baseline: {Math.round(change.baselineValue)}</span>
                            <span className="text-emerald-400 font-semibold">{inspection.footer}</span>
                          </div>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <Card className="p-6">
                <p className="text-xs leading-5 text-slate-500 dark:text-[#a6a6a6]">
                  No noticeable deviations detected. Your workload and rest patterns are steady with your personal baseline.
                </p>
              </Card>
            )}
          </section>
        </>
      )}

      {/* Guided Next Step Journey Card */}
      <Card className="p-5 border-slate-200 bg-slate-50/70 dark:border-[#383734] dark:bg-[#2d2b26]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Continue Your Daily Reflection
            </p>
            <p className="text-[11px] text-slate-500 dark:text-[#a6a6a6] mt-0.5">
              Walk through your baseline metrics, factor assessment, and personalized self-care guidance.
            </p>
          </div>

          <Link href="/dashboard/patterns">
            <Button className="flex items-center gap-2 text-xs bg-[#60cdff] text-black font-bold hover:bg-[#4cc2ff]">
              <span>View My Patterns</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </Card>

    </div>
  );
}