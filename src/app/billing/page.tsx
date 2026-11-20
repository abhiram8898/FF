"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlarmClock, Banknote, CircleCheck, FilePen, ReceiptText, Send } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Bill } from "@/lib/types";
import { BILL_TONE, billTotals, f2, fmtDate, laps, matches } from "@/lib/utils";
import { Badge, Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, NoResults, PageHeader, ResetFilters, RowActions, SearchField, Table, Tabs, linkCls } from "@/components/ui";
import { BillPreviewModal, BillStatusModal, isOverdue } from "@/components/billing";

const TABS = ["Proforma Invoice", "Invoice"] as const;

function Billing() {
  const { state, actions } = useStore();
  const { customer, job, awbOf } = useLookups();
  const params = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>(params.get("tab") === "invoice" ? "Invoice" : "Proforma Invoice");
  const [q, setQ] = useState("");
  const [history, setHistory] = useState<"open" | "all">("open");
  const [view, setView] = useState<Bill | null>(null);
  const [statusFor, setStatusFor] = useState<Bill | null>(null);
  const [kpi, setKpi] = useState<string | null>(null);

  const proformas = state.bills.filter((b) => b.kind === "Proforma");
  const invoices = state.bills.filter((b) => b.kind === "Invoice");
  const isProforma = tab === "Proforma Invoice";
  const all = isProforma ? proformas : invoices;
  const KPIS: KpiDef<Bill>[] = isProforma
    ? [
        { id: "all", icon: ReceiptText, label: "Proforma Invoices" },
        { id: "draft", icon: FilePen, tone: "slate", label: "Draft", test: (b) => b.status === "Draft" },
        { id: "sent", icon: Send, tone: "amber", label: "Proforma INV Send", test: (b) => b.status === "Proforma INV Send" },
        { id: "approved", icon: CircleCheck, tone: "green", label: "Approved (history)", test: (b) => b.status === "Approved" },
      ]
    : [
        { id: "all", icon: ReceiptText, label: "Invoices" },
        { id: "open", icon: Send, tone: "sky", label: "Sent / Issued", test: (b) => b.status === "Sent / Issued" },
        { id: "overdue", icon: AlarmClock, tone: "red", label: "Overdue", test: (b) => b.status === "Overdue" || isOverdue(b) },
        { id: "partial", icon: Banknote, tone: "amber", label: "Partially Paid", test: (b) => b.status === "Partially Paid" },
        { id: "paid", icon: CircleCheck, tone: "green", label: "Paid", test: (b) => b.status === "Paid" },
      ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || kpi !== null || (isProforma && history !== "open");
  const rows = all
    .filter(kpiOk)
    .filter((b) => !isProforma || history === "all" || kpi === "approved" || (b.status !== "Approved" && b.status !== "Cancelled"))
    .filter((b) => matches(q, [b.no, b.jobNo, customer(b.customerId)?.name, b.mawbNo, b.pol, b.pod, b.branch]))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reset = () => {
    setQ("");
    setKpi(null);
    setHistory("open");
  };
  const ready = state.jobs.filter((j) => (j.status === "Departed" || j.status === "Cargo In Transit") && !proformas.some((p) => p.jobId === j.id && p.status !== "Cancelled"));

  return (
    <>
      <PageHeader
        title="Debit Note"
        subtitle="Billing starts after the pre-alert goes to the shipper and the job departs: a proforma is created automatically, sent for confirmation, then approved into the tax invoice."
      />
      <Tabs
        tabs={TABS}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setKpi(null);
        }}
      />
      <KpiFilters cols={isProforma ? 4 : 5} rows={all} kpis={KPIS} active={kpi} onChange={setKpi} />

      {isProforma && ready.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
          Departed without a proforma:
          {ready.map((j) => (
            <button key={j.id} className={`${linkCls} font-mono text-xs`} onClick={() => actions.createProforma(j.id)}>
              Create for {j.ref}
            </button>
          ))}
        </div>
      )}

      <FilterBar>
        <SearchField label="Search bills" value={q} onChange={setQ} placeholder="Search number, job, customer, MAWB…" />
        {isProforma && (
          <FilterSelect label="History" value={history} onChange={(e) => setHistory(e.target.value as typeof history)}>
            <option value="open">Open proformas</option>
            <option value="all">Include history (approved / cancelled)</option>
          </FilterSelect>
        )}
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              {isProforma ? (
                <tr>
                  <th>Job Number</th>
                  <th>Invoice Number</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>POL</th>
                  <th>POD</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                  <th className="w-px whitespace-nowrap">Actions</th>
                </tr>
              ) : (
                <tr>
                  <th>Job Number</th>
                  <th>AWB Number</th>
                  <th>Invoice Number</th>
                  <th>Date</th>
                  <th>Customer Name</th>
                  <th>Branch Name</th>
                  <th className="text-right">Inv. Amount</th>
                  <th className="text-right">Received</th>
                  <th>Laps</th>
                  <th>Status</th>
                  <th className="w-px whitespace-nowrap">Actions</th>
                </tr>
              )}
            </thead>
            <tbody>
              {rows.map((b) => {
                const t = billTotals(b);
                const j = job(b.jobId);
                const jobCell = (
                  <td className="whitespace-nowrap">
                    {j ? (
                      <Link href={`/shipments/${j.id}`} className={`${linkCls} font-mono text-xs`}>
                        {b.jobNo}
                      </Link>
                    ) : (
                      b.jobNo
                    )}
                  </td>
                );
                const noCell = (
                  <td className="whitespace-nowrap">
                    <Link href={`/billing/${b.id}`} className={`${linkCls} font-mono text-xs`}>
                      {b.no}
                    </Link>
                  </td>
                );
                const statusCell = (
                  <td className="whitespace-nowrap">
                    <Badge className={BILL_TONE[b.status]}>{b.status}</Badge>
                    {isOverdue(b) && b.status !== "Overdue" && <div className="mt-0.5 text-xs text-red-600">Due {fmtDate(b.dueDate)}</div>}
                  </td>
                );
                return isProforma ? (
                  <tr key={b.id} className="hover:bg-slate-50">
                    {jobCell}
                    {noCell}
                    <td className="whitespace-nowrap text-slate-600">{fmtDate(b.date)}</td>
                    <td className="max-w-44 truncate">{customer(b.customerId)?.name}</td>
                    <td className="max-w-40 truncate" title={b.pol}>
                      {b.pol}
                    </td>
                    <td className="max-w-40 truncate" title={b.pod}>
                      {b.pod}
                    </td>
                    <td className="text-right tabular-nums">{f2(t.total)}</td>
                    {statusCell}
                    <td className="whitespace-nowrap">
                      <RowActions
                        label={`Actions for ${b.no}`}
                        items={[
                          { label: "View", onSelect: () => setView(b) },
                          { label: "Edit", href: `/billing/${b.id}` },
                          ...(b.status === "Draft" || b.status === "Proforma INV Send"
                            ? [{ label: "Cancel", onSelect: () => window.confirm(`Cancel proforma ${b.no}?`) && actions.cancelBill(b.id) }]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={b.id} className="hover:bg-slate-50">
                    {jobCell}
                    <td className="font-mono text-xs whitespace-nowrap">{b.mawbNo || awbOf(b.jobId)?.mawbNo || "—"}</td>
                    {noCell}
                    <td className="whitespace-nowrap text-slate-600">{fmtDate(b.date)}</td>
                    <td className="max-w-44 truncate">{customer(b.customerId)?.name}</td>
                    <td className="whitespace-nowrap">{b.branch}</td>
                    <td className="text-right tabular-nums">{f2(t.total)}</td>
                    <td className="text-right tabular-nums">{f2(t.received)}</td>
                    <td className="whitespace-nowrap text-slate-600">{b.status === "Paid" || b.status === "Cancelled" ? "—" : laps(b.createdAt)}</td>
                    {statusCell}
                    <td className="whitespace-nowrap">
                      <RowActions
                        label={`Actions for ${b.no}`}
                        items={[
                          { label: "View", onSelect: () => setView(b) },
                          { label: "Edit", href: `/billing/${b.id}` },
                          ...(b.status !== "Cancelled" ? [{ label: "Change status", onSelect: () => setStatusFor(b) }] : []),
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
            {isProforma ? "No proforma invoices yet. They are created when a job is marked Departed." : "No invoices yet. Approve a proforma to raise the invoice."}
          </NoResults>
        )}
      </Card>
      {view && <BillPreviewModal bill={view} onClose={() => setView(null)} />}
      {statusFor && <BillStatusModal bill={statusFor} onClose={() => setStatusFor(null)} />}
    </>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <Billing />
    </Suspense>
  );
}
