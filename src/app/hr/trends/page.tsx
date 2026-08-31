"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, ShieldCheck } from "lucide-react";

const trends = [
  {
    title: "Workload & Pacing",
    status: "Shifting",
    variant: "neutral" as const,
    description:
      "Workload-related patterns have shifted slightly over recent reporting periods.",
  },
  {
    title: "Work-Life Boundaries",
    status: "Active Shift",
    variant: "neutral" as const,
    description:
      "After-hours activity has moved above the established organizational baseline.",
  },
  {
    title: "Connection & Inclusion",
    status: "Steady",
    variant: "positive" as const,
    description:
      "No meaningful change has been detected across recent reporting periods.",
  },
];

export default function WellbeingTrendsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-[#9a9893]">
            <Link href="/hr" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              Workforce Portal
            </Link>
            <span>›</span>
            <span className="text-slate-700 dark:text-slate-200">Wellbeing Trends</span>
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Wellbeing Trends
          </h1>

          <p className="mt-1 text-xs text-slate-500 dark:text-[#a6a6a6] max-w-2xl">
            How aggregate organizational wellbeing patterns have evolved over recent reporting cycles.
          </p>
        </div>

        <Link href="/hr">
          <Button variant="outline" className="text-xs border-slate-200 dark:border-[#383734]">
            ← Back to Overview
          </Button>
        </Link>
      </div>

      <section className="space-y-4">
        <div className="border-b border-slate-100 pb-2 dark:border-[#383734]">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Current Directional Indicators
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
            Recent movement compared with established organizational patterns.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {trends.map((trend) => (
            <Card key={trend.title} className="border-slate-200 bg-white p-5 dark:border-[#383734] dark:bg-[#2c2b28] shadow-sm">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                {trend.title}
              </p>

              <div className="mt-2.5">
                <Badge variant={trend.variant}>
                  {trend.status}
                </Badge>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-[#cfcfce]">
                {trend.description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <Card className="border-slate-200 bg-slate-50/70 p-5 dark:border-[#383734] dark:bg-[#20201e]/60">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Strict Organizational Interpretation
            </h2>

            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-[#a6a6a6]">
              Trends describe shifts in aggregate organizational patterns over time to help identify areas worth supporting. They are strictly anonymized and never used to evaluate individual employees.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}