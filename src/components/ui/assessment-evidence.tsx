import type { EmployeeAssessment } from "@/lib/wellbeing/employeeAssessment";
import { METRIC_NAMES } from "@/lib/wellbeing/employeeMetrics";
import { metricLabels } from "@/lib/wellbeing/formatters";

export function AssessmentEvidence({ assessment }: { assessment: EmployeeAssessment | null }) {
  if (!assessment) return null;
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#383734] dark:bg-[#2c2b28]">
    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Evidence behind this comparison</h2>
    <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">Recent window: {assessment.comparisonStart} through {assessment.comparisonEnd} (UTC). Each metric uses up to 28 earlier observed dates from the past 90 days. Today’s unfinished totals are excluded. Missing observations stay unknown.</p>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs text-slate-600 dark:text-slate-300"><thead><tr><th className="py-2">Metric</th><th>Earlier observations</th><th>Recent observations</th><th>Comparison</th></tr></thead>
      <tbody>{METRIC_NAMES.map((name) => { const evidence = assessment.coverage[name]; return <tr key={name} className="border-t border-slate-100 dark:border-[#383734]"><td className="py-2 pr-3">{metricLabels[name]}</td><td>{evidence.baselineDays} / 28 dates</td><td>{evidence.recentDays} / 7 dates</td><td>{evidence.comparable ? "Available" : "Insufficient observations"}</td></tr>; })}</tbody></table></div>
    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{assessment.score === null ? "The overall pattern index is unavailable until all four metrics have 28 prior observations, seven recent observed dates, and defined percentage changes. Available metric comparisons still appear below. " : "The pattern index reflects the recorded metrics. "}Closed dates do not prove full-day capture. This is a work-pattern reflection, not a health or burnout assessment.</p>
  </div>;
}
