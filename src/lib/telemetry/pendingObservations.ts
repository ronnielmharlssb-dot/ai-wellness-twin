import { sanitizeAndValidateHeartbeat, type ValidatedHeartbeat } from "./serverSanitizer";

export type RejectedObservation = { observation: unknown; reason: string; rejectedAt: string };
export type PendingObservations = { version: 1; pending: ValidatedHeartbeat[]; rejected: RejectedObservation[] };

/** Upgrade legacy queues without losing packets that cannot be uploaded. */
export function readPendingObservations(raw: string | null, employeeId: string, now = Date.now()): PendingObservations {
  const result: PendingObservations = { version: 1, pending: [], rejected: [] };
  if (!raw) return result;
  const reject = (observation: unknown, reason: string) => result.rejected.push({ observation, reason, rejectedAt: new Date(now).toISOString() });
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { reject(raw, "Unreadable saved queue. The original data is retained for review."); return result; }
  const pending = Array.isArray(parsed) ? parsed : parsed?.version === 1 && Array.isArray(parsed.pending) && Array.isArray(parsed.rejected) ? parsed.pending : null;
  if (!pending) { reject(parsed, "Unrecognized saved queue format."); return result; }
  if (!Array.isArray(parsed)) {
    for (const review of parsed.rejected) {
      if (review && typeof review === "object" && Object.hasOwn(review, "observation") &&
          typeof review.reason === "string" && review.reason.length > 0 && typeof review.rejectedAt === "string" &&
          Number.isFinite(Date.parse(review.rejectedAt))) result.rejected.push({
        observation: review.observation, reason: review.reason, rejectedAt: review.rejectedAt,
      });
      else reject(review, "Malformed saved review record. Original data retained.");
    }
  }
  for (const observation of pending) {
    const validation = sanitizeAndValidateHeartbeat(observation, now);
    if (!validation.valid || !validation.data) reject(observation, validation.error ?? "Invalid observation.");
    else if (validation.data.employeeId !== employeeId || validation.data.organizationId !== `personal:${employeeId}`) {
      reject(observation, "This observation belongs to another account or scope.");
    } else result.pending.push(validation.data);
  }
  return result;
}

export const PERMANENT_UPLOAD_FAILURES = new Set([400, 409, 413, 422]);
