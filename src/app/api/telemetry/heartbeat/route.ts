import { ingestTelemetryRequest } from "@/lib/telemetry/ingestRequest";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return ingestTelemetryRequest(request);
}
