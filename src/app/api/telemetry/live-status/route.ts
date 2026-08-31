import { NextRequest, NextResponse } from "next/server";
import { getMetricsForEmployee } from "@/lib/wellbeing/employeeMetrics";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId") || "usr-ronnie";
    const todayStr = new Date().toISOString().split("T")[0];

    const metrics = getMetricsForEmployee(employeeId);
    const todayMetric = metrics.find((m) => m.date === todayStr);

    return NextResponse.json({
      success: true,
      status: "connected",
      bridgeVersion: "2.4.0",
      activeDate: todayStr,
      metrics: todayMetric || {
        employeeId,
        date: todayStr,
        workingHours: 0,
        meetingLoad: 0,
        breakFrequency: 0,
        afterHoursActivity: 0,
      },
    });
  } catch (err) {
    console.error("[LIVE STATUS ERROR]:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch live telemetry status." }, { status: 500 });
  }
}
