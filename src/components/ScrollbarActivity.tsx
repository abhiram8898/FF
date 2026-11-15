"use client";

import { useEffect } from "react";

/** How long a scrollbar stays visible after scrolling stops */
const HIDE_AFTER = 900;
/** Pointer this close to the window's right edge reveals the page scrollbar */
const EDGE = 18;

/**
 * macOS-style scrollbars (styles in globals.css): marks whatever is being scrolled with
 * `.is-scrolling` until shortly after it stops, and the page with `.scrollbar-near` while the
 * pointer is at the right edge. Hovering an inner scroll area is handled in CSS alone.
 */
export function ScrollbarActivity() {
  useEffect(() => {
    const timers = new Map<Element, number>();
    const root = document.documentElement;

    const onScroll = (e: Event) => {
      const el = e.target instanceof Element ? e.target : root;
      el.classList.add("is-scrolling");
      window.clearTimeout(timers.get(el));
      timers.set(
        el,
        window.setTimeout(() => {
          el.classList.remove("is-scrolling");
          timers.delete(el);
        }, HIDE_AFTER),
      );
    };

    let near = false;
    const onMove = (e: MouseEvent) => {
      const now = e.clientX >= window.innerWidth - EDGE;
      if (now !== near) root.classList.toggle("scrollbar-near", (near = now));
    };
    const onLeave = () => {
      if (near) root.classList.toggle("scrollbar-near", (near = false));
    };

    // Capture phase: scroll events don't bubble, so this sees every scrolling element
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);
  return null;
}
