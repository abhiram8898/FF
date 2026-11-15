/**
 * Theme settings shared by the root layout (server) and the theme provider (client). Kept out of the
 * "use client" module on purpose: the layout inlines THEME_SCRIPT, and values imported from a client
 * module into a server component are not reliable.
 */
export type ThemeMode = "light" | "dark" | "system";

export const THEME_KEY = "freighttask:theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * With no saved choice, follow the browser's colour scheme. That is Chrome's own Appearance setting
 * when one is set (Settings → Appearance → Mode), otherwise the laptop's light/dark setting.
 */
export const DEFAULT_MODE: ThemeMode = "system";

/** Runs in <head> before the page paints, so the right theme shows from the first frame (no flash) */
export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem("${THEME_KEY}")||"${DEFAULT_MODE}";var d=m==="dark"||(m==="system"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
