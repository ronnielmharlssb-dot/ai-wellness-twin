"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ShieldCheck, Monitor, ArrowRight } from "lucide-react";
import { VSCodeLogo, GeminiLogo, CalendarLogo, SlackLogo, GitHubLogo, ChatGPTLogo, ClaudeLogo, FigmaLogo, DiscordLogo } from "@/components/ui/brand-logos";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMetricsForEmployee } from "@/lib/wellbeing/employeeMetrics";
import { getStoredIntegrations } from "@/lib/integrations/syncEngine";
import { workstationTracker, type TrackerState } from "@/lib/telemetry/workstationTracker";

const TOOLS = [
  { id: "github", name: "GitHub", logo: GitHubLogo, source: "github", detail: "Public commit and PR events; coding duration is unknown." },
  { id: "vscode", name: "Visual Studio Code", logo: VSCodeLogo, source: "vscode", detail: "Duration requires an editor activity collector." },
  { id: "chatgpt", name: "ChatGPT", logo: ChatGPTLogo, source: "chatgpt", detail: "Duration requires an assistant activity collector." },
  { id: "gemini", name: "Google Gemini", logo: GeminiLogo, source: "gemini", detail: "Duration requires an assistant activity collector." },
  { id: "claude", name: "Claude", logo: ClaudeLogo, source: "claude", detail: "Duration requires an assistant activity collector." },
  { id: "google_calendar", name: "Google Calendar / Outlook", logo: CalendarLogo, source: "calendar", detail: "Scheduled meeting blocks; attendance and focus are unknown." },
  { id: "figma", name: "Figma", logo: FigmaLogo, source: "figma", detail: "Duration requires a design activity collector." },
  { id: "slack", name: "Slack", logo: SlackLogo, source: "slack", detail: "Duration requires a messaging activity collector." },
  { id: "discord", name: "Discord", logo: DiscordLogo, source: "discord", detail: "Duration requires a messaging activity collector." },
] as const;

export function ToolActivityBreakdown({ employeeId }: { employeeId: string }) {
  const [, setRevision] = useState(0);
  const [tracker, setTracker] = useState<TrackerState>(workstationTracker.getState());
  useEffect(() => {
    const unsubscribe = workstationTracker.subscribe(setTracker);
    const update = () => setRevision((revision) => revision + 1);
    window.addEventListener("wellness-telemetry-update", update);
    window.addEventListener("storage", update);
    return () => {
      unsubscribe();
      window.removeEventListener("wellness-telemetry-update", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  const metric = getMetricsForEmployee(employeeId).find((item) => item.date === new Date().toISOString().slice(0, 10));
  const connected = getStoredIntegrations(employeeId).filter((item) => item.connected);
  const minutes = metric?.toolActiveMinutes ?? {};
  const duration = (value: number) => value < 60 ? `${Math.round(value)}m` : `${(value / 60).toFixed(1)}h`;
  return (
    <Card className="space-y-5 border-slate-200 p-6 dark:border-[#383734] dark:bg-[#2c2b28]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5 dark:border-[#383734]">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><Activity className="h-4 w-4 text-sky-500" />Today&apos;s Workday Signals by App</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#a6a6a6]">Measured activity and imported calendar blocks. Times are grouped by UTC date.</p>
        </div>
        <Badge variant="neutral">{connected.length} of 9 tools linked</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => {
          const linked = connected.some((item) => item.provider === tool.id);
          const reported = tool.id === "github" ? metric?.githubEventCount !== undefined
            : tool.id === "google_calendar" ? metric?.observedMetrics?.includes("meetingLoad")
            : minutes[tool.source] !== undefined || (tool.id === "vscode" && minutes.ide !== undefined);
          const value = tool.id === "github" ? `${metric?.githubEventCount ?? 0} events`
            : tool.id === "google_calendar" ? duration((metric?.meetingLoad ?? 0) * 60)
            : duration(minutes[tool.source] ?? (tool.id === "vscode" ? minutes.ide ?? 0 : 0));
          const Logo = tool.logo;
          return (
            <div key={tool.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-[#383734] dark:bg-[#1f1e1c]">
              <div className="flex items-center justify-between gap-2">
                <Logo className="h-6 w-6" />
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{reported ? "Data recorded" : linked ? "Awaiting data" : "Not linked"}</span>
              </div>
              <h4 className="mt-3 text-xs font-bold text-slate-900 dark:text-white">{tool.name}</h4>
              <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-slate-200/60 pt-2 dark:border-[#383734]">
                <span className="text-[11px] text-slate-600 dark:text-[#cfcfce]">{tool.id === "github" ? "Public activity" : tool.id === "google_calendar" ? "Scheduled meetings" : "Measured duration"}</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{reported ? value : "No data"}</span>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-slate-500 dark:text-[#888884]">{tool.detail}</p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs dark:bg-[#1f1e1c]">
        <span className="flex items-center gap-2 text-slate-700 dark:text-[#cfcfce]"><Monitor className="h-4 w-4 text-sky-500" />Browser focus saved: <strong>{duration(tracker.todayActiveSeconds / 60)}</strong>{tracker.pendingEvents ? ` · ${tracker.pendingEvents} pending uploads` : ""}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-3.5 w-3.5" />No keystroke or prompt contents recorded</span>
      </div>
      <Link href="/dashboard/integrations" className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-[#60cdff]">Manage integrations<ArrowRight className="h-3.5 w-3.5" /></Link>
    </Card>
  );
}
