"use client";

import type { ThemeMode } from "../theme/themeManager";
import { getLocalSessionUser, type AuthUser } from "../supabase/auth";
import { validateTimeZone, validateWorkSchedule } from "./workSchedule";

export type TwinPersona = "supportive" | "analytical" | "minimalist";
export type NudgeSensitivity = "gentle" | "balanced" | "proactive";
export type UIDensity = "comfortable" | "compact";

export type ProfileSettings = {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  timezone: string;
};

export type AppearanceSettings = {
  themeMode: ThemeMode;
  uiDensity: UIDensity;
  highContrastIndicators: boolean;
  reducedMotion: boolean;
};

export type TwinSettings = {
  persona: TwinPersona;
  workdayStart: string; // e.g. "09:00"
  workdayEnd: string; // e.g. "18:00"
  workDays: string[]; // ["Mon", "Tue", "Wed", "Thu", "Fri"]
  maxDailyMeetingHours: number; // e.g. 4
  nudgeSensitivity: NudgeSensitivity;
  autoBaselineCalibration: boolean;
};

export type TelemetrySettings = {
  heartbeatTrackerEnabled: boolean;
  inactivityThresholdMinutes: number; // 5, 10, 15
  autoCaptureAfterHours: boolean;
  excludeWeekendActivity: boolean;
};

export type NotificationSettings = {
  eveningWarningAlerts: boolean;
  backToBackMeetingAlerts: boolean;
  microBreakReminders: boolean;
  weeklyDigestNotification: boolean;
  inAppToasts: boolean;
  soundAlerts: boolean;
};

export type UserSettingsState = {
  profile: ProfileSettings;
  appearance: AppearanceSettings;
  twin: TwinSettings;
  telemetry: TelemetrySettings;
  notifications: NotificationSettings;
};


export type UserSettingsPatch = { [K in keyof UserSettingsState]?: Partial<UserSettingsState[K]> };
export type SettingsSnapshot = { settings: UserSettingsState; status: "defaults" | "saved" | "legacy" | "invalid" | "unavailable"; error?: string };
export const DEFAULT_USER_SETTINGS: UserSettingsState = {
  profile: { fullName: "", email: "", jobTitle: "", department: "", timezone: "UTC" },
  appearance: { themeMode: "light", uiDensity: "comfortable", highContrastIndicators: false, reducedMotion: false },
  twin: { persona: "supportive", workdayStart: "09:00", workdayEnd: "18:00", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    maxDailyMeetingHours: 4, nudgeSensitivity: "balanced", autoBaselineCalibration: true },
  telemetry: { heartbeatTrackerEnabled: true, inactivityThresholdMinutes: 5, autoCaptureAfterHours: true, excludeWeekendActivity: false },
  notifications: { eveningWarningAlerts: true, backToBackMeetingAlerts: true, microBreakReminders: true,
    weeklyDigestNotification: true, inAppToasts: true, soundAlerts: false },
};
function defaults(user: AuthUser | null): UserSettingsState {
  const settings = structuredClone(DEFAULT_USER_SETTINGS);
  settings.profile.fullName = user?.fullName ?? "";
  settings.profile.email = user?.email ?? "";
  try { settings.profile.timezone = validateTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* UTC remains a valid fallback. */ }
  if (!user) settings.telemetry.heartbeatTrackerEnabled = false;
  return settings;
}
export function userSettingsKey(userId: string) { return "wellness-user-settings-v2:" + encodeURIComponent(userId); }
function session(expectedUserId?: string) {
  const user = typeof window === "undefined" ? null : getLocalSessionUser();
  if (expectedUserId !== undefined && user?.id !== expectedUserId) throw new Error("Your account changed. Reload settings before saving.");
  return user;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid settings format.");
  return value as Record<string, unknown>;
}
function normalize(raw: unknown, user: AuthUser): UserSettingsState {
  const input = object(raw), baseline = defaults(user);
  if (Object.keys(input).some(key => !Object.hasOwn(baseline, key))) throw new Error("Unknown settings section.");
  for (const section of Object.keys(input) as (keyof UserSettingsState)[]) {
    const patch = object(input[section]);
    if (Object.keys(patch).some(key => !Object.hasOwn(baseline[section], key))) throw new Error("Unknown settings field.");
  }
  const result: UserSettingsState = {
    profile: { ...baseline.profile, ...(input.profile as Partial<ProfileSettings> ?? {}) },
    appearance: { ...baseline.appearance, ...(input.appearance as Partial<AppearanceSettings> ?? {}) },
    twin: { ...baseline.twin, ...(input.twin as Partial<TwinSettings> ?? {}) },
    telemetry: { ...baseline.telemetry, ...(input.telemetry as Partial<TelemetrySettings> ?? {}) },
    notifications: { ...baseline.notifications, ...(input.notifications as Partial<NotificationSettings> ?? {}) },
  };
  for (const value of Object.values(result.profile)) if (typeof value !== "string" || value.length > 320) throw new Error("Profile preferences must be text up to 320 characters.");
  result.profile.fullName = user.fullName; result.profile.email = user.email;
  result.profile.timezone = validateTimeZone(result.profile.timezone);
  if (!["light", "dark", "system"].includes(result.appearance.themeMode) || !["comfortable", "compact"].includes(result.appearance.uiDensity) ||
      !["supportive", "analytical", "minimalist"].includes(result.twin.persona) || !["gentle", "balanced", "proactive"].includes(result.twin.nudgeSensitivity)) {
    throw new Error("Invalid preference selection.");
  }
  for (const value of [result.appearance.highContrastIndicators, result.appearance.reducedMotion, result.twin.autoBaselineCalibration,
    result.telemetry.heartbeatTrackerEnabled, result.telemetry.autoCaptureAfterHours, result.telemetry.excludeWeekendActivity, ...Object.values(result.notifications)]) {
    if (typeof value !== "boolean") throw new Error("Toggle preferences must be true or false.");
  }
  if (!Number.isFinite(result.twin.maxDailyMeetingHours) || result.twin.maxDailyMeetingHours < 0 || result.twin.maxDailyMeetingHours > 24 ||
      !Number.isInteger(result.telemetry.inactivityThresholdMinutes) || result.telemetry.inactivityThresholdMinutes < 1 || result.telemetry.inactivityThresholdMinutes > 60 ||
      !Array.isArray(result.twin.workDays)) throw new Error("Meeting limits must be 0–24 hours; inactivity must be 1–60 minutes.");
  validateWorkSchedule({ timeZone: result.profile.timezone, ...result.twin });
  return result;
}
export function getUserSettingsSnapshot(expectedUserId?: string): SettingsSnapshot {
  const user = session(expectedUserId), initial = defaults(user);
  if (!user) return { settings: initial, status: "defaults" };
  let raw: string | null;
  try {
    raw = localStorage.getItem(userSettingsKey(user.id));
    if (!raw && localStorage.getItem("wellness-user-settings-v1") !== null) {
      initial.telemetry.heartbeatTrackerEnabled = false; initial.telemetry.autoCaptureAfterHours = false;
      return { settings: initial, status: "legacy", error: "Older settings were shared across accounts. Review and save your own collection preferences; collection is paused meanwhile." };
    }
  }
  catch {
    initial.telemetry.heartbeatTrackerEnabled = false; initial.telemetry.autoCaptureAfterHours = false;
    return { settings: initial, status: "unavailable", error: "Settings could not be read. Collection is paused until your preferences can be read." };
  }
  if (!raw) return { settings: initial, status: "defaults" };
  try {
    const value = object(JSON.parse(raw));
    if (value.version !== 2 || value.userId !== user.id || Object.keys(value).some(key => !["version", "userId", "settings"].includes(key))) throw new Error("Invalid settings ownership.");
    return { settings: normalize(value.settings, user), status: "saved" };
  } catch {
    initial.telemetry.heartbeatTrackerEnabled = false; initial.telemetry.autoCaptureAfterHours = false;
    return { settings: initial, status: "invalid", error: "Saved preferences are invalid. Collection is paused; the original data remains on this device." };
  }
}
export function getUserSettings(expectedUserId?: string): UserSettingsState { return getUserSettingsSnapshot(expectedUserId).settings; }
export function saveUserSettings(patch: UserSettingsPatch, expectedUserId?: string): UserSettingsState {
  const user = session(expectedUserId);
  if (!user) throw new Error("Sign in before saving personal preferences.");
  const snapshot = getUserSettingsSnapshot(user.id);
  if (snapshot.status === "unavailable") throw new Error("Saved preferences could not be read. Changes were not saved; retry when device storage is available.");
  const current = snapshot.settings;
  const input = object(patch);
  const merged = Object.fromEntries(Object.keys(DEFAULT_USER_SETTINGS).map(section => [section, {
    ...current[section as keyof UserSettingsState], ...(input[section] === undefined ? {} : object(input[section])),
  }]));
  if (Object.keys(input).some(key => !Object.hasOwn(DEFAULT_USER_SETTINGS, key))) throw new Error("Unknown settings section.");
  const updated = normalize(merged, user);
  // A failed write throws; no success event or enabled collection can be fabricated.
  localStorage.setItem(userSettingsKey(user.id), JSON.stringify({ version: 2, userId: user.id, settings: updated }));
  window.dispatchEvent(new CustomEvent("wellness-settings-updated", { detail: { userId: user.id, settings: updated } }));
  return updated;
}
export function resetUserSettings(expectedUserId?: string): UserSettingsState {
  const user = session(expectedUserId);
  if (!user) throw new Error("Sign in before resetting personal preferences.");
  return saveUserSettings(defaults(user), user.id);
}
