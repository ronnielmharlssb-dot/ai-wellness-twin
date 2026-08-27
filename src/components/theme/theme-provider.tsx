"use client";

import { useEffect } from "react";
import { initializeThemeListener } from "@/lib/theme/themeManager";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const cleanup = initializeThemeListener();
    return cleanup;
  }, []);

  return <>{children}</>;
}
