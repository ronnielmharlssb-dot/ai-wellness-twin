import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { createClient } from "./server";
import { DEFAULT_ACCOUNTS, isDemoModeEnabled, type AuthUser } from "./authTypes";
export { isSameOriginRequest } from "../http/requestOrigin";

export const DEMO_COOKIE = "wellness-demo-session";
const SESSION_LIFETIME = 8 * 60 * 60 * 1000;

function demoSecret(create: boolean): string | null {
  if (!isDemoModeEnabled()) return null;
  const filename = path.join(process.cwd(), ".data", "development-session.key");
  if (create && !fs.existsSync(filename)) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    try { fs.writeFileSync(filename, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
  return fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : null;
}
export function createDemoSession(userId: string, now = Date.now()): string {
  if (!isDemoModeEnabled() || !DEFAULT_ACCOUNTS.some((user) => user.id === userId)) throw new Error("Demo login is unavailable.");
  const secret = demoSecret(true)!;
  const payload = Buffer.from(JSON.stringify({ userId, expires: now + SESSION_LIFETIME })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
export function verifyDemoSession(token: string, now = Date.now()): AuthUser | null {
  const secret = demoSecret(false);
  if (!secret || token.length > 2048) return null;
  try {
    const [payload, signature, extra] = token.split(".");
    if (extra || !payload || !signature) return null;
    const expected = createHmac("sha256", secret).update(payload).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof parsed.expires !== "number" || parsed.expires <= now || parsed.expires > now + SESSION_LIFETIME) return null;
    return DEFAULT_ACCOUNTS.find((user) => user.id === parsed.userId) ?? null;
  } catch { return null; }
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return {
      id: data.user.id, email: data.user.email ?? "",
      fullName: typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : "Team Member",
      // app_metadata is server-managed; user_metadata must never grant HR privileges.
      role: data.user.app_metadata?.role === "hr" ? "hr" : "employee", source: "supabase",
    };
  }
  if (!isDemoModeEnabled()) return null;
  const token = (await cookies()).get(DEMO_COOKIE)?.value;
  return token ? verifyDemoSession(token) : null;
}
