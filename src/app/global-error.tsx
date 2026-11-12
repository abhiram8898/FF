"use client";

import { useEffect } from "react";
import { Inter } from "next/font/google";
import { RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import { clearSavedData } from "@/lib/store";
import { Button, StatusPage } from "@/components/ui";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

/** Last resort: the app frame itself failed (sign-in, saved data or menu), so this page brings its own <html> */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className={`${inter.variable} bg-slate-50 font-sans antialiased`}>
        <main className="flex min-h-screen flex-col items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image needs the app frame that just failed */}
          <img src="/brand/logo.png" alt="FreightTask" className="h-9 w-auto" />
          <StatusPage
            className="min-h-0 py-6"
            icon={TriangleAlert}
            tone="red"
            code="Something went wrong"
            title="FreightTask couldn't start"
            actions={
              <>
                <Button onClick={reset}>
                  <RefreshCw size={15} aria-hidden /> Try again
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (!window.confirm("Clear the data saved in this browser and start again with the demo data? Your changes will be lost.")) return;
                    clearSavedData();
                    window.location.assign("/");
                  }}
                >
                  <RotateCcw size={15} aria-hidden /> Reset demo data
                </Button>
              </>
            }
          >
            An unexpected error stopped the app from loading. Try again first. If it keeps happening, the data saved in this browser may be damaged, and resetting the demo data will fix it.
            {error.digest && <span className="mt-2 block font-mono text-xs text-slate-400">Reference: {error.digest}</span>}
          </StatusPage>
        </main>
      </body>
    </html>
  );
}
