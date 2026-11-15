"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DARK_QUERY, DEFAULT_MODE, THEME_KEY as KEY, type ThemeMode } from "./theme-script";

export type { ThemeMode } from "./theme-script";

const readMode = (): ThemeMode => {
  try {
    const m = localStorage.getItem(KEY);
    return m === "light" || m === "dark" || m === "system" ? m : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
};

const apply = (mode: ThemeMode) => {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle("dark", dark);
};

interface ThemeValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/** Light / Dark / System preference, saved in this browser and applied as html.dark */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);

  // Pick up the saved choice (the head script has already applied it)
  useEffect(() => setModeState(readMode()), []);

  // "System" follows the OS setting live
  useEffect(() => {
    apply(mode);
    if (mode !== "system") return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* storage blocked: the choice lasts until reload */
    }
    setModeState(m);
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
