"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import { InvoiceForm, emptyInvoice } from "@/components/invoice";

function NewInvoice() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, actions } = useStore();
  const job = state.jobs.find((j) => j.id === params.get("job"));
  const customer = state.customers.find((c) => c.id === job?.customerId);
  return (
    <>
      <PageHeader
        back={{ href: "/invoices", label: "Customer Invoice" }}
        title="Add Invoice"
        subtitle="Prepare the invoice cum packing list on behalf of the customer. Linking a booking fills the ports and flight."
      />
      <InvoiceForm initial={{ ...emptyInvoice(customer?.id, customer?.type), jobId: job?.id, enquiryId: job?.enquiryId }} onSubmit={(data) => router.push(`/invoices/${actions.saveInvoice(data).id}`)} />
    </>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense>
      <NewInvoice />
    </Suspense>
  );
}
