"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Lightbulb,
  Sparkles,
  HeartHandshake,
  CheckCircle2,
  Clock,
  Calendar,
  Moon,
  Coffee,
  Check,
  ChevronRight,
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

type RecTab = "all" | "focus" | "breaks" | "habits";

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [activeTab, setActiveTab] = useState<RecTab>("all");
  const [completedTitles, setCompletedTitles] = useState<Set<string>>(new Set());

  useEffect(() => {
    const user = getLocalSessionUser();
    const employeeId = user?.id || "usr-ronnie";
    const metrics = getMetricsForEmployee(employeeId);
    const assessment = buildEmployeeAssessment(metrics);
    setIsBuilding(assessment.status === "building");
    setRecommendations(buildRecommendations(assessment));
  }, []);

  const toggleComplete = (title: string) => {
    setCompletedTitles((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const filteredRecs = recommendations.filter((r) => {
    if (activeTab === "all") return true;
    if (activeTab === "focus")
      return r.title.toLowerCase().includes("working") || r.title.toLowerCase().includes("focus") || r.title.toLowerCase().includes("duration");
    if (activeTab === "breaks")
      return r.title.toLowerCase().includes("break") || r.title.toLowerCase().includes("pause");
    if (activeTab === "habits")
      return r.title.toLowerCase().includes("cutoff") || r.title.toLowerCase().includes("after-hours") || r.title.toLowerCase().includes("weekend");
    return true;
  });

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
            <span className="text-slate-700 dark:text-slate-200">Recommendations</span>
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Personalized Recommendations
          </h1>

          <p className="mt-1 text-xs text-slate-500 dark:text-[#a6a6a6] max-w-2xl">
            Gentle, non-prescriptive nudges tailored to shifts observed in your recent work patterns.
          </p>
        </div>

        <Link href="/dashboard">
          <Button variant="outline" className="text-xs shrink-0 border-slate-200 dark:border-[#383734]">
            ← Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* Two-Column Settings-Style Recommendations Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Category Tabs Navigation */}
        <div className="space-y-1.5 lg:col-span-3.5">
          <nav className="flex flex-row gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {[
              { id: "all", label: "All Suggestions", icon: Lightbulb },
              { id: "focus", label: "Focus & Pacing", icon: Clock },
              { id: "breaks", label: "Rest & Breaks", icon: Coffee },
              { id: "habits", label: "Boundaries & Cutoffs", icon: Moon },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as RecTab)}
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

          {/* Quick Tip Card */}
          <Card className="hidden lg:block border-slate-200 bg-slate-50/70 p-4 dark:border-[#383734] dark:bg-[#20201e]/60 mt-4">
            <div className="flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-sky-500 shrink-0" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Supportive, Not Prescriptive
              </h3>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-[#a6a6a6]">
              These suggestions are micro-habits to experiment with. Pick one that resonates with your workday style!
            </p>
          </Card>
        </div>

        {/* Right Content Panel */}
        <div className="lg:col-span-8.5 space-y-4">
          {isBuilding ? (
            <Card className="border-slate-200 bg-white p-8 text-center dark:border-[#383734] dark:bg-[#2c2b28] shadow-sm">
              <Sparkles className="mx-auto h-8 w-8 text-amber-500 animate-pulse" />
              <p className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                Personal Baseline Calibration in Progress
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500 dark:text-[#a6a6a6]">
                Personalized recommendations activate automatically once shifts in your 28-day baseline are detected.
              </p>
            </Card>
          ) : filteredRecs.length === 0 ? (
            <Card className="border-slate-200 bg-white p-8 text-center dark:border-[#383734] dark:bg-[#2c2b28] shadow-sm">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                Your Work Pacing is Balanced
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500 dark:text-[#a6a6a6]">
                Your recent work rhythms closely match your typical baseline. No special pacing adjustments needed right now!
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredRecs.map((rec) => {
                const isDone = completedTitles.has(rec.title);
                return (
                  <Card
                    key={rec.title}
                    className={`border p-5 transition-all duration-200 shadow-sm ${
                      isDone
                        ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                        : "border-slate-200 bg-white dark:border-[#383734] dark:bg-[#2c2b28]"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1.5">
                        <h3 className={`text-sm font-bold ${isDone ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"}`}>
                          {rec.title}
                        </h3>

                        <p className="text-xs leading-relaxed text-slate-600 dark:text-[#cfcfce]">
                          {rec.reason}
                        </p>

                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 pt-1">
                          💡 Suggestion: {rec.action}
                        </p>
                      </div>

                      <Button
                        variant={isDone ? "outline" : "primary"}
                        onClick={() => toggleComplete(rec.title)}
                        className={`text-xs shrink-0 self-start ${
                          isDone ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300" : ""
                        }`}
                      >
                        {isDone ? (
                          <span className="flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5" />
                            Applied
                          </span>
                        ) : (
                          "Try This Habit"
                        )}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Guided Next Step Journey */}
          <div className="flex items-center justify-between pt-2">
            <Link href="/dashboard/assessment">
              <Button variant="ghost" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white">
                ← Assessment
              </Button>
            </Link>

            <Link href="/dashboard/reports">
              <Button className="flex items-center gap-2 text-xs">
                <span>View Weekly Reports</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}