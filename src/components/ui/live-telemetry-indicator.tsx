"use client";

import { useEffect, useState } from "react";
import { workstationTracker, type TrackerState } from "@/lib/telemetry/workstationTracker";
import { ShieldCheck, Play, Pause, Activity } from "lucide-react";

export function LiveTelemetryIndicator() {
  const [state, setState] = useState<TrackerState>({
    isRunning: false,
    isPaused: false,
    todayActiveSeconds: 0,
    todayBreaks: 0,
    lastHeartbeatSentAt: null,
    activeFocusStreakSeconds: 0,
  });

  useEffect(() => {
    // Start tracker when dashboard mounts
    workstationTracker.start();
    const unsubscribe = workstationTracker.subscribe(setState);

    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggle = () => {
    if (state.isPaused) {
      workstationTracker.resume();
    } else {
      workstationTracker.pause();
    }
  };

  const activeMinutes = Math.floor(state.todayActiveSeconds / 60);

  return (
    <div className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm dark:border-[#383734] dark:bg-[#2c2b28]/90">
      
      {/* Glowing Status Dot */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          {!state.isPaused && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              state.isPaused ? "bg-amber-400" : "bg-emerald-500"
            }`}
          />
        </span>

        <span className="font-semibold text-slate-800 dark:text-[#cfcfce]">
          {state.isPaused ? "Telemetry Paused" : "Live Stream Active"}
        </span>
      </div>

      <span className="hidden sm:inline text-slate-300 dark:text-slate-600">|</span>

      {/* Metrics Mini Indicator */}
      <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 dark:text-[#a6a6a6]">
        <Activity className="h-3 w-3 text-sky-500" />
        <span>{activeMinutes > 0 ? `${activeMinutes}m focus logged` : "Listening..."}</span>
      </div>

      {/* Privacy Icon */}
      <span title="Strictly metadata-only: zero keylogging, titles, or prompt text recorded.">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      </span>

      {/* Pause/Resume Toggle Button */}
      <button
        onClick={handleToggle}
        title={state.isPaused ? "Resume Live Telemetry" : "Pause Live Telemetry"}
        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100 dark:border-[#383734] dark:bg-[#181817] dark:text-[#cfcfce] dark:hover:bg-white/[0.08] transition"
      >
        {state.isPaused ? (
          <>
            <Play className="h-2.5 w-2.5 text-emerald-500" />
            <span>Resume</span>
          </>
        ) : (
          <>
            <Pause className="h-2.5 w-2.5 text-amber-500" />
            <span>Pause</span>
          </>
        )}
      </button>
    </div>
  );
}
