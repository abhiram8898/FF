"use client";

import Link from "next/link";
import { useState } from "react";
import { FileCheck2, FileStack, ListChecks, Receipt } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Enquiry } from "@/lib/types";
import { fmtDate, matches, money } from "@/lib/utils";
import { Badge, Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, NoResults, PageHeader, ResetFilters, RowMenu, SearchField, Table, linkCls } from "@/components/ui";

const PENDING = <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Pending</Badge>;
const RECEIVED = <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">Received</Badge>;

export default function DocumentsPage() {
  const { state } = useStore();
  const { customer, job } = useLookups();
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "pending" | "complete">("all");

  // Every booked shipment: invoice & packing list from the customer, then the AWB on the job
  const all = state.enquiries.filter((e) => e.booking || e.docs || e.jobId);
  const complete = (e: Enquiry) => !!(e.docs?.packingList && job(e.jobId)?.awb);

  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<Enquiry>[] = [
    { id: "all", icon: FileStack, label: "Booked Shipments" },
    { id: "invoice", icon: Receipt, tone: "sky", label: "Invoices Received", test: (e) => !!e.docs },
    { id: "packing", icon: ListChecks, tone: "amber", label: "Packing Lists Pending", test: (e) => !e.docs?.packingList },
    { id: "awb", icon: FileCheck2, tone: "green", label: "AWBs Issued", test: (e) => !!job(e.jobId)?.awb },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || show !== "all" || kpi !== null;
  const rows = all.filter(kpiOk).filter(
    (e) =>
      (show === "all" || (show === "complete") === complete(e)) &&
      matches(q, [e.ref, customer(e.customerId)?.name, e.docs?.invoiceNo, job(e.jobId)?.ref, job(e.jobId)?.awb?.number]),
  );
  const reset = () => {
    setQ("");
    setShow("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader title="AWB / Documents" subtitle="Invoice, packing list and air waybill for each booked shipment" />

      <KpiFilters rows={all} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search documents" value={q} onChange={setQ} />
        <FilterSelect label="Document status" value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
          <option value="all">All Status</option>
          <option value="pending">Documents pending</option>
          <option value="complete">Complete</option>
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Enquiry ID</th>
                <th>Customer</th>
                <th>Invoice</th>
                <th>Packing List</th>
                <th>Job No</th>
                <th>AWB</th>
                <th className="w-14 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const j = job(e.jobId);
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap">
                      <Link href={`/enquiries/${e.id}`} className={linkCls}>
                        {e.ref}
                      </Link>
                    </td>
                    <td className="max-w-44 truncate">{customer(e.customerId)?.name}</td>
                    <td className="whitespace-nowrap">
                      {e.docs ? (
                        <>
                          {e.docs.invoiceNo}
                          <div className="text-xs text-slate-500">
                            {money(e.docs.invoiceValue)} · {fmtDate(e.docs.receivedAt)}
                          </div>
                        </>
                      ) : (
                        PENDING
                      )}
                    </td>
                    <td>{e.docs?.packingList ? RECEIVED : PENDING}</td>
                    <td className="whitespace-nowrap">
                      {j ? (
                        <Link href={`/shipments/${j.id}`} className={linkCls}>
                          {j.ref}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {j?.awb ? (
                        <span className="font-mono text-xs">
                          {j.awb.type === "Master" ? "MAWB" : "HAWB"} {j.awb.number}
                        </span>
                      ) : (
                        PENDING
                      )}
                    </td>
                    <td className="text-center">
                      <RowMenu
                        label={`Actions for ${e.ref}`}
                        items={[{ label: "View enquiry", href: `/enquiries/${e.id}` }, ...(j ? [{ label: "View job / AWB", href: `/shipments/${j.id}` }] : [])]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No documents yet. Documents are collected once a booking is confirmed.
          </NoResults>
        )}
      </Card>
    </>
  );
}
