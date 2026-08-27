"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, TrendingUp } from "lucide-react";

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

export default function HRNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {navItems.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/hr" && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 ease-out ${
              active
                ? "bg-slate-100 text-slate-900 font-semibold dark:bg-white/[0.07] dark:text-white before:content-[''] before:absolute before:left-0 before:top-[22%] before:h-[56%] before:w-[3.5px] before:rounded-r-full before:bg-[#60cdff]"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-[#cfcfce] dark:hover:bg-white/[0.04] dark:hover:text-white"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}