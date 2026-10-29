"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const SESSION_KEY = "freighttask:session";

export interface User {
  name: string;
  email: string;
  role: string;
  initials: string;
}

/** Demo account for the POC (no backend yet). Swap for a real auth API later. */
export const DEMO_CREDENTIALS = { email: "admin@freighttask.com", password: "Freight@123" };

const DEMO_USER: User = { name: "Admin User", email: DEMO_CREDENTIALS.email, role: "Operations", initials: "AU" };

interface AuthValue {
  /** undefined while the saved session is still being read */
  user: User | null | undefined;
  login: (email: string, password: string, remember: boolean) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let saved: User | null = null;
    try {
      // "Remember me" sessions live in localStorage, the rest only for this tab
      const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
      if (raw) saved = JSON.parse(raw) as User;
    } catch {
      /* ignore corrupt or blocked storage */
    }
    setUser(saved);
  }, []);

  const login = useCallback((email: string, password: string, remember: boolean) => {
    const ok = email.trim().toLowerCase() === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password;
    if (!ok) return false;
    try {
      (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(DEMO_USER));
    } catch {
      /* the session still works until the page is reloaded */
    }
    setUser(DEMO_USER);
    return true;
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
