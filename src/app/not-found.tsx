"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutDashboard, MapPinOff } from "lucide-react";
import { Button, LinkButton, StatusPage } from "@/components/ui";

/** Any address that doesn't match a page */
export default function NotFound() {
  const router = useRouter();
  return (
    <StatusPage
      icon={MapPinOff}
      code="Error 404"
      title="Page not found"
      actions={
        <>
          <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeft size={15} aria-hidden /> Go back
          </Button>
          <LinkButton href="/">
            <LayoutDashboard size={15} aria-hidden /> Go to Dashboard
          </LinkButton>
        </>
      }
    >
      The page you&apos;re looking for doesn&apos;t exist or has moved. Check the address, or use the menu to find what you need.
    </StatusPage>
  );
}
