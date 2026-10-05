import { NextRequest, NextResponse } from "next/server";
import { getLastHeartbeat, getServerMetricsStore } from "@/lib/telemetry/telemetryAggregator";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import { readCloudObservations } from "@/lib/telemetry/cloudTelemetry";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    if (user.role !== "employee") return NextResponse.json({ success: false, error: "Employee telemetry access required." }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId") || user.id;
    const organizationId = searchParams.get("organizationId") || `personal:${user.id}`;
    if (employeeId !== user.id || organizationId !== `personal:${user.id}`) {
      return NextResponse.json({ success: false, error: "Access to another employee's telemetry is forbidden." }, { status: 403 });
    }
    const todayStr = new Date().toISOString().split("T")[0];

    const state = user.source === "supabase" ? await readCloudObservations(employeeId) : {
      dailyMetrics: getServerMetricsStore(organizationId)[employeeId] || [],
      lastHeartbeat: getLastHeartbeat(organizationId, employeeId),
    };
    const { lastHeartbeat, dailyMetrics: metrics } = state;
    const todayMetric = metrics.find((m) => m.date === todayStr);

    return NextResponse.json({
      success: true,
      status: lastHeartbeat && Date.now() - Date.parse(lastHeartbeat) < 120_000 ? "connected" : "inactive",
      lastHeartbeat,
      bridgeVersion: "2.4.0",
      activeDate: todayStr,
      metrics: todayMetric || {
        employeeId,
        date: todayStr,
        workingHours: 0,
        meetingLoad: 0,
        breakFrequency: 0,
        afterHoursActivity: 0,
        source: "telemetry",
        observedMetrics: [],
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[LIVE STATUS ERROR]:", err);
    return NextResponse.json({ success: false, error: "Private telemetry storage is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
