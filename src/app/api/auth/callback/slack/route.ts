import { getRequestOrigin } from "@/lib/http/requestOrigin";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import { popupResponse } from "@/lib/integrations/popupResponse";
import { consumeOAuthFlow } from "@/lib/integrations/oauthFlow";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const fail = (message: string, status = 401) => popupResponse(origin, "Slack", message, undefined, status);
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "employee") return fail("Sign in to your employee account before connecting Slack.");
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code) return fail("Slack authorization was not completed.");
  const clientId = process.env.SLACK_CLIENT_ID || process.env.NEXT_PUBLIC_SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("Slack authorization is not configured.", 503);
  try { await consumeOAuthFlow(request, "slack", user.id); }
  catch { return fail("Authorization state is missing or invalid. Start the connection again.", 400); }
  try {
    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: `${origin}/api/auth/callback/slack` }), signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) return fail("Slack rejected the authorization exchange.");
    const token = await tokenResponse.json();
    const accessToken = token.authed_user?.access_token || token.access_token;
    if (!token.ok || typeof accessToken !== "string") return fail("Slack identity verification failed.");
    const identityResponse = await fetch("https://slack.com/api/users.identity", {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000),
    });
    if (!identityResponse.ok) return fail("Slack identity verification failed.");
    const identity = await identityResponse.json();
    if (!identity.ok || typeof identity.user?.id !== "string" || typeof identity.team?.name !== "string") return fail("Slack identity verification failed.");
    return popupResponse(origin, "Slack", `Verified workspace: ${identity.team.name}`, { type: "SLACK_OAUTH_SUCCESS", employeeId: user.id, workspace: identity.team.name });
  } catch { return fail("Slack authorization is temporarily unavailable.", 502); }
}
