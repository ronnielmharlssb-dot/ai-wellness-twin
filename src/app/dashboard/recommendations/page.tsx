"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Lightbulb,
  Sparkles,
  HeartHandshake,
  CheckCircle2,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { getMetricsForEmployee } from "@/lib/wellbeing/employeeMetrics";
import { buildEmployeeAssessment } from "@/lib/wellbeing/employeeAssessment";
import {
  buildRecommendations,
  type Recommendation,
} from "@/lib/wellbeing/recommendationEngine";
import { getLocalSessionUser } from "@/lib/supabase/auth";

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);

  useEffect(() => {
    const user = getLocalSessionUser();
    const employeeId = user?.id || "usr-ronnie";
    const metrics = getMetricsForEmployee(employeeId);
    const assessment = buildEmployeeAssessment(metrics);
    setIsBuilding(assessment.status === "building");
    setRecommendations(buildRecommendations(assessment));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span>Actionable Wellbeing Nudges</span>
        </div>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Personalized Recommendations
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Gentle, non-prescriptive suggestions tailored to shifts observed in your recent work patterns.
        </p>
      </section>

      {/* Recommendations Feed */}
      <section aria-labelledby="recommendations-heading" className="space-y-4">
        <h2 id="recommendations-heading" className="sr-only">
          Personalized recommendations
        </h2>

        {isBuilding ? (
          <Card className="p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-amber-500" />
            <p className="mt-3 text-base font-bold text-slate-900">
              Personal Baseline Calibration in Progress
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Personalized guidance will appear here automatically when behavioral shifts or sustained workload changes are observed.
            </p>
          </Card>
        ) : recommendations.length === 0 ? (
          <Card className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-3 text-base font-bold text-slate-900">
              Your Work Pacing is Balanced
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Your recent work rhythms closely match your typical baseline. No special pacing adjustments needed right now!
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <Card key={rec.title} className="p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <Sparkles className="h-5 w-5" />
                  </div>

                  <div className="flex-1 space-y-3">
                    <h3 className="text-base font-bold text-slate-900">
                      {rec.title}
                    </h3>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Why this was suggested
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {rec.reason}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                        Suggested Micro-Action
                      </p>
                      <p className="mt-1 text-xs font-medium leading-5 text-emerald-900">
                        {rec.action}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Advisory Banner */}
      <Card className="border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <HeartHandshake className="h-5 w-5 shrink-0 text-slate-500" />
          <p className="text-xs leading-5 text-slate-500">
            <strong>Advisory Guidance Only:</strong> These are gentle suggestions, not mandatory rules. Choose what feels realistic and supportive for your daily workflow.
          </p>
        </div>
      </Card>

      {/* Guided Next Step Journey */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/dashboard/assessment">
          <Button variant="outline" className="text-xs">
            ← Back to Assessment
          </Button>
        </Link>

        <Link href="/dashboard/reports">
          <Button className="flex items-center gap-2 text-xs">
            <span>Open Friday Reflection Report</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}