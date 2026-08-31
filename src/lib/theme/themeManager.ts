export type ThemeMode = "light" | "dark" | "system";

const THEME_KEY = "wellness-theme-preference";

export function getStoredThemePreference(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
    return "light";
  } catch {
    return "light";
  }
}

export function setStoredThemePreference(mode: ThemeMode) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(THEME_KEY, mode);
    applyTheme(mode);
  } catch (err) {
    console.error("Failed to save theme preference:", err);
  }
}

export function applyTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;

  if (mode === "dark") {
    root.classList.add("dark");
  } else if (mode === "light") {
    root.classList.remove("dark");
  } else {
    // System preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

export function initializeThemeListener(): () => void {
  if (typeof window === "undefined") return () => {};

  const currentMode = getStoredThemePreference();
  applyTheme(currentMode);

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const handleChange = () => {
    const mode = getStoredThemePreference();
    if (mode === "system") {
      applyTheme("system");
    }
  };

  mediaQuery.addEventListener("change", handleChange);
  return () => mediaQuery.removeEventListener("change", handleChange);
}
