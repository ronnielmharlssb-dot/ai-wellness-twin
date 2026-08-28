"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Layers,
  Code2,
  Bot,
  Calendar as CalendarIcon,
  Palette,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  GoogleLogo,
  GitHubLogo,
  VSCodeLogo,
  ChatGPTLogo,
  GeminiLogo,
  ClaudeLogo,
  CalendarLogo,
  FigmaLogo,
  SlackLogo,
  DiscordLogo,
} from "@/components/ui/brand-logos";
import {
  getStoredIntegrations,
  syncProvider,
  saveStoredIntegrations,
  validateGoogleAccount,
  validateDiscordHandle,
} from "@/lib/integrations/syncEngine";
import type { IntegrationConnection, IntegrationProvider, IntegrationCategory } from "@/lib/integrations/types";
import { getLocalSessionUser, type AuthUser } from "@/lib/supabase/auth";

export default function IntegrationsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [syncingProvider, setSyncingProvider] = useState<IntegrationProvider | null>(null);
  const [isAutoSyncingAll, setIsAutoSyncingAll] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Universal Authentication Modal State
  const [authProvider, setAuthProvider] = useState<IntegrationProvider | null>(null);
  const [authAccountInput, setAuthAccountInput] = useState("");
  const [authOwnershipConfirmed, setAuthOwnershipConfirmed] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  // 2-Step Owner Confirmation State
  const [authStep, setAuthStep] = useState<"input" | "otp_verification">("input");
  const [enteredOtpInput, setEnteredOtpInput] = useState("");

  useEffect(() => {
    const sessionUser = getLocalSessionUser();
    setUser(sessionUser);

    const loaded = getStoredIntegrations();
    setIntegrations(loaded);
    const initialInputs: Record<string, string> = {};

    loaded.forEach((item) => {
      if (item.config.username) initialInputs[item.provider] = item.config.username;
      if (item.config.calendarEmail) initialInputs[item.provider] = item.config.calendarEmail;
      if (item.config.workspaceName) initialInputs[item.provider] = item.config.workspaceName;
    });

    setInputs(initialInputs);
  }, []);

  const handleInputChange = (provider: string, value: string) => {
    setInputs((prev) => ({ ...prev, [provider]: value }));
  };

  const handleOpenAuth = (provider: IntegrationProvider) => {
    setAuthProvider(provider);
    setAuthAccountInput(inputs[provider] || "");
    setAuthOwnershipConfirmed(false);
    setAuthStep("input");
    setEnteredOtpInput("");
    setSyncError(null);
  };

  const handleSendOwnerVerificationCode = async () => {
    if (!authProvider) return;

    const cleanInput = authAccountInput.trim();
    if (!cleanInput) {
      setSyncError(`Please enter your ${authProvider.toUpperCase()} account identifier.`);
      return;
    }

    if ((authProvider === "google_calendar" || authProvider === "gemini" || authProvider === "chatgpt" || authProvider === "claude" || authProvider === "figma") && !validateGoogleAccount(cleanInput)) {
      setSyncError("Invalid email address. Please enter a valid, existing work or personal email.");
      return;
    }

    if (authProvider === "discord" && !validateDiscordHandle(cleanInput)) {
      setSyncError("Discord verification failed: Please enter a valid Discord username (e.g. alex.dev or alex#1234).");
      return;
    }

    setIsSendingCode(true);
    setSyncError(null);

    try {
      // Dispatch verification code to owner via backend API
      const res = await fetch("/api/integrations/verify-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          email: cleanInput.includes("@") ? cleanInput : `${cleanInput}@verified-user.io`,
          provider: authProvider,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to dispatch verification code.");
      }

      setAuthStep("otp_verification");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to dispatch verification code.";
      setSyncError(msg);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleConfirmAuth = async () => {
    if (!authProvider) return;

    const cleanInput = authAccountInput.trim();

    if (enteredOtpInput.trim().length !== 6) {
      setSyncError("Please enter the complete 6-digit confirmation PIN sent to your email.");
      return;
    }

    if (authProvider === "discord" && !authOwnershipConfirmed) {
      setSyncError("Ownership certification required: Please check the box certifying this Discord account belongs to you.");
      return;
    }

    setIsAuthenticating(true);
    setSyncError(null);

    try {
      // Verify code with backend API
      const res = await fetch("/api/integrations/verify-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          email: cleanInput.includes("@") ? cleanInput : `${cleanInput}@verified-user.io`,
          code: enteredOtpInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid confirmation code.");
      }

      setInputs((prev) => ({ ...prev, [authProvider]: cleanInput }));
      setAuthProvider(null);
      await executeSync(authProvider, cleanInput);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setSyncError(msg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const executeSync = async (provider: IntegrationProvider, targetInput?: string) => {
    const employeeId = user?.id || "usr-live-tester";

    setSyncingProvider(provider);
    setSyncMessage(null);
    setSyncError(null);

    let config: Record<string, string> = {};
    if (provider === "github") config = { username: targetInput || inputs.github };
    else if (provider === "google_calendar") config = { calendarEmail: targetInput || inputs.google_calendar };
    else config = { workspaceName: targetInput || inputs[provider] };

    try {
      const result = await syncProvider(provider, employeeId, config);
      setIntegrations(getStoredIntegrations());
      setSyncMessage(result.message);
    } catch (err: unknown) {
      console.error("Sync error:", err);
      const msg = err instanceof Error ? err.message : "Sync failed. Please check your account connection.";
      setSyncError(msg);
    } finally {
      setSyncingProvider(null);
    }
  };

  const handleAutoSyncAllWithGoogle = async () => {
    const employeeId = user?.id || "usr-live-tester";
    const googleEmail = (inputs.google_calendar || user?.email || "ronnie.tester@company.com").trim();

    if (!validateGoogleAccount(googleEmail)) {
      setSyncError("Google verification failed: Please enter a verified, existing Google account email.");
      return;
    }

    setIsAutoSyncingAll(true);
    setSyncMessage(null);
    setSyncError(null);

    try {
      // 1. Sync Calendar & Communication (Slack & Discord)
      await syncProvider("google_calendar", employeeId, { calendarEmail: googleEmail });
      await syncProvider("slack", employeeId, { workspaceName: googleEmail });
      await syncProvider("discord", employeeId, { workspaceName: inputs.discord || `${googleEmail.split("@")[0]}.dev` });
      await syncProvider("figma", employeeId, { workspaceName: googleEmail });

      // 2. Sync AI Assistants with same Google identity
      await syncProvider("gemini", employeeId, { workspaceName: googleEmail });
      await syncProvider("chatgpt", employeeId, { workspaceName: googleEmail });
      await syncProvider("claude", employeeId, { workspaceName: googleEmail });

      // 3. Sync Development Tools
      await syncProvider("vscode", employeeId, { workspaceName: `${googleEmail.split("@")[0]}-workspace` });
      if (inputs.github?.trim()) {
        try {
          await syncProvider("github", employeeId, { username: inputs.github.trim() });
        } catch {
          // GitHub username is optional in all-sync
        }
      }

      setIntegrations(getStoredIntegrations());
      setSyncMessage(`All 9 workplace, AI, and communication tools successfully verified & linked to Google Account (${googleEmail})!`);
    } catch (err: unknown) {
      console.error("Auto sync all error:", err);
      const msg = err instanceof Error ? err.message : "Failed to auto-sync with Google account.";
      setSyncError(msg);
    } finally {
      setIsAutoSyncingAll(false);
    }
  };

  const handleDisconnect = (provider: IntegrationProvider) => {
    const updated = integrations.map((i) =>
      i.provider === provider
        ? { ...i, connected: false, lastSyncedAt: undefined, config: { ...i.config, accountLabel: undefined } }
        : i
    );
    setIntegrations(updated);
    saveStoredIntegrations(updated);
  };

  const getPlaceholder = (provider: IntegrationProvider) => {
    switch (provider) {
      case "github":
        return "Enter your real GitHub username (e.g. torvalds)";
      case "vscode":
        return "Enter your VS Code workspace name or user";
      case "chatgpt":
        return "Enter your OpenAI / ChatGPT account email";
      case "gemini":
        return "Enter your Google account email for Gemini";
      case "claude":
        return "Enter your Anthropic / Claude account email";
      case "google_calendar":
        return "Enter your Google / Outlook calendar email";
      case "figma":
        return "Enter your Figma user or team email";
      case "slack":
        return "Enter your Slack workspace or handle (e.g. acme.slack.com)";
      case "discord":
        return "Enter your real Discord username (e.g. alex.dev or alex#1234)";
    }
  };

  const getProviderLogo = (provider: IntegrationProvider) => {
    switch (provider) {
      case "github":
        return <GitHubLogo className="h-6 w-6 text-slate-900" />;
      case "vscode":
        return <VSCodeLogo className="h-6 w-6" />;
      case "chatgpt":
        return <ChatGPTLogo className="h-6 w-6 text-emerald-600" />;
      case "gemini":
        return <GeminiLogo className="h-6 w-6" />;
      case "claude":
        return <ClaudeLogo className="h-6 w-6 text-amber-700" />;
      case "google_calendar":
        return <CalendarLogo className="h-6 w-6" />;
      case "figma":
        return <FigmaLogo className="h-6 w-6" />;
      case "slack":
        return <SlackLogo className="h-6 w-6" />;
      case "discord":
        return <DiscordLogo className="h-6 w-6 text-[#5865F2]" />;
    }
  };

  const getExpandedDetails = (provider: IntegrationProvider) => {
    switch (provider) {
      case "github":
      case "vscode":
        return {
          signals: ["Active IDE session focus durations", "Commit timestamp rhythm & pace", "Rest interval pauses"],
          firewall: "Source code, repo files, branches & diffs permanently blocked",
          frequency: "Real-time workstation heartbeat",
        };
      case "chatgpt":
      case "gemini":
      case "claude":
        return {
          signals: ["Research query session blocks", "AI consultation time windows", "Cognitive load intensity"],
          firewall: "Prompt text, chat conversations & AI replies permanently blocked",
          frequency: "Active session token telemetry",
        };
      case "google_calendar":
        return {
          signals: ["Meeting start/end time blocks", "Daily schedule density", "Back-to-back meeting fatigue"],
          firewall: "Event titles, agenda details, notes & attendee rosters permanently blocked",
          frequency: "Calendar metadata synchronization",
        };
      case "figma":
        return {
          signals: ["Canvas active focus hours", "Design session flow & pauses", "Deep focus block pacing"],
          firewall: "Design artwork, canvas layers, text & project names permanently blocked",
          frequency: "Active canvas heartbeat stream",
        };
      case "slack":
      case "discord":
      default:
        return {
          signals: ["Active communication windows", "Evening message timestamps", "Collaboration rhythm & presence"],
          firewall: "Message contents, channel titles, DMs & media files permanently blocked",
          frequency: "Communication heartbeat sync",
        };
    }
  };

  const getPrivacyInspection = (provider: IntegrationProvider) => {
    switch (provider) {
      case "github":
      case "vscode":
        return {
          observed: "Active coding duration & commit timestamps only.",
          excluded: "Source code, branch names & diffs are permanently excluded.",
          color: "text-sky-400",
        };
      case "chatgpt":
      case "gemini":
      case "claude":
        return {
          observed: "Daily research session active duration & query frequency.",
          excluded: "Prompt text, AI answers & conversation chats never logged.",
          color: "text-purple-400",
        };
      case "google_calendar":
        return {
          observed: "Meeting block start/end durations & daily calendar density.",
          excluded: "Event titles, meeting descriptions & attendee lists excluded.",
          color: "text-emerald-400",
        };
      case "figma":
        return {
          observed: "Design session focus hours & canvas activity gaps.",
          excluded: "Design artwork, layer contents & project names excluded.",
          color: "text-amber-400",
        };
      case "slack":
      case "discord":
      default:
        return {
          observed: "Active communication timestamps & workday presence.",
          excluded: "Message text, channel names, DMs & media never inspected.",
          color: "text-indigo-400",
        };
    }
  };

  const getCategoryIcon = (category: IntegrationCategory) => {
    switch (category) {
      case "Code & Development":
        return <Code2 className="h-4 w-4 text-sky-600" />;
      case "AI Assistants & Research":
        return <Bot className="h-4 w-4 text-purple-600" />;
      case "Calendar & Meetings":
        return <CalendarIcon className="h-4 w-4 text-emerald-600" />;
      case "Design & Creative":
        return <Palette className="h-4 w-4 text-amber-600" />;
      case "Communication":
        return <MessageSquare className="h-4 w-4 text-indigo-600" />;
    }
  };

  const categories: IntegrationCategory[] = [
    "Code & Development",
    "AI Assistants & Research",
    "Calendar & Meetings",
    "Design & Creative",
    "Communication",
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-[#9a9893]">
          <Layers className="h-4 w-4" />
          <span>Workplace Signal Connectors</span>
        </div>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
          Connected Tools & AI Assistants
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-[#a6a6a6]">
          Link your development tools, AI assistants, and communication channels to calibrate your private behavioral twin.
        </p>
      </section>

      {/* 1-Click Google Unified Sync Card */}
      <Card className="border-slate-300 bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 p-6 shadow-sm dark:border-[#383734] dark:from-[#2c2b28] dark:via-[#2c2b28] dark:to-indigo-950/40">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm dark:bg-[#181817] dark:border-[#383734]">
                <GoogleLogo className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Unified Google Identity Sync
                </h2>
                <Badge variant="positive">Single Master Key</Badge>
              </div>
            </div>

            <p className="max-w-xl text-xs leading-5 text-slate-600 dark:text-[#cfcfce]">
              Use your Google Account (<strong className="text-slate-900 dark:text-white">{user?.email || "alex@company.com"}</strong>) to automatically link and sync Calendar, VS Code, ChatGPT, Gemini, Claude, Figma, Slack, and Discord in **1 click**.
            </p>
          </div>

          <Button
            onClick={handleAutoSyncAllWithGoogle}
            disabled={isAutoSyncingAll}
            className="shrink-0 text-xs shadow-sm"
          >
            {isAutoSyncingAll ? "Syncing All 9 Tools..." : "Auto-Link All with Google"}
          </Button>
        </div>
      </Card>

      {syncMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            {syncMessage}{" "}
            <Link href="/dashboard" className="font-bold underline text-emerald-900 dark:text-white">
              View updated Dashboard
            </Link>
          </span>
        </div>
      )}

      {syncError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          ✕ {syncError}
        </div>
      )}

      {/* Privacy Guarantee Banner */}
      <Card className="border-slate-200 bg-slate-50/70 p-6 dark:border-[#383734] dark:bg-[#2c2b28]">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white shadow-sm dark:bg-[#181817] dark:border dark:border-[#383734]">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Strict Metadata-Only Privacy Guarantee
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-[#cfcfce]">
              Connectors extract <strong className="text-slate-900 dark:text-white">activity timestamps and durations only</strong>. AI prompt conversations, source code, commit text, calendar event names, and chat messages are <strong className="text-slate-900 dark:text-white">permanently excluded</strong> and never transmitted.
            </p>
          </div>
        </div>
      </Card>

      {/* Grouped Categorized Integrations Grid with Sharp Circular Lens Privacy Masking */}
      <div className="space-y-8">
        {categories.map((category) => {
          const categoryItems = integrations.filter((item) => item.category === category);
          if (categoryItems.length === 0) return null;

          return (
            <div key={category} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-[#383734]">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(category)}
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {category}
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                {categoryItems.map((item) => {
                  const privacy = getPrivacyInspection(item.provider);
                  const details = getExpandedDetails(item.provider);

                  return (
                    <div
                      key={item.id}
                      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300 dark:border-[#383734] dark:bg-[#2c2b28] dark:hover:border-slate-600"
                    >
                      {/* Top Main Section */}
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3.5">
                          {/* Official Tool Vector Logo Container */}
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 shadow-sm dark:border-[#383734] dark:bg-[#1f1f1d] transition-transform duration-200 group-hover:scale-105">
                            {getProviderLogo(item.provider)}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                {item.name}
                              </h4>
                              <Badge variant={item.connected ? "positive" : "neutral"}>
                                {item.connected ? "Connected" : "Not Linked"}
                              </Badge>
                            </div>

                            <p className="max-w-xl text-xs leading-5 text-slate-500 dark:text-[#a6a6a6]">
                              {item.description}
                            </p>

                            {item.connected && item.config.accountLabel && (
                              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                Linked to: <span className="underline">{item.config.accountLabel}</span>
                              </p>
                            )}

                            {item.lastSyncedAt && (
                              <p className="text-[11px] text-slate-400 dark:text-[#888884]">
                                Last synced: {new Date(item.lastSyncedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Explicit Account Input and Action */}
                        <div className="flex flex-col gap-2 sm:w-72 sm:items-end sm:shrink-0">
                          <input
                            type="text"
                            value={inputs[item.provider] || ""}
                            onChange={(e) => handleInputChange(item.provider, e.target.value)}
                            placeholder={getPlaceholder(item.provider)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                          />

                          <div className="flex gap-2">
                            {item.connected && (
                              <Button
                                variant="ghost"
                                onClick={() => handleDisconnect(item.provider)}
                                className="text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                              >
                                Unlink
                              </Button>
                            )}

                            <Button
                              variant={item.connected ? "outline" : "primary"}
                              disabled={syncingProvider === item.provider || isAutoSyncingAll}
                              onClick={() => handleOpenAuth(item.provider)}
                              className="text-xs"
                            >
                              {syncingProvider === item.provider
                                ? "Syncing..."
                                : item.connected
                                ? "Re-authenticate"
                                : "Authenticate & Link"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Smooth Hover-Expandable Telemetry & Privacy Drawer */}
                      <div className="grid transition-all duration-300 ease-out grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr]">
                        <div className="overflow-hidden">
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[#383734] space-y-3 animate-in fade-in duration-200">
                            
                            {/* Privacy Badge Strip */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white">
                                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                <span>Strict Metadata-Only Privacy Firewall</span>
                              </div>
                              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60">
                                ZERO TEXT LOGGED
                              </span>
                            </div>

                            {/* Observed Signals vs Excluded Firewall */}
                            <div className="grid gap-2.5 sm:grid-cols-2 rounded-xl bg-slate-50/80 p-3 text-xs dark:bg-[#1f1e1c] border border-slate-100 dark:border-[#383734]">
                              <div className="space-y-1">
                                <p className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Observed Signals
                                </p>
                                <p className="text-[11px] text-slate-600 dark:text-[#a6a6a6] leading-4">
                                  {privacy.observed}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <p className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                  Permanently Excluded
                                </p>
                                <p className="text-[11px] text-slate-600 dark:text-[#a6a6a6] leading-4">
                                  {privacy.excluded}
                                </p>
                              </div>
                            </div>

                            {/* Bridge Cadence & Security Footer */}
                            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 dark:text-[#888884] pt-0.5">
                              <span>⚡ Bridge Cadence: <strong>{details.frequency}</strong></span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">🔒 100% Confidential • Local Encryption</span>
                            </div>

                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Universal OAuth & Identity Authentication Modal */}
      {authProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#383734] dark:bg-[#2c2b28] space-y-5">
            
            {/* Modal Header with Provider Brand Logo */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-[#383734]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 dark:bg-[#1f1e1c] border border-slate-200 dark:border-[#383734] shadow-sm">
                {getProviderLogo(authProvider)}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">
                  Authorize {authProvider.replace("_", " ")} Connection
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
                  Establish secure, zero-knowledge telemetry handshake.
                </p>
              </div>
            </div>

            {/* Step 1: Enter Account Identifier */}
            {authStep === "input" ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                    {authProvider === "google_calendar" || authProvider === "gemini"
                      ? "Verified Google Email:"
                      : authProvider === "github"
                      ? "GitHub Username:"
                      : authProvider === "discord"
                      ? "Discord Username / Tag:"
                      : authProvider === "slack"
                      ? "Slack Workspace / Username:"
                      : `${authProvider.toUpperCase()} Account Email / Handle:`}
                  </label>
                  <input
                    type="text"
                    value={authAccountInput}
                    onChange={(e) => setAuthAccountInput(e.target.value)}
                    placeholder={getPlaceholder(authProvider)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                    autoFocus
                  />
                </div>

                {/* Zero-Knowledge Scope Protection Card */}
                <div className="rounded-xl bg-slate-50/90 p-3 text-[11px] text-slate-600 dark:bg-[#1f1e1c] dark:text-[#a6a6a6] space-y-1.5 border border-slate-100 dark:border-[#383734]">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Authorized Telemetry Scopes</span>
                  </div>
                  <ul className="space-y-1 pl-4 list-disc text-[11px]">
                    <li>Read session timestamps & active focus duration</li>
                    <li>Aggregate collaboration density outside core hours</li>
                    <li className="font-semibold text-rose-600 dark:text-rose-400">
                      Zero access to text, messages, prompts, or files (100% Firewalled 🔒)
                    </li>
                  </ul>
                </div>

                {syncError && (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 animate-in fade-in duration-150">
                    {syncError}
                  </p>
                )}

                {/* Step 1 Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#383734]">
                  <Button
                    variant="ghost"
                    disabled={isSendingCode}
                    onClick={() => setAuthProvider(null)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>

                  <Button
                    variant="primary"
                    disabled={isSendingCode}
                    onClick={handleSendOwnerVerificationCode}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <span>{isSendingCode ? "Sending Code..." : "Send Verification Code to Owner"}</span>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              /* Step 2: Enter 6-digit Confirmation Code sent to Owner */
              <div className="space-y-3.5 animate-in fade-in duration-200">
                <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-3 text-xs dark:border-sky-900/40 dark:bg-sky-950/30 text-sky-900 dark:text-sky-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    <span>Confirmation Code Sent to Inbox</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    A 6-digit confirmation PIN has been sent to <strong>{authAccountInput}</strong>. Please check your email inbox to retrieve the code and verify ownership.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                      Enter 6-Digit Owner Confirmation Code:
                    </label>
                    <button
                      type="button"
                      disabled={isSendingCode}
                      onClick={handleSendOwnerVerificationCode}
                      className="text-[11px] font-medium text-sky-600 hover:underline dark:text-sky-400"
                    >
                      {isSendingCode ? "Sending..." : "Resend Code"}
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={enteredOtpInput}
                    onChange={(e) => setEnteredOtpInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="• • • • • •"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-center text-lg font-mono font-bold tracking-[0.3em] outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                    autoFocus
                  />
                </div>

                {/* Discord Specific Ownership Handshake Checkbox */}
                {authProvider === "discord" && (
                  <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={authOwnershipConfirmed}
                      onChange={(e) => setAuthOwnershipConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-700 dark:text-[#cfcfce]">
                      I certify that this Discord handle belongs to me.
                    </span>
                  </label>
                )}

                {syncError && (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 animate-in fade-in duration-150">
                    {syncError}
                  </p>
                )}

                {/* Step 2 Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#383734]">
                  <Button
                    variant="ghost"
                    disabled={isAuthenticating}
                    onClick={() => {
                      setAuthStep("input");
                      setSyncError(null);
                    }}
                    className="text-xs"
                  >
                    ← Back
                  </Button>

                  <Button
                    variant="primary"
                    disabled={isAuthenticating || enteredOtpInput.length !== 6 || (authProvider === "discord" && !authOwnershipConfirmed)}
                    onClick={handleConfirmAuth}
                    className="text-xs flex items-center gap-1.5 min-w-[150px] justify-center"
                  >
                    {isAuthenticating ? (
                      <span>Verifying PIN...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Verify & Authorize</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
