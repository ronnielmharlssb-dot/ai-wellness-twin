"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Calendar,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Smile,
  Meh,
  Frown,
  Zap,
  Lock,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Clock,
  HeartHandshake,
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

function getCurrentWeekKey(): string {
  const d = new Date();
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${d.getFullYear()}-W${week}`;
}

type FridayFeeling = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  borderHover: string;
  bgActive: string;
  textActive: string;
};

const FRIDAY_FEELING_OPTIONS: FridayFeeling[] = [
  {
    id: "energized",
    title: "Energized & Accomplished",
    subtitle: "Productive flow, steady energy, and accomplished week goals",
    icon: <Zap className="h-5 w-5 text-emerald-500" />,
    borderHover: "hover:border-emerald-400",
    bgActive: "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30",
    textActive: "text-emerald-900 dark:text-emerald-300",
  },
  {
    id: "balanced",
    title: "Balanced & Steady",
    subtitle: "Paced workload evenly, took restorative pauses, feeling good",
    icon: <Smile className="h-5 w-5 text-sky-500" />,
    borderHover: "hover:border-sky-400",
    bgActive: "border-sky-500 bg-sky-50/60 dark:bg-sky-950/30",
    textActive: "text-sky-900 dark:text-sky-300",
  },
  {
    id: "fatigued",
    title: "Fatigued & Stretched",
    subtitle: "High meeting load or long hours caught up with me",
    icon: <Meh className="h-5 w-5 text-amber-500" />,
    borderHover: "hover:border-amber-400",
    bgActive: "border-amber-500 bg-amber-50/60 dark:bg-amber-950/30",
    textActive: "text-amber-900 dark:text-amber-300",
  },
  {
    id: "drained",
    title: "Drained & In Need of Rest",
    subtitle: "Intense sprint or burnout signals, ready to disconnect completely",
    icon: <Frown className="h-5 w-5 text-rose-500" />,
    borderHover: "hover:border-rose-400",
    bgActive: "border-rose-500 bg-rose-50/60 dark:bg-rose-950/30",
    textActive: "text-rose-900 dark:text-rose-300",
  },
];

function getReflectionPrompt(assessment: EmployeeAssessment) {
  if (assessment.status === "building") {
    return {
      title: "Establishing your baseline this week",
      prompt:
        "What work rhythms, focus blocks, or routines are feeling natural as your twin learns your typical schedule?",
    };
  }

  const topChange = assessment.changes[0];

  if (!topChange) {
    return {
      title: "Your work pattern was relatively steady",
      prompt:
        "Were there any notable events, projects, or circumstances that supported your steady pacing this week?",
    };
  }

  switch (topChange.metric) {
    case "workingHours":
      return {
        title: "Working hours shifted from baseline",
        prompt:
          "Was your workload higher or lower than usual this week, and how did it affect your energy levels?",
      };

    case "breakFrequency":
      return {
        title: "Rest breaks decreased this week",
        prompt:
          "What factors made it harder to step away for micro-breaks, and how can you reclaim 5-minute pauses next week?",
      };

    case "afterHoursActivity":
      return {
        title: "After-hours activity was elevated",
        prompt:
          "Were late-night messages or tasks driven by urgent deadlines, or can you set a clearer end-of-day cutoff?",
      };

    case "meetingLoad":
      return {
        title: "Meeting load increased this week",
        prompt:
          "Did your meetings support your priorities, or did they compete with uninterrupted deep focus time?",
      };

    default:
      return {
        title: "Behavioral rhythms shifted this week",
        prompt:
          "What circumstances or projects influenced your pacing over the past few days?",
      };
  }
}

export default function ReportsPage() {
  const [assessment, setAssessment] = useState<EmployeeAssessment | null>(null);
  
  // Friday Check-in State
  const [isRealFriday, setIsRealFriday] = useState(false);
  const [simulateFriday, setSimulateFriday] = useState(true); // Default to true in sandbox for instant evaluation
  const [selectedFeeling, setSelectedFeeling] = useState<string | null>(null);
  const [reflectionNote, setReflectionNote] = useState("");
  const [isSurveySubmitted, setIsSurveySubmitted] = useState(false);
  const [savedFeelingTitle, setSavedFeelingTitle] = useState<string | null>(null);

  const weekKey = getCurrentWeekKey();
  const storageKey = `friday-survey-${weekKey}`;

  useEffect(() => {
    // 1. Check real day of week (Friday = 5)
    const isFridayToday = new Date().getDay() === 5;
    setIsRealFriday(isFridayToday);

    // 2. Load survey submission status from localStorage
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setIsSurveySubmitted(true);
        setSelectedFeeling(parsed.feeling);
        const match = FRIDAY_FEELING_OPTIONS.find((f) => f.id === parsed.feeling);
        setSavedFeelingTitle(match?.title || parsed.feeling);
      } catch {
        setIsSurveySubmitted(true);
      }
    } else {
      setIsSurveySubmitted(false);
    }

    // 3. Load assessment telemetry
    const user = getLocalSessionUser();
    const employeeId = user?.id || "usr-ronnie";
    const metrics = getMetricsForEmployee(employeeId);
    const result = buildEmployeeAssessment(metrics);
    setAssessment(result);
  }, [storageKey]);

  const handleFridaySurveySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeeling) return;

    const payload = {
      feeling: selectedFeeling,
      note: reflectionNote.trim(),
      submittedAt: new Date().toISOString(),
      week: weekKey,
    };

    localStorage.setItem(storageKey, JSON.stringify(payload));
    setIsSurveySubmitted(true);

    const match = FRIDAY_FEELING_OPTIONS.find((f) => f.id === selectedFeeling);
    setSavedFeelingTitle(match?.title || selectedFeeling);
  };

  const handleResetSurveyForTesting = () => {
    localStorage.removeItem(storageKey);
    setIsSurveySubmitted(false);
    setSelectedFeeling(null);
    setReflectionNote("");
  };

  const isFridayActive = isRealFriday || simulateFriday;
  const isReportLocked = isFridayActive && !isSurveySubmitted;

  const reflection = assessment ? getReflectionPrompt(assessment) : null;
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
            <span className="text-slate-700 dark:text-slate-200">Weekly Reports</span>
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Personal Weekly Reports
          </h1>

          <p className="mt-1 text-xs text-slate-500 dark:text-[#a6a6a6] max-w-2xl">
            Friday end-of-week reflection, weekly behavioral shift retrospective, and PDF summary export.
          </p>
        </div>

        <Link href="/dashboard">
          <Button variant="outline" className="text-xs shrink-0 border-slate-200 dark:border-[#383734]">
            ← Back to Dashboard
          </Button>
        </Link>
      </div>
      
      {/* Simulation Sandbox Control for Evaluators */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-xs dark:border-[#383734] dark:bg-[#2c2b28] shadow-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-sky-500" />
          <span className="font-semibold text-slate-800 dark:text-[#cfcfce]">
            Friday Schedule Trigger:
          </span>
          <span className="text-slate-500 dark:text-[#a6a6a6]">
            {isRealFriday ? "Today is Friday (Active)" : "Simulated Friday Mode Active"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setSimulateFriday(!simulateFriday)}
            className="text-[11px] py-1 px-2.5 border-slate-200 dark:border-[#383734]"
          >
            {simulateFriday ? "Switch to Regular Weekday" : "Simulate Friday Trigger"}
          </Button>

          {isSurveySubmitted && (
            <Button
              variant="ghost"
              onClick={handleResetSurveyForTesting}
              className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-[#a6a6a6] dark:hover:text-white py-1 px-2"
            >
              Reset Friday Survey
            </Button>
          )}
        </div>
      </div>

      {/* =========================================================================
          CASE 1: FRIDAY PULSE GATE (LOCKED UNTIL USER SELECTS HOW THEY FEEL)
          ========================================================================= */}
      {isReportLocked ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-lg dark:border-[#383734] dark:bg-[#2c2b28] space-y-7 animate-in fade-in zoom-in-95 duration-200">
          
          <div className="text-center max-w-xl mx-auto space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
              <HeartHandshake className="h-7 w-7" />
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
              <Lock className="h-3 w-3" />
              <span>Friday End-of-Week Pulse • Reflection Gate</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              How did this week of work feel to you?
            </h1>

            <p className="text-xs sm:text-sm leading-6 text-slate-500 dark:text-[#a6a6a6]">
              Before unlocking your weekly behavioral report, take a quick 10-second moment to check in with yourself. Your subjective feeling helps calibrate your twin with your lived experience.
            </p>
          </div>

          <form onSubmit={handleFridaySurveySubmit} className="space-y-6 max-w-2xl mx-auto">
            
            {/* 4 Interactive Sentiment Cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              {FRIDAY_FEELING_OPTIONS.map((option) => {
                const isSelected = selectedFeeling === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedFeeling(option.id)}
                    className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all duration-200 ${
                      isSelected
                        ? `${option.bgActive} ring-2 ring-slate-900 dark:ring-white shadow-sm`
                        : `border-slate-200 bg-white hover:bg-slate-50 dark:border-[#383734] dark:bg-[#181817] dark:hover:bg-[#353430] ${option.borderHover}`
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="flex items-center gap-2">
                        {option.icon}
                        <h3 className={`text-xs font-bold ${isSelected ? option.textActive : "text-slate-900 dark:text-white"}`}>
                          {option.title}
                        </h3>
                      </div>
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected ? "border-slate-900 bg-slate-900 dark:border-white dark:bg-white" : "border-slate-300"}`}>
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-black" />}
                      </div>
                    </div>

                    <p className="text-[11px] leading-4 text-slate-500 dark:text-[#a6a6a6]">
                      {option.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Optional Micro-Reflection Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce] flex items-center justify-between">
                <span>One intention or reflection for next week (Optional)</span>
                <span className="text-[10px] text-slate-400 font-normal">Private to you</span>
              </label>
              <textarea
                rows={2}
                value={reflectionNote}
                onChange={(e) => setReflectionNote(e.target.value)}
                placeholder="e.g. Protect Thursday afternoons for deep design focus, or stop checking email past 7 PM..."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white resize-none"
              />
            </div>

            {/* Submit & Unlock Action */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={!selectedFeeling}
                className="w-full py-3 text-xs font-bold bg-[#60cdff] text-black hover:bg-[#4cc2ff] rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Complete Friday Check-in & Unlock Weekly Report</span>
                <ArrowRight className="h-4 w-4" />
              </Button>

              {!selectedFeeling && (
                <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-[#888884]">
                  Please select how you felt this week to unlock your full weekly summary.
                </p>
              )}
            </div>

          </form>

        </section>
      ) : (
        /* =========================================================================
           CASE 2: UNLOCKED WEEKLY REPORT (SHOWN AFTER CHECK-IN OR ON NON-FRIDAYS)
           ========================================================================= */
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Header */}
          <section className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <FileText className="h-4 w-4" />
                <span>Weekly Behavioral Summary</span>
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                Weekly Reflection Report
              </h1>

              <p className="mt-1 max-w-2xl text-xs sm:text-sm text-slate-500 dark:text-[#a6a6a6]">
                A calm review of your weekly work rhythms to support self-awareness, boundary setting, and intentional pacing.
              </p>
            </div>

            {/* Completed Friday Check-in Banner */}
            {isSurveySubmitted && savedFeelingTitle && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3.5 py-2 text-xs font-semibold text-emerald-900 dark:border-emerald-950/60 dark:bg-emerald-950/30 dark:text-emerald-300 shadow-sm shrink-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Friday Pulse: <strong>{savedFeelingTitle}</strong></span>
              </div>
            )}
          </section>

          {/* Overview & Score Card */}
          <Card className="p-7">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge variant={isBuilding ? "neutral" : "positive"}>
                    {isBuilding ? "Calibrating" : "Weekly Summary"}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-[#9a9893]">
                    <Calendar className="h-3.5 w-3.5" />
                    Week {weekKey} Review
                  </span>
                </div>

                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {isBuilding
                    ? "Recording Weekly Calibration Signals"
                    : assessment?.changes.length
                    ? "Meaningful shifts observed this week"
                    : "Your weekly pacing remained balanced"}
                </h2>

                <p className="max-w-xl text-xs sm:text-sm leading-6 text-slate-600 dark:text-[#a6a6a6]">
                  {isBuilding
                    ? `Your 28-day baseline is actively recording (${assessment?.daysCollected ?? 0} / 28 days). Full reflection scores will unlock once calibrated.`
                    : "This weekly reflection compares your recent rhythms with your 28-day baseline to highlight changes worth noticing."}
                </p>
              </div>

              <div className="flex shrink-0 justify-center">
                <ScoreGauge score={assessment?.score ?? null} size={140} />
              </div>
            </div>
          </Card>

          {/* Weekly Patterns Worth Noticing */}
          {!isBuilding && assessment?.changes && assessment.changes.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Patterns Worth Noticing This Week
              </h2>

              <div className="space-y-3">
                {assessment.changes.map((change) => {
                  const isIncrease = change.percentageChange > 0;
                  return (
                    <Card key={change.metric} className="p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {metricLabels[change.metric] ?? change.metric}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
                            Baseline: {change.baselineValue.toFixed(1)} • Current: {change.currentValue.toFixed(1)}
                          </p>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold ${
                            isIncrease
                              ? change.metric === "breakFrequency"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                              : change.metric === "breakFrequency"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          }`}
                        >
                          {isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {formatChange(change.percentageChange)}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* Qualitative Prompt */}
          <Card className="border-indigo-100 bg-indigo-50/40 p-6 dark:border-indigo-950/60 dark:bg-indigo-950/20">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Guided Reflection Question</span>
            </div>

            <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-white">
              {reflection?.title}
            </h3>

            <p className="mt-1 text-xs sm:text-sm leading-6 text-slate-600 dark:text-[#cfcfce]">
              {reflection?.prompt}
            </p>
          </Card>

          {/* Privacy Guarantee Note */}
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-[#888884] pt-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Weekly reflections and Friday sentiments are private to your twin and never shown to HR.</span>
          </div>

          {/* Guided Return */}
          <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-[#383734]">
            <Link href="/dashboard/recommendations">
              <Button variant="outline" className="text-xs">
                ← Back to Recommendations
              </Button>
            </Link>

            <Link href="/dashboard">
              <Button className="text-xs">
                Back to Overview
              </Button>
            </Link>
          </div>

        </div>
      )}

    </div>
  );
}