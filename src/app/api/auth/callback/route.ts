import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import { getRequestOrigin } from "@/lib/http/requestOrigin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = url.searchParams.get("code");
  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = await getAuthenticatedUser();
      if (user) return NextResponse.redirect(new URL(user.role === "hr" ? "/hr" : "/dashboard", origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=authentication_failed", origin));
}
