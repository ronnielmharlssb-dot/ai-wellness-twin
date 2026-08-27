"use client";

import Link from "next/link";
import { useState } from "react";
import { Sliders, ArrowLeft, Play } from "lucide-react";

import {
  buildEmployeeAssessment,
  type EmployeeAssessment,
} from "@/lib/wellbeing/employeeAssessment";
import { getMetricsForEmployee } from "@/lib/wellbeing/employeeMetrics";
import { formatChange, metricLabels } from "@/lib/wellbeing/formatters";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/ui/score-gauge";

export default function SimulatorPage() {
  const [workingHours, setWorkingHours] = useState(8);
  const [meetingLoad, setMeetingLoad] = useState(4);
  const [breakFrequency, setBreakFrequency] = useState(5);
  const [afterHoursActivity, setAfterHoursActivity] = useState(30);

  const [result, setResult] = useState<EmployeeAssessment | null>(null);

  function runSimulation() {
    const history = getMetricsForEmployee("emp-001");

    if (history.length === 0) {
      return;
    }

    const sortedHistory = [...history].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const latestIndex = sortedHistory.length - 1;
    const simulatedMetrics = [
      ...sortedHistory.slice(0, latestIndex),
      {
        ...sortedHistory[latestIndex],
        workingHours,
        meetingLoad,
        breakFrequency,
        afterHoursActivity,
      },
    ];

    const assessment = buildEmployeeAssessment(simulatedMetrics);
    setResult(assessment);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <section className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Sliders className="h-4 w-4 text-sky-500" />
            <span>Interactive Modeling Environment</span>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Scenario Simulator
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-[#a6a6a6]">
            Explore how potential changes in work rhythms would influence your twin&apos;s balance reflection.
          </p>
        </div>

        <Link href="/dashboard">
          <Button variant="outline" className="flex items-center gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Overview</span>
          </Button>
        </Link>
      </section>

      {/* Simulator Inputs Card */}
      <Card className="space-y-5 p-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Adjust Simulated Behavioral Signals
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
              Working Hours (hours / day)
            </label>
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={workingHours}
              onChange={(e) => setWorkingHours(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
              Meeting Load (hours / day)
            </label>
            <input
              type="number"
              min="0"
              max="16"
              step="0.5"
              value={meetingLoad}
              onChange={(e) => setMeetingLoad(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
              Break Frequency (micro-pauses / day)
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={breakFrequency}
              onChange={(e) => setBreakFrequency(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
              After-hours Activity (minutes / day)
            </label>
            <input
              type="number"
              min="0"
              max="300"
              value={afterHoursActivity}
              onChange={(e) => setAfterHoursActivity(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-[#383734]">
          <Button onClick={runSimulation} className="flex items-center gap-2 text-xs bg-[#60cdff] text-black font-bold hover:bg-[#4cc2ff]">
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Calculate Projected Reflection</span>
          </Button>
        </div>
      </Card>

      {/* Simulation Result Output */}
      {result && (
        <Card className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4 dark:border-[#383734]">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Simulation Outcome
                </h2>
                <Badge
                  variant={
                    result.status === "stable"
                      ? "positive"
                      : result.status === "watch"
                      ? "neutral"
                      : "warning"
                  }
                >
                  {result.status === "stable"
                    ? "Steady & Balanced"
                    : result.status === "watch"
                    ? "Noticing Changes"
                    : "Gentle Pacing Check"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#a6a6a6] mt-0.5">
                Hypothetical reflection compared against your 28-day baseline
              </p>
            </div>

            <ScoreGauge score={result.score} size={110} />
          </div>

          {result.changes.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Projected Significant Shifts (≥ 20%)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.changes.map((change) => (
                  <div
                    key={change.metric}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#383734] dark:bg-[#35342e]"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {metricLabels[change.metric] ?? change.metric}
                      </p>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-300">
                        {formatChange(change.percentageChange)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-[#a6a6a6] mt-1">
                      Simulated: {change.currentValue.toFixed(1)} • Baseline: {change.baselineValue.toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
              No meaningful changes detected with these parameters. Your simulated habits match your normal rhythm.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}