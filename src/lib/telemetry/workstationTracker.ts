"use client";

import { getLocalSessionUser } from "../supabase/auth";
import { saveEmployeeMetrics } from "../wellbeing/employeeMetrics";

export type TrackerState = {
  isRunning: boolean;
  isPaused: boolean;
  todayActiveSeconds: number;
  todayBreaks: number;
  lastHeartbeatSentAt: string | null;
  activeFocusStreakSeconds: number;
};

class WorkstationTrackerService {
  private isRunning = false;
  private isPaused = false;
  private timer: NodeJS.Timeout | null = null;
  private accumulatedActiveSeconds = 0;
  private lastActivityTimestamp = Date.now();
  private lastAwayTimestamp: number | null = null;
  private hasPendingBreak = false;
  private todayBreaks = 0;

  private stateListeners: Set<(state: TrackerState) => void> = new Set();

  constructor() {
    this.loadStateFromStorage();
  }

  private loadStateFromStorage() {
    if (typeof window === "undefined") return;
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const saved = localStorage.getItem("wellness-workstation-tracker-state");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.date === todayStr && typeof parsed.seconds === "number") {
          this.accumulatedActiveSeconds = parsed.seconds;
          this.todayBreaks = parsed.breaks || 0;
          if (parsed.lastActivityTimestamp) {
            this.lastActivityTimestamp = parsed.lastActivityTimestamp;
          }
          return;
        }
      }
    } catch {
      // ignore parsing error
    }
    this.accumulatedActiveSeconds = 0;
    this.todayBreaks = 0;
  }

  private saveStateToStorage() {
    if (typeof window === "undefined") return;
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      localStorage.setItem(
        "wellness-workstation-tracker-state",
        JSON.stringify({
          date: todayStr,
          seconds: this.accumulatedActiveSeconds,
          breaks: this.todayBreaks,
          lastActivityTimestamp: this.lastActivityTimestamp,
        })
      );
    } catch {
      // ignore storage error
    }
  }

  public subscribe(listener: (state: TrackerState) => void) {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private notifyListeners() {
    const state = this.getState();
    this.stateListeners.forEach((l) => l(state));
  }

  public getState(): TrackerState {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      todayActiveSeconds: this.accumulatedActiveSeconds,
      todayBreaks: this.todayBreaks + (this.hasPendingBreak ? 1 : 0),
      lastHeartbeatSentAt: new Date(this.lastActivityTimestamp).toISOString(),
      activeFocusStreakSeconds: this.accumulatedActiveSeconds,
    };
  }

  public start() {
    if (this.isRunning || typeof window === "undefined") return;

    this.loadStateFromStorage();
    this.isRunning = true;
    this.isPaused = false;
    this.lastActivityTimestamp = Date.now();

    // 1. Listen for user activity events (Strictly binary interaction timestamps - NO keylogging)
    window.addEventListener("focus", this.handleFocus);
    window.addEventListener("blur", this.handleBlur);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("pointerdown", this.handleUserPresence);
    window.addEventListener("keydown", this.handleUserPresence);

    // 2. Start regular dispatch loop
    this.timer = setInterval(() => {
      this.tickAndDispatch();
    }, 45000); // 45-second heartbeat cycle

    console.log("🟢 [WORKSTATION TRACKER]: Live telemetry heartbeat bridge activated.");
    this.notifyListeners();
  }

  public pause() {
    this.isPaused = true;
    this.notifyListeners();
  }

  public resume() {
    this.isPaused = false;
    this.lastActivityTimestamp = Date.now();
    this.notifyListeners();
  }

  public stop() {
    if (!this.isRunning || typeof window === "undefined") return;

    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);

    window.removeEventListener("focus", this.handleFocus);
    window.removeEventListener("blur", this.handleBlur);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("pointerdown", this.handleUserPresence);
    window.removeEventListener("keydown", this.handleUserPresence);

    this.notifyListeners();
  }

  private handleUserPresence = () => {
    if (this.isPaused) return;

    const now = Date.now();
    // Check if returning from a break (>= 5 minutes away)
    if (this.lastAwayTimestamp && now - this.lastAwayTimestamp >= 5 * 60 * 1000) {
      this.hasPendingBreak = true;
    }
    this.lastAwayTimestamp = null;
    this.lastActivityTimestamp = now;
  };

  private handleFocus = () => {
    this.handleUserPresence();
  };

  private handleBlur = () => {
    this.lastAwayTimestamp = Date.now();
  };

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.lastAwayTimestamp = Date.now();
    } else {
      this.handleUserPresence();
    }
  };

  private async tickAndDispatch() {
    if (!this.isRunning || this.isPaused || typeof window === "undefined") return;

    // If tab is currently hidden, skip active focus accumulation
    if (document.hidden) {
      return;
    }

    const activeChunk = 60; // 60 seconds
    this.accumulatedActiveSeconds += activeChunk;
    if (this.hasPendingBreak) {
      this.todayBreaks += 1;
    }
    this.lastActivityTimestamp = Date.now();
    this.saveStateToStorage();

    const user = getLocalSessionUser();
    const employeeId = user?.id || "usr-ronnie";
    const hour = new Date().getHours();
    const isEvening = hour >= 19 || hour < 6;

    const payload = {
      employeeId,
      organizationId: "org_acme_technologies",
      timestamp: new Date().toISOString(),
      activeSeconds: activeChunk,
      isBreak: this.hasPendingBreak,
      isEvening,
      source: "workstation",
    };

    // Reset pending break flag
    this.hasPendingBreak = false;

    try {
      const response = await fetch("/api/telemetry/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.summary?.todayMetrics) {
          saveEmployeeMetrics(data.summary.todayMetrics);
        }
        console.log("⚡ [TELEMETRY PACKET RECORDED]:", {
          activeMinutesToday: data.summary?.todayActiveMinutes ?? 0,
          breaksToday: data.summary?.todayBreakCount ?? 0,
          timestamp: payload.timestamp,
        });
        // Dispatch custom browser event for reactive UI updates
        window.dispatchEvent(
          new CustomEvent("wellness-telemetry-update", { detail: data.summary })
        );
      }
    } catch (err) {
      console.warn("[HEARTBEAT DISPATCH FAILED]:", err);
    }

    this.notifyListeners();
  }
}

export const workstationTracker = new WorkstationTrackerService();
