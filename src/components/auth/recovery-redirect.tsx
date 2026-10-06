"use client";

import { useEffect } from "react";
import { recoveryRedirect } from "@/lib/supabase/passwordRecovery";

export function RecoveryRedirect() {
  useEffect(() => {
    const destination = recoveryRedirect(window.location.href);
    if (destination) window.location.replace(destination);
  }, []);
  return null;
}
