import { getRequestOrigin } from "@/lib/http/requestOrigin";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import { popupResponse } from "@/lib/integrations/popupResponse";
import { consumeOAuthFlow } from "@/lib/integrations/oauthFlow";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const fail = (message: string, status = 401) => popupResponse(origin, "GitHub", message, undefined, status);
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "employee") return fail("Sign in to your employee account before connecting GitHub.");
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code) return fail("GitHub authorization was not completed.");
  const clientId = process.env.GITHUB_CLIENT_ID || process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("GitHub authorization is not configured.", 503);
  let flow;
  try { flow = await consumeOAuthFlow(request, "github", user.id); }
  catch { return fail("Authorization state is missing or invalid. Start the connection again.", 400); }
  if (!flow.codeVerifier) return fail("Authorization proof is missing. Start the connection again.", 400);
  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code,
        redirect_uri: `${flow.origin}/api/auth/callback/github`, code_verifier: flow.codeVerifier }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) return fail("GitHub rejected the authorization exchange.");
    const token = await tokenResponse.json();
    if (typeof token.access_token !== "string") return fail("GitHub did not provide an authorization token.");
    const profileResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token.access_token}`, "User-Agent": "WellnessTwin-App" }, signal: AbortSignal.timeout(10000),
    });
    if (!profileResponse.ok) return fail("GitHub identity verification failed.");
    const profile = await profileResponse.json();
    if (typeof profile.login !== "string" || !profile.login) return fail("GitHub identity verification failed.");
    return popupResponse(origin, "GitHub", `Verified account: ${profile.login}`, { type: "GITHUB_OAUTH_SUCCESS", employeeId: user.id, username: profile.login });
  } catch { return fail("GitHub authorization is temporarily unavailable.", 502); }
}
