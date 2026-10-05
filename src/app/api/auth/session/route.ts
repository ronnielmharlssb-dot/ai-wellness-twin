import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ACCOUNTS, isDemoModeEnabled } from "@/lib/supabase/authTypes";
import { createDemoSession, DEMO_COOKIE, getAuthenticatedUser, isSameOriginRequest } from "@/lib/supabase/serverAuth";

export const runtime = "nodejs";
export async function GET() {
  const user = await getAuthenticatedUser();
  return NextResponse.json({ user }, { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!isDemoModeEnabled()) return NextResponse.json({ error: "Demo login is disabled. Use your verified account." }, { status: 403 });
  let userId: unknown;
  try {
    const body = await request.text();
    if (body.length > 1024) throw new Error("Oversized request.");
    userId = JSON.parse(body).userId;
  } catch { return NextResponse.json({ error: "Invalid demo login request." }, { status: 400 }); }
  const user = DEFAULT_ACCOUNTS.find((account) => account.id === userId);
  if (!user) return NextResponse.json({ error: "Unknown demo account." }, { status: 400 });
  const response = NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(DEMO_COOKIE, createDemoSession(user.id), { httpOnly: true, sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
  return response;
}
export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const supabase = await createClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) return NextResponse.json({ error: "Sign-out failed. Please retry." }, { status: 503 });
  }
  (await cookies()).delete(DEMO_COOKIE);
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
