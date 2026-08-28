"use client";

import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  RotateCcw,
  Sparkles,
  Zap,
  Coffee,
  Moon,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  saveEmployeeMetrics,
  getMetricsForEmployee,
  clearEmployeeMetrics,
  saveEmployeeMetricsBatch,
} from "@/lib/wellbeing/employeeMetrics";
import type { EmployeeDailyMetrics } from "@/lib/wellbeing/employeeTypes";

interface BaselineSuiteProps {
  employeeId: string;
  daysCollected: number;
  requiredDays?: number;
  onMetricsUpdated: () => void;
}

export function BaselineCalibrationSuite({
  employeeId,
  daysCollected,
  requiredDays = 28,
  onMetricsUpdated,
}: BaselineSuiteProps) {
  const [showLogModal, setShowLogModal] = useState(false);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [workingHours, setWorkingHours] = useState(8);
  const [meetingLoad, setMeetingLoad] = useState(3.5);
  const [breakFrequency, setBreakFrequency] = useState(5);
  const [afterHoursActivity, setAfterHoursActivity] = useState(15);
  const [dayFeeling, setDayFeeling] = useState<"energized" | "balanced" | "fatigued" | "drained">("balanced");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const percentage = Math.min(100, Math.round((daysCollected / requiredDays) * 100));
  const remainingDays = Math.max(0, requiredDays - daysCollected);

  // Determine current phase
  const getPhaseInfo = () => {
    if (daysCollected <= 7) {
      return {
        phase: 1,
        title: "Week 1: Workstation Rhythm & Schedule Detection",
        desc: "Learning your daily start and end bounds, core focus windows, and natural session rhythm.",
      };
    } else if (daysCollected <= 14) {
      return {
        phase: 2,
        title: "Week 2: Meeting Load & Calendar Distribution Lock",
        desc: "Calibrating collaboration density, video call clustering, and focus time buffer requirements.",
      };
    } else if (daysCollected <= 21) {
      return {
        phase: 3,
        title: "Week 3: Rest & Micro-Pause Recovery Rhythm",
        desc: "Mapping restorative breaks, screen pauses, and evening boundary recovery intervals.",
      };
    } else {
      return {
        phase: 4,
        title: "Week 4: Final Behavioral Twin Profile Establishment",
        desc: "Synthesizing 28 days of variance into a personal behavioral baseline.",
      };
    }
  };

  const currentPhase = getPhaseInfo();
  const existingMetrics = getMetricsForEmployee(employeeId).sort((a, b) => a.date.localeCompare(b.date));

  // Compute preliminary averages from data collected so far
  const avgWorkingHours =
    existingMetrics.length > 0
      ? (existingMetrics.reduce((acc, m) => acc + m.workingHours, 0) / existingMetrics.length).toFixed(1)
      : "0";
  const avgMeetings =
    existingMetrics.length > 0
      ? (existingMetrics.reduce((acc, m) => acc + m.meetingLoad, 0) / existingMetrics.length).toFixed(1)
      : "0";
  const avgBreaks =
    existingMetrics.length > 0
      ? (existingMetrics.reduce((acc, m) => acc + m.breakFrequency, 0) / existingMetrics.length).toFixed(1)
      : "0";

  const handleSaveDailyMetric = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const newMetric: EmployeeDailyMetrics = {
      employeeId,
      date: logDate,
      source: "manual",
      workingHours: Number(workingHours),
      meetingLoad: Number(meetingLoad),
      breakFrequency: Number(breakFrequency),
      afterHoursActivity: Number(afterHoursActivity),
    };

    saveEmployeeMetrics(newMetric);
    setIsSubmitting(false);
    setShowLogModal(false);
    onMetricsUpdated();
  };

  const handleFastForwardOneDay = () => {
    // Generate the next sequential day
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - (requiredDays - daysCollected - 1));
    const formattedDate = baseDate.toISOString().split("T")[0];

    // Add healthy realistic data with slight variation
    const simulatedMetric: EmployeeDailyMetrics = {
      employeeId,
      date: formattedDate,
      source: "telemetry",
      workingHours: Number((7.5 + Math.random() * 1.5).toFixed(1)),
      meetingLoad: Number((2.5 + Math.random() * 2.0).toFixed(1)),
      breakFrequency: Math.floor(4 + Math.random() * 4),
      afterHoursActivity: Math.floor(Math.random() * 25),
    };

    saveEmployeeMetrics(simulatedMetric);
    onMetricsUpdated();
  };

  const handleCompleteFullBaseline = () => {
    const batch: EmployeeDailyMetrics[] = [];
    for (let i = 28; i >= 1; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      batch.push({
        employeeId,
        date: dateStr,
        source: "telemetry",
        workingHours: Number((7.8 + Math.sin(i) * 0.8).toFixed(1)),
        meetingLoad: Number((3.2 + Math.cos(i) * 0.9).toFixed(1)),
        breakFrequency: Math.floor(5 + Math.sin(i) * 2),
        afterHoursActivity: Math.floor(15 + Math.cos(i) * 10),
      });
    }

    saveEmployeeMetricsBatch(batch);
    onMetricsUpdated();
  };

  const handleResetBaseline = () => {
    if (confirm("Reset all recorded metrics for this account to Day 0?")) {
      clearEmployeeMetrics(employeeId);
      onMetricsUpdated();
    }
  };

  return (
    <Card className="overflow-hidden border-slate-300 bg-white p-6 shadow-sm dark:border-[#383734] dark:bg-[#2c2b28]">
      <div className="space-y-6">
        
        {/* Top Header & Calibration Progress Status */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-[#60cdff]">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                28-Day Behavioral Baseline Calibration
              </h2>
              <Badge variant="neutral">
                Day {daysCollected} of {requiredDays}
              </Badge>
            </div>

            <p className="text-xs text-slate-500 dark:text-[#a6a6a6] max-w-2xl leading-5">
              To guarantee zero false alarms, your AI Twin calibrates against 28 days of your personal daily signals before evaluating shifts.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setShowLogModal(true)}
              className="flex items-center gap-1.5 text-xs shadow-sm bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Log Today&apos;s Signals</span>
            </Button>
          </div>
        </div>

        {/* Phase Progress Bar & Banner */}
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50/70 to-indigo-50/50 p-4 dark:border-sky-950/50 dark:from-sky-950/20 dark:to-indigo-950/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-900 dark:text-[#60cdff]">
              <span>📍 {currentPhase.title}</span>
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-[#cfcfce]">
              {percentage}% Complete • {remainingDays === 0 ? "Established!" : `${remainingDays} days remaining`}
            </span>
          </div>

          {/* Progress Track */}
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-[#1f1e1c]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${Math.max(4, percentage)}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-600 dark:text-[#a6a6a6]">
            {currentPhase.desc}
          </p>
        </div>

        {/* 28-Day Interactive Calendar Matrix */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>28-Day Calibration Matrix</span>
            </span>
            <span className="text-[10px] text-slate-400">
              Each day strengthens the behavioral profile
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {Array.from({ length: requiredDays }, (_, i) => {
              const dayNum = i + 1;
              const isLogged = dayNum <= daysCollected;
              const isCurrent = dayNum === daysCollected + 1;
              const metricForDay = existingMetrics[i];

              return (
                <div
                  key={dayNum}
                  title={
                    metricForDay
                      ? `Day ${dayNum} (${metricForDay.date}): ${metricForDay.workingHours}h work, ${metricForDay.meetingLoad}h meetings, ${metricForDay.breakFrequency} breaks`
                      : `Day ${dayNum}: Pending calibration`
                  }
                  className={`relative flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all duration-200 border ${
                    isLogged
                      ? "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : isCurrent
                      ? "border-sky-400 bg-sky-50/80 text-sky-900 ring-2 ring-sky-300/60 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-200"
                      : "border-slate-200/60 bg-slate-50/50 text-slate-400 dark:border-[#383734]/60 dark:bg-[#20201e]/60 dark:text-[#666]"
                  }`}
                >
                  <span className="text-[10px] font-bold">Day {dayNum}</span>
                  {isLogged ? (
                    <CheckCircle2 className="mt-1 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="mt-1 flex h-3.5 w-3.5 items-center justify-center">
                      <span className="h-2 w-2 rounded-full bg-sky-500 animate-ping" />
                    </span>
                  ) : (
                    <span className="mt-1 text-[10px] font-medium opacity-50">—</span>
                  )}
                  {metricForDay && (
                    <span className="mt-1 text-[9px] font-semibold text-emerald-800 dark:text-emerald-300 truncate max-w-full">
                      {metricForDay.workingHours}h
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time Preliminary Baseline Metrics Calibrated So Far */}
        {existingMetrics.length > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center dark:border-[#383734] dark:bg-[#20201e]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Avg Working Hours
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {avgWorkingHours} <span className="text-xs font-normal text-slate-400">hrs/day</span>
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center dark:border-[#383734] dark:bg-[#20201e]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Avg Meeting Load
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {avgMeetings} <span className="text-xs font-normal text-slate-400">hrs/day</span>
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center dark:border-[#383734] dark:bg-[#20201e]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Avg Rest Pauses
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {avgBreaks} <span className="text-xs font-normal text-slate-400">breaks/day</span>
              </p>
            </div>
          </div>
        )}

        {/* Quick Evaluator Testing Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-[#383734]">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#a6a6a6]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Pure Test Account: Zero pre-seeded demo data</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleFastForwardOneDay}
              className="text-[11px] h-8 px-3"
              title="Add 1 simulated day to advance calibration"
            >
              <Zap className="mr-1 h-3 w-3 text-amber-500" />
              + Fast-Forward 1 Day
            </Button>

            <Button
              variant="outline"
              onClick={handleCompleteFullBaseline}
              className="text-[11px] h-8 px-3"
              title="Instantly establish 28-day baseline for testing"
            >
              <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" />
              Complete 28 Days
            </Button>

            {daysCollected > 0 && (
              <Button
                variant="ghost"
                onClick={handleResetBaseline}
                className="text-[11px] h-8 px-3 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
        </div>

      </div>

      {/* Interactive Log Daily Signal Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#383734] dark:bg-[#2c2b28] space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#383734]">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Log Day&apos;s Work Signals
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
                  Record your telemetry to advance your 28-day calibration.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setShowLogModal(false)}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleSaveDailyMetric} className="space-y-4">
              
              {/* Date Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                  Log Date
                </label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-slate-400 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                  required
                />
              </div>

              {/* Working Hours */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-[#cfcfce] flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-sky-500" />
                    Working Hours
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">{workingHours} hrs</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="14"
                  step="0.5"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(parseFloat(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>

              {/* Meeting Load */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-[#cfcfce] flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-teal-500" />
                    Meeting Load
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">{meetingLoad} hrs</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={meetingLoad}
                  onChange={(e) => setMeetingLoad(parseFloat(e.target.value))}
                  className="w-full accent-teal-500"
                />
              </div>

              {/* Rest Breaks */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-[#cfcfce] flex items-center gap-1">
                    <Coffee className="h-3.5 w-3.5 text-emerald-500" />
                    Rest Breaks (≥5 mins)
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">{breakFrequency} pauses</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={breakFrequency}
                  onChange={(e) => setBreakFrequency(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* After Hours Work */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-[#cfcfce] flex items-center gap-1">
                    <Moon className="h-3.5 w-3.5 text-indigo-500" />
                    After-Hours Activity (Evening)
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">{afterHoursActivity} mins</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="5"
                  value={afterHoursActivity}
                  onChange={(e) => setAfterHoursActivity(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Subjective Feeling */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                  How did today&apos;s work rhythm feel?
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: "energized", emoji: "⚡", label: "Energized" },
                      { id: "balanced", emoji: "😊", label: "Balanced" },
                      { id: "fatigued", emoji: "🥱", label: "Fatigued" },
                      { id: "drained", emoji: "😫", label: "Drained" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDayFeeling(item.id)}
                      className={`flex flex-col items-center rounded-xl p-2 text-center text-xs font-medium border transition ${
                        dayFeeling === item.id
                          ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900 font-bold"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-[#383734] dark:bg-[#181817] dark:text-[#cfcfce]"
                      }`}
                    >
                      <span className="text-base">{item.emoji}</span>
                      <span className="text-[10px] mt-0.5">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-[#383734]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLogModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="text-xs bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold"
                >
                  Save Day Entry
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
