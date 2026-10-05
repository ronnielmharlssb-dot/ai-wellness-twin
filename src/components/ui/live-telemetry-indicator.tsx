"use client";

import { useEffect, useState } from "react";
import { workstationTracker, type TrackerState } from "@/lib/telemetry/workstationTracker";
import { getLocalSessionUser } from "@/lib/supabase/auth";
import { saveUserSettings } from "@/lib/settings/userSettings";
import { ShieldCheck, Play, Pause, Activity } from "lucide-react";

export function LiveTelemetryIndicator() {
  const [showReview, setShowReview] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
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
      workstationTracker.stop();
    };
  }, []);

  const handleToggle = () => {
    const user = getLocalSessionUser();
    if (!user || user.role !== "employee") return;
    try {
      saveUserSettings({ telemetry: { heartbeatTrackerEnabled: state.isPaused } }, user.id);
      setControlError(null);
    } catch { setControlError("Collection preference could not be saved. Its previous state remains active."); }
  };

  const activeMinutes = Math.floor(state.todayActiveSeconds / 60);
  const downloadRejected = () => {
    const records = workstationTracker.getRejectedObservations();
    if (!records.length) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "wellness-observations-for-review.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  const status = state.isPaused ? "Telemetry Paused"
    : state.memoryOnlyEvents ? `${state.memoryOnlyEvents} Memory Only`
    : state.error && state.pendingEvents ? "Upload Pending"
    : state.error ? "Device Storage Issue"
    : !state.isRunning ? "Tracker Inactive"
    : state.pendingEvents ? `${state.pendingEvents} Pending`
    : state.rejectedEvents ? `${state.rejectedEvents} Need Review`
    : state.lastHeartbeatSentAt ? "Browser Activity Saved" : "Waiting for Activity";

  return (
    <div className="relative flex items-center gap-2.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm dark:border-[#383734] dark:bg-[#2c2b28]/90">
      
      {/* Glowing Status Dot */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          {!state.isPaused && state.isRunning && !state.error && !state.rejectedEvents && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              state.isPaused || state.error || state.rejectedEvents ? "bg-amber-400" : state.lastHeartbeatSentAt ? "bg-emerald-500" : "bg-slate-400"
            }`}
          />
        </span>

        <span className="font-semibold text-slate-800 dark:text-[#cfcfce]">
          {status}
        </span>
      </div>
      {controlError && <span role="alert" className="max-w-56 text-[10px] text-amber-700 dark:text-amber-300">{controlError}</span>}
      {state.error && <span role="status" className="max-w-48 text-[10px] text-amber-700 dark:text-amber-300" title={state.error}>
        {state.memoryOnlyEvents ? "Keep this page open to retry" : state.pendingEvents ? "Upload needs retry" : "Device storage needs attention"}
      </span>}
      {!!state.pendingEvents && !state.isPaused && <button onClick={() => { void workstationTracker.retryPendingObservations(); }} className="text-[10px] font-semibold text-sky-700 dark:text-sky-300">Retry uploads</button>}

      <span className="hidden sm:inline text-slate-300 dark:text-slate-600">|</span>

      {/* Metrics Mini Indicator */}
      <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 dark:text-[#a6a6a6]">
        <Activity className="h-3 w-3 text-sky-500" />
        <span>{activeMinutes > 0 ? `${activeMinutes}m browser activity` : "Listening..."}</span>
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
      {!!state.rejectedEvents && <button onClick={() => setShowReview(!showReview)} aria-expanded={showReview} className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Review</button>}
      {showReview && !!state.rejectedEvents && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-amber-200 bg-white p-4 text-xs text-slate-700 shadow-lg dark:border-amber-900 dark:bg-[#2c2b28] dark:text-slate-200">
          <p>{state.rejectedEvents} observations could not be uploaded. Expired, invalid or conflicting packets are retained on this device for review. Fresh observations can still upload.</p>
          <button onClick={downloadRejected} className="mt-3 font-semibold text-sky-700 dark:text-sky-300">Download retained observations</button>
        </div>
      )}
    </div>
  );
}
