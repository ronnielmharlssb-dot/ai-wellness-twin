"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HRNav from "./HRNav";
import { UserHeaderButton } from "@/components/ui/user-header-button";
import { WellnessTwinLogo } from "@/components/ui/wellness-twin-logo";
import { Settings, ShieldCheck, Building2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { getOrganizations, type Organization } from "@/lib/organizations/organizationManager";
import { getLocalSessionUser } from "@/lib/supabase/auth";

const HR_SIDEBAR_COLLAPSED_KEY = "wellness-hr-sidebar-collapsed";

export default function HRLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const user = getLocalSessionUser();
    if (!user) {
      setIsAuthorized(false);
      router.replace("/login");
      return;
    }
    if (user.role !== "hr") {
      setIsAuthorized(false);
      router.replace("/dashboard");
      return;
    }
    setIsAuthorized(true);
    const orgs = getOrganizations();
    if (orgs.length > 0) {
      setActiveOrg(orgs[0]);
    }

    // Load saved collapsed state
    try {
      const saved = localStorage.getItem(HR_SIDEBAR_COLLAPSED_KEY);
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
        localStorage.setItem(HR_SIDEBAR_COLLAPSED_KEY, String(next));
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
          <p className="text-xs font-semibold text-slate-400">Verifying HR authorization...</p>
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
              {/* Header Brand */}
              <div className="mb-6 flex items-center justify-between">
                <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? "justify-center w-full" : ""}`}>
                  <Link href="/hr" className="shrink-0" title="HR Workforce Portal">
                    <WellnessTwinLogo size={34} />
                  </Link>

                  {!isCollapsed && (
                    <div className="min-w-0 transition-opacity duration-200">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        Wellness Twin
                      </p>

                      <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-[#9a9893] truncate">
                        <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                        HR Workforce Portal
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

              {/* Verified Organization Tag */}
              {!isCollapsed && activeOrg && (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[11px] dark:border-emerald-950/60 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span className="font-bold text-emerald-900 dark:text-emerald-300 truncate">
                      {activeOrg.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 ml-1">
                    ✓ Verified
                  </span>
                </div>
              )}

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

              <HRNav collapsed={isCollapsed} />
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
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-[#383734] dark:bg-[#2c2b28] transition-colors duration-300">
            <div className="flex items-center gap-3">
              {/* Desktop Quick Toggle Icon in Top Header */}
              <button
                type="button"
                onClick={toggleSidebar}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden md:flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#383734] dark:hover:text-slate-200 transition-colors"
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>

              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Workforce Aggregate Portal
              </p>
            </div>

            <UserHeaderButton defaultRole="hr" />
          </header>

          <main className="p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}