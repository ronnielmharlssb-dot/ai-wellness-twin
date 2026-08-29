import Link from "next/link";
import { WellnessTwinLogo } from "@/components/ui/wellness-twin-logo";
import { Building2, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F7F8FA] dark:bg-[#20201e] transition-colors duration-300">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-12">
        <div className="max-w-2xl text-center">
          <div className="mb-6 flex justify-center">
            <WellnessTwinLogo size={64} />
          </div>

          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#9a9893]">
            AI WELLNESS TWIN
          </p>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
            Understand your work patterns.
            <br />
            Build healthier work habits.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-500 dark:text-[#a6a6a6]">
            A private, calibrated view of your work behavior, wellness rhythms,
            and changes over time compared only against your personal baseline.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register-company"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#60cdff] px-6 py-3 text-xs font-bold text-black transition hover:bg-[#4cc2ff] shadow-sm"
            >
              <Building2 className="h-4 w-4" />
              <span>Register Your Company</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto rounded-xl bg-slate-900 px-6 py-3 text-xs font-bold text-white transition hover:bg-slate-800 shadow-sm dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Sign In
            </Link>
          </div>

          <p className="mt-6 text-xs text-slate-400 dark:text-[#888884]">
            Have an employee invite?{" "}
            <Link href="/register" className="font-semibold text-slate-700 hover:underline dark:text-[#cfcfce]">
              Accept Single-Use Invite
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}