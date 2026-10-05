import { getLocalSessionUser } from "../supabase/auth";
export type PrivateReflection = { employeeId: string; week: string; feeling: string; note: string; submittedAt: string };
export const REFLECTION_FEELINGS = ["energized", "balanced", "fatigued", "drained"] as const;
function ownKey(employeeId: string, week: string): string {
  const user = getLocalSessionUser();
  if (!user || user.role !== "employee" || user.id !== employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    throw new Error("Your employee session is required.");
  }
  return "wellness-reflection-v1:" + encodeURIComponent(employeeId) + ":" + week;
}
export function readPrivateReflection(employeeId: string, week: string): PrivateReflection | null {
  const raw = localStorage.getItem(ownKey(employeeId, week));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value.employeeId !== employeeId || value.week !== week || !REFLECTION_FEELINGS.includes(value.feeling) ||
        typeof value.note !== "string" || value.note.length > 2000 || typeof value.submittedAt !== "string" ||
        !Number.isFinite(Date.parse(value.submittedAt))) return null;
    return value;
  } catch { return null; }
}
export function savePrivateReflection(employeeId: string, week: string, feeling: string, note: string): PrivateReflection {
  const key = ownKey(employeeId, week);
  if (!REFLECTION_FEELINGS.includes(feeling as typeof REFLECTION_FEELINGS[number]) || note.length > 2000) {
    throw new Error("Choose a feeling and keep the note within 2,000 characters.");
  }
  const reflection = { employeeId, week, feeling, note: note.trim(), submittedAt: new Date().toISOString() };
  localStorage.setItem(key, JSON.stringify(reflection));
  return reflection;
}
