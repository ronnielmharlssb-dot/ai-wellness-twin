import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  variant?: "neutral" | "positive" | "warning" | "destructive";
};

export function Badge({
  children,
  variant = "neutral",
}: BadgeProps) {
  const variants = {
    neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    positive: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50",
    warning: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50",
    destructive: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/50",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${variants[variant]}`}
    >
      {children}
    </span>
  );
}