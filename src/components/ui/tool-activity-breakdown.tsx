"use client";

import { useEffect, useState } from "react";
import {
  VSCodeLogo,
  GeminiLogo,
  CalendarLogo,
  SlackLogo,
  GitHubLogo,
} from "@/components/ui/brand-logos";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { workstationTracker, type TrackerState } from "@/lib/telemetry/workstationTracker";
import { getMetricsForEmployee } from "@/lib/wellbeing/employeeMetrics";
import { getStoredIntegrations } from "@/lib/integrations/syncEngine";
import { getToolMinutesToday } from "@/lib/telemetry/telemetryAggregator";
import { Activity, ShieldCheck, Monitor } from "lucide-react";

interface ToolActivityProps {
  employeeId: string;
}

export function ToolActivityBreakdown({ employeeId }: ToolActivityProps) {
  const [trackerState, setTrackerState] = useState<TrackerState>({
    isRunning: false,
    isPaused: false,
    todayActiveSeconds: 0,
    todayBreaks: 0,
    lastHeartbeatSentAt: null,
    activeFocusStreakSeconds: 0,
  });

  const [, setMetricsRevision] = useState(0);

  useEffect(() => {
    const unsub = workstationTracker.subscribe(setTrackerState);

    const handleUpdate = () => {
      setMetricsRevision((prev) => prev + 1);
    };

    window.addEventListener("wellness-telemetry-update", handleUpdate);
    return () => {
      unsub();
      window.removeEventListener("wellness-telemetry-update", handleUpdate);
    };
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];
  const metrics = getMetricsForEmployee(employeeId);
  const todayMetric = metrics.find((m) => m.date === todayStr);

  const meetingHours = todayMetric ? todayMetric.meetingLoad : 0;
  const afterHoursMins = todayMetric ? todayMetric.afterHoursActivity : 0;
  const workstationActiveMins = Math.floor(trackerState.todayActiveSeconds / 60);

  const connectedTools = getStoredIntegrations().filter((i) => i.connected);

  const githubConnected = connectedTools.some((t) => t.provider === "github");
  const vscodeConnected = connectedTools.some((t) => t.provider === "vscode");
  const geminiConnected = connectedTools.some((t) => t.provider === "gemini");
  const calendarConnected = connectedTools.some((t) => t.provider === "google_calendar");
  const slackConnected = connectedTools.some((t) => t.provider === "slack");

  const calendarMinutes = Math.round(meetingHours * 60);

  const toolMinutesToday = getToolMinutesToday();
  const rawVsCodeMins = toolMinutesToday["vscode"] || toolMinutesToday["ide"] || 0;
  const rawGeminiMins = toolMinutesToday["gemini"] || toolMinutesToday["ai"] || 0;

  // Pure recorded minutes (Starts at 0m and increments strictly with genuine telemetry)
  const githubMinutes = githubConnected && todayMetric?.source === "github" ? Math.round(todayMetric.workingHours * 60) : 0;
  const vscodeMinutes = vscodeConnected ? Math.round(workstationActiveMins + rawVsCodeMins) : 0;
  const geminiMinutes = geminiConnected ? Math.round(rawGeminiMins) : 0;
  const slackMinutes = slackConnected ? afterHoursMins : 0;

  const toolCards = [
    {
      id: "github",
      name: "GitHub",
      logo: <GitHubLogo className="h-6 w-6" />,
      category: "Code & Commits",
      minutes: githubMinutes,
      label: "Active Commit Window",
      unit: "mins",
      status: githubConnected ? "Live API Synced" : "Not Linked",
      color: "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#1e1e1c]",
      badgeColor: githubConnected
        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
        : "bg-slate-100 text-slate-500 dark:bg-[#20201e] dark:text-slate-400",
      detail: "Live commit & PR review timestamps from public activity",
    },
    {
      id: "vscode",
      name: "Visual Studio Code",
      logo: <VSCodeLogo className="h-6 w-6" />,
      category: "Code & Engineering",
      minutes: vscodeMinutes,
      label: "Active Focus Session",
      unit: "mins",
      status: vscodeConnected ? "Ingesting Telemetry" : "Not Linked",
      color: "border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20",
      badgeColor: vscodeConnected
        ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-[#60cdff]"
        : "bg-slate-100 text-slate-500 dark:bg-[#20201e] dark:text-slate-400",
      detail: "Active workstation focus time & typing interaction",
    },
    {
      id: "gemini",
      name: "Google Gemini",
      logo: <GeminiLogo className="h-6 w-6" />,
      category: "AI Research & Synthesis",
      minutes: geminiMinutes,
      label: "AI Consultation Time",
      unit: "mins",
      status: geminiConnected ? "Live Telemetry" : "Not Linked",
      color: "border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20",
      badgeColor: geminiConnected
        ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
        : "bg-slate-100 text-slate-500 dark:bg-[#20201e] dark:text-slate-400",
      detail: "Research session time windows (Prompt text strictly firewalled 🔒)",
    },
    {
      id: "calendar",
      name: "Google Calendar",
      logo: <CalendarLogo className="h-6 w-6" />,
      category: "Meetings & Syncs",
      minutes: calendarMinutes,
      label: "Meeting & Call Density",
      unit: "mins",
      status: calendarConnected ? "Synced via Cloud" : "Not Linked",
      color: "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20",
      badgeColor: calendarConnected
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
        : "bg-slate-100 text-slate-500 dark:bg-[#20201e] dark:text-slate-400",
      detail: "Calendar event start/end blocks (Titles excluded 🔒)",
    },
    {
      id: "slack",
      name: "Slack & Messaging",
      logo: <SlackLogo className="h-6 w-6" />,
      category: "Team Communication",
      minutes: slackMinutes,
      label: "Evening Activity Window",
      unit: "mins",
      status: slackConnected ? "Synced via Cloud" : "Not Linked",
      color: "border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20",
      badgeColor: slackConnected
        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
        : "bg-slate-100 text-slate-500 dark:bg-[#20201e] dark:text-slate-400",
      detail: "Active messaging timestamps outside core hours",
    },
  ];

  const formatHoursMinutes = (totalMins: number) => {
    if (totalMins < 60) {
      return `${totalMins}m`;
    }
    const hrs = (totalMins / 60).toFixed(1);
    return `${hrs}h`;
  };

  return (
    <Card className="p-6 border-slate-200 dark:border-[#383734] dark:bg-[#2c2b28] space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3.5 dark:border-[#383734]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-[#60cdff]">
            <Activity className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Today&apos;s Workday Signals by App
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
              Live signal telemetry recorded across your linked tools without opening the twin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="positive">
            🟢 {connectedTools.length > 0 ? `${connectedTools.length} Tools Linked` : "Live Telemetry Active"}
          </Badge>
        </div>
      </div>

      {/* Grid of App Activity Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {toolCards.map((tool) => (
          <div
            key={tool.id}
            className={`rounded-2xl border p-4 transition-all duration-200 hover:shadow-md ${tool.color}`}
          >
            {/* Top row: Logo + Status */}
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-[#1f1e1c] border border-slate-100 dark:border-[#383734]">
                {tool.logo}
              </div>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${tool.badgeColor}`}>
                {tool.status}
              </span>
            </div>

            {/* App Name & Category */}
            <div className="mt-3 space-y-0.5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                {tool.name}
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-[#888884]">
                {tool.category}
              </p>
            </div>

            {/* Worked Time Highlight */}
            <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-[#383734]">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-[#cfcfce]">
                  {tool.label}:
                </span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {formatHoursMinutes(tool.minutes)}
                </span>
              </div>

              <p className="mt-1 text-[10px] text-slate-400 dark:text-[#888884] leading-3.5 line-clamp-1" title={tool.detail}>
                {tool.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Workstation Desktop Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs dark:border-[#383734] dark:bg-[#1f1e1c]">
        <div className="flex items-center gap-2 text-slate-700 dark:text-[#cfcfce]">
          <Monitor className="h-4 w-4 text-sky-500" />
          <span>
            Desktop Workstation Focus Tracker: <strong>{workstationActiveMins} minutes</strong> active today
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Strict Metadata Firewall: Zero keystroke / prompt text logging</span>
        </div>
      </div>

    </Card>
  );
}
