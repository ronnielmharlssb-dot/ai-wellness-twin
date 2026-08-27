"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HRNav from "./HRNav";
import { UserHeaderButton } from "@/components/ui/user-header-button";
import { WellnessTwinLogo } from "@/components/ui/wellness-twin-logo";
import { Settings, ShieldCheck, Building2 } from "lucide-react";
import { getOrganizations, type Organization } from "@/lib/organizations/organizationManager";

export default function HRLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);

  useEffect(() => {
    const orgs = getOrganizations();
    if (orgs.length > 0) {
      setActiveOrg(orgs[0]);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f8fa] dark:bg-[#20201e] transition-colors duration-300">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white dark:border-[#383734] dark:bg-[#2c2b28] lg:block transition-colors duration-300">
          <div className="flex h-full flex-col p-5">
            
            {/* Header Brand */}
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <WellnessTwinLogo size={36} />

                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Wellness Twin
                  </p>

                  <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-[#9a9893]">
                    <ShieldCheck className="h-3 w-3 text-emerald-500" />
                    HR Workforce Portal
                  </p>
                </div>
              </div>

              {/* Verified Organization Tag */}
              {activeOrg && (
                <div className="mt-3.5 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[11px] dark:border-emerald-950/60 dark:bg-emerald-950/30">
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
            </div>

            <HRNav />

            <div className="mt-auto border-t border-slate-100 pt-4 dark:border-[#383734]">
              <Link
                href="/settings"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:text-[#cfcfce] dark:hover:bg-[#353430] dark:hover:text-white"
              >
                <Settings className="h-4 w-4 text-slate-400 dark:text-[#9a9893]" />
                <span>Settings & Theme</span>
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-[#383734] dark:bg-[#2c2b28] transition-colors duration-300">
            <div>
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