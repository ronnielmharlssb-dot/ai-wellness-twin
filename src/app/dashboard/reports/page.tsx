"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { AssessmentEvidence } from "@/components/ui/assessment-evidence";
import { useEmployeeAssessment } from "@/components/use-employee-assessment";
import { getLocalSessionUser } from "@/lib/supabase/auth";
import { formatChange, metricLabels } from "@/lib/wellbeing/formatters";
import { readPrivateReflection, savePrivateReflection, REFLECTION_FEELINGS, type PrivateReflection } from "@/lib/wellbeing/privateReflectionStore";

function currentWeekStart() {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() - (now.getUTCDay() + 6) % 7);
  return now.toISOString().slice(0, 10);
}
const feelingLabels = { energized: "Energized", balanced: "Balanced", fatigued: "Fatigued", drained: "Drained" };
export default function ReportsPage() {
  const assessment = useEmployeeAssessment();
  const [employeeId, setEmployeeId] = useState("");
  const [week, setWeek] = useState("");
  const [feeling, setFeeling] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<PrivateReflection | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let currentScope = "";
    const refresh = () => {
      const user = getLocalSessionUser();
      const id = user?.role === "employee" ? user.id : "";
      const nextWeek = currentWeekStart();
      const scope = id + ":" + nextWeek;
      if (scope === currentScope) return;
      currentScope = scope;
      setEmployeeId(id); setWeek(nextWeek);
      setSaved(null); setFeeling(""); setNote(""); setError("");
      if (id) {
        try {
          const reflection = readPrivateReflection(id, nextWeek);
          setSaved(reflection); setFeeling(reflection?.feeling ?? ""); setNote(reflection?.note ?? "");
        } catch { setError("This browser could not read your private reflection."); }
      }
    };
    refresh();
    window.addEventListener("wellness-auth-update", refresh);
    window.addEventListener("storage", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.clearInterval(timer); window.removeEventListener("wellness-auth-update", refresh); window.removeEventListener("storage", refresh); };
  }, []);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    try { setSaved(savePrivateReflection(employeeId, week, feeling, note)); setError(""); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Your reflection could not be saved."); }
  };
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Personal Weekly Reflection</h1>
      <p className="mt-2 text-sm text-slate-500">Review recorded changes alongside your own experience.</p></div>
      <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link></div>
    <AssessmentEvidence assessment={assessment} />
    <Card className="flex flex-wrap items-center justify-between gap-6 p-6">
      <div className="max-w-xl space-y-3"><h2 className="text-lg font-bold">Recorded weekly patterns</h2>
        <p className="text-sm text-slate-500">{!assessment || assessment.status === "building" ? "There is not yet enough evidence to compare a metric."
          : assessment.status === "partial" ? "Some metrics can be compared. The overall index is unavailable."
          : assessment.changes.length ? "Recorded changes are available for reflection." : "Compared recorded averages are close to baseline."}</p>
        <p className="text-sm text-slate-500">The index describes recorded work patterns. It does not assess how you feel.</p></div>
      <ScoreGauge score={assessment?.score ?? null} size={140} />
    </Card>
    {assessment?.changes.map(change => <Card key={change.metric} className="space-y-2 p-5">
      <h3 className="font-semibold">{metricLabels[change.metric]}</h3>
      <p className="text-sm text-slate-500">Earlier daily average: {change.baselineValue.toFixed(1)} · Recent observed average: {change.currentValue.toFixed(1)} · {formatChange(change.percentageChange)}</p>
      <p className="text-sm text-slate-500">What circumstances or changes in recording coverage might explain this shift?</p>
    </Card>)}
    <Card className="space-y-4 p-6"><h2 className="text-lg font-bold">How has this week felt?</h2>
      <p className="text-sm text-slate-500">Optional reflection for the week starting {week || "…"} (UTC). This check-in does not change the pattern index or score a clinical survey.
        Reflections stay in this browser, scoped to your employee account, and are not sent to HR.</p>
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={!employeeId} className="flex flex-wrap gap-3"><legend className="mb-2 text-sm">Choose the feeling that fits your experience</legend>
          {REFLECTION_FEELINGS.map(value => <label key={value} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <input type="radio" name="feeling" value={value} checked={feeling === value} onChange={() => setFeeling(value)} />{feelingLabels[value]}
          </label>)}</fieldset>
        <label className="block text-sm">Private note (optional)<textarea className="mt-2 block w-full rounded-xl border border-slate-200 p-3 dark:border-slate-800 dark:bg-slate-900"
          value={note} maxLength={2000} rows={3} disabled={!employeeId} onChange={event => setNote(event.target.value)} /></label>
        <Button type="submit" disabled={!employeeId || !feeling}>Save private reflection</Button>
        {saved && <p role="status" className="text-sm text-slate-500">Saved in this browser for your account.</p>}
        {error && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{error}</p>}
      </form>
    </Card>
  </div>;
}
