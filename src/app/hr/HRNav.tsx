"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, TrendingUp } from "lucide-react";

interface HRNavProps {
  collapsed?: boolean;
}

const navItems = [
  {
    href: "/hr",
    label: "Overview",
    icon: <LayoutDashboard className="h-4 w-4 shrink-0 transition-transform duration-200 text-sky-400" />,
  },
  {
    href: "/hr/teams",
    label: "Teams & Groups",
    icon: <Users className="h-4 w-4 shrink-0 transition-transform duration-200 text-teal-400" />,
  },
  {
    href: "/hr/trends",
    label: "Workforce Trends",
    icon: <TrendingUp className="h-4 w-4 shrink-0 transition-transform duration-200 text-amber-400" />,
  },
];

export default function HRNav({ collapsed = false }: HRNavProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/hr" && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={`relative flex items-center rounded-lg text-xs font-medium transition-all duration-150 ease-out ${
              collapsed
                ? "h-10 w-10 justify-center mx-auto"
                : "gap-3 px-3 py-2"
            } ${
              active
                ? "bg-slate-100 text-slate-900 font-semibold dark:bg-white/[0.07] dark:text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-[#cfcfce] dark:hover:bg-white/[0.04] dark:hover:text-white"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center shrink-0">
              {item.icon}
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}