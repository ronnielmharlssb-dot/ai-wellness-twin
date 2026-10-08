import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import { getRequestOrigin } from "@/lib/http/requestOrigin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = url.searchParams.get("code");
  const failed = (reason = "authentication_failed") => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
  const providerError = url.searchParams.get("error");
  if (providerError) return failed(providerError === "access_denied" ? "sign_in_cancelled" : "authentication_failed");
  if (!code) return failed();
  try {
    const supabase = await createClient();
    if (!supabase) return failed();
    const flowId = url.searchParams.get("sb_flow_id");
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) {
      return failed(["flow_state_expired", "flow_state_not_found", "bad_code_verifier"].includes(error.code ?? "")
        ? "session_expired" : "authentication_failed");
    }
    const user = await getAuthenticatedUser();
    return user ? NextResponse.redirect(new URL(user.role === "hr" ? "/hr" : "/dashboard", origin)) : failed();
  } catch { return failed(); }
}
