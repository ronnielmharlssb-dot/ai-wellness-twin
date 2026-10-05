"use client";
import { useEffect, useState } from "react";
import { setLocalSessionUser, type AuthUser } from "@/lib/supabase/auth";

/** Populate the UI cache from the server before child pages read their identity. */
export function SessionGate({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setLocalSessionUser(user); setReady(true); }, [user]);
  return ready ? children : null;
}
