"use client";

import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  validateInvitationToken,
  redeemInvitation,
  getInvitations,
  type Invitation,
} from "@/lib/invitations/invitationManager";
import { signUpUser } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WellnessTwinLogo } from "@/components/ui/wellness-twin-logo";
import {
  Lock,
  Building2,
  Users,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  UserPlus,
  Mail,
} from "lucide-react";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token") || searchParams.get("invite");

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  
  // Form fields
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeDemoInvites, setActiveDemoInvites] = useState<Invitation[]>([]);

  useEffect(() => {
    const invites = getInvitations().filter((inv) => !inv.isUsed && inv.status === "pending");
    setActiveDemoInvites(invites);

    if (tokenParam) {
      const validation = validateInvitationToken(tokenParam);
      if (validation.valid && validation.invitation) {
        setInvitation(validation.invitation);
        setFullName(validation.invitation.fullName || "");
        setTokenError(null);
      } else {
        setInvitation(null);
        setTokenError(validation.reason || "Invalid invitation token.");
      }
    } else {
      setInvitation(null);
      setTokenError(null);
    }
  }, [tokenParam]);

  const handleDirectSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!fullName.trim()) {
      setFormError("Please enter your full name.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setFormError("Please enter a valid email address.");
      return;
    }

    if (!password || password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const { user, error } = await signUpUser({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role: "employee",
      });

      if (error || !user) {
        setFormError(error || "Failed to create account.");
        return;
      }

      // Success: clean account created, route directly to dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("Direct registration error:", err);
      setFormError("An unexpected error occurred during account creation.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!fullName.trim()) {
      setFormError("Please enter your full name.");
      return;
    }

    if (!password || password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    if (!tokenParam) {
      setFormError("Missing invitation token.");
      return;
    }

    setIsLoading(true);

    try {
      const { user, error } = await redeemInvitation({
        token: tokenParam,
        fullName: fullName.trim(),
        password,
      });

      if (error || !user) {
        setFormError(error || "Failed to redeem invitation.");
        return;
      }

      // Success: Single-use token is burned, route to dashboard or HR
      if (user.role === "hr") {
        router.push("/hr");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Redemption error:", err);
      setFormError("An unexpected error occurred during registration.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F8FA] dark:bg-[#20201e] transition-colors duration-300">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        
        {/* Centered Logo Header */}
        <div className="mb-6 text-center flex flex-col items-center">
          <div className="mb-4 flex items-center justify-center">
            <WellnessTwinLogo size={68} />
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#9a9893]">
            AI WELLNESS TWIN
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {invitation ? "Accept Invitation" : "Single-Use Registration"}
          </h1>

          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-[#a6a6a6]">
            {invitation
              ? `Confidential behavioral twin for ${invitation.organizationName}`
              : "Closed corporate tenant • Invitation required"}
          </p>
        </div>

        {/* CASE 1: Valid Single-Use Invitation Found */}
        {invitation && (
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-[#383734] dark:bg-[#2c2b28] space-y-5 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Organization & Team Badge Strip */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5 dark:border-emerald-950/60 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <Building2 className="h-4 w-4 shrink-0" />
                <p className="text-xs font-bold truncate">{invitation.organizationName}</p>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>Assigned Group: <strong>{invitation.assignedTeam}</strong></span>
              </div>
            </div>

            {formError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleRedeem} className="space-y-4">
              
              {/* Locked Verified Email Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                    Authorized Email Address
                  </label>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold dark:text-emerald-400">
                    <Lock className="h-3 w-3" /> Locked to invite
                  </span>
                </div>
                <input
                  type="email"
                  value={invitation.email}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-100/80 px-3.5 py-2.5 text-xs text-slate-600 cursor-not-allowed outline-none dark:border-[#383734] dark:bg-[#1f1f1d] dark:text-[#a6a6a6]"
                />
              </div>

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                  Create Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                />
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                />
              </div>

              {/* Burn-on-use security notice */}
              <p className="text-[11px] text-slate-400 dark:text-[#888884] leading-4">
                🔒 <strong>Single-use link:</strong> This invitation will be permanently burned upon account creation and cannot be reused.
              </p>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full text-xs font-bold bg-[#60cdff] text-black hover:bg-[#4cc2ff] py-2.5 rounded-xl shadow-sm"
              >
                {isLoading ? "Provisioning Twin..." : "Accept Invite & Activate Twin"}
              </Button>
            </form>
          </div>
        )}

        {/* CASE 2: Invalid / Expired / Already Redeemed Token */}
        {tokenError && (
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-[#383734] dark:bg-[#2d2b26] space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Invitation Notice
              </h2>
            </div>

            <p className="text-xs leading-5 text-slate-600 dark:text-[#a6a6a6]">
              {tokenError}
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <Link href="/login">
                <Button className="w-full text-xs">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* CASE 3: Direct Registration / Pure Test Account Creation */}
        {!invitation && !tokenError && (
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-[#383734] dark:bg-[#2c2b28] space-y-5 animate-in fade-in duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#383734]">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <UserPlus className="h-4 w-4 text-sky-500" />
                <span>Create Test Account (Clean 28-Day Baseline)</span>
              </div>
              <Badge variant="neutral">Zero Demo Data</Badge>
            </div>

            {formError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleDirectSignUp} className="space-y-4">
              
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                  Work / Test Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. john@mycompany.com or test@company.com"
                    required
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                  Create Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                />
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 py-2.5 rounded-xl shadow-sm"
              >
                {isLoading ? "Creating Account..." : "Create Account & Start 28-Day Baseline"}
              </Button>
            </form>

            <div className="pt-2 flex flex-col gap-2 border-t border-slate-100 dark:border-[#383734]">
              <Link href="/login">
                <Button variant="outline" className="w-full text-xs font-semibold">
                  Already have an account? Sign In
                </Button>
              </Link>
            </div>

            {/* Interactive Demo Testing Invites */}
            {activeDemoInvites.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-[#383734] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-[#cfcfce]">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Or Test with Pre-Generated Invite Token</span>
                </div>

                <div className="space-y-1.5">
                  {activeDemoInvites.slice(0, 2).map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/register?token=${inv.id}`}
                      className="flex items-center justify-between p-2 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition text-[11px] dark:border-[#383734] dark:bg-[#1f1e1c] dark:hover:bg-white/[0.08]"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {inv.fullName} ({inv.email})
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {inv.assignedTeam} • {inv.role}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F7F8FA] dark:bg-[#20201e] flex items-center justify-center p-6">
          <p className="text-xs text-slate-400">Loading registration security verification...</p>
        </main>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
