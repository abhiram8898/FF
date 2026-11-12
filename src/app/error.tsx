"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, LinkButton, StatusPage } from "@/components/ui";

/** A page crashed: the menu stays usable, and the user can retry or start over with the demo data */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { actions } = useStore();
  const [details, setDetails] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      icon={TriangleAlert}
      tone="red"
      code="Something went wrong"
      title="This page couldn't be shown"
      actions={
        <>
          <Button onClick={reset}>
            <RefreshCw size={15} aria-hidden /> Try again
          </Button>
          <LinkButton href="/" variant="secondary">
            <LayoutDashboard size={15} aria-hidden /> Go to Dashboard
          </LinkButton>
          <Button
            variant="danger"
            onClick={() => {
              if (!window.confirm("Reset all data back to the demo data? Your changes will be lost.")) return;
              actions.reset();
              reset();
            }}
          >
            <RotateCcw size={15} aria-hidden /> Reset demo data
          </Button>
        </>
      }
    >
      <p>An unexpected error stopped this page from loading. Your other pages and saved data are not affected. Try again, or go back to the dashboard.</p>
      <p className="mt-2">If it keeps happening, the saved data in this browser may be damaged. Resetting the demo data usually fixes it.</p>
      <button type="button" onClick={() => setDetails((d) => !d)} className="mt-3 text-xs font-medium text-brand-700 hover:underline" aria-expanded={details}>
        {details ? "Hide" : "Show"} technical details
      </button>
      {details && (
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-100 p-3 text-left font-mono text-xs break-words whitespace-pre-wrap text-slate-700">
          {error.message || "Unknown error"}
          {error.digest && `\nReference: ${error.digest}`}
        </pre>
      )}
    </StatusPage>
  );
}
