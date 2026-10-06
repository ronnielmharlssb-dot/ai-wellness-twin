import { NextResponse } from "next/server";
import { getAuthenticatedUser, isSameOriginRequest } from "@/lib/supabase/serverAuth";

function reject(status: number, error: string) {
  return NextResponse.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return reject(403, "Invalid request origin.");
  const user = await getAuthenticatedUser();
  if (!user) return reject(401, "Sign in before requesting organization setup.");
  return reject(410, "Automatic business verification is unavailable. Submit an organization setup request for administrator review.");
}
