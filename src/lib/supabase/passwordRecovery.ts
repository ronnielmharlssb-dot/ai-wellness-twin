import { createClient } from "./client";

const unavailable = "Password recovery is unavailable. Please try again later.";

export async function requestPasswordReset(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return "Enter a valid email address.";
  const supabase = createClient();
  if (!supabase) return unavailable;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error ? unavailable : null;
  } catch { return unavailable; }
}

/** Verify recovery credentials with Supabase; a local UI cache never grants access. */
export async function initializePasswordRecovery(href: string): Promise<{ email: string | null; error: string | null }> {
  const invalid = "This reset link is invalid or expired. Request a new one below.";
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (fragment.has("error") || url.searchParams.has("error")) return { email: null, error: invalid };
  const supabase = createClient({ detectSessionInUrl: false });
  if (!supabase) return { email: null, error: unavailable };
  try {
    // A reset requested outside this browser uses an implicit recovery link.
    // Requests made by our browser client instead use a PKCE code and verifier.
    if (fragment.get("type") === "recovery") {
      const access_token = fragment.get("access_token");
      const refresh_token = fragment.get("refresh_token");
      if (!access_token || !refresh_token) return { email: null, error: invalid };
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) return { email: null, error: invalid };
    } else if (url.searchParams.has("code")) {
      const flowId = url.searchParams.get("sb_flow_id");
      const { error } = await supabase.auth.exchangeCodeForSession(url.searchParams.get("code")!, flowId ? { flowId } : undefined);
      if (error) return { email: null, error: invalid };
    }
    const { data, error } = await supabase.auth.getUser();
    return !error && data.user?.email ? { email: data.user.email, error: null } : { email: null, error: invalid };
  } catch { return { email: null, error: invalid }; }
}

export async function completePasswordRecovery(password: string, confirmation: string): Promise<string | null> {
  if (password.length < 12) return "Use at least 12 characters for your new password.";
  if (password !== confirmation) return "The passwords do not match.";
  const supabase = createClient();
  if (!supabase) return unavailable;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return "Your recovery session has expired. Request a new reset link.";
    const { error: updateError } = await supabase.auth.updateUser({ password });
    return updateError ? "The password could not be changed. Try a different password or request a new reset link." : null;
  } catch { return unavailable; }
}

export function recoveryRedirect(href: string): string | null {
  const url = new URL(href);
  if (url.pathname === "/reset-password") return null;
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (fragment.get("type") === "recovery" || fragment.get("error_code") === "otp_expired") {
    return `/reset-password${url.hash}`;
  }
  return null;
}
