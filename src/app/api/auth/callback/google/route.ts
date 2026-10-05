import { getRequestOrigin } from "@/lib/http/requestOrigin";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import { popupResponse } from "@/lib/integrations/popupResponse";
import { consumeOAuthFlow } from "@/lib/integrations/oauthFlow";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const fail = (message: string, status = 401) => popupResponse(origin, "Google", message, undefined, status);
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "employee") return fail("Sign in to your employee account before connecting Google.");
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code) return fail("Google authorization was not completed.");
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("Google authorization is not configured.", 503);
  let flow;
  try { flow = await consumeOAuthFlow(request, "google", user.id); }
  catch { return fail("Authorization state is missing or invalid. Start the connection again.", 400); }
  const provider = flow.provider;
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code,
        grant_type: "authorization_code", redirect_uri: `${origin}/api/auth/callback/google` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) return fail("Google rejected the authorization exchange.");
    const token = await tokenResponse.json();
    if (typeof token.access_token !== "string") return fail("Google did not provide an authorization token.");
    const headers = { Authorization: `Bearer ${token.access_token}` };
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers, signal: AbortSignal.timeout(10000) });
    if (!profileResponse.ok) return fail("Google identity verification failed.");
    const profile = await profileResponse.json();
    if (typeof profile.email !== "string" || profile.verified_email !== true) return fail("Google did not verify an email address.");
    const events: Array<{ start: string; end: string }> = [];
    let coverage: { start: string; end: string } | undefined;
    if (provider === "google_calendar") {
      const now = new Date();
      coverage = { start: new Date(now.getTime() - 28 * 86400000).toISOString(), end: now.toISOString() };
      let pageToken = "";
      for (let page = 0; page < 10; page++) {
        const query = new URLSearchParams({
          timeMin: coverage.start, timeMax: coverage.end,
          singleEvents: "true", orderBy: "startTime", maxResults: "250",
          fields: "items(start,end,status),nextPageToken",
        });
        if (pageToken) query.set("pageToken", pageToken);
        const calendarResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`, { headers, signal: AbortSignal.timeout(10000) });
        if (!calendarResponse.ok) return fail("Google Calendar could not be imported. Please retry.", 502);
        const calendar = await calendarResponse.json();
        if (calendar.items !== undefined && !Array.isArray(calendar.items)) return fail("Google Calendar returned an invalid response.", 502);
        for (const event of calendar.items ?? []) {
          if (event.status !== "cancelled" && typeof event.start?.dateTime === "string" && typeof event.end?.dateTime === "string") {
            events.push({ start: event.start.dateTime, end: event.end.dateTime });
          }
        }
        pageToken = typeof calendar.nextPageToken === "string" ? calendar.nextPageToken : "";
        if (!pageToken) break;
      }
      if (pageToken) return fail("Calendar import exceeds the supported window. No partial sync was saved.", 422);
    }
    return popupResponse(origin, "Google", `Verified account: ${profile.email}`, {
      type: "GOOGLE_OAUTH_SUCCESS", employeeId: user.id, email: profile.email, provider, events, coverage,
    });
  } catch { return fail("Google authorization is temporarily unavailable.", 502); }
}
