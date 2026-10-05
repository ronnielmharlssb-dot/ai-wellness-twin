import { Card } from "@/components/ui/card";
import type { HRWorkspace } from "@/lib/wellbeing/serverHRWorkspace";

const display = (value: number | null, unit: string) => value === null ? "Withheld / unavailable" : `${value.toFixed(2)} ${unit}`;
export default function ServerOverview({ workspace }: { workspace: HRWorkspace }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Organizational work patterns</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Daily group averages are released only when at least three consenting employees have a 28-day observation baseline for that metric. Individual observations and personal scores are excluded.</p>
      </section>
      {!workspace.available ? (
        <Card className="p-6"><h2 className="font-semibold">Organization data is unavailable</h2><p className="mt-2 text-sm text-slate-500">The organization backend has not been configured or cannot be reached. No browser demonstration data is used for this account.</p></Card>
      ) : !workspace.groups.length ? (
        <Card className="p-6"><h2 className="font-semibold">No verified groups</h2><p className="mt-2 text-sm text-slate-500">Your organization administrator must provision your HR membership and group cohorts before aggregates can appear.</p></Card>
      ) : workspace.groups.map((group) => (
        <Card key={group.id} className="p-5">
          <h2 className="text-lg font-semibold">{group.name}</h2>
          {!group.observations.length ? <p className="mt-2 text-sm text-slate-500">Awaiting enough consenting employees with calibrated observations. No individual values are available.</p> : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="pb-3 text-left text-slate-500">Most recent 14 released days. Dates use UTC; today is excluded because collection is still in progress.</caption>
                <thead><tr className="border-b border-slate-200 dark:border-slate-700"><th className="p-2">Date</th><th className="p-2">Observed active time</th><th className="p-2">Scheduled meetings</th><th className="p-2">Recorded breaks</th><th className="p-2">After-hours activity</th></tr></thead>
                <tbody>{group.observations.slice(0, 14).map((day) => <tr key={day.date} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2">{day.date}</td><td className="p-2">{display(day.workingHours, "h")}</td><td className="p-2">{display(day.meetingLoad, "h")}</td><td className="p-2">{display(day.breakFrequency, "breaks")}</td><td className="p-2">{display(day.afterHoursActivity, "min")}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
      <p className="text-xs text-slate-500">Group membership and cohorts are provisioned by your organization administrator. Work-pattern observations describe recorded coverage and do not diagnose health or evaluate individual performance.</p>
    </div>
  );
}
