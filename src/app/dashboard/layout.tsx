"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardNav from "./DashboardNav";
import MobileNav from "./MobileNav";
import { UserHeaderButton } from "@/components/ui/user-header-button";
import { LiveTelemetryIndicator } from "@/components/ui/live-telemetry-indicator";
import { WellnessTwinLogo } from "@/components/ui/wellness-twin-logo";
import { Settings, ShieldCheck } from "lucide-react";
import { getLocalSessionUser } from "@/lib/supabase/auth";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

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
  }, [router]);

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
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white dark:border-[#383734] dark:bg-[#2c2b28] md:flex md:flex-col sticky top-0 h-screen overflow-y-auto transition-colors duration-300">
          <div className="flex h-full flex-col justify-between p-5">
            <div>
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <WellnessTwinLogo size={36} />

                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Wellness Twin
                    </p>

                    <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-[#9a9893]">
                      <ShieldCheck className="h-3 w-3 text-emerald-500" />
                      Private & Anonymized
                    </p>
                  </div>
                </div>
              </div>

              <DashboardNav />
            </div>

            <div className="mt-auto border-t border-slate-100 pt-4 dark:border-[#383734] space-y-1">
              <Link
                href="/settings"
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:text-[#a6a6a6] dark:hover:bg-[#353430] dark:hover:text-white"
              >
                <Settings className="h-4 w-4 text-slate-400 dark:text-[#9a9893]" />
                <span>Settings</span>
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="relative flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-[#383734] dark:bg-[#2c2b28] transition-colors duration-300">
            <div className="flex items-center gap-3">
              <MobileNav />

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