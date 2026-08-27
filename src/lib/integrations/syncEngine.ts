import type { IntegrationConnection, IntegrationProvider, SyncResult } from "./types";
import { fetchGitHubSignals } from "./githubConnector";
import { generateSimulatedCalendarSignals } from "./calendarConnector";
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
    connected: false,
    config: {
      username: "",
    },
  },
  {
    id: "int-vscode",
    provider: "vscode",
    name: "Visual Studio Code",
    category: "Code & Development",
    description: "Observes editor focus time, coding session durations, and micro-pauses without reading source code.",
    connected: false,
    config: {
      workspaceName: "",
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
    connected: false,
    config: {
      workspaceName: "",
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

export function getStoredIntegrations(): IntegrationConnection[] {
  if (typeof window === "undefined") {
    return DEFAULT_INTEGRATIONS;
  }

  try {
    const saved = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
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

export function saveStoredIntegrations(integrations: IntegrationConnection[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(integrations));
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
      signals = generateSimulatedVSCodeSignals(employeeId);
      connectedAccountLabel = handle;
      break;
    }

    case "chatgpt": {
      const handle = config.workspaceName?.trim();
      if (!handle) {
        throw new Error("Please enter your OpenAI / ChatGPT account email.");
      }
      signals = generateSimulatedChatGPTSignals(employeeId);
      connectedAccountLabel = handle;
      break;
    }

    case "gemini": {
      const handle = config.workspaceName?.trim();
      if (!handle) {
        throw new Error("Please enter your Google account email for Gemini.");
      }
      signals = generateSimulatedGeminiSignals(employeeId);
      connectedAccountLabel = handle;
      break;
    }

    case "claude": {
      const handle = config.workspaceName?.trim();
      if (!handle) {
        throw new Error("Please enter your Anthropic / Claude account email.");
      }
      signals = generateSimulatedClaudeSignals(employeeId);
      connectedAccountLabel = handle;
      break;
    }

    case "google_calendar": {
      const email = config.calendarEmail?.trim();
      if (!email || !email.includes("@")) {
        throw new Error("Please enter a valid work email (e.g. you@company.com) for your Google/Outlook calendar.");
      }
      signals = generateSimulatedCalendarSignals(employeeId, 30);
      connectedAccountLabel = email;
      break;
    }

    case "figma": {
      const handle = config.workspaceName?.trim();
      if (!handle) {
        throw new Error("Please enter your Figma account email or team handle.");
      }
      signals = generateSimulatedFigmaSignals(employeeId);
      connectedAccountLabel = handle;
      break;
    }

    case "slack": {
      const workspace = config.workspaceName?.trim();
      if (!workspace) {
        throw new Error("Please enter your Slack workspace (e.g. acme.slack.com) or username.");
      }
      signals = generateSimulatedSlackSignals(employeeId);
      connectedAccountLabel = workspace;
      break;
    }

    case "discord": {
      const handle = config.workspaceName?.trim();
      if (!handle) {
        throw new Error("Please enter your Discord username or tag (e.g. alex.dev or alex#1234).");
      }
      signals = generateSimulatedDiscordSignals(employeeId);
      connectedAccountLabel = handle;
      break;
    }
  }

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

  return {
    provider,
    success: true,
    daysSynced: signals.length,
    message: `Connected ${connectedAccountLabel}: Synchronized ${signals.length} daily signal records.`,
  };
}

function generateSimulatedVSCodeSignals(employeeId: string): EmployeeSignal[] {
  const signals: EmployeeSignal[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    signals.push({
      employeeId,
      date: dateStr,
      activeMinutes: i < 5 ? 490 : 420,
      meetingMinutes: 45,
      afterHoursMinutes: i < 4 ? 45 : 10,
      breakCount: 3,
      appSwitches: 35,
      source: "imported",
    });
  }

  return signals;
}

function generateSimulatedChatGPTSignals(employeeId: string): EmployeeSignal[] {
  const signals: EmployeeSignal[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    signals.push({
      employeeId,
      date: dateStr,
      activeMinutes: 430,
      meetingMinutes: 60,
      afterHoursMinutes: i < 5 ? 30 : 5,
      breakCount: 4,
      appSwitches: 50,
      source: "imported",
    });
  }

  return signals;
}

function generateSimulatedGeminiSignals(employeeId: string): EmployeeSignal[] {
  const signals: EmployeeSignal[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    signals.push({
      employeeId,
      date: dateStr,
      activeMinutes: 440,
      meetingMinutes: 50,
      afterHoursMinutes: i < 4 ? 35 : 10,
      breakCount: 4,
      appSwitches: 45,
      source: "imported",
    });
  }

  return signals;
}

function generateSimulatedClaudeSignals(employeeId: string): EmployeeSignal[] {
  const signals: EmployeeSignal[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    signals.push({
      employeeId,
      date: dateStr,
      activeMinutes: 450,
      meetingMinutes: 40,
      afterHoursMinutes: i < 5 ? 40 : 15,
      breakCount: 3,
      appSwitches: 30,
      source: "imported",
    });
  }

  return signals;
}

function generateSimulatedFigmaSignals(employeeId: string): EmployeeSignal[] {
  const signals: EmployeeSignal[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    signals.push({
      employeeId,
      date: dateStr,
      activeMinutes: 440,
      meetingMinutes: 80,
      afterHoursMinutes: i < 5 ? 40 : 10,
      breakCount: 3,
      appSwitches: 45,
      source: "imported",
    });
  }

  return signals;
}

function generateSimulatedSlackSignals(employeeId: string): EmployeeSignal[] {
  const signals: EmployeeSignal[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    signals.push({
      employeeId,
      date: dateStr,
      activeMinutes: 460,
      meetingMinutes: 90,
      afterHoursMinutes: i < 4 ? 50 : 15,
      breakCount: 4,
      appSwitches: 80,
      source: "imported",
    });
  }

  return signals;
}

function generateSimulatedDiscordSignals(employeeId: string): EmployeeSignal[] {
  const signals: EmployeeSignal[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    signals.push({
      employeeId,
      date: dateStr,
      activeMinutes: 420,
      meetingMinutes: 30,
      afterHoursMinutes: i < 3 ? 60 : 15,
      breakCount: 3,
      appSwitches: 70,
      source: "imported",
    });
  }

  return signals;
}
