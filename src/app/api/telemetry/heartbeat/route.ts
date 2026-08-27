import { NextRequest, NextResponse } from "next/server";
import { sanitizeAndValidateHeartbeat } from "@/lib/telemetry/serverSanitizer";
import { recordLiveHeartbeat } from "@/lib/telemetry/telemetryAggregator";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();

    // 1. Enforce Server-Side Privacy Firewall
    const validation = sanitizeAndValidateHeartbeat(rawBody);

    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error || "Privacy or schema validation failed.",
        },
        { status: 400 }
      );
    }

    // 2. Atomically Aggregate Heartbeat into Today's Daily Record
    const summary = recordLiveHeartbeat(validation.data);

    return NextResponse.json({
      success: true,
      message: "Telemetry heartbeat processed and sanitized successfully.",
      summary,
    });
  } catch (err: unknown) {
    console.error("[TELEMETRY API ERROR]:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process telemetry heartbeat.",
      },
      { status: 500 }
    );
  }
}
