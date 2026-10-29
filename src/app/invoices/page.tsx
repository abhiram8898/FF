"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, FileSpreadsheet, Link2, Link2Off, Plus } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { CustomerInvoice } from "@/lib/types";
import { DATE_RANGES, type DateRange, fmtDate, inRange, matches } from "@/lib/utils";
import { Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, LinkButton, NoResults, PageHeader, ResetFilters, RowMenu, SearchField, Table, linkCls } from "@/components/ui";
import { InvoicePreview, invoiceTotals } from "@/components/invoice";

const f2 = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoicesPage() {
  const { state, actions } = useStore();
  const { customer, job } = useLookups();
  const [q, setQ] = useState("");
  const [cust, setCust] = useState("all");
  const [range, setRange] = useState<DateRange>("all");
  const [view, setView] = useState<CustomerInvoice | null>(null);

  const all = state.invoices;
  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<CustomerInvoice>[] = [
    { id: "all", icon: FileSpreadsheet, label: "Invoices" },
    { id: "recent", icon: CalendarDays, tone: "sky", label: "Last 30 Days", test: (i) => inRange(i.date, "30") },
    { id: "linked", icon: Link2, tone: "green", label: "Linked to Bookings", test: (i) => !!i.jobId },
    { id: "unlinked", icon: Link2Off, tone: "amber", label: "Not Linked to Bookings", test: (i) => !i.jobId },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || cust !== "all" || range !== "all" || kpi !== null;
  const rows = all.filter(kpiOk).filter(
    (i) =>
      (cust === "all" || i.customerId === cust) &&
      inRange(i.date, range) &&
      matches(q, [i.no, customer(i.customerId)?.name, i.consignee, i.finalDestination, i.countryOfDestination, ...i.items.map((x) => x.description)]),
  );
  const reset = () => {
    setQ("");
    setCust("all");
    setRange("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader
        title="Customer Invoices"
        subtitle="Invoice cum packing list for a customer's cargo, e.g. when the customer only has a manual bill"
        actions={
          <LinkButton href="/invoices/new">
            <Plus size={16} aria-hidden /> New Invoice
          </LinkButton>
        }
      />

      <KpiFilters rows={all} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search invoices" value={q} onChange={setQ} placeholder="Search invoice no, customer, consignee, goods…" />
        <FilterSelect label="Customer" value={cust} onChange={(e) => setCust(e.target.value)}>
          <option value="all">All Customers</option>
          {state.customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
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
                <th>Invoice No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Consignee</th>
                <th>Destination</th>
                <th className="text-right">Packages</th>
                <th className="text-right">Net Kg</th>
                <th className="text-right">Amount</th>
                <th>Booking/Job</th>
                <th className="w-14 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const t = invoiceTotals(i);
                const j = job(i.jobId);
                return (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap">
                      <Link href={`/invoices/${i.id}`} className={`${linkCls} font-mono text-xs`}>
                        {i.no}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-slate-600">{fmtDate(i.date)}</td>
                    <td className="max-w-44 truncate">{customer(i.customerId)?.name}</td>
                    <td className="max-w-52 truncate" title={i.consignee}>
                      {i.consignee.split("\n")[0]}
                    </td>
                    <td className="whitespace-nowrap">{i.finalDestination || i.countryOfDestination}</td>
                    <td className="text-right tabular-nums">{t.packages}</td>
                    <td className="text-right tabular-nums">{f2(t.quantity)}</td>
                    <td className="text-right whitespace-nowrap tabular-nums">
                      {i.currency} {f2(t.amount)}
                    </td>
                    <td className="whitespace-nowrap">
                      {j ? (
                        <Link href={`/shipments/${j.id}`} className={`${linkCls} font-mono text-xs`}>
                          {j.ref}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-center">
                      <RowMenu
                        label={`Actions for ${i.no}`}
                        items={[
                          { label: "Open / Edit", href: `/invoices/${i.id}` },
                          { label: "Preview / Print", onSelect: () => setView(i) },
                          { label: "Delete", onSelect: () => window.confirm(`Delete invoice ${i.no}?`) && actions.deleteInvoice(i.id) },
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
            No invoices yet. Create one with New Invoice.
          </NoResults>
        )}
      </Card>
      {view && <InvoicePreview inv={view} onClose={() => setView(null)} />}
    </>
  );
}
