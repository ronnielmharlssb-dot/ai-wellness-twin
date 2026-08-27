"use client";

export function BaselineProgressTracker({
  daysCollected,
  requiredDays = 28,
}: {
  daysCollected: number;
  requiredDays?: number;
}) {
  const percentage = Math.min(100, Math.round((daysCollected / requiredDays) * 100));
  const remaining = Math.max(0, requiredDays - daysCollected);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          Calibration Progress: <strong className="text-slate-900 dark:text-white">{daysCollected}</strong> / {requiredDays} days
        </span>
        <span className="font-semibold text-slate-900 dark:text-white">{percentage}%</span>
      </div>

      {/* Progress Track */}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#282a2c]">
        <div
          className="h-full rounded-full bg-slate-900 dark:bg-[#a8c7fa] transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <span>Day 1 (Started)</span>
        <span className="dark:text-[#a8c7fa] font-medium">{remaining === 0 ? "Baseline Complete" : `${remaining} days to full baseline`}</span>
        <span>Day 28 (Established)</span>
      </div>
    </div>
  );
}
