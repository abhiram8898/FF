"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { EnquiryForm } from "@/components/EnquiryForm";

function NewEnquiry() {
  const params = useSearchParams();
  const { state } = useStore();
  const email = state.inbox.find((m) => m.id === params.get("emailId"));
  return <EnquiryForm email={email} />;
}

export default function NewEnquiryPage() {
  return (
    <Suspense>
      <NewEnquiry />
    </Suspense>
  );
}
