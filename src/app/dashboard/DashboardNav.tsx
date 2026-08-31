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
            className={`flex items-center rounded-xl text-sm font-medium transition-all duration-200 ease-out ${
              collapsed
                ? "h-11 w-11 justify-center mx-auto"
                : "gap-3 px-3 py-2.5"
            } ${
              active
                ? "bg-slate-900 text-white font-semibold shadow-sm dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-[#cfcfce] dark:hover:bg-[#353430] dark:hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 transition-transform duration-200" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}