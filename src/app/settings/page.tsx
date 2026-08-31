"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  User,
  Palette,
  Bot,
  Activity,
  Bell,
  ShieldCheck,
  Building2,
  Download,
  Trash2,
  Search,
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  Save,
  LogOut,
  Sliders,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getLocalSessionUser,
  saveRegisteredUser,
  setLocalSessionUser,
  signOutUser,
  type AuthUser,
} from "@/lib/supabase/auth";
import {
  getMetricsForEmployee,
  clearEmployeeMetrics,
} from "@/lib/wellbeing/employeeMetrics";
import {
  getStoredThemePreference,
  setStoredThemePreference,
  type ThemeMode,
} from "@/lib/theme/themeManager";
import {
  getUserSettings,
  saveUserSettings,
  type UserSettingsState,
  type TwinPersona,
  type NudgeSensitivity,
  type UIDensity,
} from "@/lib/settings/userSettings";
import { workstationTracker } from "@/lib/telemetry/workstationTracker";

type SettingsTab =
  | "profile"
  | "appearance"
  | "twin"
  | "telemetry"
  | "notifications"
  | "privacy"
  | "hr";

type RegisteredMember = {
  id: string;
  name: string;
  role: string;
};

const DEFAULT_MEMBERS: RegisteredMember[] = [
  { id: "emp-001", name: "Alex Morgan", role: "Frontend Developer" },
  { id: "emp-002", name: "Taylor Swift", role: "UI/UX Designer" },
  { id: "emp-003", name: "Sam Wilson", role: "DevOps Engineer" },
  { id: "emp-004", name: "Casey Brooks", role: "Fullstack Developer" },
];

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [settings, setSettings] = useState<UserSettingsState>(getUserSettings());
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTrackerRunning, setIsTrackerRunning] = useState(true);

  // Form states
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    email: "",
    jobTitle: "",
    department: "",
    timezone: "UTC+08:00 (Singapore / Manila)",
  });

  useEffect(() => {
    const user = getLocalSessionUser();
    setCurrentUser(user);

    const initialSettings = getUserSettings();
    setSettings(initialSettings);

    const currentTheme = getStoredThemePreference();
    setThemeMode(currentTheme);

    const trackerState = workstationTracker.getState();
    setIsTrackerRunning(trackerState.isRunning && !trackerState.isPaused);

    if (user) {
      setProfileForm({
        fullName: user.fullName || initialSettings.profile.fullName,
        email: user.email || initialSettings.profile.email,
        jobTitle: initialSettings.profile.jobTitle || "Senior Software Engineer",
        department: initialSettings.profile.department || "Product & Engineering",
        timezone: initialSettings.profile.timezone || "UTC+08:00 (Singapore / Manila)",
      });
    }
  }, []);

  const isHR = currentUser?.role === "hr";

  const showToast = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Profile Save
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const updatedUser: AuthUser = {
      ...currentUser,
      fullName: profileForm.fullName.trim() || currentUser.fullName,
      email: profileForm.email.trim() || currentUser.email,
    };

    saveRegisteredUser(updatedUser);
    setLocalSessionUser(updatedUser);
    setCurrentUser(updatedUser);

    saveUserSettings({
      profile: {
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        jobTitle: profileForm.jobTitle,
        department: profileForm.department,
        timezone: profileForm.timezone,
      },
    });

    window.dispatchEvent(new CustomEvent("wellness-auth-update", { detail: updatedUser }));
    showToast("Profile information updated successfully.");
  };

  // Theme Change
  const handleThemeChange = (newMode: ThemeMode) => {
    setThemeMode(newMode);
    setStoredThemePreference(newMode);
    saveUserSettings({ appearance: { ...settings.appearance, themeMode: newMode } });
    const label =
      newMode === "dark"
        ? "Dark mode activated"
        : newMode === "light"
        ? "Light mode activated"
        : "System preference synchronized";
    showToast(label);
  };

  // Appearance Options
  const handleDensityChange = (density: UIDensity) => {
    const updated = { ...settings.appearance, uiDensity: density };
    setSettings((prev) => ({ ...prev, appearance: updated }));
    saveUserSettings({ appearance: updated });
    showToast(`Interface density set to ${density}.`);
  };

  const handleToggleContrast = () => {
    const updated = {
      ...settings.appearance,
      highContrastIndicators: !settings.appearance.highContrastIndicators,
    };
    setSettings((prev) => ({ ...prev, appearance: updated }));
    saveUserSettings({ appearance: updated });
    showToast(
      updated.highContrastIndicators
        ? "High-contrast status indicators enabled."
        : "Standard status indicators restored."
    );
  };

  // Twin Settings
  const handlePersonaChange = (persona: TwinPersona) => {
    const updated = { ...settings.twin, persona };
    setSettings((prev) => ({ ...prev, twin: updated }));
    saveUserSettings({ twin: updated });
    showToast(`Twin persona updated to: ${persona.charAt(0).toUpperCase() + persona.slice(1)}.`);
  };

  const handleSensitivityChange = (nudgeSensitivity: NudgeSensitivity) => {
    const updated = { ...settings.twin, nudgeSensitivity };
    setSettings((prev) => ({ ...prev, twin: updated }));
    saveUserSettings({ twin: updated });
    showToast(`Pacing nudge sensitivity set to: ${nudgeSensitivity}.`);
  };

  const handleWorkDayToggle = (day: string) => {
    const current = settings.twin.workDays;
    const nextDays = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    const updated = { ...settings.twin, workDays: nextDays };
    setSettings((prev) => ({ ...prev, twin: updated }));
    saveUserSettings({ twin: updated });
  };

  const handleTwinScheduleChange = (field: "workdayStart" | "workdayEnd" | "maxDailyMeetingHours", value: string | number) => {
    const updated = { ...settings.twin, [field]: value };
    setSettings((prev) => ({ ...prev, twin: updated }));
    saveUserSettings({ twin: updated });
  };

  // Telemetry Tracker
  const handleToggleTracker = () => {
    if (isTrackerRunning) {
      workstationTracker.pause();
      setIsTrackerRunning(false);
      showToast("Workstation telemetry tracking paused.");
    } else {
      workstationTracker.resume();
      setIsTrackerRunning(true);
      showToast("Workstation telemetry tracking resumed.");
    }
  };

  const handleToggleTelemetrySetting = (key: keyof typeof settings.telemetry) => {
    const updated = { ...settings.telemetry, [key]: !settings.telemetry[key] };
    setSettings((prev) => ({ ...prev, telemetry: updated }));
    saveUserSettings({ telemetry: updated });
    showToast("Telemetry preference saved.");
  };

  // Notification Toggles
  const handleToggleNotification = (key: keyof typeof settings.notifications) => {
    const updated = { ...settings.notifications, [key]: !settings.notifications[key] };
    setSettings((prev) => ({ ...prev, notifications: updated }));
    saveUserSettings({ notifications: updated });
    showToast("Notification preferences updated.");
  };

  // Data Export
  const handleExportData = () => {
    const employeeId = currentUser?.id || "usr-ronnie";
    const metrics = getMetricsForEmployee(employeeId);

    const exportPayload = {
      employeeId,
      exportedAt: new Date().toISOString(),
      recordCount: metrics.length,
      baselineRequiredDays: 28,
      twinSettings: settings.twin,
      data: metrics,
    };

    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `wellness-twin-data-${employeeId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast("Personal behavioral data exported to JSON.");
  };

  // Reset Personal Baseline
  const handleResetPersonalBaseline = () => {
    const employeeId = currentUser?.id || "usr-ronnie";
    if (
      window.confirm(
        "Are you sure you want to reset your baseline? This will clear your historical observations and begin a fresh 28-day calibration cycle."
      )
    ) {
      clearEmployeeMetrics(employeeId);
      showToast("Personal baseline reset. Fresh 28-day calibration initiated.");
    }
  };

  // HR Clear Employee Baseline
  const handleClearEmployeeData = (employeeId: string, employeeName: string) => {
    const success = clearEmployeeMetrics(employeeId);
    if (success) {
      showToast(`Baseline cleared for "${employeeName}". Employee will begin a fresh calibration.`);
    } else {
      showToast(`Failed to clear baseline for ${employeeName}.`);
    }
  };

  const filteredMembers = DEFAULT_MEMBERS.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f7f8fa] py-8 sm:py-10 dark:bg-[#20201e] transition-colors duration-300">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
              <Link
                href={isHR ? "/hr" : "/dashboard"}
                className="hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                {isHR ? "HR Workforce Portal" : "Dashboard"}
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-slate-700 dark:text-slate-300">Settings</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
              Settings
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Manage your profile, theme, twin calibration, telemetry, notifications, and privacy preferences.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {isHR ? (
              <Link href="/hr">
                <Button variant="outline" className="text-xs">
                  ← Back to HR Portal
                </Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button variant="outline" className="text-xs">
                  ← Back to Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Action Message Toast */}
        {actionMessage && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 animate-in fade-in slide-in-from-top-1">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Tabbed Layout Container */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          {/* Settings Sidebar Tabs */}
          <div className="lg:col-span-3">
            <div className="flex flex-row overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0 gap-1.5 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900/90 shadow-sm">
              <TabButton
                active={activeTab === "profile"}
                onClick={() => setActiveTab("profile")}
                icon={<User className="h-4 w-4" />}
                label="Profile & Account"
              />
              <TabButton
                active={activeTab === "appearance"}
                onClick={() => setActiveTab("appearance")}
                icon={<Palette className="h-4 w-4" />}
                label="Appearance & Theme"
              />
              <TabButton
                active={activeTab === "twin"}
                onClick={() => setActiveTab("twin")}
                icon={<Bot className="h-4 w-4" />}
                label="AI Twin & Schedule"
              />
              <TabButton
                active={activeTab === "telemetry"}
                onClick={() => setActiveTab("telemetry")}
                icon={<Activity className="h-4 w-4" />}
                label="Telemetry & Sensors"
              />
              <TabButton
                active={activeTab === "notifications"}
                onClick={() => setActiveTab("notifications")}
                icon={<Bell className="h-4 w-4" />}
                label="Notifications & Alerts"
              />
              <TabButton
                active={activeTab === "privacy"}
                onClick={() => setActiveTab("privacy")}
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Privacy & Data"
              />
              {isHR && (
                <TabButton
                  active={activeTab === "hr"}
                  onClick={() => setActiveTab("hr")}
                  icon={<Building2 className="h-4 w-4" />}
                  label="HR Administration"
                  badge="Admin"
                />
              )}
            </div>

            {/* Quick Session Status Card */}
            <div className="mt-4 hidden lg:block rounded-2xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900/60">
              <p className="font-semibold text-slate-900 dark:text-slate-200">Active Identity</p>
              <p className="text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {currentUser?.email || "alex@company.com"}
              </p>
              <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800 text-[11px]">
                <span className="text-slate-400 dark:text-slate-500 capitalize">
                  Role: {currentUser?.role || "employee"}
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
              </div>
            </div>
          </div>

          {/* Settings Main Content Area */}
          <div className="lg:col-span-9 space-y-6">

            {/* =========================================================================
               TAB 1: PROFILE & ACCOUNT
               ========================================================================= */}
            {activeTab === "profile" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <Card className="p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Profile Details
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Update your employee identity and workplace metadata.
                      </p>
                    </div>
                    <Badge variant="positive">Active Session</Badge>
                  </div>

                  <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold text-white shadow-sm dark:bg-white dark:text-slate-900">
                        {profileForm.fullName ? profileForm.fullName.charAt(0).toUpperCase() : "A"}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {profileForm.fullName || "Team Member"}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Account ID: {currentUser?.id || "usr-ronnie"}
                        </p>
                        <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {currentUser?.role || "employee"}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.fullName}
                          onChange={(e) =>
                            setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))
                          }
                          required
                          className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Work Email
                        </label>
                        <input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) =>
                            setProfileForm((prev) => ({ ...prev, email: e.target.value }))
                          }
                          required
                          className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Job Title / Role
                        </label>
                        <input
                          type="text"
                          value={profileForm.jobTitle}
                          onChange={(e) =>
                            setProfileForm((prev) => ({ ...prev, jobTitle: e.target.value }))
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Department
                        </label>
                        <input
                          type="text"
                          value={profileForm.department}
                          onChange={(e) =>
                            setProfileForm((prev) => ({ ...prev, department: e.target.value }))
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Working Timezone
                        </label>
                        <input
                          type="text"
                          value={profileForm.timezone}
                          onChange={(e) =>
                            setProfileForm((prev) => ({ ...prev, timezone: e.target.value }))
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button type="submit" className="flex items-center gap-2 text-xs">
                        <Save className="h-3.5 w-3.5" />
                        Save Profile Changes
                      </Button>
                    </div>
                  </form>
                </Card>

                {/* Account Actions & Sign Out */}
                <Card className="p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Account Session Management
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Signed in as <strong className="text-slate-700 dark:text-slate-200">{currentUser?.email}</strong>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await signOutUser();
                        window.location.href = "/login";
                      }}
                      className="flex items-center gap-2 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 shrink-0"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {/* =========================================================================
               TAB 2: APPEARANCE & THEME
               ========================================================================= */}
            {activeTab === "appearance" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <Card className="p-6">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-indigo-500" />
                        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          Theme Mode
                        </h2>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Select your preferred color scheme or synchronize with your operating system.
                      </p>
                    </div>
                    <Badge variant="positive">
                      {themeMode === "dark"
                        ? "Dark Mode (Active)"
                        : themeMode === "light"
                        ? "Light Mode (Active)"
                        : "System Synchronized"}
                    </Badge>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {/* Light Theme */}
                    <button
                      type="button"
                      onClick={() => handleThemeChange("light")}
                      className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
                        themeMode === "light"
                          ? "border-slate-900 bg-slate-50 text-slate-900 shadow-sm ring-2 ring-slate-900 dark:border-white dark:bg-slate-800 dark:text-white dark:ring-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                        <Sun className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Light Theme</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">Clean & bright</p>
                      </div>
                    </button>

                    {/* Dark Theme */}
                    <button
                      type="button"
                      onClick={() => handleThemeChange("dark")}
                      className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
                        themeMode === "dark"
                          ? "border-slate-900 bg-slate-50 text-slate-900 shadow-sm ring-2 ring-slate-900 dark:border-white dark:bg-slate-800 dark:text-white dark:ring-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                        <Moon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Dark Theme</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">Warm earthy charcoal</p>
                      </div>
                    </button>

                    {/* System Theme */}
                    <button
                      type="button"
                      onClick={() => handleThemeChange("system")}
                      className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
                        themeMode === "system"
                          ? "border-slate-900 bg-slate-50 text-slate-900 shadow-sm ring-2 ring-slate-900 dark:border-white dark:bg-slate-800 dark:text-white dark:ring-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <Laptop className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">System Sync</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">Follows device OS</p>
                      </div>
                    </button>
                  </div>
                </Card>

                {/* Display & Accessibility Preferences */}
                <Card className="p-6 space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Display & Accessibility
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Fine-tune density, contrast, and motion.
                    </p>
                  </div>

                  <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
                    {/* UI Density */}
                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Interface Spacing Density
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Adjust card padding and layout spacing.
                        </p>
                      </div>
                      <div className="flex gap-1.5 rounded-xl border border-slate-200 p-1 dark:border-slate-700 dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => handleDensityChange("comfortable")}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                            settings.appearance.uiDensity === "comfortable"
                              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                          }`}
                        >
                          Comfortable
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDensityChange("compact")}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                            settings.appearance.uiDensity === "compact"
                              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                          }`}
                        >
                          Compact
                        </button>
                      </div>
                    </div>

                    {/* High Contrast */}
                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          High-Contrast Status Rings
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Emphasize score gauge borders and badge highlights.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleContrast}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          settings.appearance.highContrastIndicators
                            ? "bg-slate-900 dark:bg-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out dark:bg-slate-900 ${
                            settings.appearance.highContrastIndicators
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* =========================================================================
               TAB 3: AI TWIN & SCHEDULE
               ========================================================================= */}
            {activeTab === "twin" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* AI Companion Persona Voice */}
                <Card className="p-6">
                  <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-sky-500" />
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        AI Twin Persona & Reflection Voice
                      </h2>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Customize how your wellness twin frames daily reflections and pacing guidance.
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => handlePersonaChange("supportive")}
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        settings.twin.persona === "supportive"
                          ? "border-slate-900 bg-slate-50 text-slate-900 ring-2 ring-slate-900 dark:border-white dark:bg-slate-800 dark:text-white dark:ring-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                      }`}
                    >
                      <span className="text-xs font-bold block">Supportive & Empathetic</span>
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 leading-4">
                        Warm, encouraging reflections focusing on sustainable habits and restorative pauses.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePersonaChange("analytical")}
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        settings.twin.persona === "analytical"
                          ? "border-slate-900 bg-slate-50 text-slate-900 ring-2 ring-slate-900 dark:border-white dark:bg-slate-800 dark:text-white dark:ring-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                      }`}
                    >
                      <span className="text-xs font-bold block">Direct & Analytical</span>
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 leading-4">
                        Data-focused metrics, exact baseline shift percentages, and objective observations.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePersonaChange("minimalist")}
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        settings.twin.persona === "minimalist"
                          ? "border-slate-900 bg-slate-50 text-slate-900 ring-2 ring-slate-900 dark:border-white dark:bg-slate-800 dark:text-white dark:ring-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                      }`}
                    >
                      <span className="text-xs font-bold block">Minimalist Coach</span>
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 leading-4">
                        Succinct single-sentence takeaways. Fast check-ins without long explanations.
                      </p>
                    </button>
                  </div>
                </Card>

                {/* Workday Schedule Baseline */}
                <Card className="p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Workday Hours & Target Ceilings
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        These boundaries define after-hours activity detection and schedule density alerts.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Typical Start Time
                      </label>
                      <input
                        type="time"
                        value={settings.twin.workdayStart}
                        onChange={(e) => handleTwinScheduleChange("workdayStart", e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Typical End Time
                      </label>
                      <input
                        type="time"
                        value={settings.twin.workdayEnd}
                        onChange={(e) => handleTwinScheduleChange("workdayEnd", e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Max Meeting Target (hrs/day)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        value={settings.twin.maxDailyMeetingHours}
                        onChange={(e) =>
                          handleTwinScheduleChange("maxDailyMeetingHours", Number(e.target.value))
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Active Work Days */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Core Active Workdays
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const isSelected = settings.twin.workDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleWorkDayToggle(day)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                              isSelected
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Nudge Sensitivity */}
                  <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Pacing Intervention Sensitivity
                    </label>
                    <div className="grid grid-cols-3 gap-2 sm:w-80">
                      {(["gentle", "balanced", "proactive"] as NudgeSensitivity[]).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => handleSensitivityChange(level)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition ${
                            settings.twin.nudgeSensitivity === level
                              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* =========================================================================
               TAB 4: TELEMETRY & SENSORS
               ========================================================================= */}
            {activeTab === "telemetry" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Live Tracker Status Card */}
                <Card className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            isTrackerRunning ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                          }`}
                        />
                        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          Workstation Telemetry Sensor
                        </h2>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Zero-knowledge background heartbeat observing binary active workstation timestamps.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant={isTrackerRunning ? "outline" : "primary"}
                        onClick={handleToggleTracker}
                        className="text-xs"
                      >
                        {isTrackerRunning ? "Pause Telemetry" : "Resume Telemetry"}
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Sensor Scope Configuration */}
                <Card className="p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Telemetry Signal Scopes
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Enable or disable individual behavioral dimension signals.
                    </p>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Active Workstation Duration
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Measures continuous focused desk activity intervals.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleTelemetrySetting("heartbeatTrackerEnabled")}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          settings.telemetry.heartbeatTrackerEnabled
                            ? "bg-slate-900 dark:bg-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out dark:bg-slate-900 ${
                            settings.telemetry.heartbeatTrackerEnabled
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          After-Hours Activity Capture
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Flags activity outside established schedule to protect work-life balance.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleTelemetrySetting("autoCaptureAfterHours")}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          settings.telemetry.autoCaptureAfterHours
                            ? "bg-slate-900 dark:bg-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out dark:bg-slate-900 ${
                            settings.telemetry.autoCaptureAfterHours
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Exclude Weekend Heartbeats
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Mutes telemetry logging on non-work days.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleTelemetrySetting("excludeWeekendActivity")}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          settings.telemetry.excludeWeekendActivity
                            ? "bg-slate-900 dark:bg-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out dark:bg-slate-900 ${
                            settings.telemetry.excludeWeekendActivity
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800 flex items-center justify-between">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Manage external connectors like GitHub, Google Calendar, and Slack:
                    </p>
                    <Link href="/dashboard/integrations">
                      <Button variant="outline" className="flex items-center gap-1.5 text-xs">
                        <Layers className="h-3.5 w-3.5" />
                        <span>Connected Integrations</span>
                      </Button>
                    </Link>
                  </div>
                </Card>
              </div>
            )}

            {/* =========================================================================
               TAB 5: NOTIFICATIONS & PACING
               ========================================================================= */}
            {activeTab === "notifications" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <Card className="p-6">
                  <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-amber-500" />
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Wellbeing & Pacing Alerts
                      </h2>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Control which supportive nudges and balance summaries you receive.
                    </p>
                  </div>

                  <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="flex items-center justify-between py-3.5">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Evening / After-Hours Working Warnings
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Receive a gentle nudge when active past your configured end time.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleNotification("eveningWarningAlerts")}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          settings.notifications.eveningWarningAlerts
                            ? "bg-slate-900 dark:bg-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out dark:bg-slate-900 ${
                            settings.notifications.eveningWarningAlerts
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-3.5">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Back-to-Back Meeting Fatigue Warnings
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Alert when consecutive scheduled meetings exceed 3 hours.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleNotification("backToBackMeetingAlerts")}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          settings.notifications.backToBackMeetingAlerts
                            ? "bg-slate-900 dark:bg-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out dark:bg-slate-900 ${
                            settings.notifications.backToBackMeetingAlerts
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-3.5">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Rest Micro-Break Reminders
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Suggest a 5-minute movement or eye-rest break every 90 minutes.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleNotification("microBreakReminders")}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          settings.notifications.microBreakReminders
                            ? "bg-slate-900 dark:bg-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out dark:bg-slate-900 ${
                            settings.notifications.microBreakReminders
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-3.5">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Weekly Wellbeing Summary Digest
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Friday afternoon summary reflecting on weekly rhythm trends.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleNotification("weeklyDigestNotification")}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          settings.notifications.weeklyDigestNotification
                            ? "bg-slate-900 dark:bg-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out dark:bg-slate-900 ${
                            settings.notifications.weeklyDigestNotification
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* =========================================================================
               TAB 6: PRIVACY & DATA SOVEREIGNTY
               ========================================================================= */}
            {activeTab === "privacy" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Data Export Card */}
                <Card className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Self-Service Data Export
                      </h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        You own your behavioral data. Download your complete 28-day historical records at any time.
                      </p>
                    </div>
                    <Badge variant="positive">Employee Owned</Badge>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <Button onClick={handleExportData} className="flex items-center gap-2 text-xs">
                      <Download className="h-3.5 w-3.5" />
                      Export My Data (JSON)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleResetPersonalBaseline}
                      className="flex items-center gap-2 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Reset My Personal Baseline
                    </Button>
                  </div>
                </Card>

                {/* Transparency & Strict Prohibitions */}
                <Card className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Data Collection Transparency
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        How your AI Wellness Twin observes work patterns while preserving privacy.
                      </p>
                    </div>
                    <Badge variant="positive">Privacy-First</Badge>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        What Is Observed (Metadata Only)
                      </p>
                      <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-600 font-bold dark:text-emerald-400">✓</span> Total active workstation duration
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-600 font-bold dark:text-emerald-400">✓</span> Meeting duration & calendar load
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-600 font-bold dark:text-emerald-400">✓</span> Inactivity gaps (rest micro-breaks)
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-600 font-bold dark:text-emerald-400">✓</span> Activity outside typical hours
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 dark:border-rose-950/60 dark:bg-rose-950/20">
                      <p className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-400">
                        What Is Strictly Prohibited
                      </p>
                      <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                        <li className="flex items-center gap-2">
                          <span className="text-rose-600 font-bold dark:text-rose-400">✕</span> Keystroke logging or typing tracking
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-rose-600 font-bold dark:text-rose-400">✕</span> Screen recording or webcam capture
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-rose-600 font-bold dark:text-rose-400">✕</span> Reading email, Slack, or Discord text
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-rose-600 font-bold dark:text-rose-400">✕</span> AI prompt conversations or code diffs
                        </li>
                      </ul>
                    </div>
                  </div>
                </Card>

                {/* Privacy & k-Anonymity */}
                <Card className="p-6">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Organizational Privacy & k-Anonymity Guarantees
                    </h3>
                  </div>

                  <div className="mt-4 space-y-3 text-xs leading-5 text-slate-600 dark:text-slate-400">
                    <p>
                      <strong className="text-slate-900 dark:text-slate-200">1. Individual Confidentiality:</strong> Your personal baseline, daily scores, and reflection answers are private to you. They are never displayed on HR or managerial dashboards.
                    </p>
                    <p>
                      <strong className="text-slate-900 dark:text-slate-200">2. k-Anonymity Threshold (k ≥ 3):</strong> HR aggregate trends are only calculated for groups with at least 3 eligible members to prevent deducing any individual&apos;s state.
                    </p>
                    <p>
                      <strong className="text-slate-900 dark:text-slate-200">3. Non-Comparative Baselines:</strong> You are only evaluated against your own 28-day historical pattern, never ranked against colleagues.
                    </p>
                  </div>
                </Card>
              </div>
            )}

            {/* =========================================================================
               TAB 7: HR ADMINISTRATION (Role-guarded)
               ========================================================================= */}
            {activeTab === "hr" && isHR && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <Card className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          HR Baseline Clearance & Recalibration
                        </h2>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Clear an employee&apos;s baseline data to trigger a fresh 28-day calibration cycle. 
                        <strong className="text-slate-700 dark:text-slate-300"> Individual scores and metrics are permanently hidden from HR</strong> to protect privacy.
                      </p>
                    </div>
                    <Badge variant="positive">HR Admin</Badge>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search employee by name or ID (e.g. Alex Morgan or emp-001)..."
                        className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-4 text-xs outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/50">
                      {filteredMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3.5 text-xs">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{member.name}</p>
                            <p className="text-slate-400 dark:text-slate-500">{member.id} • {member.role}</p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-slate-400 italic dark:text-slate-500">
                              Private data hidden 🔒
                            </span>
                            <Button
                              variant="outline"
                              onClick={() => handleClearEmployeeData(member.id, member.name)}
                              className="flex items-center gap-1.5 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="h-3 w-3" />
                              Clear & Recalibrate
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
        active
          ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={active ? "text-white dark:text-slate-900" : "text-slate-400 dark:text-slate-500"}>
          {icon}
        </span>
        <span className="whitespace-nowrap">{label}</span>
      </div>
      {badge && (
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            active
              ? "bg-slate-800 text-slate-200 dark:bg-slate-100 dark:text-slate-800"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
