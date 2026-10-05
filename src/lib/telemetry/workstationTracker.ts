"use client";

import { getLocalSessionUser } from "../supabase/auth";
import { getMetricsForEmployee } from "../wellbeing/employeeMetrics";
import { getUserSettings, userSettingsKey, type UserSettingsState } from "../settings/userSettings";
import { workSchedulePosition } from "../settings/workSchedule";
import { HeartbeatQueueService } from "./heartbeatQueue";
import type { RejectedObservation } from "./pendingObservations";

export type TrackerState = {
  isRunning: boolean;
  isPaused: boolean;
  todayActiveSeconds: number;
  todayBreaks: number;
  lastHeartbeatSentAt: string | null;
  activeFocusStreakSeconds: number;
  pendingEvents?: number;
  rejectedEvents?: number;
  memoryOnlyEvents?: number;
  error?: string | null;
};

export class WorkstationTrackerService {
  private isRunning = false;
  private isPaused = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private employeeId = "";
  private lastSample = 0;
  private lastPresence = 0;
  private awaySince: number | null = null;
  private focused = false;
  private focusStreak = 0;
  private uploads = new HeartbeatQueueService();
  private settings: UserSettingsState | null = null;
  private stateListeners = new Set<(state: TrackerState) => void>();

  constructor() { this.uploads.subscribe(() => this.notifyListeners()); }
  public subscribe(listener: (state: TrackerState) => void) {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => { this.stateListeners.delete(listener); };
  }
  private notifyListeners() {
    const state = this.getState();
    this.stateListeners.forEach((listener) => listener(state));
  }
  public getState(): TrackerState {
    const date = new Date().toISOString().slice(0, 10);
    const user = getLocalSessionUser();
    const metric = user?.id === this.employeeId && user.role === "employee"
      ? getMetricsForEmployee(this.employeeId).find((item) => item.date === date) : undefined;
    return {
      isRunning: this.isRunning, isPaused: this.isPaused,
      // Show acknowledged observations; pending packets have a separate status.
      todayActiveSeconds: (metric?.toolActiveMinutes?.workstation ?? 0) * 60,
      todayBreaks: metric?.contributions?.telemetry?.breakFrequency ?? 0,
      lastHeartbeatSentAt: this.uploads.getState().lastHeartbeat,
      activeFocusStreakSeconds: this.focusStreak,
      pendingEvents: this.uploads.getState().pendingEvents, rejectedEvents: this.uploads.getState().rejectedEvents,
      memoryOnlyEvents: this.uploads.getState().memoryOnlyEvents, error: this.uploads.getState().error,
    };
  }
  public start() {
    if (this.isRunning || typeof window === "undefined") return;
    const user = getLocalSessionUser();
    if (!user || user.role !== "employee" || user.id === "usr-demo-calibrated") return;
    this.employeeId = user.id;
    this.isRunning = true;
    this.settings = structuredClone(getUserSettings(user.id));
    this.isPaused = !this.settings.telemetry.heartbeatTrackerEnabled;
    this.uploads.start(user.id, this.isPaused);
    this.lastSample = this.lastPresence = Date.now();
    this.focused = !document.hidden && document.hasFocus();
    this.awaySince = null;
    this.focusStreak = 0;
    window.addEventListener("focus", this.handleFocus);
    window.addEventListener("blur", this.handleBlur);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("pointerdown", this.handlePresence);
    window.addEventListener("pointermove", this.handlePresence);
    window.addEventListener("keydown", this.handlePresence);
    window.addEventListener("wellness-settings-updated", this.handleSettings);
    window.addEventListener("wellness-auth-update", this.handleAuthUpdate);
    window.addEventListener("storage", this.handleStorage);
    this.timer = setInterval(() => this.tickAndDispatch(), 45000);
    if (!this.isPaused) void this.uploads.flush();
    this.notifyListeners();
  }
  public pause() {
    this.captureUntil(Date.now());
    this.isPaused = true;
    this.uploads.setPaused(true);
    this.focusStreak = 0;
    this.notifyListeners();
  }
  public resume() {
    if (!this.isRunning) this.start();
    if (!getUserSettings().telemetry.heartbeatTrackerEnabled) return;
    this.isPaused = false;
    this.uploads.setPaused(false);
    this.lastSample = this.lastPresence = Date.now();
    this.focused = !document.hidden && document.hasFocus();
    this.awaySince = null;
    void this.uploads.flush();
    this.notifyListeners();
  }
  public stop() {
    if (!this.isRunning) return;
    this.captureUntil(Date.now());
    this.isRunning = false;
    this.focusStreak = 0;
    this.uploads.stop();
    if (this.timer) clearInterval(this.timer);
    window.removeEventListener("focus", this.handleFocus);
    window.removeEventListener("blur", this.handleBlur);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("pointerdown", this.handlePresence);
    window.removeEventListener("pointermove", this.handlePresence);
    window.removeEventListener("keydown", this.handlePresence);
    window.removeEventListener("wellness-settings-updated", this.handleSettings);
    window.removeEventListener("wellness-auth-update", this.handleAuthUpdate);
    window.removeEventListener("storage", this.handleStorage);
    this.notifyListeners();
  }
  public getRejectedObservations(): RejectedObservation[] { return this.uploads.getRejectedObservations(); }
  public flushPendingObservations(): Promise<void> { return this.uploads.flush(); }
  public retryPendingObservations(): Promise<void> { return this.uploads.retry(); }
  private enqueue(end: number, activeSeconds: number, isBreak: boolean) {
    const settings = this.settings!;
    const position = workSchedulePosition(isBreak ? end : end - 1, { timeZone: settings.profile.timezone, ...settings.twin });
    if (settings.telemetry.excludeWeekendActivity && !position.scheduledDay) return;
    this.uploads.enqueue({
      eventId: crypto.randomUUID(), employeeId: this.employeeId,
      // Personal scope until organization membership is verified by server authentication.
      organizationId: `personal:${this.employeeId}`,
      timestamp: new Date(end).toISOString(), activeSeconds, isBreak,
      isEvening: settings.telemetry.autoCaptureAfterHours && !position.inWorkHours,
      afterHoursObserved: settings.telemetry.autoCaptureAfterHours,
      meetingMinutes: 0, source: "workstation",
    });
  }
  private captureUntil(now: number) {
    const start = this.lastSample;
    this.lastSample = now;
    if (!this.isRunning || this.isPaused || !this.focused || !start || now <= start) return;
    if (getLocalSessionUser()?.role !== "employee" || getLocalSessionUser()?.id !== this.employeeId) return;
    // A suspended/throttled browser cannot establish presence during a long gap.
    if (now - start > 90000) { this.focusStreak = 0; return; }
    const settings = this.settings!;
    if (!settings.telemetry.heartbeatTrackerEnabled) return;
    const idleMs = Math.max(1, settings.telemetry.inactivityThresholdMinutes) * 60000;
    const end = Math.min(now, this.lastPresence + idleMs);
    let cursor = start;
    // Split at minute boundaries so schedule changes and midnight use the correct interval.
    while (cursor < end) {
      const segmentEnd = Math.min(end, (Math.floor(cursor / 60000) + 1) * 60000);
      const duration = (segmentEnd - cursor) / 1000;
      this.enqueue(segmentEnd, duration, false);
      this.focusStreak += duration;
      cursor = segmentEnd;
    }
    if (now > end) { this.awaySince ??= end; this.focusStreak = 0; }
  }
  private handlePresence = () => {
    if (!this.isRunning || this.isPaused) return;
    const now = Date.now();
    const idleMs = Math.max(1, this.settings!.telemetry.inactivityThresholdMinutes) * 60000;
    const returning = this.awaySince !== null || now - this.lastPresence >= idleMs;
    // Frequent pointer events prove continuing presence; they do not each need a
    // packet. Close a previous interval only when returning after an idle/away gap.
    if (returning) this.captureUntil(now);
    const awaySince = this.awaySince ?? this.lastPresence;
    if (now - awaySince >= idleMs) this.enqueue(now, 0, true);
    this.awaySince = null;
    this.lastPresence = now;
    if (returning) this.lastSample = now;
  };
  private handleFocus = () => {
    this.handlePresence();
    this.focused = !document.hidden;
  };
  private handleBlur = () => {
    this.captureUntil(Date.now());
    this.focused = false;
    this.awaySince ??= Date.now();
    this.focusStreak = 0;
  };
  private handleVisibilityChange = () => {
    if (document.hidden) this.handleBlur();
    else if (document.hasFocus()) this.handleFocus();
  };
  private handleSettings = () => {
    if (!this.isRunning || getLocalSessionUser()?.id !== this.employeeId || getLocalSessionUser()?.role !== "employee") return;
    // Finish the preceding interval under its original preferences.
    this.captureUntil(Date.now());
    this.settings = structuredClone(getUserSettings(this.employeeId));
    if (this.settings.telemetry.heartbeatTrackerEnabled) this.resume();
    else this.pause();
  };
  private handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === "wellness-auth-user") this.handleAuthUpdate();
    if (!event.key || event.key === userSettingsKey(this.employeeId)) this.handleSettings();
  };
  private handleAuthUpdate = () => {
    if (getLocalSessionUser()?.role !== "employee" || getLocalSessionUser()?.id !== this.employeeId) this.stop();
  };
  private async tickAndDispatch() {
    if (!this.isRunning) return;
    if (getLocalSessionUser()?.role !== "employee" || getLocalSessionUser()?.id !== this.employeeId) { this.stop(); return; }
    const latest = getUserSettings(this.employeeId);
    const fingerprint = (settings: UserSettingsState) => JSON.stringify({ timezone: settings.profile.timezone,
      start: settings.twin.workdayStart, end: settings.twin.workdayEnd, days: settings.twin.workDays, telemetry: settings.telemetry });
    if (fingerprint(latest) !== fingerprint(this.settings!)) {
      // A missed cross-tab change has no reliable transition time. Drop the open
      // interval rather than collecting through an unknown pause or schedule change.
      this.settings = structuredClone(latest);
      this.lastSample = this.lastPresence = Date.now(); this.focusStreak = 0;
      this.isPaused = !latest.telemetry.heartbeatTrackerEnabled;
      this.uploads.setPaused(this.isPaused);
    }
    if (this.isPaused) { this.notifyListeners(); return; }
    this.captureUntil(Date.now());
    await this.uploads.flush();
    this.notifyListeners();
  }
}
export const workstationTracker = new WorkstationTrackerService();
