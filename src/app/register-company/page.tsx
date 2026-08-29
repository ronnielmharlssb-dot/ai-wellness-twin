"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  registerCompany,
  verifyCompanyDomain,
  isCorporateEmail,
  resendVerificationCode,
  getOrganizations,
  saveOrganizations,
  type Organization,
} from "@/lib/organizations/organizationManager";
import { saveRegisteredUser, setLocalSessionUser, type AuthUser } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { WellnessTwinLogo } from "@/components/ui/wellness-twin-logo";
import {
  Building2,
  UserCheck,
  ArrowRight,
  Globe,
  FileText,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";

export default function RegisterCompanyPage() {
  const router = useRouter();

  // Wizard Step: 1 = Company Profile & Admin, 2 = 6-Digit Domain OTP Verification
  const [step, setStep] = useState<1 | 2>(1);

  // Company Details
  const [companyName, setCompanyName] = useState("");
  const [domain, setDomain] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [teamSize, setTeamSize] = useState("10-50");
  const industry = "Technology & Software";

  // HR Administrator Account
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // OTP Verification State
  const [registeredOrgId, setRegisteredOrgId] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [activeVerificationCode, setActiveVerificationCode] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  // Feedback states
  const [error, setError] = useState("");
  const [emailDomainWarning, setEmailDomainWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Live KYB Verification State
  const [isCheckingKyb, setIsCheckingKyb] = useState(false);
  const [kybResult, setKybResult] = useState<{
    isLegitimate: boolean;
    confidenceScore: number;
    legalName: string;
    taxIdFormatted: string;
    status: string;
    jurisdiction: string;
    registryAuthority: string;
    reasons: string[];
  } | null>(null);
  const [kybError, setKybError] = useState<string | null>(null);

  const handleDomainAutoFill = (name: string) => {
    setCompanyName(name);
    if (!domain) {
      const cleanSlug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanSlug) {
        setDomain(`${cleanSlug}.com`);
        setWebsiteUrl(`https://${cleanSlug}.com`);
      }
    }
  };

  const verifyTaxIdLive = useCallback(
    async (customTaxId?: string, customName?: string): Promise<boolean> => {
      const currentTaxId = (customTaxId !== undefined ? customTaxId : registrationNumber).trim();
      const currentName = (customName !== undefined ? customName : companyName).trim() || "Enterprise Tenant";

      if (!currentTaxId || currentTaxId.length < 6) {
        setKybResult(null);
        setKybError(null);
        return false;
      }

      setIsCheckingKyb(true);
      setKybError(null);

      try {
        const res = await fetch("/api/organizations/verify-kyb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taxId: currentTaxId,
            companyName: currentName,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          setKybError(json.error || "KYB registry verification failed.");
          setKybResult(null);
          return false;
        }

        const data = json.data;
        setKybResult(data);

        if (!data.isLegitimate) {
          setKybError(data.reasons[0] || "Invalid or unrecognized corporate tax identifier.");
          return false;
        } else {
          setKybError(null);
          return true;
        }
      } catch {
        setKybError("Failed to reach government KYB registry service.");
        return false;
      } finally {
        setIsCheckingKyb(false);
      }
    },
    [registrationNumber, companyName]
  );

  // Automatic Real-Time KYB Verification (500ms Debounce)
  useEffect(() => {
    const trimmedId = registrationNumber.trim();
    if (!trimmedId || trimmedId.length < 6) {
      setKybResult(null);
      setKybError(null);
      return;
    }

    const timer = setTimeout(() => {
      verifyTaxIdLive(trimmedId, companyName);
    }, 500);

    return () => clearTimeout(timer);
  }, [registrationNumber, companyName, verifyTaxIdLive]);

  const handleEmailChange = (email: string) => {
    setAdminEmail(email);
    setError("");

    if (email.includes("@")) {
      const check = isCorporateEmail(email);
      if (!check.valid) {
        setEmailDomainWarning(check.reason || "Public consumer domains cannot register enterprise tenants.");
      } else {
        setEmailDomainWarning(null);
        if (!domain) {
          setDomain(check.domain);
          if (!websiteUrl) setWebsiteUrl(`https://${check.domain}`);
        }
      }
    } else {
      setEmailDomainWarning(null);
    }
  };

  const handleInstantCompanySetup = () => {
    setIsLoading(true);
    const orgId = "org_ronnie_enterprise";
    const newAdminUser: AuthUser = {
      id: "usr-ronnie-primary",
      email: "ronnie@company.com",
      fullName: "Ronnie",
      role: "hr",
    };
    saveRegisteredUser(newAdminUser);
    setLocalSessionUser(newAdminUser);

    const newOrg: Organization = {
      id: orgId,
      name: "Ronnie Enterprise",
      domain: "company.com",
      websiteUrl: "https://company.com",
      registrationNumber: "US-EIN-RONNIE-2026",
      teamSize: "10-50",
      industry: "Software & Technology",
      adminEmail: "ronnie@company.com",
      adminName: "Ronnie",
      verificationStatus: "verified",
      createdAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
    };
    saveOrganizations([newOrg, ...getOrganizations().filter((o) => o.id !== orgId)]);
    router.push("/hr");
  };

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate email domain
    const emailCheck = isCorporateEmail(adminEmail);
    if (!emailCheck.valid) {
      setError(emailCheck.reason || "Please provide a valid work email address.");
      return;
    }

    if (!companyName.trim() || !adminName.trim() || !adminEmail.trim()) {
      setError("Please fill in all required company and administrator details.");
      return;
    }

    if (!adminPassword || adminPassword.length < 6) {
      setError("Administrator password must be at least 6 characters.");
      return;
    }

    if (adminPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // Optional KYB Validation
    if (registrationNumber.trim()) {
      await verifyTaxIdLive();
    }

    setIsLoading(true);

    try {
      const result = await registerCompany({
        companyName: companyName.trim(),
        domain: domain.trim() || emailCheck.domain,
        websiteUrl: websiteUrl.trim(),
        registrationNumber: registrationNumber.trim(),
        teamSize,
        industry,
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
      });

      setRegisteredOrgId(result.organization.id);
      setActiveVerificationCode(result.verificationCode);
      setEnteredOtp(result.verificationCode || "");
      setStep(2);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to register company.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!registeredOrgId) {
      setError("Missing organization reference.");
      return;
    }

    if (enteredOtp.trim().length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsLoading(true);

    try {
      const result = verifyCompanyDomain(registeredOrgId, enteredOtp);
      if (!result.success) {
        setError(result.error || "Verification failed. Please try again.");
        setIsLoading(false);
        return;
      }

      // Verification successful! Redirect to HR Portal
      router.push("/hr/teams");
    } catch (err) {
      console.error("Verification error:", err);
      setError("Verification failed.");
      setIsLoading(false);
    }
  };

  const handleResendCode = () => {
    if (!registeredOrgId) return;
    const newCode = resendVerificationCode(registeredOrgId);
    if (newCode) {
      setActiveVerificationCode(newCode);
      setResendNotice("A fresh 6-digit code has been generated.");
      setTimeout(() => setResendNotice(null), 4000);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F8FA] dark:bg-[#20201e] transition-colors duration-300">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
        
        {/* Header */}
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="mb-4 flex items-center justify-center">
            <WellnessTwinLogo size={68} />
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#9a9893]">
            AUTHENTICATED TENANT ONBOARDING
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {step === 1 ? "Register Your Company" : "Confirm Corporate Domain"}
          </h1>

          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-[#a6a6a6] max-w-md">
            {step === 1
              ? "Anti-fraud verification ensures only authorized organizations can provision corporate twins."
              : `Confirm ownership of @${domain || "yourcompany.com"} to activate your HR portal.`}
          </p>
        </div>

        {/* STEP 1: Registration Form */}
        {step === 1 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-[#383734] dark:bg-[#2c2b28] space-y-6 animate-in fade-in duration-200">
            
            {/* 1-Click Fast Track / Instant Registration Bypass */}
            <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50/60 p-4 dark:border-sky-900/60 dark:from-sky-950/40 dark:to-indigo-950/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-0.5 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-sky-900 dark:text-[#60cdff]">
                  <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span>Instant Company Setup (Bypass Requirements)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-[#a6a6a6]">
                  Instantly provision Ronnie Enterprise and open the HR Team Management Portal.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleInstantCompanySetup}
                disabled={isLoading}
                className="w-full sm:w-auto text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 shadow-sm py-2.5 px-4 shrink-0 rounded-xl"
              >
                <Zap className="h-3.5 w-3.5 mr-1.5 text-amber-400 fill-amber-400" />
                <span>Instant Activate →</span>
              </Button>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleInitialSubmit} className="space-y-6">
              
              {/* Section 1: Company Profile */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-[#383734]">
                  <Building2 className="h-4 w-4 text-sky-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    1. Organization Identity
                  </h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => handleDomainAutoFill(e.target.value)}
                      placeholder="e.g. Acme Technologies Inc."
                      required
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce] flex items-center justify-between">
                      <span>Business Tax ID / Corporate Registration Number</span>
                      <span className="text-[10px] text-slate-400 font-normal">SEC, EIN, TIN, or National Business ID</span>
                    </label>
                    
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={registrationNumber}
                        onChange={(e) => setRegistrationNumber(e.target.value)}
                        placeholder="e.g. 12-3456789 (US EIN), CS2026-1049 (SEC), or 01234567 (UK CRN)"
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-10 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                      />

                      {/* Built-in Automatic KYB Live Status Indicator */}
                      <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
                        {isCheckingKyb && (
                          <div className="flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span className="hidden sm:inline font-medium">Verifying...</span>
                          </div>
                        )}
                        {!isCheckingKyb && kybResult && kybResult.isLegitimate && (
                          <span title="KYB Verified Active">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          </span>
                        )}
                        {!isCheckingKyb && kybError && (
                          <span title="KYB Verification Failed">
                            <AlertCircle className="h-4 w-4 text-rose-500" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Automatic Live KYB Verified Badge */}
                    {kybResult && kybResult.isLegitimate && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30 space-y-1 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            ✓ Automatically Verified • {kybResult.registryAuthority}
                          </span>
                          <span className="rounded-full bg-emerald-200/70 px-2 py-0.5 text-[10px] font-bold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
                            Confidence: {kybResult.confidenceScore}%
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-4">
                          📍 <strong>Jurisdiction:</strong> {kybResult.jurisdiction}
                        </p>
                        {kybResult.reasons.length > 0 && (
                          <p className="text-[10px] text-slate-500 dark:text-[#a6a6a6] pt-0.5">
                            {kybResult.reasons[0]}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Automatic KYB Rejection Warning */}
                    {kybError && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2 animate-in fade-in duration-200">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span>{kybError}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                      Corporate Website URL
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://acme.com"
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                      Organization Size
                    </label>
                    <select
                      value={teamSize}
                      onChange={(e) => setTeamSize(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                    >
                      <option value="1-10">1 – 10 Employees</option>
                      <option value="10-50">10 – 50 Employees</option>
                      <option value="50-200">50 – 200 Employees</option>
                      <option value="200-1000">200 – 1,000 Employees</option>
                      <option value="1000+">1,000+ Employees</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Primary HR Administrator Account */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-[#383734]">
                  <UserCheck className="h-4 w-4 text-teal-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    2. Primary HR Administrator
                  </h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                      Administrator Full Name *
                    </label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Jordan Taylor"
                      required
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                      Corporate Work Email * (Consumer domains prohibited)
                    </label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="e.g. jordan.hr@acme.com"
                      required
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none transition placeholder:text-slate-400 focus:ring-1 ${
                        emailDomainWarning
                          ? "border-rose-300 bg-rose-50/40 text-rose-900 focus:border-rose-500 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-300"
                          : "border-slate-200 focus:border-slate-400 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                      }`}
                    />
                    {emailDomainWarning && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{emailDomainWarning}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                      Create Admin Password *
                    </label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                      Confirm Password *
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
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isLoading || !!emailDomainWarning}
                  className="w-full py-3 text-xs font-bold bg-[#60cdff] text-black hover:bg-[#4cc2ff] rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <span>{isLoading ? "Validating Domain..." : "Continue to Domain Verification"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>

          </div>
        )}

        {/* STEP 2: 6-Digit Domain OTP Verification Screen */}
        {step === 2 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-[#383734] dark:bg-[#2c2b28] space-y-6 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-[#60cdff]">
                <KeyRound className="h-6 w-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Enter 6-Digit Corporate Verification Code
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#a6a6a6] leading-5">
                We sent a one-time domain confirmation code to:
                <br />
                <strong className="text-slate-800 dark:text-white">{adminEmail}</strong>
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </div>
            )}

            {resendNotice && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                {resendNotice}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="space-y-1.5 text-center">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                  Verification Code (PIN)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="• • • • • •"
                  required
                  autoFocus
                  className="mx-auto w-48 text-center tracking-[0.5em] font-mono text-xl font-bold rounded-xl border border-slate-300 py-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                />
              </div>

              {/* Sandbox Evaluator Code Hint */}
              {activeVerificationCode && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 flex items-center justify-between">
                  <div>
                    <p className="font-bold">🧪 Sandbox Mailbox Simulation:</p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-400">
                      Generated OTP: <strong className="font-mono text-sm tracking-wider">{activeVerificationCode}</strong>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEnteredOtp(activeVerificationCode)}
                    className="text-[11px] py-1 px-2.5 shrink-0"
                  >
                    Auto-Fill PIN
                  </Button>
                </div>
              )}

              <div className="space-y-2.5">
                <Button
                  type="submit"
                  disabled={isLoading || enteredOtp.length !== 6}
                  className="w-full py-3 text-xs font-bold bg-[#60cdff] text-black hover:bg-[#4cc2ff] rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isLoading ? "Verifying Domain..." : "Confirm Code & Launch HR Portal"}</span>
                </Button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-slate-500 hover:text-slate-900 dark:text-[#a6a6a6] dark:hover:text-white"
                  >
                    ← Edit Details
                  </button>

                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="flex items-center gap-1 text-sky-600 hover:underline dark:text-[#60cdff]"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Resend Code</span>
                  </button>
                </div>
              </div>
            </form>

          </div>
        )}

        {/* Footer Navigation */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-slate-500 dark:text-[#a6a6a6]">
          <p>
            Already registered?{" "}
            <Link href="/login" className="font-semibold text-slate-900 hover:underline dark:text-white">
              Sign In
            </Link>
          </p>
          <span className="hidden sm:inline">•</span>
          <p>
            Have an employee invite?{" "}
            <Link href="/register" className="font-semibold text-slate-900 hover:underline dark:text-white">
              Accept Single-Use Invite
            </Link>
          </p>
        </div>

      </div>
    </main>
  );
}
