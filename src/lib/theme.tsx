"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

const KEY = "freighttask:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> before the page paints, so a dark-mode user never sees a white flash.
 * Kept tiny and self-contained (no imports): it's inlined as a string.
 */
export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem("${KEY}")||"light";var d=m==="dark"||(m==="system"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

const readMode = (): ThemeMode => {
  try {
    const m = localStorage.getItem(KEY);
    return m === "dark" || m === "system" ? m : "light";
  } catch {
    return "light";
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
  const [mode, setModeState] = useState<ThemeMode>("light");

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
