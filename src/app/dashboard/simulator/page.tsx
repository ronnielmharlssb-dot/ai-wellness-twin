"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import {
  Sliders,
  ArrowLeft,
  Sparkles,
  Zap,
  ShieldCheck,
  Flame,
  Clock,
  Coffee,
  Moon,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  Calendar,
  Layers,
  Activity,
  BarChart3,
  RefreshCw,
} from "lucide-react";

import { getMetricsForEmployee } from "@/lib/wellbeing/employeeMetrics";
import { getLocalSessionUser } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PresetScenario {
  id: string;
  name: string;
  emoji: string;
  description: string;
  workingHours: number;
  meetingLoad: number;
  focusHours: number;
  breakFrequency: number;
  afterHoursActivity: number;
  tag: string;
  tagColor: string;
}

const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: "meeting-detox",
    name: "Meeting Detox Protocol",
    emoji: "🧘",
    description: "Halve meetings, protect focus blocks, and eliminate after-hours syncs.",
    workingHours: 7.5,
    meetingLoad: 1.5,
    focusHours: 4.5,
    breakFrequency: 7,
    afterHoursActivity: 0,
    tag: "High Recovery",
    tagColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  {
    id: "deep-focus-sprint",
    name: "Deep Focus Engineering Sprint",
    emoji: "⚡",
    description: "Maximize contiguous deep coding time with minimal synchronous interruptions.",
    workingHours: 8.0,
    meetingLoad: 1.0,
    focusHours: 5.0,
    breakFrequency: 6,
    afterHoursActivity: 10,
    tag: "High Flow",
    tagColor: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-[#60cdff] border-sky-200 dark:border-sky-800",
  },
  {
    id: "strict-curfew",
    name: "Strict 6 PM Curfew",
    emoji: "🛡️",
    description: "Hard boundary on evening Slack/GitHub activity to restore rest buffers.",
    workingHours: 8.0,
    meetingLoad: 2.5,
    focusHours: 3.5,
    breakFrequency: 5,
    afterHoursActivity: 0,
    tag: "Boundary Protection",
    tagColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  },
  {
    id: "crunch-deadline",
    name: "Crunch / Deadline Overload",
    emoji: "🚨",
    description: "Simulate intense crunch: 11h days, 5h meetings, and late-night PR reviews.",
    workingHours: 11.5,
    meetingLoad: 5.0,
    focusHours: 2.0,
    breakFrequency: 2,
    afterHoursActivity: 120,
    tag: "Hazard Warning",
    tagColor: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  },
  {
    id: "balanced-sustainability",
    name: "Balanced Sustainable Flow",
    emoji: "🌿",
    description: "Target equilibrium between collaboration, focus, and deliberate breaks.",
    workingHours: 8.0,
    meetingLoad: 2.0,
    focusHours: 4.0,
    breakFrequency: 6,
    afterHoursActivity: 0,
    tag: "Target Benchmark",
    tagColor: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  },
];

const SCENARIO_GOAL_STORAGE_KEY = "wellness-active-scenario-goal";

export default function SimulatorPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  // Simulation Parameters
  const [workingHours, setWorkingHours] = useState(8.0);
  const [meetingLoad, setMeetingLoad] = useState(3.5);
  const [focusHours, setFocusHours] = useState(3.0);
  const [breakFrequency, setBreakFrequency] = useState(4);
  const [afterHoursActivity, setAfterHoursActivity] = useState(35);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [savedGoalMessage, setSavedGoalMessage] = useState<string | null>(null);

  useEffect(() => {
    const sessionUser = getLocalSessionUser();
    setUser(sessionUser);

    // Initialize from employee's actual recent metrics
    const metrics = getMetricsForEmployee(sessionUser?.id || "usr-ronnie");
    if (metrics.length > 0) {
      const recent = metrics.slice(-7);
      const avgWork = recent.reduce((sum, m) => sum + m.workingHours, 0) / recent.length;
      const avgMeetings = recent.reduce((sum, m) => sum + m.meetingLoad, 0) / recent.length;
      const avgBreaks = Math.round(recent.reduce((sum, m) => sum + m.breakFrequency, 0) / recent.length);
      const avgAfterHours = Math.round(recent.reduce((sum, m) => sum + m.afterHoursActivity, 0) / recent.length);

      setWorkingHours(Number(avgWork.toFixed(1)) || 8.0);
      setMeetingLoad(Number(avgMeetings.toFixed(1)) || 3.5);
      setBreakFrequency(avgBreaks || 4);
      setAfterHoursActivity(avgAfterHours || 35);
      setFocusHours(Math.max(1, Number((avgWork - avgMeetings - 1.5).toFixed(1))));
    }
  }, []);

  // Baseline Metrics for comparison
  const baselineStats = useMemo(() => {
    const metrics = getMetricsForEmployee(user?.id || "usr-ronnie");
    if (metrics.length === 0) {
      return { score: 62, workHours: 8.4, meetingLoad: 3.8, breaks: 3, afterHours: 42 };
    }
    const recent = metrics.slice(-14);
    const avgWork = recent.reduce((s, m) => s + m.workingHours, 0) / recent.length;
    const avgMeetings = recent.reduce((s, m) => s + m.meetingLoad, 0) / recent.length;
    const avgBreaks = recent.reduce((s, m) => s + m.breakFrequency, 0) / recent.length;
    const avgAfter = recent.reduce((s, m) => s + m.afterHoursActivity, 0) / recent.length;

    // Approximate baseline score
    const score = Math.max(
      30,
      Math.min(
        95,
        Math.round(80 - (avgWork - 7.5) * 5 - (avgMeetings / avgWork) * 30 - (avgAfter / 25) * 10 + avgBreaks * 2.5)
      )
    );

    return {
      score,
      workHours: Number(avgWork.toFixed(1)),
      meetingLoad: Number(avgMeetings.toFixed(1)),
      breaks: Math.round(avgBreaks),
      afterHours: Math.round(avgAfter),
    };
  }, [user]);

  // Real-Time Simulation Calculation
  const simulation = useMemo(() => {
    // 1. Workload strain penalty
    const workloadStrain = Math.max(0, (workingHours - 8.0) * 8);
    // 2. Meeting density penalty (% of workday in meetings)
    const meetingRatio = meetingLoad / Math.max(1, workingHours);
    const meetingStrain = meetingRatio > 0.3 ? (meetingRatio - 0.3) * 60 : -10;
    // 3. Focus buffer reward
    const focusReward = Math.min(20, (focusHours / 4.0) * 18);
    // 4. Break recovery reward
    const breakReward = Math.min(18, breakFrequency * 2.8);
    // 5. Evening boundary erosion penalty
    const boundaryStrain = (afterHoursActivity / 30) * 12;

    // Compute Simulated Twin Health Score (15 - 98)
    const rawScore = 74 - workloadStrain - meetingStrain + focusReward + breakReward - boundaryStrain;
    const simulatedScore = Math.max(18, Math.min(96, Math.round(rawScore)));
    const scoreDelta = simulatedScore - baselineStats.score;

    // Burnout Risk Categorization
    let riskLevel = "Low Risk (Optimal Balance)";
    let riskColor = "text-emerald-600 dark:text-emerald-400";
    let riskBadgeBg = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
    let riskStatus = "stable";

    if (simulatedScore < 45) {
      riskLevel = "Critical Burnout Risk (Severe Hazard)";
      riskColor = "text-rose-600 dark:text-rose-400";
      riskBadgeBg = "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800";
      riskStatus = "critical";
    } else if (simulatedScore < 65) {
      riskLevel = "Elevated Risk (Boundary Strain)";
      riskColor = "text-amber-600 dark:text-amber-400";
      riskBadgeBg = "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800";
      riskStatus = "watch";
    } else if (simulatedScore < 80) {
      riskLevel = "Moderate Risk (Manageable Pacing)";
      riskColor = "text-sky-600 dark:text-[#60cdff]";
      riskBadgeBg = "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-300 dark:border-sky-800";
      riskStatus = "moderate";
    }

    // 4 Key Dimensional Probabilities
    const exhaustionProb = Math.max(10, Math.min(95, Math.round((workingHours / 12) * 45 + (afterHoursActivity / 60) * 35 - breakFrequency * 4)));
    const cynicismProb = Math.max(10, Math.min(90, Math.round((meetingLoad / Math.max(1, focusHours)) * 30 + (meetingRatio > 0.4 ? 25 : 5))));
    const cognitiveFriction = Math.max(15, Math.min(95, Math.round((meetingLoad / 5) * 50 - (focusHours / 5) * 30 + 35)));
    const boundaryErosion = Math.max(5, Math.min(98, Math.round((afterHoursActivity / 90) * 100)));

    // 14-Day Trajectory Projection
    const trajectoryDays = [1, 3, 5, 7, 10, 14];
    const trajectory = trajectoryDays.map((day) => {
      const weight = day / 14;
      const projectedDayScore = Math.round(baselineStats.score + (simulatedScore - baselineStats.score) * weight);
      return {
        day: `Day ${day}`,
        score: Math.max(20, Math.min(96, projectedDayScore)),
      };
    });

    // Concrete AI Recommendations for this simulated state
    const recommendations: string[] = [];
    if (meetingLoad > 3.0) {
      recommendations.push(`Decline or compress ${(meetingLoad - 2).toFixed(1)}h of recurring meetings to restore focus blocks.`);
    }
    if (afterHoursActivity > 20) {
      recommendations.push(`Set a strict notification curfew at 6:30 PM to recover ${afterHoursActivity} mins of evening rest.`);
    }
    if (breakFrequency < 5) {
      recommendations.push(`Add ${5 - breakFrequency} micro-pauses (5 mins each) between intense engineering sessions.`);
    }
    if (focusHours < 3.5) {
      recommendations.push(`Block a recurring 2-hour "No-Ping Focus Window" on your calendar every morning.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("Current simulated parameters reflect an optimal high-performance equilibrium.");
    }

    return {
      simulatedScore,
      scoreDelta,
      riskLevel,
      riskColor,
      riskBadgeBg,
      riskStatus,
      exhaustionProb,
      cynicismProb,
      cognitiveFriction,
      boundaryErosion,
      trajectory,
      recommendations,
    };
  }, [workingHours, meetingLoad, focusHours, breakFrequency, afterHoursActivity, baselineStats]);

  const applyPreset = (preset: PresetScenario) => {
    setActivePreset(preset.id);
    setWorkingHours(preset.workingHours);
    setMeetingLoad(preset.meetingLoad);
    setFocusHours(preset.focusHours);
    setBreakFrequency(preset.breakFrequency);
    setAfterHoursActivity(preset.afterHoursActivity);
  };

  const handleSaveAsGoal = () => {
    const goalData = {
      presetId: activePreset,
      workingHours,
      meetingLoad,
      focusHours,
      breakFrequency,
      afterHoursActivity,
      targetScore: simulation.simulatedScore,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(SCENARIO_GOAL_STORAGE_KEY, JSON.stringify(goalData));
      setSavedGoalMessage("✓ Simulation targets saved as your active weekly wellbeing goal!");
      setTimeout(() => setSavedGoalMessage(null), 4000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5 dark:border-[#383734]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-[#60cdff]">
            <Sliders className="h-4 w-4" />
            <span>Digital Twin Workday & Burnout Simulator</span>
          </div>

          <h1 className="mt-1.5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            What-If Scenario Simulator
          </h1>

          <p className="mt-1 text-xs text-slate-500 dark:text-[#a6a6a6] max-w-2xl">
            Model proactive changes to your meetings, focus blocks, and disconnect habits. See instant real-time predictions of your Twin Health Score and 14-day burnout recovery trajectory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="outline" className="flex items-center gap-1.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>
        </div>
      </section>

      {/* Preset Scenario Selector */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#888884] flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Instant Scenario Presets</span>
          </h2>
          <span className="text-[11px] text-slate-400">Click any preset to load proven behavioral targets</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PRESET_SCENARIOS.map((preset) => {
            const isSelected = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all duration-200 hover:shadow-md ${
                  isSelected
                    ? "border-sky-500 bg-sky-50/80 shadow-sm ring-2 ring-sky-500/20 dark:border-[#60cdff] dark:bg-sky-950/30"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-[#383734] dark:bg-[#20201e] dark:hover:border-slate-600"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{preset.emoji}</span>
                    <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${preset.tagColor}`}>
                      {preset.tag}
                    </span>
                  </div>
                  <h3 className="mt-2 text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {preset.name}
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-[#888884] line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-[#383734] text-[10px] font-mono text-slate-400">
                  {preset.workingHours}h work • {preset.meetingLoad}h mtg
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main 2-Column Interactive Simulator Workspace */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Interactive Real-Time Parameter Sliders (7 Cols) */}
        <Card className="lg:col-span-7 p-6 space-y-6 border-slate-200 dark:border-[#383734]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#383734]">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-sky-500" />
                <span>Adjust Workday Variables</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-[#888884]">
                Move the sliders to model customized schedule configurations.
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setActivePreset(null);
                setWorkingHours(8.0);
                setMeetingLoad(3.0);
                setFocusHours(3.5);
                setBreakFrequency(5);
                setAfterHoursActivity(20);
              }}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              <RefreshCw className="mr-1 h-3 w-3" /> Reset
            </Button>
          </div>

          <div className="space-y-5">
            {/* Slider 1: Working Hours */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-800 dark:text-[#cfcfce] flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-sky-500" />
                  <span>Total Daily Work Time:</span>
                </label>
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                  {workingHours.toFixed(1)} hours / day
                </span>
              </div>
              <input
                type="range"
                min="4.0"
                max="14.0"
                step="0.5"
                value={workingHours}
                onChange={(e) => {
                  setActivePreset(null);
                  setWorkingHours(parseFloat(e.target.value));
                }}
                className="w-full accent-sky-500 cursor-pointer h-2 bg-slate-100 rounded-lg dark:bg-[#383734]"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>4.0h (Part-time)</span>
                <span>8.0h (Standard)</span>
                <span>14.0h (Overdrive)</span>
              </div>
            </div>

            {/* Slider 2: Meeting Load */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-800 dark:text-[#cfcfce] flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-500" />
                  <span>Daily Meeting & Call Load:</span>
                </label>
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                  {meetingLoad.toFixed(1)} hours / day
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="9.0"
                step="0.5"
                value={meetingLoad}
                onChange={(e) => {
                  setActivePreset(null);
                  setMeetingLoad(parseFloat(e.target.value));
                }}
                className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-100 rounded-lg dark:bg-[#383734]"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0.0h (No Meetings)</span>
                <span>3.0h (Moderate)</span>
                <span>9.0h (Back-to-back)</span>
              </div>
            </div>

            {/* Slider 3: Contiguous Focus Hours */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-800 dark:text-[#cfcfce] flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span>Deep Work / Coding Blocks:</span>
                </label>
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                  {focusHours.toFixed(1)} hours / day
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="7.0"
                step="0.5"
                value={focusHours}
                onChange={(e) => {
                  setActivePreset(null);
                  setFocusHours(parseFloat(e.target.value));
                }}
                className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-100 rounded-lg dark:bg-[#383734]"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0.5h (Fragmented)</span>
                <span>3.5h (Solid Flow)</span>
                <span>7.0h (Deep Flow)</span>
              </div>
            </div>

            {/* Slider 4: Micro-Pause Frequency */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-800 dark:text-[#cfcfce] flex items-center gap-1.5">
                  <Coffee className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Rest & Micro-Pause Frequency:</span>
                </label>
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                  {breakFrequency} breaks / day
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={breakFrequency}
                onChange={(e) => {
                  setActivePreset(null);
                  setBreakFrequency(parseInt(e.target.value));
                }}
                className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-100 rounded-lg dark:bg-[#383734]"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0 breaks (Continuous strain)</span>
                <span>5 breaks (Recommended)</span>
                <span>12 breaks</span>
              </div>
            </div>

            {/* Slider 5: Evening / After-Hours Activity */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-800 dark:text-[#cfcfce] flex items-center gap-1.5">
                  <Moon className="h-3.5 w-3.5 text-purple-500" />
                  <span>After-Hours Slack & Commits:</span>
                </label>
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                  {afterHoursActivity} mins / evening
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="180"
                step="5"
                value={afterHoursActivity}
                onChange={(e) => {
                  setActivePreset(null);
                  setAfterHoursActivity(parseInt(e.target.value));
                }}
                className="w-full accent-purple-500 cursor-pointer h-2 bg-slate-100 rounded-lg dark:bg-[#383734]"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0m (Full Disconnect)</span>
                <span>45m (Moderate)</span>
                <span>180m (Severe overtime)</span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 border-t border-slate-100 dark:border-[#383734] flex flex-wrap items-center justify-between gap-3">
            <Button
              onClick={handleSaveAsGoal}
              className="flex items-center gap-2 text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 font-bold"
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>Apply Scenario as Active Weekly Goal</span>
            </Button>

            {savedGoalMessage && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                {savedGoalMessage}
              </span>
            )}
          </div>
        </Card>

        {/* Right Column: Real-Time Projected Health Twin Outcome (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Outcome Card */}
          <Card className="p-6 space-y-5 border-slate-200 dark:border-[#383734]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#383734]">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Projected Twin Health Score
              </span>
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${simulation.riskBadgeBg}`}>
                {simulation.riskLevel}
              </span>
            </div>

            {/* Big Score Visual */}
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                  {simulation.simulatedScore}
                  <span className="text-xl text-slate-400 font-normal"> / 100</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
                  {simulation.scoreDelta >= 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      +{simulation.scoreDelta} pts vs current baseline ({baselineStats.score})
                    </span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                      <TrendingDown className="h-3.5 w-3.5" />
                      {simulation.scoreDelta} pts vs current baseline ({baselineStats.score})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 4 Core Burnout Risk Dimension Gauges */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-[#383734]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Burnout Dimension Probabilities
              </div>

              {/* Exhaustion Gauge */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-[#cfcfce]">Cognitive Exhaustion:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{simulation.exhaustionProb}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-[#383734]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      simulation.exhaustionProb > 65 ? "bg-rose-500" : simulation.exhaustionProb > 40 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${simulation.exhaustionProb}%` }}
                  />
                </div>
              </div>

              {/* Detachment Gauge */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-[#cfcfce]">Cynicism / Detachment:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{simulation.cynicismProb}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-[#383734]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      simulation.cynicismProb > 65 ? "bg-rose-500" : simulation.cynicismProb > 40 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${simulation.cynicismProb}%` }}
                  />
                </div>
              </div>

              {/* Schedule Friction Gauge */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-[#cfcfce]">Schedule Fragmentation:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{simulation.cognitiveFriction}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-[#383734]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      simulation.cognitiveFriction > 65 ? "bg-rose-500" : simulation.cognitiveFriction > 40 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${simulation.cognitiveFriction}%` }}
                  />
                </div>
              </div>

              {/* Boundary Erosion Gauge */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-[#cfcfce]">Evening Boundary Erosion:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{simulation.boundaryErosion}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-[#383734]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      simulation.boundaryErosion > 65 ? "bg-rose-500" : simulation.boundaryErosion > 40 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${simulation.boundaryErosion}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* 14-Day Trajectory Forecast Card */}
          <Card className="p-6 space-y-4 border-slate-200 dark:border-[#383734]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-sky-500" />
                <span>14-Day Projected Recovery Path</span>
              </h3>
            </div>

            <div className="grid grid-cols-6 gap-2 text-center">
              {simulation.trajectory.map((point) => (
                <div
                  key={point.day}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-2 text-xs dark:border-[#383734] dark:bg-[#1e1e1c]"
                >
                  <div className="text-[10px] text-slate-400 font-mono">{point.day}</div>
                  <div className="mt-1 font-bold text-slate-900 dark:text-white">{point.score}</div>
                </div>
              ))}
            </div>

            {/* AI Action Plan Takeaways */}
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-[#383734]">
              <div className="text-[11px] font-bold text-slate-700 dark:text-[#cfcfce] flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span>Action Plan for this Target:</span>
              </div>
              <ul className="space-y-1 text-[11px] text-slate-500 dark:text-[#a6a6a6]">
                {simulation.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}