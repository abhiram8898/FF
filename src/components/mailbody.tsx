"use client";

import { useSyncExternalStore } from "react";
import DOMPurify from "dompurify";
import { cn, isHtml } from "@/lib/utils";

/*
 * Read-only mail viewer, kept apart from the editor (richtext.tsx) so pages that only show mail
 * (Inbox, Sent, Email Logs) don't download the whole rich-text editor.
 */

// Links in mail bodies open in a new tab
if (typeof window !== "undefined" && DOMPurify.isSupported) {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

const noop = () => () => {};

/** Shows a mail body: sanitised HTML from the editor, or plain text as written */
export function MailBody({ body, className }: { body: string; className?: string }) {
  // The sanitiser needs the browser DOM, so the server render shows nothing for HTML bodies
  const client = useSyncExternalStore(noop, () => true, () => false);
  if (!isHtml(body)) return <pre className={cn("font-sans text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-700", className)}>{body}</pre>;
  if (!client) return null;
  return <div className={cn("rich-text text-sm text-slate-700", className)} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body, { ADD_ATTR: ["target"] }) }} />;
}
