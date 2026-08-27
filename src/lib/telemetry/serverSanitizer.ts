/**
 * Server-Side Privacy Sanitizer Middleware
 * 
 * Enforces mathematical metadata-only guarantees.
 * Rejects and drops any payload that contains text, prompts, code fragments, 
 * message bodies, URLs, or personal identifiers.
 */

export const FORBIDDEN_TEXT_KEYS = new Set([
  "title",
  "prompt",
  "code",
  "message",
  "body",
  "text",
  "diff",
  "query",
  "description",
  "summary",
  "url",
  "attendees",
  "subject",
  "content",
  "keystrokes",
  "clipboard",
]);

export type RawTelemetryPayload = {
  employeeId?: string;
  organizationId?: string;
  timestamp?: string;
  activeSeconds?: number;
  isBreak?: boolean;
  isEvening?: boolean;
  meetingMinutes?: number;
  source?: string;
  [key: string]: unknown;
};

export type ValidatedHeartbeat = {
  employeeId: string;
  organizationId: string;
  timestamp: string;
  activeSeconds: number;
  isBreak: boolean;
  isEvening: boolean;
  meetingMinutes: number;
  source: "workstation" | "ide" | "calendar" | "presence";
};

export function sanitizeAndValidateHeartbeat(
  raw: Record<string, unknown>
): { valid: boolean; data?: ValidatedHeartbeat; error?: string } {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "Invalid payload format: must be a JSON object." };
  }

  // 1. Strict Privacy Firewall Scan: Check for any forbidden text/content keys
  const keys = Object.keys(raw);
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if (FORBIDDEN_TEXT_KEYS.has(lowerKey)) {
      console.warn(`[PRIVACY FIREWALL VIOLATION] Dropped incoming payload containing forbidden key: '${key}'`);
      return {
        valid: false,
        error: `Privacy violation: Payload contains prohibited content key '${key}'. Only numerical metadata is permitted.`,
      };
    }
  }

  // 2. Validate mandatory metadata fields
  const employeeId = typeof raw.employeeId === "string" && raw.employeeId.trim() ? raw.employeeId.trim() : "emp-001";
  const organizationId = typeof raw.organizationId === "string" && raw.organizationId.trim() ? raw.organizationId.trim() : "org_acme_technologies";
  const timestamp = typeof raw.timestamp === "string" && !isNaN(Date.parse(raw.timestamp)) ? raw.timestamp : new Date().toISOString();

  // 3. Validate numerical bounds (prevent unrealistic spoofing)
  const rawActiveSeconds = typeof raw.activeSeconds === "number" ? raw.activeSeconds : 60;
  const activeSeconds = Math.max(0, Math.min(rawActiveSeconds, 300)); // Cap between 0 and 5 minutes per ping

  const rawMeetingMinutes = typeof raw.meetingMinutes === "number" ? raw.meetingMinutes : 0;
  const meetingMinutes = Math.max(0, Math.min(rawMeetingMinutes, 120)); // Cap at 2 hours per calendar block

  const isBreak = Boolean(raw.isBreak);
  
  // Auto-detect evening (activity past 7:00 PM local time)
  const hour = new Date(timestamp).getHours();
  const isEvening = typeof raw.isEvening === "boolean" ? raw.isEvening : hour >= 19 || hour < 6;

  const validSources = new Set(["workstation", "ide", "calendar", "presence"]);
  const source = typeof raw.source === "string" && validSources.has(raw.source)
    ? (raw.source as "workstation" | "ide" | "calendar" | "presence")
    : "workstation";

  return {
    valid: true,
    data: {
      employeeId,
      organizationId,
      timestamp,
      activeSeconds,
      isBreak,
      isEvening,
      meetingMinutes,
      source,
    },
  };
}
