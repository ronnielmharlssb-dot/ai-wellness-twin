import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import { createOAuthAuthorization, flowCookieName, OAUTH_PROVIDERS, type OAuthProvider } from "@/lib/integrations/oauthFlow";
import { popupResponse } from "@/lib/integrations/popupResponse";
import { getRequestOrigin } from "@/lib/http/requestOrigin";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return popupResponse(origin, "Provider", "Start this connection from your dashboard.", undefined, 403);
  }
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "employee") return popupResponse(origin, "Provider", "Sign in to your employee account before connecting a provider.", undefined, 401);
  const provider = url.searchParams.get("provider");
  if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) return popupResponse(origin, "Provider", "This tool requires a metadata collector; provider authorization is not available.", undefined, 400);
  try {
    const authorization = createOAuthAuthorization(provider as OAuthProvider, user.id, origin);
    const response = NextResponse.redirect(authorization.url);
    response.cookies.set(flowCookieName(authorization.callbackProvider), authorization.token, {
      path: `/api/auth/callback/${authorization.callbackProvider}`, httpOnly: true,
      sameSite: "lax", secure: origin.startsWith("https:"), maxAge: 10 * 60,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return popupResponse(origin, "Provider", error instanceof Error ? error.message : "Provider authorization is unavailable.", undefined, 503);
  }
}
