"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInUser, signInWithGoogle } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/ui/brand-logos";
import { WellnessTwinLogo } from "@/components/ui/wellness-twin-logo";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Google login modal state for interactive sign-in
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState("");
  const [notFoundEmail, setNotFoundEmail] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotFoundEmail(null);

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setIsLoading(true);

    try {
      const { user, error: signInError } = await signInUser({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError);
        return;
      }

      if (user) {
        if (user.role === "hr") {
          router.push("/hr");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignInClick = () => {
    setError("");
    setNotFoundEmail(null);
    setShowGoogleModal(true);
  };

  const handleConfirmGoogleAuth = async (selectedEmail?: string) => {
    const targetEmail = (selectedEmail || googleEmailInput.trim() || "alex.morgan@gmail.com").toLowerCase();
    setIsLoading(true);
    setError("");
    setNotFoundEmail(null);

    try {
      const { user, error: googleError } = await signInWithGoogle(targetEmail, { isSignUp: false });

      if (googleError) {
        setError(googleError);
        if (googleError.includes("not found")) {
          setNotFoundEmail(targetEmail);
        }
        setShowGoogleModal(false);
        return;
      }

      setShowGoogleModal(false);
      if (user) {
        if (user.role === "hr") {
          router.push("/hr");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Google verification failed. Please try again.");
      setShowGoogleModal(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F8FA] dark:bg-[#20201e] transition-colors duration-300">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="mb-4 flex items-center justify-center">
            <WellnessTwinLogo size={68} />
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#9a9893]">
            AI WELLNESS TWIN
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back
          </h1>

          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-[#a6a6a6]">
            Understand your work patterns. Build healthier habits.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-[#383734] dark:bg-[#2c2b28] space-y-4">
          
          {error && (
            <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
              <p className="font-semibold">Verification Notice:</p>
              <p>{error}</p>
              {notFoundEmail && (
                <div className="pt-2">
                  <Link
                    href={`/register?email=${encodeURIComponent(notFoundEmail)}`}
                    className="inline-flex items-center gap-1 font-bold text-amber-950 underline hover:text-black"
                  >
                    → Create account for {notFoundEmail}
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Official Google Sign-In Button */}
          <Button
            variant="outline"
            type="button"
            onClick={handleGoogleSignInClick}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 border-slate-200 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <GoogleLogo className="h-4 w-4" />
            Continue with Google
          </Button>

          {/* Quick Demo Test Accounts */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-[#383734] dark:bg-[#20201e]/60">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
              🧪 Quick Demo Accounts:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail("ronnie@company.com");
                  setPassword("password123");
                  setError("");
                }}
                className="flex flex-col items-start rounded-xl border border-slate-200 bg-white p-2 text-left transition hover:border-slate-400 hover:bg-slate-50 dark:border-[#383734] dark:bg-[#2c2b28] dark:hover:border-slate-500"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  👤 Employee
                </span>
                <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                  ronnie@company.com
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail("hr@company.com");
                  setPassword("password123");
                  setError("");
                }}
                className="flex flex-col items-start rounded-xl border border-slate-200 bg-white p-2 text-left transition hover:border-slate-400 hover:bg-slate-50 dark:border-[#383734] dark:bg-[#2c2b28] dark:hover:border-slate-500"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  🛡️ HR Admin
                </span>
                <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                  hr@company.com
                </span>
              </button>
            </div>
          </div>

          <div className="my-4 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-100 dark:bg-[#383734]" />
            <span className="text-xs font-medium text-slate-400">OR WITH EMAIL</span>
            <div className="h-px flex-1 bg-slate-100 dark:bg-[#383734]" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-semibold text-slate-700"
              >
                Work email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold text-slate-700"
                >
                  Password
                </label>

                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-slate-900"
                >
                  Forgot password?
                </button>
              </div>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 text-xs font-semibold"
            >
              {isLoading ? "Verifying..." : "Sign in to Dashboard"}
            </Button>
          </form>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 text-center text-xs text-slate-500 dark:text-[#a6a6a6]">
          <p>
            Have an employee invite?{" "}
            <Link
              href="/register"
              className="font-semibold text-slate-900 hover:underline dark:text-white"
            >
              Accept Single-Use Invite
            </Link>
          </p>

          <p>
            New organization?{" "}
            <Link
              href="/register-company"
              className="font-semibold text-sky-600 hover:underline dark:text-[#60cdff]"
            >
              Register Your Company →
            </Link>
          </p>
        </div>

        {/* Interactive Google Sign-In Dialog Modal with Account Verification */}
        {showGoogleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
                  <GoogleLogo className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Sign in with Google
                  </h3>
                  <p className="text-xs text-slate-400">
                    Verifying registered account
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Enter your Google / Gmail address:
                  </label>
                  <input
                    type="email"
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    placeholder="e.g. alex.morgan@gmail.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowGoogleModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleConfirmGoogleAuth()}
                  className="text-xs"
                >
                  Verify & Sign in
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}