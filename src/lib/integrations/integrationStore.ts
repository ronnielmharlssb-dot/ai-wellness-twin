import type { IntegrationConnection, IntegrationProvider } from "./types";

const INTEGRATIONS_STORAGE_KEY = "wellness-integrations-config";

export const DEFAULT_INTEGRATIONS: IntegrationConnection[] = [
  // 1. Code & Development
  {
    id: "int-github",
    provider: "github",
    name: "GitHub",
    category: "Code & Development",
    description: "Imports public commit and PR activity counts. Event timestamps do not measure coding duration.",
    connected: false,
    config: {},
  },
  {
    id: "int-vscode",
    provider: "vscode",
    name: "Visual Studio Code",
    category: "Code & Development",
    description: "Editor activity requires a dedicated collector, which is not available yet.",
    connected: false,
    config: {},
  },

  // 2. AI Assistants & Research
  {
    id: "int-chatgpt",
    provider: "chatgpt",
    name: "ChatGPT (OpenAI)",
    category: "AI Assistants & Research",
    description: "ChatGPT usage measurements require a collector, which is not available yet.",
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
    description: "Google identity can be verified; Gemini usage measurements are not available yet.",
    connected: false,
    config: {},
  },
  {
    id: "int-claude",
    provider: "claude",
    name: "Claude (Anthropic)",
    category: "AI Assistants & Research",
    description: "Claude usage measurements require a collector, which is not available yet.",
    connected: false,
    config: {
      workspaceName: "",
    },
  },

  // 3. Calendar & Meetings
  {
    id: "int-calendar",
    provider: "google_calendar",
    name: "Google Calendar",
    category: "Calendar & Meetings",
    description: "Imports scheduled meeting intervals. Attendance and breaks are not inferred from the calendar.",
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
    description: "Design activity requires a collector, which is not available yet.",
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
    description: "Slack identity can be verified; messaging activity measurements are not available yet.",
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
    description: "Discord identity can be verified; communication activity measurements are not available yet.",
    connected: false,
    config: {
      workspaceName: "",
    },
  },
];

function getStorageKey(employeeId?: string): string {
  if (typeof window === "undefined") return INTEGRATIONS_STORAGE_KEY;
  try {
    const activeUserId = employeeId || (JSON.parse(localStorage.getItem("wellness-auth-user") || "{}")?.id) || "anonymous";
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
    const saved = localStorage.getItem(key);
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

export function markImportState(employeeId: string, provider: IntegrationProvider, capturedAt: string, status: "synced" | "needs_review") {
  const updated = getStoredIntegrations(employeeId).map((item) => item.provider === provider && item.connected && item.lastImportCapturedAt === capturedAt
    ? { ...item, dataStatus: status, ...(status === "synced" ? { lastSyncedAt: new Date().toISOString() } : {}) } : item);
  saveStoredIntegrations(updated, employeeId);
}
