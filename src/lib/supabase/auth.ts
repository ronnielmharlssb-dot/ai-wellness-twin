import { createClient } from "./client";
import { DEFAULT_ACCOUNTS, PRIMARY_USER_ACCOUNT, PRIMARY_HR_ACCOUNT, CALIBRATED_DEMO_ACCOUNT, isDemoModeEnabled, type AuthUser } from "./authTypes";

export { DEFAULT_ACCOUNTS, PRIMARY_USER_ACCOUNT, PRIMARY_HR_ACCOUNT, CALIBRATED_DEMO_ACCOUNT, isDemoModeEnabled };
export type { AuthUser };
export const LIVE_TESTER_ACCOUNT = PRIMARY_USER_ACCOUNT;
const LOCAL_SESSION_KEY = "wellness-auth-user";
const REGISTERED_USERS_KEY = "wellness-registered-users";

function isAuthUser(raw: unknown): raw is AuthUser {
  if (!raw || typeof raw !== "object") return false;
  const user = raw as AuthUser;
  return typeof user.id === "string" && typeof user.email === "string" && typeof user.fullName === "string" &&
    (user.role === "employee" || user.role === "hr");
}
/** Local storage is a UI cache only. Server authentication owns access decisions. */
export function getLocalSessionUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!saved) return null;
    const parsed: unknown = JSON.parse(saved);
    return isAuthUser(parsed) ? parsed : null;
  } catch { return null; }
}
export function setLocalSessionUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(LOCAL_SESSION_KEY);
  window.dispatchEvent(new CustomEvent("wellness-auth-update", { detail: user }));
}
export function getRegisteredUsers(): AuthUser[] {
  if (typeof window === "undefined") return DEFAULT_ACCOUNTS;
  try {
    const saved = JSON.parse(localStorage.getItem(REGISTERED_USERS_KEY) || "[]");
    const users: AuthUser[] = Array.isArray(saved) ? saved.filter(isAuthUser) : [];
    for (const account of DEFAULT_ACCOUNTS) {
      if (!users.some((user) => user.id === account.id)) users.push(account);
    }
    return users;
  } catch { return DEFAULT_ACCOUNTS; }
}
export function saveRegisteredUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  const users = getRegisteredUsers().filter((existing) => existing.id !== user.id);
  localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify([...users, user]));
}
export function findRegisteredUser(email: string): AuthUser | null {
  return getRegisteredUsers().find((user) => user.email.toLowerCase() === email.trim().toLowerCase()) ?? null;
}
async function loginDemo(account: AuthUser): Promise<AuthUser> {
  if (!isDemoModeEnabled()) throw new Error("Demo login is unavailable. Use your verified account.");
  const response = await fetch("/api/auth/session", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: account.id }),
  });
  const data = await response.json();
  if (!response.ok || !isAuthUser(data.user)) throw new Error(data.error || "Demo login failed.");
  setLocalSessionUser(data.user);
  return data.user;
}
export function loginAsRole(role: "employee" | "hr"): Promise<AuthUser> {
  return loginDemo(role === "hr" ? PRIMARY_HR_ACCOUNT : PRIMARY_USER_ACCOUNT);
}
export function loginAsCalibratedDemo(): Promise<AuthUser> { return loginDemo(CALIBRATED_DEMO_ACCOUNT); }
export function loginAsLiveTester(): Promise<AuthUser> { return loginAsRole("employee"); }

export async function refreshSessionUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  const data = await response.json();
  const user = response.ok && isAuthUser(data.user) ? data.user : null;
  setLocalSessionUser(user);
  return user;
}
export async function signInUser({ email, password, selectedRole }: {
  email: string; password?: string; selectedRole?: "employee" | "hr";
}): Promise<{ user: AuthUser | null; error: string | null }> {
  const supabase = createClient();
  if (!supabase) return { user: null, error: "Account sign-in is unavailable. Please contact the site administrator." };
  if (!password) return { user: null, error: "A password is required." };
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return { user: null, error: error.message };
    const user = await refreshSessionUser();
    if (!user) return { user: null, error: "The server could not verify your session. Please sign in again." };
    if (selectedRole && selectedRole !== user.role) {
      await signOutUser();
      return { user: null, error: "This account does not have the requested role." };
    }
    return { user, error: null };
  } catch { return { user: null, error: "Authentication is unavailable. Please retry." }; }
}
export async function signUpUser({ email, password, fullName, role }: {
  email: string; password: string; fullName: string; role: "employee" | "hr";
}): Promise<{ user: AuthUser | null; error: string | null; confirmationRequired?: boolean }> {
  const supabase = createClient();
  if (!supabase) return { user: null, error: "Account registration is unavailable. Please contact the site administrator." };
  if (role !== "employee") return { user: null, error: "HR access requires administrator approval." };
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });
    if (error) return { user: null, error: error.message };
    if (!data.session) return { user: null, error: null, confirmationRequired: true };
    const user = await refreshSessionUser();
    return { user, error: user ? null : "Account created, but session verification failed. Please sign in." };
  } catch { return { user: null, error: "Registration is unavailable. Please retry." }; }
}
export async function signInWithGoogle(customEmail?: string, _options?: { isSignUp?: boolean; role?: "employee" | "hr" }): Promise<{ user: AuthUser | null; error: string | null }> {
  if (_options?.isSignUp && _options.role === "hr") return { user: null, error: "HR access requires administrator approval." };
  const supabase = createClient();
  if (!supabase) return { user: null, error: "Google sign-in is unavailable. Please contact the site administrator." };
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: {
    redirectTo: `${window.location.origin}/api/auth/callback`,
    queryParams: customEmail ? { login_hint: customEmail } : undefined,
  } });
  return { user: null, error: error?.message ?? null };
}
export async function signOutUser() {
  const response = await fetch("/api/auth/session", { method: "DELETE" });
  if (!response.ok) throw new Error("Sign-out failed. Please retry.");
  setLocalSessionUser(null);
}
