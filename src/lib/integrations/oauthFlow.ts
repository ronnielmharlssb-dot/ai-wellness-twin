import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { getRequestOrigin } from "../http/requestOrigin";

export const OAUTH_PROVIDERS = ["github", "google_calendar", "gemini", "discord", "slack"] as const;
export type OAuthProvider = typeof OAUTH_PROVIDERS[number];
export type CallbackProvider = "github" | "google" | "discord" | "slack";
export type OAuthFlow = {
  provider: OAuthProvider;
  employeeId: string;
  origin: string;
  state: string;
  codeVerifier?: string;
  expires: number;
};
const FLOW_LIFETIME_MS = 10 * 60 * 1000;

export function callbackProviderFor(provider: OAuthProvider): CallbackProvider {
  return provider === "google_calendar" || provider === "gemini" ? "google" : provider;
}
export function flowCookieName(provider: CallbackProvider) { return `wellness-oauth-${provider}`; }

function encryptionKey(): Buffer {
  let secret = process.env.WELLNESS_OAUTH_STATE_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("Provider authorization requires WELLNESS_OAUTH_STATE_SECRET.");
    const filename = path.join(process.cwd(), ".data", "development-oauth.key");
    if (!fs.existsSync(/* turbopackIgnore: true */ filename)) {
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      try { fs.writeFileSync(filename, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    }
    secret = fs.readFileSync(/* turbopackIgnore: true */ filename, "utf8");
  }
  if (secret.length < 32) throw new Error("WELLNESS_OAUTH_STATE_SECRET must contain at least 32 random characters.");
  return createHash("sha256").update(secret).digest();
}
export function sealOAuthFlow(flow: OAuthFlow): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(flow), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function openOAuthFlow(token: string): OAuthFlow | null {
  if (!token || token.length > 4096) return null;
  try {
    const buffer = Buffer.from(token, "base64url");
    if (buffer.length <= 28) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), buffer.subarray(0, 12));
    decipher.setAuthTag(buffer.subarray(12, 28));
    const value = JSON.parse(Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString("utf8"));
    return value && typeof value === "object" ? value as OAuthFlow : null;
  } catch { return null; }
}
export function validateOAuthFlow(flow: OAuthFlow | null, returnedState: string | null, callbackProvider: CallbackProvider, employeeId: string, origin: string, now = Date.now()): flow is OAuthFlow {
  if (!flow || !OAUTH_PROVIDERS.includes(flow.provider) || callbackProviderFor(flow.provider) !== callbackProvider ||
      flow.employeeId !== employeeId || flow.origin !== origin || !Number.isFinite(flow.expires) ||
      flow.expires <= now || flow.expires > now + FLOW_LIFETIME_MS || typeof flow.state !== "string" || !returnedState) return false;
  const expected = Buffer.from(flow.state);
  const supplied = Buffer.from(returnedState);
  return expected.length === 43 && supplied.length === expected.length && timingSafeEqual(expected, supplied);
}
export async function consumeOAuthFlow(request: Request, callbackProvider: CallbackProvider, employeeId: string): Promise<OAuthFlow> {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const jar = await cookies();
  const cookieName = flowCookieName(callbackProvider);
  const token = jar.get(cookieName)?.value;
  // Clear the flow cookie with the same path used by the authorization endpoint.
  jar.set(cookieName, "", { path: `/api/auth/callback/${callbackProvider}`, maxAge: 0, httpOnly: true, sameSite: "lax", secure: origin.startsWith("https:") });
  const flow = token ? openOAuthFlow(token) : null;
  if (!validateOAuthFlow(flow, url.searchParams.get("state"), callbackProvider, employeeId, origin)) {
    throw new Error("Authorization state is missing, expired or does not match this employee. Start the connection again.");
  }
  return flow;
}

export function createOAuthAuthorization(provider: OAuthProvider, employeeId: string, origin: string, now = Date.now()) {
  const callbackProvider = callbackProviderFor(provider);
  const prefix = callbackProvider.toUpperCase();
  const clientId = process.env[`${prefix}_CLIENT_ID`] || process.env[`NEXT_PUBLIC_${prefix}_CLIENT_ID`];
  if (!clientId || !process.env[`${prefix}_CLIENT_SECRET`]) throw new Error(`${callbackProvider} authorization is not configured.`);
  const flow: OAuthFlow = {
    provider, employeeId, origin, state: randomBytes(32).toString("base64url"), expires: now + FLOW_LIFETIME_MS,
  };
  const endpoints: Record<CallbackProvider, string> = {
    github: "https://github.com/login/oauth/authorize",
    google: "https://accounts.google.com/o/oauth2/v2/auth",
    discord: "https://discord.com/oauth2/authorize",
    slack: "https://slack.com/oauth/v2/authorize",
  };
  const url = new URL(endpoints[callbackProvider]);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/callback/${callbackProvider}`);
  url.searchParams.set("state", flow.state);
  if (callbackProvider === "github") {
    // GitHub's documented web flow supports S256 PKCE; the verifier stays encrypted.
    flow.codeVerifier = randomBytes(32).toString("base64url");
    url.searchParams.set("scope", "read:user");
    url.searchParams.set("code_challenge", createHash("sha256").update(flow.codeVerifier).digest("base64url"));
    url.searchParams.set("code_challenge_method", "S256");
  } else if (callbackProvider === "google") {
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", provider === "google_calendar" ? "openid email profile https://www.googleapis.com/auth/calendar.events.readonly" : "openid email profile");
    url.searchParams.set("prompt", "consent select_account");
  } else if (callbackProvider === "discord") {
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify");
  } else {
    url.searchParams.set("user_scope", "identity.basic,identity.email");
  }
  return { url: url.toString(), token: sealOAuthFlow(flow), callbackProvider, flow };
}
