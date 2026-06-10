import { useEffect, useState } from "react";

const KEY = "yosignal.theme";
export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    try {
      const stored = (localStorage.getItem(KEY) as Theme | null) ?? "light";
      setThemeState(stored);
      document.documentElement.classList.toggle("dark", stored === "dark");
    } catch {
      /* ignore */
    }
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}