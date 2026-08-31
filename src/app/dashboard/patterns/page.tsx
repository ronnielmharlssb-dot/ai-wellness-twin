"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  Clock,
  Calendar,
  Moon,
  Coffee,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

import {
  buildEmployeeAssessment,
  type EmployeeAssessment,
} from "@/lib/wellbeing/employeeAssessment";
import { getMetricsForEmployee } from "@/lib/wellbeing/employeeMetrics";
import { formatChange, metricLabels } from "@/lib/wellbeing/formatters";
import { getLocalSessionUser } from "@/lib/supabase/auth";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BaselineProgressTracker } from "@/components/ui/baseline-progress";

type PatternTab = "all" | "focus" | "meetings" | "boundaries" | "breaks";

export default function PatternsPage() {
  const [assessment, setAssessment] = useState<EmployeeAssessment | null>(null);
  const [activeTab, setActiveTab] = useState<PatternTab>("all");

  useEffect(() => {
    const user = getLocalSessionUser();
    const employeeId = user?.id || "usr-ronnie";
    const metrics = getMetricsForEmployee(employeeId);
    const result = buildEmployeeAssessment(metrics);
    setAssessment(result);
  }, []);

  const isBuilding = assessment?.status === "building";

  const filterChanges = (tab: PatternTab) => {
    if (!assessment) return [];
    if (tab === "all") return assessment.changes;
    if (tab === "focus")
      return assessment.changes.filter((c) =>
        ["workingHours", "focusContinuity", "ideFocusMinutes"].includes(c.metric)
      );
    if (tab === "meetings")
      return assessment.changes.filter((c) =>
        ["meetingHours", "meetingDensity"].includes(c.metric)
      );
    if (tab === "boundaries")
      return assessment.changes.filter((c) =>
        ["afterHoursWork", "weekendWork"].includes(c.metric)
      );
    if (tab === "breaks")
      return assessment.changes.filter((c) =>
        ["breakFrequency", "restBufferMinutes"].includes(c.metric)
      );
    return assessment.changes;
  };

  const displayedChanges = filterChanges(activeTab);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-[#9a9893]">
            <Link href="/dashboard" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              Dashboard
            </Link>
            <span>›</span>
            <span className="text-slate-700 dark:text-slate-200">My Patterns</span>
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            My Work Patterns
          </h1>

          <p className="mt-1 text-xs text-slate-500 dark:text-[#a6a6a6] max-w-2xl">
            28-day ground-truth calibration compares your recent rhythms strictly against your personal baseline without peer ranking.
          </p>
        </div>

        <Link href="/dashboard">
          <Button variant="outline" className="text-xs shrink-0 border-slate-200 dark:border-[#383734]">
            ← Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* Baseline Status Card */}
      <Card className="border-slate-200 bg-white p-5 dark:border-[#383734] dark:bg-[#2c2b28] shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-[#1f1f1d] dark:text-[#60cdff]">
              {isBuilding ? (
                <Activity className="h-5 w-5 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Personal Baseline Calibration
                </h2>
                <Badge variant={isBuilding ? "neutral" : "positive"}>
                  {isBuilding
                    ? `Day ${assessment?.daysCollected ?? 0} / 28`
                    : "Baseline Calibrated"}
                </Badge>
              </div>

              <p className="mt-0.5 text-xs text-slate-500 dark:text-[#a6a6a6]">
                {isBuilding
                  ? `Recording day ${assessment?.daysCollected ?? 0} of 28 to calibrate your personalized ground truth.`
                  : "Ground truth active across 28 recorded workday sessions. Shifts are highlighted when they deviate ≥ 20%."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-[#888884]">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Zero Peer Comparison
            </span>
          </div>
        </div>

        {isBuilding && (
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-[#383734]">
            <BaselineProgressTracker
              daysCollected={assessment?.daysCollected ?? 0}
              requiredDays={assessment?.requiredDays ?? 28}
            />
          </div>
        )}
      </Card>

      {/* Two-Column Settings-Style Work Pattern Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Category Tabs Navigation */}
        <div className="space-y-1.5 lg:col-span-3.5">
          <nav className="flex flex-row gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {[
              { id: "all", label: "All Dimensions", icon: Activity },
              { id: "focus", label: "Deep Work & Focus", icon: Clock },
              { id: "meetings", label: "Meeting Load", icon: Calendar },
              { id: "boundaries", label: "Work Boundaries", icon: Moon },
              { id: "breaks", label: "Rest & Recovery", icon: Coffee },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as PatternTab)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 shrink-0 text-left cursor-pointer ${
                    active
                      ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-[#cfcfce] dark:hover:bg-[#353430] dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick Context Card */}
          <Card className="hidden lg:block border-slate-200 bg-slate-50/70 p-4 dark:border-[#383734] dark:bg-[#20201e]/60 mt-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Meaningful Shifts
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-[#a6a6a6]">
              A shift is marked as meaningful when current 7-day rolling patterns differ by more than <strong>20%</strong> from your 28-day baseline.
            </p>
          </Card>
        </div>

        {/* Right Content Panel */}
        <div className="lg:col-span-8.5 space-y-4">
          <Card className="border-slate-200 bg-white p-6 dark:border-[#383734] dark:bg-[#2c2b28] shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-[#383734]">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Observed Pattern Metrics
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
                  Comparing current rolling 7-day average against your 28-day ground truth.
                </p>
              </div>

              <span className="text-[11px] font-semibold text-slate-400 dark:text-[#888884]">
                {displayedChanges.length} dimensions
              </span>
            </div>

            {isBuilding ? (
              <div className="py-12 text-center">
                <Activity className="mx-auto h-8 w-8 text-amber-500 animate-pulse" />
                <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                  Baseline Gathering Telemetry ({assessment?.daysCollected ?? 0} / 28 days)
                </p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-[#a6a6a6]">
                  Metrics are accumulating in the background. Full percentage variance will be computed once baseline calibration reaches 28 days.
                </p>
              </div>
            ) : displayedChanges.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No metrics recorded under this category.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#383734]">
                {displayedChanges.map((change) => {
                  const isIncrease = change.percentageChange > 0;
                  return (
                    <div
                      key={change.metric}
                      className="grid gap-3 py-4 sm:grid-cols-[1.8fr_1fr_1fr_1.2fr] sm:items-center"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {metricLabels[change.metric] ?? change.metric}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-[#888884]">
                          {change.meaningful ? "≥ 20% meaningful deviation" : "Stable within baseline range"}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block sm:hidden">
                          Baseline:
                        </span>
                        <p className="text-xs font-medium text-slate-600 dark:text-[#cfcfce]">
                          {change.baselineValue.toFixed(1)}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block sm:hidden">
                          Recent:
                        </span>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {change.currentValue.toFixed(1)}
                        </p>
                      </div>

                      <div className="flex items-center sm:justify-end">
                        <span
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${
                            isIncrease
                              ? change.metric === "breakFrequency"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                              : change.metric === "breakFrequency"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
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
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Guided Next Step Journey */}
          <div className="flex items-center justify-between pt-2">
            <Link href="/dashboard">
              <Button variant="ghost" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white">
                ← Overview
              </Button>
            </Link>

            <Link href="/dashboard/assessment">
              <Button className="flex items-center gap-2 text-xs">
                <span>View Wellness Assessment</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}