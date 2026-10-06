"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset } from "@/lib/supabase/passwordRecovery";
import { Button } from "@/components/ui/button";
import { WellnessTwinLogo } from "@/components/ui/wellness-twin-logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = await requestPasswordReset(email);
    setError(result);
    setSent(!result);
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-[#F7F8FA] dark:bg-[#20201e]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <WellnessTwinLogo size={68} />
          <h1 className="mt-5 text-2xl font-bold">Reset your password</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">We’ll email you a link to choose a new password.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-[#383734] dark:bg-[#2c2b28]">
          {sent ? <p role="status" className="text-sm leading-6">If an account exists for that email, you’ll receive a reset link. Check your inbox and spam folder. Open the link in this browser if you requested it here.</p> : (
            <form onSubmit={submit} className="space-y-4">
              {error && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{error}</p>}
              <label htmlFor="recovery-email" className="block text-sm font-semibold">Email address</label>
              <input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-transparent px-3.5 py-2.5 text-sm" />
              <Button type="submit" disabled={busy} className="w-full">{busy ? "Requesting link…" : "Send reset link"}</Button>
            </form>
          )}
        </div>
        <Link href="/login" className="mt-6 text-center text-sm font-semibold hover:underline">Back to sign in</Link>
      </div>
    </main>
  );
}
