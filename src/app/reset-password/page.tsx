"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { completePasswordRecovery, initializePasswordRecovery } from "@/lib/supabase/passwordRecovery";
import { Button } from "@/components/ui/button";
import { WellnessTwinLogo } from "@/components/ui/wellness-twin-logo";

export default function ResetPasswordPage() {
  const initialization = useRef<ReturnType<typeof initializePasswordRecovery> | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    let mounted = true;
    // React may replay effects; consume a single-use recovery code only once.
    initialization.current ??= initializePasswordRecovery(window.location.href);
    void initialization.current.then(result => {
      window.history.replaceState(window.history.state, "", "/reset-password");
      if (!mounted) return;
      setEmail(result.email);
      setError(result.error);
      setChecking(false);
    });
    return () => { mounted = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !email) return;
    setBusy(true);
    const result = await completePasswordRecovery(password, confirmation);
    setError(result);
    if (!result) {
      setPassword("");
      setConfirmation("");
      setChanged(true);
    }
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-[#F7F8FA] dark:bg-[#20201e]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <WellnessTwinLogo size={68} />
          <h1 className="mt-5 text-2xl font-bold">Choose a new password</h1>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-[#383734] dark:bg-[#2c2b28]">
          {checking ? <p role="status" className="text-sm">Checking your reset link…</p> : changed ? (
            <p role="status" className="text-sm leading-6">Your password has been changed. You can now sign in with your new password.</p>
          ) : (
            <>
              {error && <p role="alert" className="mb-4 text-sm text-amber-700 dark:text-amber-300">{error}</p>}
              {email && <form onSubmit={submit} className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Resetting the password for {email}.</p>
                <label htmlFor="new-password" className="block text-sm font-semibold">New password</label>
                <input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-transparent px-3.5 py-2.5 text-sm" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Use at least 12 characters.</p>
                <label htmlFor="confirm-password" className="block text-sm font-semibold">Confirm new password</label>
                <input id="confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-transparent px-3.5 py-2.5 text-sm" />
                <Button type="submit" disabled={busy} className="w-full">{busy ? "Changing password…" : "Save new password"}</Button>
              </form>}
              {!email && <Link href="/forgot-password" className="text-sm font-semibold hover:underline">Request a new reset link</Link>}
            </>
          )}
        </div>
        <Link href="/login" className="mt-6 text-center text-sm font-semibold hover:underline">Back to sign in</Link>
      </div>
    </main>
  );
}
