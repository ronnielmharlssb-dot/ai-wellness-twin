import { NextResponse } from "next/server";
import { getAuthenticatedUser, isSameOriginRequest } from "@/lib/supabase/serverAuth";
import { importCloudSnapshots, CloudObservationError } from "@/lib/telemetry/cloudTelemetry";
import { readBoundedJson, RequestBodyError } from "@/lib/http/readBoundedJson";
import { validateSourceSnapshots, type ImportSource } from "@/lib/integrations/sourceSnapshotValidator";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 });
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  if (user.role !== "employee") return NextResponse.json({ success: false, error: "Employee access required." }, { status: 403 });
  if (user.source !== "supabase") return NextResponse.json({ success: false, error: "A cloud account is required." }, { status: 409 });
  try {
    const raw = await readBoundedJson(request);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new RequestBodyError(400);
    const input = raw as Record<string, unknown>;
    if (Object.keys(input).some((key) => !["snapshots", "capturedAt"].includes(key)) ||
      !Array.isArray(input.snapshots) || input.snapshots.length > 36 ||
      typeof input.capturedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.capturedAt) ||
      !Number.isFinite(Date.parse(input.capturedAt))) throw new RequestBodyError(400);
    const groups: Record<ImportSource, unknown[]> = { github: [], google_calendar: [] };
    for (const snapshot of input.snapshots) {
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) || !["github", "google_calendar"].includes(snapshot.source)) throw new RequestBodyError(400);
      if (snapshot.employeeId !== user.id) return NextResponse.json({ success: false, error: "Import must belong to the authenticated employee." }, { status: 403 });
      groups[snapshot.source as ImportSource].push(snapshot);
    }
    let snapshots;
    try {
      snapshots = (Object.entries(groups) as [ImportSource, unknown[]][]).flatMap(([source, entries]) => entries.length ? validateSourceSnapshots(entries, user.id, source, input.capturedAt as string) : []);
    } catch { throw new RequestBodyError(400); }
    return NextResponse.json({ success: true, ...await importCloudSnapshots(user.id, snapshots, input.capturedAt) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof RequestBodyError || error instanceof CloudObservationError ? error.status : 503;
    return NextResponse.json({ success: false, error: status === 503 ? "Cloud import is unavailable. Retry this sync." : "Import metadata was rejected." }, {
      status, headers: { "Cache-Control": "no-store", "Retry-After": "5" },
    });
  }
}
