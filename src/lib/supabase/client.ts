import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "./publicConfig";

export function isSupabaseConfigured(): boolean {
  return getPublicSupabaseConfig() !== null;
}

export function createClient(options?: { detectSessionInUrl: boolean }) {
  const config = getPublicSupabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.key, options ? { auth: options } : undefined);
}
