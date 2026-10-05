import { getRequestOrigin } from "@/lib/http/requestOrigin";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import { popupResponse } from "@/lib/integrations/popupResponse";
import { consumeOAuthFlow } from "@/lib/integrations/oauthFlow";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const fail = (message: string, status = 401) => popupResponse(origin, "Discord", message, undefined, status);
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "employee") return fail("Sign in to your employee account before connecting Discord.");
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code) return fail("Discord authorization was not completed.");
  const clientId = process.env.DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("Discord authorization is not configured.", 503);
  try { await consumeOAuthFlow(request, "discord", user.id); }
  catch { return fail("Authorization state is missing or invalid. Start the connection again.", 400); }
  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: `${origin}/api/auth/callback/discord` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) return fail("Discord rejected the authorization exchange.");
    const token = await tokenResponse.json();
    if (typeof token.access_token !== "string") return fail("Discord did not provide an authorization token.");
    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(10000),
    });
    if (!profileResponse.ok) return fail("Discord identity verification failed.");
    const profile = await profileResponse.json();
    if (typeof profile.username !== "string" || !profile.username) return fail("Discord identity verification failed.");
    return popupResponse(origin, "Discord", `Verified account: ${profile.username}`, { type: "DISCORD_OAUTH_SUCCESS", employeeId: user.id, username: profile.username });
  } catch { return fail("Discord authorization is temporarily unavailable.", 502); }
}
