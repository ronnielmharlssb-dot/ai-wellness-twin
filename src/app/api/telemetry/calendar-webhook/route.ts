import { NextRequest, NextResponse } from "next/server";
import { sanitizeAndValidateHeartbeat } from "@/lib/telemetry/serverSanitizer";
import { recordLiveHeartbeat } from "@/lib/telemetry/telemetryAggregator";

/**
 * Ingestion endpoint for Google Calendar / Microsoft Graph Push Notification Webhooks
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();

    // Check for Google / Microsoft validation challenge headers
    const clientState = req.headers.get("x-goog-channel-token") || req.headers.get("clientState");
    const syncToken = req.headers.get("x-goog-resource-state");

    // If it's a sync handshake, acknowledge immediately
    if (syncToken === "sync") {
      return new NextResponse(null, { status: 200 });
    }

    // Extract ONLY numerical duration minutes, strictly dropping event summaries
    const rawMeetingMinutes = typeof rawBody.durationMinutes === "number"
      ? rawBody.durationMinutes
      : typeof rawBody.duration === "number"
      ? rawBody.duration / 60
      : 30; // Default 30 min block if unprovided

    const payload = {
      employeeId: rawBody.employeeId || clientState || "emp-001",
      organizationId: rawBody.organizationId || "org_acme_technologies",
      timestamp: new Date().toISOString(),
      activeSeconds: 0,
      meetingMinutes: Math.min(240, Math.max(5, rawMeetingMinutes)),
      isBreak: false,
      source: "calendar",
    };

    const validation = sanitizeAndValidateHeartbeat(payload);

    if (!validation.valid || !validation.data) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const summary = recordLiveHeartbeat(validation.data);

    return NextResponse.json({
      success: true,
      message: "Calendar webhook processed with zero title inspection.",
      summary,
    });
  } catch (err: unknown) {
    console.error("[CALENDAR WEBHOOK ERROR]:", err);
    return NextResponse.json({ success: false, error: "Webhook ingestion failed." }, { status: 500 });
  }
}
