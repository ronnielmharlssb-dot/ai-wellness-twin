import Link from "next/link";
import { WellnessTwinLogo } from "@/components/ui/wellness-twin-logo";
import { Building2, ArrowRight, ShieldCheck, Activity } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F7F8FA] dark:bg-[#20201e] transition-colors duration-300 relative overflow-hidden">
      {/* Background Decorative Blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-gradient-to-b from-sky-400/10 to-transparent blur-3xl rounded-full pointer-events-none opacity-50 dark:from-[#60cdff]/10" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-12">
        <div className="max-w-2xl text-center animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">

          <div className="mb-8 flex justify-center hover:scale-105 transition-transform duration-500">
            <WellnessTwinLogo size={72} />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/50 px-3 py-1 mb-6 text-[11px] font-bold uppercase tracking-wider text-slate-500 shadow-sm backdrop-blur-sm dark:border-[#383734] dark:bg-[#2c2b28]/50 dark:text-[#a6a6a6]">
            <Activity className="h-3 w-3 text-sky-500" />
            AI Wellness Twin
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl dark:text-white leading-[1.1]">
            Understand your work patterns.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-500 dark:from-[#60cdff] dark:to-indigo-400">
              Build healthier habits.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-[#a6a6a6] sm:text-base">
            A private, calibrated view of your work behavior, wellness rhythms,
            and changes over time compared only against your personal baseline.
          </p>

          <div className="mt-8 flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-400 dark:text-[#888884]">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>100% Privacy Guaranteed. Zero Surveillance.</span>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register-company"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-[#60cdff] px-8 py-3.5 text-xs font-bold text-black transition-all hover:bg-[#4cc2ff] hover:scale-105 hover:shadow-lg hover:shadow-[#60cdff]/20 active:scale-95"
            >
              <Building2 className="h-4 w-4" />
              <span>Register Your Company</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto rounded-2xl bg-slate-900 px-8 py-3.5 text-xs font-bold text-white transition-all hover:bg-slate-800 hover:scale-105 hover:shadow-lg active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Sign In to Dashboard
            </Link>
          </div>

          <p className="mt-10 text-xs text-slate-400 dark:text-[#888884] animate-in fade-in delay-300 duration-1000">
            Have an employee invite?{" "}
            <Link href="/register" className="font-semibold text-sky-600 hover:underline hover:text-sky-700 dark:text-[#60cdff] dark:hover:text-[#4cc2ff] transition-colors">
              Accept Single-Use Invite
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
