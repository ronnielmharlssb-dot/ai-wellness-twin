export type IntegrationProvider =
  | "github"
  | "vscode"
  | "google_calendar"
  | "figma"
  | "slack"
  | "discord"
  | "chatgpt"
  | "gemini"
  | "claude";

export type IntegrationCategory =
  | "Code & Development"
  | "AI Assistants & Research"
  | "Calendar & Meetings"
  | "Design & Creative"
  | "Communication";

export type IntegrationConnection = {
  id: string;
  provider: IntegrationProvider;
  name: string;
  category: IntegrationCategory;
  description: string;
  connected: boolean;
  lastSyncedAt?: string;
  config: {
    username?: string;
    calendarEmail?: string;
    workspaceName?: string;
    accountLabel?: string;
    [key: string]: string | undefined;
  };
};

export type SyncResult = {
  provider: IntegrationProvider;
  success: boolean;
  daysSynced: number;
  message: string;
};
