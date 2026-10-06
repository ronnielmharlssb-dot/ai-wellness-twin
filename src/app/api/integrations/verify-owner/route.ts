import { NextResponse } from "next/server";
import { getAuthenticatedUser, isSameOriginRequest } from "@/lib/supabase/serverAuth";

function rejection(status: number, error: string) {
  return NextResponse.json({ success: false, error }, {
    status, headers: { "Cache-Control": "no-store" },
  });
}

/** Provider OAuth has replaced the former email/PIN ownership check. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return rejection(403, "Start provider authorization from your dashboard.");
  const user = await getAuthenticatedUser();
  if (!user) return rejection(401, "Sign in to your employee account.");
  if (user.role !== "employee") return rejection(403, "Provider authorization requires an employee account.");
  return rejection(410, "Email/PIN verification has been retired. Connect the provider from the Integrations page using OAuth.");
}
