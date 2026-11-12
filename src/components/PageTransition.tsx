"use client";

import { usePathname } from "next/navigation";

/**
 * Page entrance. The wrapper is keyed on the path, so every navigation (including one record to
 * another of the same kind) mounts fresh content; `.page-enter` in globals.css then animates the
 * page's top-level sections in one after another. The animation is pure CSS, so it plays exactly
 * when the real page content is inserted (after "Loading page…", not on it) and costs no script.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
