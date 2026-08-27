"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Download, Trash2, Search, ShieldCheck, Sun, Moon, Laptop, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLocalSessionUser, type AuthUser } from "@/lib/supabase/auth";
import {
  getMetricsForEmployee,
  clearEmployeeMetrics,
} from "@/lib/wellbeing/employeeMetrics";
import {
  getStoredThemePreference,
  setStoredThemePreference,
  type ThemeMode,
} from "@/lib/theme/themeManager";

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

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const user = getLocalSessionUser();
    setCurrentUser(user);
    const currentTheme = getStoredThemePreference();
    setThemeMode(currentTheme);
  }, []);

  const isHR = currentUser?.role === "hr";

  const handleThemeChange = (newMode: ThemeMode) => {
    setThemeMode(newMode);
    setStoredThemePreference(newMode);
    const label = newMode === "dark" ? "Dark mode activated" : newMode === "light" ? "Light mode activated" : "System preference synced";
    setActionMessage(label);
    setTimeout(() => setActionMessage(""), 3000);
  };

  // Employee: Export Personal Data
  const handleExportData = () => {
    const employeeId = currentUser?.id || "emp-001";
    const metrics = getMetricsForEmployee(employeeId);

    const exportPayload = {
      employeeId,
      exportedAt: new Date().toISOString(),
      recordCount: metrics.length,
      baselineRequiredDays: 28,
      data: metrics,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `wellness-twin-data-${employeeId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setActionMessage("Your personal behavioral records were successfully exported to JSON.");
    setTimeout(() => setActionMessage(""), 4000);
  };

  // HR: Clear Employee Baseline Data (without viewing individual scores)
  const handleClearEmployeeData = (employeeId: string, employeeName: string) => {
    const success = clearEmployeeMetrics(employeeId);
    if (success) {
      setActionMessage(`Baseline data for "${employeeName}" (${employeeId}) has been cleared. The employee will begin a fresh 28-day calibration.`);
    } else {
      setActionMessage(`Failed to clear data for ${employeeName}.`);
    }
    setTimeout(() => setActionMessage(""), 5000);
  };

  const filteredMembers = DEFAULT_MEMBERS.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f7f8fa] py-10 dark:bg-[#20201e] transition-colors duration-300">
      <div className="mx-auto max-w-4xl space-y-8 px-4 sm:px-6">
        
        {/* Navigation back */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Preferences & Governance
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
              Settings & Customization
            </h1>
          </div>

          <div className="flex gap-3">
            {isHR ? (
              <Link href="/hr">
                <Button variant="outline" className="text-xs">
                  HR Portal
                </Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button variant="outline" className="text-xs">
                  Dashboard Overview
                </Button>
              </Link>
            )}
          </div>
        </div>

        {actionMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            ✓ {actionMessage}
          </div>
        )}

        {/* Appearance & Theme Preference Section */}
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-indigo-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Appearance & Theme
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Choose your preferred interface theme or synchronize with your operating system.
              </p>
            </div>
            <Badge variant="positive">
              {themeMode === "dark" ? "Dark Mode (On)" : themeMode === "light" ? "Light Mode (Off)" : "System Match"}
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

        {/* Self-Service Data Management */}
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Self-Service Personal Data Export
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                You own your behavioral data. Download your complete 28-day historical signal records at any time.
              </p>
            </div>
            <Badge variant="positive">Employee Owned</Badge>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button onClick={handleExportData} className="flex items-center gap-2 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export My Data (JSON)
            </Button>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Includes active minutes, meeting load, and rest pause counts.
            </p>
          </div>
        </Card>

        {/* HR Administrative Employee Data Clearance (STRICTLY ROLE-GUARDED TO HR ONLY) */}
        {isHR && (
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    HR Employee Data Clearance & Recalibration
                  </h2>
                  <Badge variant="positive">
                    HR Admin Mode Active
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  HR administrators can clear an employee&apos;s baseline data to trigger a fresh 28-day calibration. 
                  <strong className="text-slate-700 dark:text-slate-300"> Individual scores and metrics are permanently hidden from HR</strong> to protect privacy.
                </p>
              </div>
            </div>

            {/* Search box */}
            <div className="mt-5 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search employee by name or ID (e.g. Alex Morgan or emp-001)..."
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-4 text-xs outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
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
        )}

        {/* Data Transparency & Prohibited Data */}
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Data Collection Transparency
              </h2>
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
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Organizational Privacy & k-Anonymity Guarantees
            </h2>
          </div>

          <div className="mt-4 space-y-3 text-xs leading-5 text-slate-600 dark:text-slate-400">
            <p>
              <strong className="text-slate-900 dark:text-slate-200">1. Individual Confidentiality:</strong> Your personal behavioral baseline, daily scores, and reflection answers are private to you. They are never displayed on HR or managerial dashboards.
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
    </div>
  );
}
