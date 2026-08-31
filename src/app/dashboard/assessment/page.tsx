"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShieldCheck,
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

const statusLabels: Record<string, string> = {
  building: "Calibrating",
  stable: "Steady & Balanced",
  watch: "Noticing Changes",
  attention: "Gentle Pacing Check",
};

export default function AssessmentPage() {
  const [assessment, setAssessment] =
    useState<EmployeeAssessment | null>(null);

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
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Transparent Self-Reflection</span>
        </div>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Wellness Assessment
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          A supportive, non-diagnostic reflection on how recent habits compare with your established personal baseline.
        </p>
      </section>

      {/* Assessment Score Ring Card */}
      <Card className="p-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant={badgeVariant}>
                {assessment ? statusLabels[assessment.status] : "Loading"}
              </Badge>
              <span className="text-xs text-slate-400">
                {isBuilding
                  ? `Day ${assessment?.daysCollected ?? 0} of 28 recorded`
                  : "Calibrated to your personal history"}
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900">
              {isBuilding
                ? "Calibrating Your Ground-Truth Profile"
                : assessment?.status === "stable"
                ? "Your work rhythms are balanced"
                : assessment?.status === "watch"
                ? "A few noticeable changes observed"
                : "A gentle pacing check is recommended"}
            </h2>

            <p className="max-w-xl text-xs leading-5 text-slate-500">
              {isBuilding
                ? `Your baseline calibration is active (${assessment?.daysCollected ?? 0} / ${assessment?.requiredDays ?? 28} days). Meaningful deviation scores will activate once complete.`
                : "This assessment reflects how after-hours activity, meeting load, and break frequency compare with your personal history to help you protect balance."}
            </p>
          </div>

          <div className="flex shrink-0 justify-center">
            <ScoreGauge score={assessment?.score ?? null} size={140} />
          </div>
        </div>
      </Card>

      {/* Key Factors Breakdown */}
      {!isBuilding && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Contributing Factors
            </h2>
            <p className="text-xs text-slate-500">
              Specific dimensions contributing to this reflection.
            </p>
          </div>

          {assessment?.changes && assessment.changes.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assessment.changes.map((change) => {
                const isIncrease = change.percentageChange > 0;
                return (
                  <Card key={change.metric} className="p-5">
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-semibold text-slate-700">
                        {metricLabels[change.metric] ?? change.metric}
                      </p>
                      <span
                        className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold ${
                          isIncrease
                            ? change.metric === "breakFrequency"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-800"
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

                    <div className="mt-4 text-xs text-slate-500">
                      Usual: <strong className="text-slate-700">{change.baselineValue.toFixed(1)}</strong>
                      {" • "}
                      Recent: <strong className="text-slate-900">{change.currentValue.toFixed(1)}</strong>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-6">
              <p className="text-xs leading-5 text-slate-600">
                All tracked dimensions are within your expected baseline range. Your pacing is steady and aligned.
              </p>
            </Card>
          )}
        </section>
      )}

      {/* Safety & Non-Diagnostic Disclaimer */}
      <Card className="border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Supportive, Non-Diagnostic Notice
            </p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              This score is a self-reflection companion to help you stay aware of your working hours. It is not an evaluation or medical diagnosis.
            </p>
          </div>
        </div>
      </Card>

      {/* Guided Next Step Journey */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/dashboard/patterns">
          <Button variant="outline" className="text-xs">
            ← Back to My Patterns
          </Button>
        </Link>

        <Link href="/dashboard/recommendations">
          <Button className="flex items-center gap-2 text-xs">
            <span>View Personalized Suggestions</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}