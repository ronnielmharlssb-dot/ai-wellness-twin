"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
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

export default function PatternsPage() {
  const [assessment, setAssessment] =
    useState<EmployeeAssessment | null>(null);

  useEffect(() => {
    const user = getLocalSessionUser();
    const employeeId = user?.id || "emp-001";
    const metrics = getMetricsForEmployee(employeeId);
    const result = buildEmployeeAssessment(metrics);
    setAssessment(result);
  }, []);

  const isBuilding = assessment?.status === "building";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Activity className="h-4 w-4" />
          <span>28-Day Behavioral Ground Truth</span>
        </div>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          My Work Patterns
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Your Wellness Twin learns your typical habits over a 28-day calibration window. It uses your own history as the baseline to detect meaningful shifts without comparing you against peers.
        </p>
      </section>

      {/* Baseline Status Card */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isBuilding ? (
                <Activity className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
              <h2 className="text-base font-bold text-slate-900">
                Personal Baseline Reference
              </h2>
            </div>

            <p className="text-xs text-slate-500">
              {isBuilding
                ? `Recording day ${assessment?.daysCollected ?? 0} of 28 to calibrate your personal profile.`
                : "Active ground-truth reference established across 28 days of work activity."}
            </p>
          </div>

          <Badge variant={isBuilding ? "neutral" : "positive"}>
            {isBuilding
              ? `Day ${assessment?.daysCollected ?? 0} / ${assessment?.requiredDays ?? 28}`
              : "Baseline Established"}
          </Badge>
        </div>

        {isBuilding && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <BaselineProgressTracker
              daysCollected={assessment?.daysCollected ?? 0}
              requiredDays={assessment?.requiredDays ?? 28}
            />
          </div>
        )}
      </Card>

      {/* Pattern Breakdown Comparison Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Observed Behavioral Dimensions
          </h2>
          <p className="text-xs text-slate-500">
            How your recent working habits compare against your established baseline.
          </p>
        </div>

        {isBuilding ? (
          <Card className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-900">
              Calibration in Progress ({assessment?.daysCollected ?? 0} / 28 days)
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Meaningful percentage deviations will activate once the full 28-day calibration period is complete.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="hidden grid-cols-[1.5fr_1fr_1fr_1.2fr] border-b border-slate-200 bg-slate-50/80 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 md:grid">
              <span>Behavioral Dimension</span>
              <span>28-Day Baseline</span>
              <span>Recent Average</span>
              <span className="text-right">Observed Delta</span>
            </div>

            <div className="divide-y divide-slate-100">
              {assessment?.changes.map((change) => {
                const isIncrease = change.percentageChange > 0;
                return (
                  <div
                    key={change.metric}
                    className="grid gap-3 px-6 py-5 md:grid-cols-[1.5fr_1fr_1fr_1.2fr] md:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {metricLabels[change.metric] ?? change.metric}
                      </p>
                      <p className="text-xs text-slate-400">
                        {change.meaningful ? "≥ 20% meaningful deviation" : "Within expected range"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 md:hidden">Baseline:</p>
                      <p className="text-sm font-medium text-slate-600">
                        {change.baselineValue.toFixed(1)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 md:hidden">Recent:</p>
                      <p className="text-sm font-bold text-slate-900">
                        {change.currentValue.toFixed(1)}
                      </p>
                    </div>

                    <div className="flex items-center justify-end">
                      <span
                        className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold ${
                          isIncrease
                            ? change.metric === "breakFrequency"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                            : change.metric === "breakFrequency"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-emerald-50 text-emerald-700"
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
          </Card>
        )}
      </section>

      {/* Guided Next Step Journey */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/dashboard">
          <Button variant="outline" className="text-xs">
            ← Back to Overview
          </Button>
        </Link>

        <Link href="/dashboard/assessment">
          <Button className="flex items-center gap-2 text-xs">
            <span>Understand Assessment Impact</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}