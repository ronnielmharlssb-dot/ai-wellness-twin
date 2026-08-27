import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const trends = [
  {
    title: "Workload & Pacing",
    status: "Shifting",
    variant: "neutral",
    description:
      "Workload-related patterns have shifted slightly over recent reporting periods.",
  },
  {
    title: "Work-Life Boundaries",
    status: "Active Shift",
    variant: "neutral",
    description:
      "After-hours activity has moved above the established organizational baseline.",
  },
  {
    title: "Connection & Inclusion",
    status: "Steady",
    variant: "positive",
    description:
      "No meaningful change has been detected across recent reporting periods.",
  },
] as const;

export default function WellbeingTrendsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Organizational Trends
        </p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Wellbeing Trends
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          How aggregate organizational wellbeing patterns have evolved over recent reporting cycles.
        </p>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Current Directions
          </h2>

          <p className="mt-0.5 text-xs text-slate-500">
            Recent movement compared with established organizational patterns.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {trends.map((trend) => (
            <Card key={trend.title} className="p-6">
              <p className="text-xs font-semibold text-slate-500">
                {trend.title}
              </p>

              <div className="mt-3">
                <Badge variant={trend.variant}>
                  {trend.status}
                </Badge>
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-600">
                {trend.description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <Card className="p-6">
        <h2 className="text-base font-bold text-slate-900">
          Reading the Trends
        </h2>

        <p className="mt-2.5 max-w-3xl text-xs leading-6 text-slate-600">
          Trends describe shifts in aggregate organizational patterns over time to help identify areas worth supporting. They are never used to evaluate individual employees.
        </p>
      </Card>
    </div>
  );
}