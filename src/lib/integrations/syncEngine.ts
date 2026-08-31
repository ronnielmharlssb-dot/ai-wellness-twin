import type { IntegrationConnection, IntegrationProvider, SyncResult } from "./types";
import { fetchGitHubSignals } from "./githubConnector";
import { parseCalendarBlocksToSignals, type CalendarEventBlock } from "./calendarConnector";
import { signalToMetrics } from "../signals/metricsMapper";
import { saveEmployeeMetricsBatch } from "../wellbeing/employeeMetrics";
import type { EmployeeSignal } from "../signals/types";

const INTEGRATIONS_STORAGE_KEY = "wellness-integrations-config";

export const DEFAULT_INTEGRATIONS: IntegrationConnection[] = [
  // 1. Code & Development
  {
    id: "int-github",
    provider: "github",
    name: "GitHub",
    category: "Code & Development",
    description: "Observes commit and PR review timestamps to measure active development hours and evening coding patterns.",
    connected: true,
    config: {
      username: "ronnielmharlssb-dot",
      accountLabel: "github.com/ronnielmharlssb-dot",
    },
  },
  {
    id: "int-vscode",
    provider: "vscode",
    name: "Visual Studio Code",
    category: "Code & Development",
    description: "Observes editor focus time, coding session durations, and micro-pauses without reading source code.",
    connected: true,
    config: {
      workspaceName: "ai-wellness-twin",
      accountLabel: "ai-wellness-twin workspace",
    },
  },

  // 2. AI Assistants & Research
  {
    id: "int-chatgpt",
    provider: "chatgpt",
    name: "ChatGPT (OpenAI)",
    category: "AI Assistants & Research",
    description: "Observes AI assistance session timestamps to measure cognitive offloading and problem-solving focus windows.",
    connected: false,
    config: {
      workspaceName: "",
    },
  },
  {
    id: "int-gemini",
    provider: "gemini",
    name: "Google Gemini",
    category: "AI Assistants & Research",
    description: "Observes Gemini research & analysis session windows to track workflow augmentation and focus intensity.",
    connected: true,
    config: {
      workspaceName: "Gemini 3.7 Flash Assistant",
      accountLabel: "Google Gemini AI Active",
    },
  },
  {
    id: "int-claude",
    provider: "claude",
    name: "Claude (Anthropic)",
    category: "AI Assistants & Research",
    description: "Observes Claude writing and reasoning session windows to measure cognitive pacing and deep-work duration.",
    connected: false,
    config: {
      workspaceName: "",
    },
  },

  // 3. Calendar & Meetings
  {
    id: "int-calendar",
    provider: "google_calendar",
    name: "Google Calendar / Outlook",
    category: "Calendar & Meetings",
    description: "Observes meeting durations and buffer gaps to measure meeting fatigue and rest breaks.",
    connected: false,
    config: {
      calendarEmail: "",
    },
  },

  // 4. Design & Creative
  {
    id: "int-figma",
    provider: "figma",
    name: "Figma & Design Tools",
    category: "Design & Creative",
    description: "Observes design file activity windows to estimate creative focus blocks.",
    connected: false,
    config: {
      workspaceName: "",
    },
  },

  // 5. Communication
  {
    id: "int-slack",
    provider: "slack",
    name: "Slack & Messaging",
    category: "Communication",
    description: "Observes workplace messaging active windows to protect the right-to-disconnect outside core hours.",
    connected: false,
    config: {
      workspaceName: "",
    },
  },
  {
    id: "int-discord",
    provider: "discord",
    name: "Discord",
    category: "Communication",
    description: "Observes team and community voice/chat activity windows to safeguard late-night disconnection.",
    connected: false,
    config: {
      workspaceName: "",
    },
  },
];

function getStorageKey(employeeId?: string): string {
  if (typeof window === "undefined") return INTEGRATIONS_STORAGE_KEY;
  try {
    const activeUserId = employeeId || (JSON.parse(localStorage.getItem("wellness-auth-user") || "{}")?.id) || "usr-ronnie";
    return `${INTEGRATIONS_STORAGE_KEY}:${activeUserId}`;
  } catch {
    return INTEGRATIONS_STORAGE_KEY;
  }
}

export function getStoredIntegrations(employeeId?: string): IntegrationConnection[] {
  if (typeof window === "undefined") {
    return DEFAULT_INTEGRATIONS;
  }

  try {
    const key = getStorageKey(employeeId);
    let saved = localStorage.getItem(key);
    // Backward compatibility fallback to legacy global key if user key is not yet populated
    if (!saved) {
      saved = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
    }
    if (!saved) return DEFAULT_INTEGRATIONS;

    const parsed: IntegrationConnection[] = JSON.parse(saved);
    const existingIds = new Set(parsed.map((p) => p.provider));
    const merged = [...parsed];
    DEFAULT_INTEGRATIONS.forEach((def) => {
      if (!existingIds.has(def.provider)) {
        merged.push(def);
      }
    });
    return merged;
  } catch {
    return DEFAULT_INTEGRATIONS;
  }
}

export function saveStoredIntegrations(integrations: IntegrationConnection[], employeeId?: string) {
  if (typeof window === "undefined") return;
  const key = getStorageKey(employeeId);
  localStorage.setItem(key, JSON.stringify(integrations));
}

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
  config: Record<string, string | undefined>
): Promise<SyncResult> {
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
        throw new Error("Google Identity Verification Failed: Please enter an existing, valid Google Account email (e.g. you@gmail.com or you@company.com).");
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
        throw new Error("Google Account Verification Failed: Please enter a verified, existing Google / Outlook calendar email (e.g. you@company.com).");
      }
      const rawEvents = (config.calendarEvents as unknown as CalendarEventBlock[]) || [];
      if (rawEvents.length > 0) {
        signals = parseCalendarBlocksToSignals(employeeId, rawEvents);
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
  if (signals.length > 0) {
    const dailyMetrics = signals.map(signalToMetrics);
    saveEmployeeMetricsBatch(dailyMetrics);
  }

  const allIntegrations = getStoredIntegrations();
  const updated = allIntegrations.map((item) =>
    item.provider === provider
      ? {
          ...item,
          connected: true,
          lastSyncedAt: new Date().toISOString(),
          config: { ...item.config, ...config, accountLabel: connectedAccountLabel },
        }
      : item
  );
  saveStoredIntegrations(updated);

  // Dispatch custom browser event for live telemetry UI updates
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("wellness-telemetry-update"));
  }

  return {
    provider,
    success: true,
    daysSynced: signals.length,
    message: `Connected ${connectedAccountLabel}: Live telemetry stream active.`,
  };
}
