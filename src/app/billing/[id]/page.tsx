"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLookups, useStore } from "@/lib/store";
import { BILL_TONE, fmtDate } from "@/lib/utils";
import { Badge, Empty, PageHeader, linkCls } from "@/components/ui";
import { BILL_HEADING, BillEditor, isOverdue } from "@/components/billing";

export default function BillPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useStore();
  const { job } = useLookups();
  const bill = state.bills.find((b) => b.id === id);
  if (!bill) {
    return <Empty action={<Link href="/billing" className={linkCls}>Back to Billing</Link>}>This bill doesn&apos;t exist.</Empty>;
  }
  const source = state.bills.find((b) => b.id === bill.sourceId);
  const derived = state.bills.filter((b) => b.sourceId === bill.id);
  const j = job(bill.jobId);
  return (
    <>
      <PageHeader
        back={bill.kind === "Credit Note" ? { href: "/billing/credit-notes", label: "Credit Note" } : { href: "/billing", label: "Debit Note" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{bill.no}</span> <Badge className={BILL_TONE[bill.status]}>{bill.status}</Badge>
            {isOverdue(bill) && bill.status !== "Overdue" && <Badge className={BILL_TONE.Overdue}>Due date passed</Badge>}
          </span>
        }
        subtitle={
          <>
            {BILL_HEADING[bill.kind]} · {fmtDate(bill.date)}
            {j && (
              <>
                {" "}
                · Job{" "}
                <Link href={`/shipments/${j.id}`} className={linkCls}>
                  {j.ref}
                </Link>
              </>
            )}
            {source && (
              <>
                {" "}
                · from{" "}
                <Link href={`/billing/${source.id}`} className={linkCls}>
                  {source.no}
                </Link>
              </>
            )}
            {derived.map((d) => (
              <span key={d.id}>
                {" "}
                · {d.kind}{" "}
                <Link href={`/billing/${d.id}`} className={linkCls}>
                  {d.no}
                </Link>
              </span>
            ))}
          </>
        }
      />
      <BillEditor key={`${bill.id}-${bill.status}-${bill.statusAt}-${bill.sentAt ?? ""}-${bill.payments.length}`} bill={bill} />
    </>
  );
}
