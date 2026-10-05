"use client";
import Link from "next/link";
import { useState } from "react";
import { useEmployeeAssessment } from "@/components/use-employee-assessment";
import { AssessmentEvidence } from "@/components/ui/assessment-evidence";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { formatChange, metricLabels } from "@/lib/wellbeing/formatters";

export default function AssessmentPage() {
  const assessment = useEmployeeAssessment();
  const [activeTab, setActiveTab] = useState<"overview" | "survey" | "dimensions">("overview");
  const labels = { building: "Collecting evidence", partial: "Partial observations", stable: "Recorded patterns steady",
    watch: "Recorded patterns changed", attention: "Review recorded changes" };
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Personal Work Pattern Assessment</h1>
        <p className="mt-2 text-sm text-slate-500">Reflect on your own recorded activity and its coverage.</p></div>
      <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
    </div>
    <nav aria-label="Assessment views" className="flex flex-wrap gap-2">
      {(["overview", "dimensions", "survey"] as const).map(tab => <Button key={tab} variant={activeTab === tab ? "primary" : "outline"}
        onClick={() => setActiveTab(tab)}>{tab === "survey" ? "Survey availability" : tab === "dimensions" ? "Metric comparisons" : "Overview"}</Button>)}
    </nav>
    {activeTab === "survey" ? <Card className="space-y-3 p-6">
      <Badge variant="neutral">Unavailable</Badge><h2 className="text-lg font-bold">Survey assessment is not implemented</h2>
      <p className="text-sm text-slate-500">No survey responses have been collected or scored here. Exhaustion, detachment,
        and efficacy scores are unavailable. Recorded activity cannot supply those responses.</p>
      <p className="text-sm text-slate-500">The weekly check-in is a private reflection, and does not produce a clinical assessment.</p>
    </Card> : <>
      <AssessmentEvidence assessment={assessment} />
      {activeTab === "overview" ? <Card className="flex flex-wrap items-center justify-between gap-6 p-6">
        <div className="max-w-xl space-y-3"><Badge variant="neutral">{assessment ? labels[assessment.status] : "Loading observations"}</Badge>
          <h2 className="text-lg font-bold">Recorded work pattern index</h2>
          <p className="text-sm text-slate-500">This descriptive index summarizes increases in recorded active time, scheduled meeting load,
            and after-hours activity, and decreases in recorded breaks relative to your baseline.
            It does not measure your health, energy, productivity, or burnout.</p>
          <p className="text-sm text-slate-500">Unknown metrics stay unknown. A high index does not establish that you feel well.</p>
        </div><ScoreGauge score={assessment?.score ?? null} size={140} />
      </Card> : <Card className="space-y-4 p-6">
        <h2 className="text-lg font-bold">Available daily average comparisons</h2>
        {!assessment?.comparisons.length && <p className="text-sm text-slate-500">No metric yet has 28 earlier observed dates and an observation in the recent window.</p>}
        {assessment?.comparisons.map(change => <div key={change.metric} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-3 dark:border-slate-800">
          <div><p className="font-semibold">{metricLabels[change.metric]}</p><p className="text-sm text-slate-500">
            Earlier average: {change.baselineValue.toFixed(1)} · Recent observed average: {change.currentValue.toFixed(1)}</p></div>
          <Badge variant="neutral">{formatChange(change.percentageChange)}</Badge>
        </div>)}
      </Card>}
    </>}
    <div className="flex justify-between"><Link href="/dashboard/patterns"><Button variant="outline">My Patterns</Button></Link>
      <Link href="/dashboard/recommendations"><Button>Reflection ideas</Button></Link></div>
  </div>;
}
