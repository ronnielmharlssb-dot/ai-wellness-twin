import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import { readCloudObservations } from "@/lib/telemetry/cloudTelemetry";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  if (user.role !== "employee") return NextResponse.json({ success: false, error: "Employee access required." }, { status: 403 });
  if (user.source !== "supabase") return NextResponse.json({ success: false, error: "Cloud history requires a cloud account." }, { status: 409 });
  try {
    return NextResponse.json({ success: true, ...await readCloudObservations(user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, error: "Private cloud history is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } });
  }
}
