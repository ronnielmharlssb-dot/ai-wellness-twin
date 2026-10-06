"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Activity, Users, ShieldCheck, RotateCcw, LockKeyhole, Database, CheckCircle2 } from "lucide-react";
import { WellnessTwinLogo } from "@/components/ui/wellness-twin-logo";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { AssessmentEvidence } from "@/components/ui/assessment-evidence";
import { createPresentationSample, DEMO_METRICS, presentationGroup, type DemoScenario } from "@/lib/demo/presentation";
import { metricLabels, formatChange } from "@/lib/wellbeing/formatters";
import type { MetricName } from "@/lib/wellbeing/employeeTypes";

const panels = [{ id: "employee", label: "Employee insights", icon: Activity }, { id: "hr", label: "HR group view", icon: Users }, { id: "data", label: "Data & privacy", icon: ShieldCheck }] as const;
const scenarios: { id: DemoScenario; label: string }[] = [{ id: "busy", label: "Busier week" }, { id: "steady", label: "Steady week" }, { id: "calibrating", label: "Building a baseline" }, { id: "partial", label: "Missing observations" }];
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#383734] dark:bg-[#2c2b28]";
const control = "rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold transition hover:border-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-[#484743]";
function value(name: MetricName, amount: number | null) {
  if (amount === null) return "Unknown";
  return name === "breakFrequency" ? `${amount.toFixed(1)} breaks` : name === "afterHoursActivity" ? `${amount.toFixed(0)} min` : `${amount.toFixed(1)} h`;
}

export function PresentationDemo({ now }: { now: number }) {
  const [panel, setPanel] = useState<typeof panels[number]["id"]>("employee");
  const [scenario, setScenario] = useState<DemoScenario>("busy");
  const [contributors, setContributors] = useState(3);
  const [pipelineStep, setPipelineStep] = useState(0);
  const { days, assessment } = createPresentationSample(scenario, now);
  const group = presentationGroup(contributors);
  const reset = () => { setPanel("employee"); setScenario("busy"); setContributors(3); setPipelineStep(0); };

  return <main className="min-h-screen bg-[#F7F8FA] text-slate-900 dark:bg-[#20201e] dark:text-white">
    <header className="border-b border-slate-200 bg-white dark:border-[#383734] dark:bg-[#2c2b28]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-3"><WellnessTwinLogo size={38} /><span className="text-sm font-bold">AI Wellness Twin</span></Link>
        <div className="flex items-center gap-3"><button onClick={reset} className={control}><RotateCcw className="mr-2 inline h-3.5 w-3.5" />Reset demo</button><Link href="/login" className="text-xs font-semibold text-sky-700 dark:text-sky-300">Sign in<ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link></div>
      </div>
    </header>
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-7 sm:py-10">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><span className="font-bold">Interactive sample demo</span><span>Fictional data · No account required · Nothing saved to your account</span></div>
      <section><p className="text-xs font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300">Your patterns. Your baseline.</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">A calmer view of your workday</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-300">Explore how personal observations become useful reflections, and how group privacy protects individual employees.</p></section>
      <nav aria-label="Demo views" className="flex flex-wrap gap-2">{panels.map(item => <button key={item.id} aria-pressed={panel === item.id} onClick={() => setPanel(item.id)} className={`${control} ${panel === item.id ? "border-sky-400 bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100" : "bg-white dark:bg-[#2c2b28]"}`}><item.icon className="mr-2 inline h-4 w-4" />{item.label}</button>)}</nav>

      {panel === "employee" && <section className="space-y-5" aria-label="Sample employee insights">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Hello, Alex</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Fictional employee · Private personal view</p></div><label className="flex items-center gap-3 text-xs font-semibold">Sample scenario<select value={scenario} onChange={event => setScenario(event.target.value as DemoScenario)} className={`${control} bg-white dark:bg-[#2c2b28]`}>{scenarios.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div>
        <div className={`${card} flex flex-col items-start gap-6 sm:flex-row sm:items-center`}>
          <ScoreGauge score={assessment.score} />
          <div className="flex-1"><p className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">{assessment.score === null ? "More evidence needed" : "Your weekly reflection"}</p><h3 className="mt-2 text-xl font-bold">{scenario === "calibrating" ? "Your baseline is taking shape" : scenario === "partial" ? "Some patterns are still unknown" : scenario === "steady" ? "A familiar work rhythm" : "More meetings and fewer pauses this week"}</h3><p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">{scenario === "calibrating" ? "This sample has 14 earlier dates and seven recent dates. It needs 28 earlier observations per metric before comparisons become available." : scenario === "partial" ? "After-hours activity was not observed. Available comparisons remain visible, while the overall pattern index stays unavailable." : scenario === "steady" ? "The sample’s recent seven-day averages match its own earlier baseline. It is never compared with another employee." : "The sample’s meeting load rose from 2 to 3 hours a day, while recorded breaks fell from 5 to 3. Consider protecting a short break between meetings."}</p><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">A descriptive work-pattern index, not a health, productivity or burnout score.</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{DEMO_METRICS.map(name => { const evidence = assessment.coverage[name]; const comparison = assessment.comparisons.find(item => item.metric === name); return <article key={name} className={card}><h3 className="min-h-8 text-xs font-semibold text-slate-500 dark:text-slate-300">{metricLabels[name]}</h3><p className="mt-3 text-2xl font-bold">{value(name, evidence.recentValue)}</p><p className="mt-2 text-xs font-semibold text-sky-700 dark:text-sky-300">{comparison ? comparison.percentageChange === 0 ? "Matches your baseline" : formatChange(comparison.percentageChange) : "Comparison unavailable"}</p><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Earlier baseline: {value(name, evidence.baselineValue)}</p></article>; })}</div>
        <div className={card}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">Scheduled meeting rhythm</h3><span className="text-xs text-slate-500 dark:text-slate-400">{days.length} closed sample dates · UTC</span></div><div className="mt-5 flex h-28 items-end gap-1" role="img" aria-label="Sample meeting hours across earlier baseline dates and seven recent dates">{days.map((day, index) => <div key={day.date} title={`${day.date}: ${day.meetingLoad} sample meeting hours`} style={{ height: `${day.meetingLoad / 4 * 100}%` }} className={`min-w-0 flex-1 rounded-t ${index >= days.length - 7 ? "bg-sky-500" : "bg-slate-200 dark:bg-slate-600"}`} />)}</div><div className="mt-3 flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>Earlier baseline observations</span><span>Recent 7 dates</span></div></div>
        <AssessmentEvidence assessment={assessment} />
      </section>}

      {panel === "hr" && <section className="space-y-5" aria-label="Sample HR group view">
        <div><h2 className="text-xl font-bold">Group trends, without individual profiles</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Fictional Product team · Only eligible group averages appear</p></div>
        <div className={`${card} flex flex-wrap items-center justify-between gap-4`}><div className="flex items-center gap-3"><Users className="h-7 w-7 text-sky-500" /><div><h3 className="font-bold">Product team</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Sample contributors have consented and established their own baselines.</p></div></div><div className="flex gap-2">{[3, 2].map(count => <button key={count} aria-pressed={contributors === count} onClick={() => setContributors(count)} className={`${control} ${contributors === count ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100" : ""}`}>{count} consenting contributors</button>)}</div></div>
        <div aria-live="polite">{group.available ? <><p className="mb-4 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />Sample group meets the minimum contributor threshold</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{DEMO_METRICS.map(name => <article key={name} className={card}><h3 className="text-xs text-slate-500 dark:text-slate-300">{metricLabels[name]}</h3><p className="mt-3 text-2xl font-bold">{value(name, group.metrics[name])}</p><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Fictional group average</p></article>)}</div></> : <div className={`${card} py-12 text-center`}><LockKeyhole className="mx-auto h-9 w-9 text-slate-400" /><h3 className="mt-4 text-xl font-bold">Group observations withheld</h3><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-300">Two contributors are below the minimum of three. No group metric is displayed. Withdrawing consent can make a metric unavailable.</p></div>}</div>
        <div className={card}><ShieldCheck className="mb-3 h-6 w-6 text-emerald-500" /><h3 className="font-bold">Privacy is part of the experience</h3><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">HR sees eligible group trends. Personal observations, reflections, message contents and individual rankings do not appear here. Each real metric requires at least three consenting contributors with a valid 28-day baseline.</p><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">This view illustrates the privacy rule with fictional averages; it does not read a real organization.</p></div>
      </section>}

      {panel === "data" && <section className="space-y-5" aria-label="Sample data and privacy">
        <div><h2 className="text-xl font-bold">From observations to reflections</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-300">An illustrative journey with sample metadata. No device collection or provider connection runs in this demo.</p></div>
        <div className="grid gap-4 md:grid-cols-3">{[{ title: "1. Observe metadata", description: "Elapsed browser presence, scheduled calendar blocks and public GitHub event counts. Contents are excluded." }, { title: "2. Keep evidence honest", description: "Repeated deliveries do not add duplicate time. Missing measurements remain unknown; a linked tool alone proves no activity." }, { title: "3. Compare privately", description: "Seven closed dates are compared with 28 earlier observed dates. Group sharing requires consent and sufficient contributors." }].map((item, index) => <article key={item.title} className={`${card} ${pipelineStep > index ? "ring-2 ring-sky-400" : ""}`}><Database className="h-6 w-6 text-sky-500" /><h3 className="mt-4 text-sm font-bold">{item.title}</h3><p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">{item.description}</p></article>)}</div>
        <div className={`${card} flex flex-wrap items-center justify-between gap-4`}><p aria-live="polite" className="text-sm text-slate-600 dark:text-slate-300">{["Walk through the sample data journey.", "Sample metadata observed. No message or document contents included.", "Sample delivery validated. A repeated event counts once.", "Sample reflection ready. Personal evidence and group sharing stay separate."][pipelineStep]}</p><button className={`${control} bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100`} onClick={() => setPipelineStep(step => step === 3 ? 0 : step + 1)}>{pipelineStep === 3 ? "Restart walkthrough" : "Next sample step"}<ArrowRight className="ml-2 inline h-4 w-4" /></button></div>
        <div className={card}><h3 className="font-bold">What this demo shows</h3><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Personal baseline comparisons, calibration, missing-data handling and group privacy. Live sign-in, email delivery, cloud ingestion and provider authorization require separate setup and testing. The sample walkthrough does not demonstrate a live upload.</p></div>
      </section>}
      <footer className="border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500 dark:border-[#383734] dark:text-slate-400">Presentation mode · All people, observations and group averages on this page are fictional. Reset demo restores the starting view.</footer>
    </div>
  </main>;
}
