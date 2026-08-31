"use client";

import type { ThemeMode } from "../theme/themeManager";

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

const SETTINGS_STORAGE_KEY = "wellness-user-settings-v1";

export const DEFAULT_USER_SETTINGS: UserSettingsState = {
  profile: {
    fullName: "Ronnie",
    email: "ronnie@company.com",
    jobTitle: "Senior Software Engineer",
    department: "Product & Engineering",
    timezone: "UTC+08:00 (Singapore / Manila)",
  },
  appearance: {
    themeMode: "dark",
    uiDensity: "comfortable",
    highContrastIndicators: false,
    reducedMotion: false,
  },
  twin: {
    persona: "supportive",
    workdayStart: "09:00",
    workdayEnd: "18:00",
    workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    maxDailyMeetingHours: 4,
    nudgeSensitivity: "balanced",
    autoBaselineCalibration: true,
  },
  telemetry: {
    heartbeatTrackerEnabled: true,
    inactivityThresholdMinutes: 5,
    autoCaptureAfterHours: true,
    excludeWeekendActivity: false,
  },
  notifications: {
    eveningWarningAlerts: true,
    backToBackMeetingAlerts: true,
    microBreakReminders: true,
    weeklyDigestNotification: true,
    inAppToasts: true,
    soundAlerts: false,
  },
};

export function getUserSettings(): UserSettingsState {
  if (typeof window === "undefined") {
    return DEFAULT_USER_SETTINGS;
  }

  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!saved) {
      return DEFAULT_USER_SETTINGS;
    }
    const parsed = JSON.parse(saved);
    return {
      profile: { ...DEFAULT_USER_SETTINGS.profile, ...parsed.profile },
      appearance: { ...DEFAULT_USER_SETTINGS.appearance, ...parsed.appearance },
      twin: { ...DEFAULT_USER_SETTINGS.twin, ...parsed.twin },
      telemetry: { ...DEFAULT_USER_SETTINGS.telemetry, ...parsed.telemetry },
      notifications: { ...DEFAULT_USER_SETTINGS.notifications, ...parsed.notifications },
    };
  } catch (err) {
    console.error("Failed to load user settings:", err);
    return DEFAULT_USER_SETTINGS;
  }
}

export function saveUserSettings(settings: Partial<UserSettingsState>): UserSettingsState {
  if (typeof window === "undefined") {
    return DEFAULT_USER_SETTINGS;
  }

  try {
    const current = getUserSettings();
    const updated: UserSettingsState = {
      profile: { ...current.profile, ...(settings.profile || {}) },
      appearance: { ...current.appearance, ...(settings.appearance || {}) },
      twin: { ...current.twin, ...(settings.twin || {}) },
      telemetry: { ...current.telemetry, ...(settings.telemetry || {}) },
      notifications: { ...current.notifications, ...(settings.notifications || {}) },
    };

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("wellness-settings-updated", { detail: updated }));
    return updated;
  } catch (err) {
    console.error("Failed to save user settings:", err);
    return DEFAULT_USER_SETTINGS;
  }
}

export function resetUserSettings(): UserSettingsState {
  if (typeof window === "undefined") {
    return DEFAULT_USER_SETTINGS;
  }

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_USER_SETTINGS));
    window.dispatchEvent(new CustomEvent("wellness-settings-updated", { detail: DEFAULT_USER_SETTINGS }));
    return DEFAULT_USER_SETTINGS;
  } catch (err) {
    console.error("Failed to reset user settings:", err);
    return DEFAULT_USER_SETTINGS;
  }
}
