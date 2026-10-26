"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Quotation } from "@/lib/types";
import { cn, fmtDate, laps, money, quoteTotals } from "@/lib/utils";
import { Button, Card, Empty, Field, Input, Kpi, Modal, PageHeader, RowMenu, Select, StatusBadge, Table, linkCls } from "@/components/ui";
import { PreviewModal, QuotationActionsModal } from "@/components/quotation";
import { RouteCell } from "@/components/workflow";

export default function QuotationsPage() {
  const router = useRouter();
  const { state } = useStore();
  const { enquiry, customer } = useLookups();
  const [q, setQ] = useState("");
  const [view, setView] = useState<Quotation | null>(null);
  const [actionsFor, setActionsFor] = useState<Quotation | null>(null);
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState("");

  const term = q.trim().toLowerCase();
  const rows = state.quotations.filter((x) => {
    const e = enquiry(x.enquiryId);
    return !term || [x.ref, customer(e?.customerId)?.name, e?.pol, e?.pod, x.status].some((v) => v?.toLowerCase().includes(term));
  });
  const live = state.quotations.filter((x) => x.status !== "Cancelled" && x.status !== "Lost");
  const withoutQuote = state.enquiries.filter((e) => !e.quotationId && !["Cancelled", "Lost"].includes(e.status));

  return (
    <>
      <PageHeader
        title="Quotations"
        subtitle="Create, preview and send freight quotations to customers"
        actions={
          <Button onClick={() => setPicking(true)}>
            <Plus size={16} aria-hidden /> New Quotation
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total Quotations" value={state.quotations.length} hint="Saved quotations" />
        <Kpi label="Confirmation Pending" value={state.quotations.filter((x) => x.status === "Quote Confirmation Pending").length} hint="Awaiting customer reply" />
        <Kpi label="Booking in Progress" value={state.quotations.filter((x) => x.status === "Booking in Progress").length} hint="Shipment date confirmed" />
        <Kpi label="Total Quoted Value" value={money(live.reduce((s, x) => s + quoteTotals(x).grand, 0))} hint="Excludes cancelled / lost" />
      </div>

      <Card bodyClassName="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3">
          <div className="relative w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input placeholder="Search quotation, customer, port…" aria-label="Search quotations" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <span className="text-xs text-slate-500">
            {rows.length} record{rows.length !== 1 && "s"}
          </span>
        </div>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Ref No · Date · Type</th>
                <th>Customer Name</th>
                <th>Route (POL → POD)</th>
                <th className="text-right">Grand Total</th>
                <th>Status</th>
                <th>Laps</th>
                <th className="w-10">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const e = enquiry(x.enquiryId);
                return (
                  <tr key={x.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap">
                      <Link href={`/quotations/${x.id}`} className={linkCls}>
                        {x.ref}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {fmtDate(x.createdAt)} · {e?.shipmentMode} · {e?.cargoMode}
                      </div>
                    </td>
                    <td className="max-w-44 truncate" title={customer(e?.customerId)?.name}>
                      {customer(e?.customerId)?.name}
                    </td>
                    <td>
                      <RouteCell pol={e?.pol} pod={e?.pod} route={e?.route} />
                    </td>
                    <td className="text-right whitespace-nowrap tabular-nums">{money(quoteTotals(x).grand)}</td>
                    <td>
                      <StatusBadge status={x.status} />
                    </td>
                    <td className="whitespace-nowrap text-slate-600">{x.status === "Draft" ? "—" : laps(x.statusAt)}</td>
                    <td className="text-right">
                      <RowMenu
                        label={`Actions for ${x.ref}`}
                        items={[
                          { label: "View", onSelect: () => setView(x) },
                          { label: "Edit", href: `/quotations/${x.id}` },
                          { label: "Update status / Reminder", onSelect: () => setActionsFor(x) },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="p-4">
            <Empty icon={FileText}>{term ? "No quotations match your search." : "No quotations yet. Create one from an enquiry with Get Rates / Compare."}</Empty>
          </div>
        )}
      </Card>

      {view && <PreviewModal q={view} onClose={() => setView(null)} />}
      {actionsFor && <QuotationActionsModal q={actionsFor} onClose={() => setActionsFor(null)} />}
      {picking && (
        <Modal
          open
          onClose={() => setPicking(false)}
          title="New Quotation"
          footer={
            withoutQuote.length > 0 && (
              <>
                <Button variant="secondary" onClick={() => setPicking(false)}>
                  Cancel
                </Button>
                <Button disabled={!pick} onClick={() => router.push(`/enquiries/${pick}?open=rates`)}>
                  Continue to Get Rates
                </Button>
              </>
            )
          }
        >
          <p className="mb-4 text-sm text-slate-600">Quotations are created from an enquiry, and the Enquiry ID becomes the Quotation ID.</p>
          {withoutQuote.length ? (
            <Field label="Enquiry">
              <Select value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Select an enquiry</option>
                {withoutQuote.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.ref} · {customer(e.customerId)?.name} · {e.pol} → {e.pod}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Empty
              action={
                <Link href="/enquiries/new" className={cn(linkCls, "text-sm")}>
                  Add an enquiry
                </Link>
              }
            >
              Every open enquiry already has a quotation.
            </Empty>
          )}
        </Modal>
      )}
    </>
  );
}
