"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Sparkles,
  Lightbulb,
  FileText,
  Layers,
  Settings,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: <LayoutDashboard className="h-4 w-4 shrink-0" />,
  },
  {
    href: "/dashboard/patterns",
    label: "My Patterns",
    icon: <Activity className="h-4 w-4 shrink-0" />,
  },
  {
    href: "/dashboard/assessment",
    label: "Assessment",
    icon: <Sparkles className="h-4 w-4 shrink-0" />,
  },
  {
    href: "/dashboard/recommendations",
    label: "Recommendations",
    icon: <Lightbulb className="h-4 w-4 shrink-0" />,
  },
  {
    href: "/dashboard/reports",
    label: "Weekly Reports",
    icon: <FileText className="h-4 w-4 shrink-0" />,
  },
  {
    href: "/dashboard/integrations",
    label: "Integrations",
    icon: <Layers className="h-4 w-4 shrink-0" />,
  },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 dark:text-[#cfcfce] dark:hover:bg-[#353430]"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div
          id="mobile-navigation"
          className="absolute left-0 right-0 top-16 z-50 border-b border-slate-200 bg-white p-4 shadow-lg dark:border-[#383734] dark:bg-[#2c2b28] animate-in fade-in slide-in-from-top-2"
        >
          <nav aria-label="Mobile dashboard navigation" className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-slate-900 text-white font-semibold dark:bg-white dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-[#cfcfce] dark:hover:bg-[#353430] dark:hover:text-white"
                  }`}
                >
                  <span className={active ? "text-white dark:text-slate-900" : "text-slate-400 dark:text-[#9a9893]"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="my-2 border-t border-slate-100 dark:border-[#383734]" />

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-[#cfcfce] dark:hover:bg-[#353430] dark:hover:text-white"
            >
              <Settings className="h-4 w-4 text-slate-400 dark:text-[#9a9893]" />
              <span>Settings & Theme</span>
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}