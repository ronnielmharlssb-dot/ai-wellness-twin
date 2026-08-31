"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Sparkles,
  Lightbulb,
  FileText,
  Layers,
} from "lucide-react";

interface DashboardNavProps {
  collapsed?: boolean;
}

const navItems = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/patterns",
    label: "My Patterns",
    icon: Activity,
  },
  {
    href: "/dashboard/assessment",
    label: "Assessment",
    icon: Sparkles,
  },
  {
    href: "/dashboard/recommendations",
    label: "Recommendations",
    icon: Lightbulb,
  },
  {
    href: "/dashboard/reports",
    label: "Weekly Reports",
    icon: FileText,
  },
  {
    href: "/dashboard/integrations",
    label: "Integrations",
    icon: Layers,
  },
];

export default function DashboardNav({ collapsed = false }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard navigation" className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
              collapsed ? "h-10 w-10 justify-center mx-auto" : ""
            } ${
              active
                ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={active ? "text-white dark:text-slate-900" : "text-slate-400 dark:text-slate-500"}>
                <Icon className="h-4 w-4 shrink-0" />
              </span>
              {!collapsed && <span className="whitespace-nowrap truncate">{item.label}</span>}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}