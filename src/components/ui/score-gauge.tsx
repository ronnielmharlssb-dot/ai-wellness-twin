"use client";

export function ScoreGauge({
  score,
  size = 130,
  strokeWidth = 10,
}: {
  score: number | null;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const validScore = score !== null && score !== undefined ? Math.max(0, Math.min(100, score)) : null;
  const strokeDashoffset = validScore !== null ? circumference - (validScore / 100) * circumference : circumference;

  const colorClass =
    validScore === null
      ? "text-slate-300 dark:text-slate-600"
      : validScore >= 80
      ? "text-emerald-500 dark:text-emerald-400"
      : validScore >= 60
      ? "text-amber-500 dark:text-amber-400"
      : "text-amber-600 dark:text-amber-500";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90 transform" width={size} height={size}>
        {/* Background Track */}
        <circle
          className="text-slate-100 dark:text-slate-800"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Animated Progress Ring */}
        {validScore !== null && (
          <circle
            className={`${colorClass} transition-all duration-700 ease-out`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        )}
      </svg>

      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {validScore !== null ? validScore : "--"}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          balance score
        </span>
      </div>
    </div>
  );
}
