import { ingestTelemetryRequest } from "@/lib/telemetry/ingestRequest";

export const runtime = "nodejs";
/** Receives normalized calendar intervals from an adapter. Native provider push
 * notifications require a verified subscription and a fetch adapter first.
 */
export async function POST(request: Request) {
  return ingestTelemetryRequest(request, true);
}
