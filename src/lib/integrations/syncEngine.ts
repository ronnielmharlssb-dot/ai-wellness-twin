import type { IntegrationProvider, SyncResult } from "./types";
import { fetchGitHubSignals } from "./githubConnector";
import { parseCalendarBlocksToSignals, type CalendarEventBlock } from "./calendarConnector";
import { signalToMetrics } from "../signals/metricsMapper";
import { saveEmployeeMetricsBatch } from "../wellbeing/employeeMetrics";
import type { EmployeeSignal } from "../signals/types";
import { getUserSettings } from "../settings/userSettings";
import { getLocalSessionUser } from "../supabase/auth";
import { sourceImportQueue } from "./sourceImportQueue";
import { markImportState } from "./integrationStore";

type SyncConfig = {
  username?: string;
  workspaceName?: string;
  calendarEmail?: string;
  email?: string;
  calendarEvents?: CalendarEventBlock[];
  calendarCoverage?: { start: string; end: string };
};

import { getStoredIntegrations, saveStoredIntegrations } from "./integrationStore";
export { DEFAULT_INTEGRATIONS, getStoredIntegrations, saveStoredIntegrations } from "./integrationStore";

export function validateGoogleAccount(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || domain === "localhost" || !domain.includes(".")) return false;
  return true;
}

export function validateDiscordHandle(handle: string): boolean {
  if (!handle) return false;
  const clean = handle.trim().replace(/^@/, "");
  const modernPattern = /^[a-z0-9_.]{2,32}$/i;
  const legacyPattern = /^[a-zA-Z0-9_]{2,32}#[0-9]{4}$/;
  const snowflakePattern = /^[0-9]{17,20}$/;
  return modernPattern.test(clean) || legacyPattern.test(clean) || snowflakePattern.test(clean);
}

export async function syncProvider(
  provider: IntegrationProvider,
  employeeId: string,
  config: SyncConfig
): Promise<SyncResult> {
  const capturedAt = provider === "google_calendar" && config.calendarCoverage ? config.calendarCoverage.end : new Date().toISOString();
  const session = getLocalSessionUser();
  if (!session || session.id !== employeeId || session.role !== "employee") throw new Error("Sign in to your own employee account before syncing.");
  let signals: EmployeeSignal[] = [];
  let connectedAccountLabel = "";

  switch (provider) {
    case "github": {
      const username = config.username?.trim();
      if (!username) {
        throw new Error("Please enter your GitHub username.");
      }
      signals = await fetchGitHubSignals(username, employeeId);
      connectedAccountLabel = `github.com/${username}`;
      break;
    }

    case "vscode": {
      const handle = config.workspaceName?.trim() || config.username?.trim();
      if (!handle) {
        throw new Error("Please enter your VS Code user or workspace handle.");
      }
      connectedAccountLabel = handle;
      break;
    }

    case "chatgpt": {
      const handle = config.workspaceName?.trim();
      if (!handle) {
        throw new Error("Please enter your OpenAI / ChatGPT account email.");
      }
      connectedAccountLabel = handle;
      break;
    }

    case "gemini": {
      const email = config.workspaceName?.trim();
      if (!email || !validateGoogleAccount(email)) {
        throw new Error("A valid Google account email is required.");
      }
      connectedAccountLabel = email;
      break;
    }

    case "claude": {
      const handle = config.workspaceName?.trim();
      if (!handle) {
        throw new Error("Please enter your Anthropic / Claude account email.");
      }
      connectedAccountLabel = handle;
      break;
    }

    case "google_calendar": {
      const email = config.calendarEmail?.trim() || config.email?.trim();
      if (!email || !validateGoogleAccount(email)) {
        throw new Error("A valid Google Calendar account email is required.");
      }
      const rawEvents = config.calendarEvents || [];
      if (config.calendarEvents !== undefined) {
        const settings = getUserSettings(employeeId);
        signals = parseCalendarBlocksToSignals(employeeId, rawEvents, {
          workdayStart: settings.twin.workdayStart, workdayEnd: settings.twin.workdayEnd,
          timeZone: settings.profile?.timezone, workDays: settings.twin.workDays,
          afterHoursObserved: settings.telemetry?.autoCaptureAfterHours !== false,
          coverage: config.calendarCoverage,
        });
      }
      connectedAccountLabel = email;
      break;
    }

    case "figma": {
      const handle = config.workspaceName?.trim();
      if (!handle) {
        throw new Error("Please enter your Figma account email or team handle.");
      }
      connectedAccountLabel = handle;
      break;
    }

    case "slack": {
      const workspace = config.workspaceName?.trim();
      if (!workspace) {
        throw new Error("Please enter your Slack workspace (e.g. acme.slack.com) or username.");
      }
      connectedAccountLabel = workspace;
      break;
    }

    case "discord": {
      const handle = config.workspaceName?.trim();
      if (!handle || !validateDiscordHandle(handle)) {
        throw new Error("Discord Identity Verification Failed: Please enter a valid Discord username (e.g. alex.dev or alex#1234) and confirm that this account belongs to you.");
      }
      connectedAccountLabel = handle.startsWith("@") ? handle : `@${handle}`;
      break;
    }
  }

  // Save genuine incoming tool signals if any real events were retrieved
  if (getLocalSessionUser()?.id !== employeeId) throw new Error("Your active account changed during the sync.");
  let queuedBatch: string | null = null;
  if (signals.length > 0) {
    const dailyMetrics = signals.map(signalToMetrics);
    if (session.source === "supabase") {
      if (provider !== "github" && provider !== "google_calendar") throw new Error("Unsupported import source.");
      queuedBatch = await sourceImportQueue.enqueue(employeeId, provider, dailyMetrics, capturedAt);
    } else saveEmployeeMetricsBatch(dailyMetrics);
  }

  const { calendarEvents, calendarCoverage, ...accountConfig } = config;
  // Coverage belongs to observations, not the linked account's identity.
  void calendarCoverage;
  const fetchedData = provider === "github" || (provider === "google_calendar" && calendarEvents !== undefined);
  const allIntegrations = getStoredIntegrations(employeeId);
  const updated = allIntegrations.map((item) =>
    item.provider === provider
      ? {
          ...item,
          connected: true,
          lastSyncedAt: fetchedData && !queuedBatch ? new Date().toISOString() : item.lastSyncedAt,
          dataStatus: queuedBatch ? "pending" as const : fetchedData ? "synced" as const : "awaiting_data" as const,
          ...(queuedBatch ? { lastImportCapturedAt: capturedAt } : {}),
          config: { ...item.config, ...accountConfig, accountLabel: connectedAccountLabel },
        }
      : item
  );
  saveStoredIntegrations(updated, employeeId);
  let outcome: "synced" | "pending" | "needs_review" = "synced";
  if (queuedBatch) {
    outcome = "pending";
    try { outcome = await sourceImportQueue.upload(employeeId, queuedBatch); }
    catch { /* Persisted imports remain queued if the device store is temporarily unavailable. */ }
    if (getLocalSessionUser()?.id !== employeeId) throw new Error("Your active account changed during the sync. The import is retained for its original account.");
    if (outcome !== "pending") markImportState(employeeId, provider, capturedAt, outcome);
  }

  // Dispatch custom browser event for live telemetry UI updates
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("wellness-telemetry-update"));
  }

  return {
    provider,
    success: true,
    daysSynced: outcome === "synced" ? signals.length : 0,
    pending: outcome !== "synced",
    message: outcome === "needs_review" ? "The import was rejected and retained for review. Open the queued imports notice for details."
      : outcome === "pending" ? sourceImportQueue.hasUnsavedImports(employeeId)
        ? "The import could not be saved on this device. Keep this page open and retry from the imports notice."
        : `Queued ${signals.length} days from ${connectedAccountLabel}. Uploads will retry while you are signed in on the dashboard.`
      : fetchedData
      ? `Imported ${signals.length} days from ${connectedAccountLabel}.`
      : `Linked ${connectedAccountLabel}. Waiting for measured activity from a collector.`,
  };
}
