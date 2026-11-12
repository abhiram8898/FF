"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { INVOICE_TONE, omit } from "@/lib/utils";
import { Badge, Empty, PageHeader, linkCls } from "@/components/ui";
import { InvoiceForm } from "@/components/invoice";

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { state, actions } = useStore();
  const inv = state.invoices.find((i) => i.id === id);
  if (!inv) {
    return <Empty action={<Link href="/invoices" className={linkCls}>Back to Customer Invoice</Link>}>This invoice doesn&apos;t exist.</Empty>;
  }
  const editable = omit(inv, ["id", "createdAt", "status", "statusAt", "sentAt"]);
  return (
    <>
      <PageHeader
        back={{ href: "/invoices", label: "Customer Invoice" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{inv.no}</span> <Badge className={INVOICE_TONE[inv.status]}>{inv.status}</Badge>
          </span>
        }
        subtitle="Save keeps the invoice in Draft. Preview → Send forwards it for the customer's approval; Generate finalises it once confirmed."
      />
      {/* Re-key after saving so "unsaved changes" compares against the saved invoice */}
      <InvoiceForm key={JSON.stringify(inv)} initial={editable} existing={inv} onSubmit={(data) => actions.saveInvoice(data, inv.id)} />
    </>
  );
}
