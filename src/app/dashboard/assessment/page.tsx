"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  ClipboardList,
  Activity,
  HeartHandshake,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

import {
  buildEmployeeAssessment,
  type EmployeeAssessment,
} from "@/lib/wellbeing/employeeAssessment";
import { getMetricsForEmployee } from "@/lib/wellbeing/employeeMetrics";
import { formatChange, metricLabels } from "@/lib/wellbeing/formatters";
import { getLocalSessionUser } from "@/lib/supabase/auth";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScoreGauge } from "@/components/ui/score-gauge";

type AssessmentTab = "overview" | "mbi" | "dimensions";

const statusLabels: Record<string, string> = {
  building: "Calibrating",
  stable: "Steady & Balanced",
  watch: "Noticing Changes",
  attention: "Gentle Pacing Check",
};

const mbiDimensions = [
  {
    title: "Exhaustion Index",
    score: "Low (1.8 / 6.0)",
    status: "Healthy",
    statusVariant: "positive" as const,
    description: "Measures energy depletion and cognitive fatigue from continuous deep engineering or meeting density.",
  },
  {
    title: "Cynicism / Detachment",
    score: "Low (1.2 / 6.0)",
    status: "Optimal",
    statusVariant: "positive" as const,
    description: "Evaluates psychological connection to work outcomes and daily motivation.",
  },
  {
    title: "Professional Efficacy",
    score: "High (5.4 / 6.0)",
    status: "Strong",
    statusVariant: "positive" as const,
    description: "Captures feelings of competence, meaningful output, and technical achievement.",
  },
];

export default function AssessmentPage() {
  const [assessment, setAssessment] = useState<EmployeeAssessment | null>(null);
  const [activeTab, setActiveTab] = useState<AssessmentTab>("overview");

  useEffect(() => {
    const sessionUser = getLocalSessionUser();
    const employeeId = sessionUser?.id || "usr-ronnie";
    const metrics = getMetricsForEmployee(employeeId);
    const result = buildEmployeeAssessment(metrics);
    setAssessment(result);
  }, []);

  const badgeVariant =
    assessment?.status === "building"
      ? "neutral"
      : assessment?.status === "stable"
      ? "positive"
      : assessment?.status === "watch"
      ? "neutral"
      : "warning";

  const isBuilding = assessment?.status === "building";

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
            <span className="text-slate-700 dark:text-slate-200">Assessment</span>
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Wellness Assessment
          </h1>

          <p className="mt-1 text-xs text-slate-500 dark:text-[#a6a6a6] max-w-2xl">
            Supportive, non-diagnostic reflection comparing recent telemetry and Maslach Burnout Inventory (MBI-GS) responses against your baseline.
          </p>
        </div>

        <Link href="/dashboard">
          <Button variant="outline" className="text-xs shrink-0 border-slate-200 dark:border-[#383734]">
            ← Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* Two-Column Settings-Style Assessment Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Category Tabs Navigation */}
        <div className="space-y-1.5 lg:col-span-3.5">
          <nav className="flex flex-row gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {[
              { id: "overview", label: "Assessment Overview", icon: Sparkles },
              { id: "mbi", label: "MBI-GS Scientific Survey", icon: ClipboardList },
              { id: "dimensions", label: "Telemetry Dimensions", icon: Activity },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as AssessmentTab)}
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

          {/* Privacy Guarantee Side Note */}
          <Card className="hidden lg:block border-slate-200 bg-slate-50/70 p-4 dark:border-[#383734] dark:bg-[#20201e]/60 mt-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                100% Confidential
              </h3>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-[#a6a6a6]">
              Your individual assessment scores and survey entries are stored locally on your device and are <strong>never visible</strong> to HR or managers.
            </p>
          </Card>
        </div>

        {/* Right Content Panel */}
        <div className="lg:col-span-8.5 space-y-4">
          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Main Score Card */}
              <Card className="border-slate-200 bg-white p-6 dark:border-[#383734] dark:bg-[#2c2b28] shadow-sm">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <Badge variant={badgeVariant}>
                        {assessment ? statusLabels[assessment.status] : "Calibrating"}
                      </Badge>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Composite Vitality Index
                      </span>
                    </div>

                    <p className="max-w-md text-xs leading-relaxed text-slate-600 dark:text-[#cfcfce]">
                      Your Wellness Twin is continuously measuring rest buffers, meeting density, and focus consistency compared against your personal baseline.
                    </p>

                    <p className="text-[11px] text-slate-400 dark:text-[#888884]">
                      {assessment?.status === "building"
                        ? `Recording day ${assessment.daysCollected} of ${assessment.requiredDays} to calibrate baseline.`
                        : "Telemetry signals are compared against your personal 28-day historical baseline."}
                    </p>
                  </div>

                  <div className="flex justify-center shrink-0">
                    <ScoreGauge
                      score={assessment?.score ?? null}
                      size={130}
                    />
                  </div>
                </div>
              </Card>

              {/* Dimension Quick Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {mbiDimensions.map((dim) => (
                  <Card key={dim.title} className="border-slate-200 bg-white p-4 dark:border-[#383734] dark:bg-[#2c2b28]">
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-[#888884]">
                      {dim.title}
                    </span>
                    <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                      {dim.score}
                    </p>
                    <div className="mt-2">
                      <Badge variant={dim.statusVariant}>
                        {dim.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: MBI-GS Survey */}
          {activeTab === "mbi" && (
            <Card className="border-slate-200 bg-white p-6 dark:border-[#383734] dark:bg-[#2c2b28] shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 dark:border-[#383734]">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Maslach Burnout Inventory (MBI-GS)
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
                  Scientifically validated 3-factor burnout assessment framework.
                </p>
              </div>

              <div className="space-y-3">
                {mbiDimensions.map((dim) => (
                  <div key={dim.title} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-[#383734] dark:bg-[#20201e]/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        {dim.title}
                      </h3>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {dim.score}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-[#a6a6a6] leading-relaxed">
                      {dim.description}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Tab 3: Telemetry Dimensions */}
          {activeTab === "dimensions" && (
            <Card className="border-slate-200 bg-white p-6 dark:border-[#383734] dark:bg-[#2c2b28] shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 dark:border-[#383734]">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Telemetry Breakdown vs Baseline
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
                  Ground truth comparisons across recorded work activity.
                </p>
              </div>

              {isBuilding ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  Telemetry calibration in progress. Complete 28 days to view full variance.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#383734]">
                  {assessment?.changes.map((change) => {
                    const isIncrease = change.percentageChange > 0;
                    return (
                      <div
                        key={change.metric}
                        className="flex items-center justify-between py-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {metricLabels[change.metric] ?? change.metric}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-[#888884]">
                            Baseline: {change.baselineValue.toFixed(1)} → Recent: {change.currentValue.toFixed(1)}
                          </p>
                        </div>

                        <span
                          className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                            isIncrease
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          }`}
                        >
                          {isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {formatChange(change.percentageChange)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Guided Next Step Journey */}
          <div className="flex items-center justify-between pt-2">
            <Link href="/dashboard/patterns">
              <Button variant="ghost" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white">
                ← My Patterns
              </Button>
            </Link>

            <Link href="/dashboard/recommendations">
              <Button className="flex items-center gap-2 text-xs">
                <span>View Recommendations</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}