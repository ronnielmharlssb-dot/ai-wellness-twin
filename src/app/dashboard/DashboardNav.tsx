"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Sparkles,
  Lightbulb,
  FileText,
  Sliders,
  Layers,
} from "lucide-react";

export default function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard navigation" className="space-y-1">
      <NavItem
        href="/dashboard"
        active={pathname === "/dashboard"}
        icon={<LayoutDashboard className="h-4 w-4 shrink-0 transition-transform duration-200" />}
      >
        Overview
      </NavItem>

      <NavItem
        href="/dashboard/patterns"
        active={pathname === "/dashboard/patterns"}
        icon={<Activity className="h-4 w-4 shrink-0 transition-transform duration-200" />}
      >
        My Patterns
      </NavItem>

      <NavItem
        href="/dashboard/assessment"
        active={pathname === "/dashboard/assessment"}
        icon={<Sparkles className="h-4 w-4 shrink-0 transition-transform duration-200" />}
      >
        Assessment
      </NavItem>

      <NavItem
        href="/dashboard/recommendations"
        active={pathname === "/dashboard/recommendations"}
        icon={<Lightbulb className="h-4 w-4 shrink-0 transition-transform duration-200" />}
      >
        Recommendations
      </NavItem>

      <NavItem
        href="/dashboard/simulator"
        active={pathname === "/dashboard/simulator"}
        icon={<Sliders className="h-4 w-4 shrink-0 transition-transform duration-200" />}
      >
        Twin Simulator
      </NavItem>

      <NavItem
        href="/dashboard/reports"
        active={pathname === "/dashboard/reports"}
        icon={<FileText className="h-4 w-4 shrink-0 transition-transform duration-200" />}
      >
        Weekly Reports
      </NavItem>

      <NavItem
        href="/dashboard/integrations"
        active={pathname === "/dashboard/integrations"}
        icon={<Layers className="h-4 w-4 shrink-0 transition-transform duration-200" />}
      >
        Integrations
      </NavItem>
    </nav>
  );
}

function NavItem({
  href,
  children,
  icon,
  active = false,
}: {
  href: string;
  children: React.ReactNode;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out ${
        active
          ? "bg-slate-900 text-white font-semibold shadow-sm dark:bg-white dark:text-slate-900"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-[#cfcfce] dark:hover:bg-[#353430] dark:hover:text-white"
      }`}
    >
      <span className={active ? "text-white dark:text-slate-900" : "text-slate-400 dark:text-[#9a9893]"}>
        {icon}
      </span>
      <span>{children}</span>
    </Link>
  );
}