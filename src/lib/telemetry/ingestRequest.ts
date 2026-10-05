import { NextResponse } from "next/server";
import { sanitizeAndValidateHeartbeat } from "./serverSanitizer";
import { recordLiveHeartbeat } from "./telemetryAggregator";
import { CloudObservationError, recordCloudHeartbeat } from "./cloudTelemetry";
import { getAuthenticatedUser, isSameOriginRequest } from "../supabase/serverAuth";
import { readBoundedJson, RequestBodyError } from "../http/readBoundedJson";

export async function ingestTelemetryRequest(request: Request, calendarOnly = false) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 });
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  if (user.role !== "employee") return NextResponse.json({ success: false, error: "Employee telemetry access required." }, { status: 403 });
  let raw: unknown;
  try {
    raw = await readBoundedJson(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof RequestBodyError ? error.message : "Invalid request body." }, { status: error instanceof RequestBodyError ? error.status : 400 });
  }
  const validation = sanitizeAndValidateHeartbeat(raw);
  if (!validation.valid || !validation.data) {
    return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
  }
  if (calendarOnly && validation.data.source !== "calendar") {
    return NextResponse.json({ success: false, error: "This endpoint accepts normalized calendar metadata only." }, { status: 400 });
  }
  if (validation.data.employeeId !== user.id || validation.data.organizationId !== `personal:${user.id}`) {
    return NextResponse.json({ success: false, error: "Telemetry must belong to the authenticated employee." }, { status: 403 });
  }
  try {
    const summary = user.source === "supabase" ? await recordCloudHeartbeat(validation.data) : recordLiveHeartbeat(validation.data);
    return NextResponse.json({ success: true, summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const conflict = error instanceof Error && error.message === "Event ID was reused with different metadata.";
    const status = conflict ? 409 : error instanceof CloudObservationError ? error.status : 503;
    const message = status === 409 ? "Event ID conflicts with an existing observation." : status === 400 || status === 422 ?
      "The observation exceeds the accepted metadata or daily limits." : status === 403 ? "Employee observation access denied." :
      "Telemetry storage is unavailable. Retry with the same event ID.";
    return NextResponse.json({ success: false, error: message }, {
      status,
      headers: { "Retry-After": "5" },
    });
  }
}
