"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { CircleCheck, FilePen, FileSpreadsheet, Hourglass, Plus, Stamp } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import { INVOICE_STATUSES, type CustomerInvoice, type InvoiceStatus } from "@/lib/types";
import { DATE_RANGES, type DateRange, INVOICE_TONE, fmtDate, inRange, matches } from "@/lib/utils";
import { Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, LinkButton, NoResults, PageHeader, ResetFilters, RowActions, SearchField, Table, ToneBadge, linkCls } from "@/components/ui";
import { InvoicePreview, invoiceTotals } from "@/components/invoice";

export default function InvoicesPage() {
  const router = useRouter();
  const { state, actions } = useStore();
  const { customer, job } = useLookups();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | InvoiceStatus>("all");
  const [range, setRange] = useState<DateRange>("all");
  const [view, setView] = useState<CustomerInvoice | null>(null);

  const all = state.invoices;
  const [kpi, setKpi] = useState<string | null>(null);
  const is = (s: InvoiceStatus) => (i: CustomerInvoice) => i.status === s;
  const KPIS: KpiDef<CustomerInvoice>[] = [
    { id: "all", icon: FileSpreadsheet, label: "Invoices" },
    { id: "draft", icon: FilePen, tone: "slate", label: "Draft", test: is("Draft") },
    { id: "awaiting", icon: Hourglass, tone: "amber", label: "Awaiting Confirmation", test: is("Awaiting Confirmation") },
    { id: "generated", icon: Stamp, tone: "violet", label: "Generated", test: is("Generated") },
    { id: "completed", icon: CircleCheck, tone: "green", label: "Completed", test: is("Completed") },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || status !== "all" || range !== "all" || kpi !== null;
  const rows = all.filter(kpiOk).filter(
    (i) =>
      (status === "all" || i.status === status) &&
      inRange(i.date, range) &&
      matches(q, [i.no, customer(i.customerId)?.name, job(i.jobId)?.ref, i.consignee, i.portOfLoading, i.portOfDischarge, ...i.items.map((x) => x.description)]),
  );
  const reset = () => {
    setQ("");
    setStatus("all");
    setRange("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader
        title="Customer Invoice"
        subtitle="Invoices prepared on behalf of customers: save as draft, send for approval, generate once confirmed. Generated invoices link into the job's documents."
        actions={
          <LinkButton href="/invoices/new">
            <Plus size={16} aria-hidden /> Add Invoice
          </LinkButton>
        }
      />

      <KpiFilters cols={5} rows={all} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search invoices" value={q} onChange={setQ} placeholder="Search invoice no, job, customer, consignee, goods…" />
        <FilterSelect label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All Status</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Invoice date" value={range} onChange={(e) => setRange(e.target.value as DateRange)}>
          {DATE_RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Job Number</th>
                <th>Invoice Number</th>
                <th>Customer Name</th>
                <th>Type</th>
                <th>POL</th>
                <th>POD</th>
                <th>Date</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th className="w-px whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const j = job(i.jobId);
                return (
                  <tr key={i.id} className={i.status === "Cancelled" ? "bg-slate-50 text-slate-500" : "hover:bg-slate-50"}>
                    <td className="whitespace-nowrap">
                      {j ? (
                        <Link href={`/shipments/${j.id}`} className={`${linkCls} font-mono text-xs`}>
                          {j.ref}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <Link href={`/invoices/${i.id}`} className={`${linkCls} font-mono text-xs`}>
                        {i.no}
                      </Link>
                    </td>
                    <td className="max-w-44 truncate">{customer(i.customerId)?.name}</td>
                    <td className="whitespace-nowrap">{i.stakeholderType}</td>
                    <td className="whitespace-nowrap">{i.portOfLoading}</td>
                    <td className="whitespace-nowrap">{i.portOfDischarge}</td>
                    <td className="whitespace-nowrap text-slate-600">{fmtDate(i.date)}</td>
                    <td className="text-right whitespace-nowrap tabular-nums">
                      {i.currency} {invoiceTotals(i).amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="whitespace-nowrap">
                      <ToneBadge status={i.status} tones={INVOICE_TONE} />
                    </td>
                    <td className="whitespace-nowrap">
                      <RowActions
                        label={`Actions for ${i.no}`}
                        items={[
                          { label: "View", onSelect: () => setView(i) },
                          { label: "Edit", href: `/invoices/${i.id}` },
                          ...(i.status !== "Cancelled" ? [{ label: "Cancel", onSelect: () => window.confirm(`Cancel invoice ${i.no}?`) && actions.setInvoiceStatus(i.id, "Cancelled") }] : []),
                          { label: "Duplicate", onSelect: () => router.push(`/invoices/${actions.duplicateInvoice(i.id).id}`) },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No invoices yet. Create one with Add Invoice.
          </NoResults>
        )}
      </Card>
      {view && <InvoicePreview inv={view} onClose={() => setView(null)} />}
    </>
  );
}
