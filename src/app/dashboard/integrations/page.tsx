"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStoredIntegrations, saveStoredIntegrations, syncProvider } from "@/lib/integrations/syncEngine";
import type { IntegrationConnection, IntegrationProvider } from "@/lib/integrations/types";
import { getLocalSessionUser } from "@/lib/supabase/auth";
import { sourceImportQueue } from "@/lib/integrations/sourceImportQueue";

const AUTH_PROVIDERS: IntegrationProvider[] = ["github", "google_calendar", "gemini", "discord", "slack"];
const providerObservation = (provider: IntegrationProvider) => {
  if (provider === "github") return "Imports public commit and pull-request event counts. These events do not measure working hours or breaks.";
  if (provider === "google_calendar") return "Imports the past 28 days of scheduled meeting start and end times. Scheduled time does not prove attendance.";
  return "No activity collector is available yet. Verifying an account does not supply tool usage measurements.";
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [activeProvider, setActiveProvider] = useState<IntegrationProvider | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const authPopupRef = useRef<Window | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const sessionUser = getLocalSessionUser();
    if (!sessionUser) return;
    setIntegrations(getStoredIntegrations(sessionUser.id));
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !authPopupRef.current || event.source !== authPopupRef.current) return;
      if (event.data?.employeeId !== sessionUser.id || getLocalSessionUser()?.id !== sessionUser.id || savingRef.current) return;
      const data = event.data;
      let provider: IntegrationProvider;
      let config;
      if (data.type === "GITHUB_OAUTH_SUCCESS" && typeof data.username === "string" && data.username) {
        provider = "github"; config = { username: data.username };
      } else if (data.type === "GOOGLE_OAUTH_SUCCESS" && typeof data.email === "string" && data.email) {
        if (data.provider !== "google_calendar" && data.provider !== "gemini") return;
        provider = data.provider;
        if (provider === "google_calendar" && !Array.isArray(data.events)) return;
        if (provider === "google_calendar" && (typeof data.coverage?.start !== "string" || typeof data.coverage?.end !== "string")) return;
        config = provider === "google_calendar" ? { calendarEmail: data.email, calendarEvents: data.events, calendarCoverage: data.coverage } : { workspaceName: data.email };
      } else if (data.type === "DISCORD_OAUTH_SUCCESS" && typeof data.username === "string" && data.username) {
        provider = "discord"; config = { workspaceName: data.username };
      } else if (data.type === "SLACK_OAUTH_SUCCESS" && typeof data.workspace === "string" && data.workspace) {
        provider = "slack"; config = { workspaceName: data.workspace };
      } else return;
      savingRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      authPopupRef.current = null;
      try {
        const result = await syncProvider(provider, sessionUser.id, config);
        setIntegrations(getStoredIntegrations(sessionUser.id));
        setSyncMessage(result.message);
        setSyncPending(!!result.pending);
        setSyncError(null);
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : "The verified account could not be saved or imported.");
      } finally {
        savingRef.current = false;
        setActiveProvider(null);
      }
    };
    window.addEventListener("message", handleOAuthMessage);
    const refreshImports = () => { if (getLocalSessionUser()?.id === sessionUser.id) setIntegrations(getStoredIntegrations(sessionUser.id)); };
    window.addEventListener("wellness-import-queue-update", refreshImports);
    return () => {
      window.removeEventListener("message", handleOAuthMessage);
      window.removeEventListener("wellness-import-queue-update", refreshImports);
      if (timerRef.current) clearInterval(timerRef.current);
      authPopupRef.current?.close();
      authPopupRef.current = null;
    };
  }, []);

  const authorize = (provider: IntegrationProvider) => {
    if (savingRef.current || !getLocalSessionUser()) return;
    setSyncError(null);
    setSyncMessage(null);
    const popup = window.open("/api/integrations/authorize?provider=" + provider, "WellnessProviderAuthorization", "width=520,height=740");
    if (!popup) { setSyncError("Allow the authorization popup to verify your account."); return; }
    authPopupRef.current = popup;
    setActiveProvider(provider);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (popup.closed) {
        if (timerRef.current) clearInterval(timerRef.current);
        authPopupRef.current = null;
        if (!savingRef.current) setActiveProvider(null);
      }
    }, 600);
  };

  const disconnect = async (provider: IntegrationProvider) => {
    const user = getLocalSessionUser();
    if (!user) return;
    const updated = integrations.map((item) => item.provider === provider
      ? { ...item, connected: false, lastSyncedAt: undefined, lastImportCapturedAt: undefined, dataStatus: undefined, config: {} } : item);
    try {
      setActiveProvider(provider);
      if (user.source === "supabase" && (provider === "github" || provider === "google_calendar")) await sourceImportQueue.cancelProvider(user.id, provider);
      if (getLocalSessionUser()?.id !== user.id) return;
      saveStoredIntegrations(updated, user.id);
      setIntegrations(updated);
      setSyncPending(false);
      setSyncMessage(user.source === "supabase" && (provider === "github" || provider === "google_calendar")
        ? "Account unlinked on this device. Queued uploads were cancelled and retained for review. Previously imported observations remain in your history."
        : "Account unlinked on this device. Previously imported observations remain in your history.");
    } catch { setSyncError("The account could not be unlinked or its queued uploads cancelled on this device."); }
    finally { setActiveProvider(null); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Data integrations</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Verify each account separately. Your insights use available observations; a linked account alone does not establish work hours, breaks or wellbeing.</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#383734] dark:bg-[#2c2b28]">
        <h2 className="font-semibold text-slate-900 dark:text-white">Import Google Calendar</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Choose your Google account and authorize a calendar import. The importer retains event times and excludes titles, descriptions and attendees. Reauthorize to import again; automatic background sync is not available yet.</p>
        <Button className="mt-4" disabled={activeProvider !== null} onClick={() => authorize("google_calendar")}>Authorize calendar import</Button>
      </div>
      {activeProvider && <p role="status" className="text-sm text-sky-700 dark:text-sky-300">Complete authorization in the popup. Importing data may take a moment.</p>}
      {syncMessage && <p role="status" className={syncPending ? "text-sm text-amber-700 dark:text-amber-300" : "text-sm text-emerald-700 dark:text-emerald-300"}>{syncMessage}</p>}
      {syncError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{syncError}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((item) => (
          <div key={item.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#383734] dark:bg-[#2c2b28]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-900 dark:text-white">{item.name}</h2>
              <Badge variant={item.connected ? "positive" : "neutral"}>{item.connected ? "Account linked" : "Not linked"}</Badge>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">{providerObservation(item.provider)}</p>
            {item.connected && item.config.accountLabel && <p className="text-xs text-slate-600 dark:text-slate-300">Account: {item.config.accountLabel}</p>}
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.dataStatus === "pending" ? "Import queued on this device" : item.dataStatus === "needs_review" ? "Import retained for review" : item.dataStatus === "synced" && item.lastSyncedAt ? "Last import: " + new Date(item.lastSyncedAt).toLocaleString() : "No imported data"}</p>
            <div className="flex flex-wrap gap-2">
              {AUTH_PROVIDERS.includes(item.provider) ? (
                <Button variant="outline" disabled={activeProvider !== null} onClick={() => authorize(item.provider)}>{item.connected ? "Reauthorize" : "Verify account"}</Button>
              ) : <span className="text-xs text-slate-500 dark:text-slate-400">Collector not available</span>}
              {item.connected && <Button variant="ghost" disabled={activeProvider !== null} onClick={() => void disconnect(item.provider)}>Unlink</Button>}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">The dashboard measures its own browser presence separately. That time is not attributed to other tools. Cloud accounts keep acknowledged imports in private cloud history; pending imports and linked-account settings are kept on this device.</p>
    </div>
  );
}
