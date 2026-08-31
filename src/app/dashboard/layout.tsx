"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardNav from "./DashboardNav";
import MobileNav from "./MobileNav";
import { UserHeaderButton } from "@/components/ui/user-header-button";
import { LiveTelemetryIndicator } from "@/components/ui/live-telemetry-indicator";
import { WellnessTwinLogo } from "@/components/ui/wellness-twin-logo";
import { Settings, ShieldCheck, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { getLocalSessionUser } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";

const SIDEBAR_COLLAPSED_KEY = "wellness-sidebar-collapsed";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const user = getLocalSessionUser();
    if (!user) {
      setIsAuthorized(false);
      router.replace("/login");
      return;
    }
    if (user.role === "hr") {
      setIsAuthorized(false);
      router.replace("/hr");
      return;
    }
    setIsAuthorized(true);

    // Load saved collapsed state
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // ignore
    }
  }, [router]);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] dark:bg-[#20201e]">
        <div className="flex flex-col items-center gap-3">
          <WellnessTwinLogo size={40} />
          <p className="text-xs font-semibold text-slate-400">Loading your wellness twin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] dark:bg-[#20201e] transition-colors duration-300">
      <div className="flex min-h-screen">
        {/* Collapsible Desktop Sidebar */}
        <aside
          className={`hidden shrink-0 border-r border-slate-200 bg-white dark:border-[#383734] dark:bg-[#2c2b28] md:flex md:flex-col sticky top-0 h-screen overflow-y-auto transition-all duration-300 ease-in-out ${
            isCollapsed ? "w-[72px]" : "w-64"
          }`}
        >
          <div className="flex h-full flex-col justify-between p-3.5">
            <div>
              {/* Brand & Collapse Toggle */}
              <div className="mb-6 flex items-center justify-between">
                <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? "justify-center w-full" : ""}`}>
                  <Link href="/dashboard" className="shrink-0" title="Wellness Twin Dashboard">
                    <WellnessTwinLogo size={34} />
                  </Link>

                  {!isCollapsed && (
                    <div className="min-w-0 transition-opacity duration-200">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        Wellness Twin
                      </p>

                      <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-[#9a9893] truncate">
                        <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                        Private & Anonymized
                      </p>
                    </div>
                  )}
                </div>

                {!isCollapsed && (
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    title="Collapse sidebar"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#383734] dark:hover:text-slate-200 transition-colors shrink-0"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Collapsed Expand Trigger Button */}
              {isCollapsed && (
                <div className="mb-4 flex justify-center">
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    title="Expand sidebar"
                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#383734] dark:hover:text-slate-200 transition-colors"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Navigation Items */}
              <DashboardNav collapsed={isCollapsed} />
            </div>

            {/* Bottom Settings Link */}
            <div className="mt-auto border-t border-slate-100 pt-3 dark:border-[#383734]">
              <Link
                href="/settings"
                title={isCollapsed ? "Settings" : undefined}
                className={`flex items-center rounded-xl text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:text-[#a6a6a6] dark:hover:bg-[#353430] dark:hover:text-white ${
                  isCollapsed ? "h-11 w-11 justify-center mx-auto" : "gap-3 px-3 py-2.5"
                }`}
              >
                <Settings className="h-4 w-4 text-slate-400 dark:text-[#9a9893] shrink-0" />
                {!isCollapsed && <span>Settings</span>}
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="min-w-0 flex-1">
          <header className="relative flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-[#383734] dark:bg-[#2c2b28] transition-colors duration-300">
            <div className="flex items-center gap-3">
              <MobileNav />

              {/* Desktop Quick Toggle Icon in Top Header */}
              <button
                type="button"
                onClick={toggleSidebar}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden md:flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#383734] dark:hover:text-slate-200 transition-colors"
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4 text-sky-600 dark:text-[#60cdff]" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>

              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Personal Wellbeing Dashboard
              </p>
            </div>

            <div className="flex items-center gap-3">
              <LiveTelemetryIndicator />
              <UserHeaderButton defaultRole="employee" />
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}