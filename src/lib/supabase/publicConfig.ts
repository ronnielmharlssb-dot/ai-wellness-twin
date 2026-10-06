function publicValues() {
  // Keep direct property reads: Next.js inlines these values into browser assets.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return { url, key: publishableKey || anonKey, present: Boolean(url || publishableKey || anonKey) };
}

/** Partial or invalid cloud configuration must never enable demo authentication. */
export function hasSupabaseConfiguration(): boolean {
  return publicValues().present;
}

function isPublicKey(key: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) return true;
  const parts = key.split(".");
  if (parts.length !== 3 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return false;
  try {
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))).role === "anon";
  } catch { return false; }
}

export function getPublicSupabaseConfig(): { url: string; key: string } | null {
  const { url, key } = publicValues();
  if (!url || url.trim() !== url || !isPublicKey(key)) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  } catch { return null; }
  // This validates public configuration, not JWT signatures or user authority.
  return { url, key };
}
