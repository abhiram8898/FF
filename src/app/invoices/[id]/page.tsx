"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { omit } from "@/lib/utils";
import { Empty, PageHeader, linkCls } from "@/components/ui";
import { InvoiceForm } from "@/components/invoice";

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { state, actions } = useStore();
  const inv = state.invoices.find((i) => i.id === id);
  if (!inv) {
    return <Empty action={<Link href="/invoices" className={linkCls}>Back to Customer Invoices</Link>}>This invoice doesn&apos;t exist.</Empty>;
  }
  const editable = omit(inv, ["id", "no", "createdAt"]);
  return (
    <>
      <PageHeader back={{ href: "/invoices", label: "Customer Invoices" }} title={<span className="font-mono">{inv.no}</span>} subtitle="Edit the invoice, then use Preview to print or save it as PDF." />
      {/* Re-key after saving so "unsaved changes" compares against the saved invoice */}
      <InvoiceForm key={JSON.stringify(editable)} initial={editable} existing={inv} onSubmit={(data) => actions.saveInvoice(data, inv.id)} />
    </>
  );
}
