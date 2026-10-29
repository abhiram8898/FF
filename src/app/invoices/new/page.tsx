"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import { InvoiceForm, emptyInvoice } from "@/components/invoice";

export default function NewInvoicePage() {
  const router = useRouter();
  const { actions } = useStore();
  return (
    <>
      <PageHeader
        back={{ href: "/invoices", label: "Customer Invoices" }}
        title="New Customer Invoice"
        subtitle="Convert the customer's bill into an invoice cum packing list. Linking a booking fills the ports and flight."
      />
      <InvoiceForm initial={emptyInvoice()} onSubmit={(data) => router.push(`/invoices/${actions.saveInvoice(data).id}`)} />
    </>
  );
}
