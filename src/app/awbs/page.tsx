"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleCheck, CircleX, FilePen, Plane, Send } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Awb, AwbStatus } from "@/lib/types";
import { AWB_TONE, fmtDate, matches } from "@/lib/utils";
import { Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, NoResults, PageHeader, ResetFilters, RowActions, SearchField, Table, ToneBadge, linkCls } from "@/components/ui";
import { AwbFormModal, AwbPreviewModal, AwbStatusModal, awbLabel } from "@/components/awb";

export default function AwbsPage() {
  const { state, actions } = useStore();
  const { job, awbsOf } = useLookups();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | Awb["type"]>("all");
  const [view, setView] = useState<Awb | null>(null);
  const [editing, setEditing] = useState<Awb | null>(null);
  const [statusFor, setStatusFor] = useState<Awb | null>(null);

  const [kpi, setKpi] = useState<string | null>(null);
  const is = (s: AwbStatus) => (a: Awb) => a.status === s;
  const KPIS: KpiDef<Awb>[] = [
    { id: "all", icon: Plane, label: "Airway Bills" },
    { id: "draft", icon: FilePen, tone: "slate", label: "Draft", test: is("Draft") },
    { id: "sent", icon: Send, tone: "amber", label: "Draft AWB Send", test: is("Draft AWB Send") },
    { id: "executed", icon: CircleCheck, tone: "green", label: "AWB Executed", test: is("AWB Executed") },
    { id: "cancelled", icon: CircleX, tone: "red", label: "Cancelled", test: is("Cancelled") },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || type !== "all" || kpi !== null;
  const rows = state.awbs
    .filter(kpiOk)
    .filter((a) => (type === "all" || a.type === type) && matches(q, [job(a.jobId)?.ref, a.mawbNo, a.hawbNo, a.shipper, a.consignee, a.portOfDestination, a.legs[0]?.flightNo]))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reset = () => {
    setQ("");
    setType("all");
    setKpi(null);
  };
  // Jobs still waiting for their AWB
  const waiting = state.jobs.filter((j) => j.status === "AWB In Progress" && !state.awbs.some((a) => a.jobId === j.id && a.status !== "Cancelled"));

  return (
    <>
      <PageHeader title="Airway Bills" subtitle="Master and House AWBs. Save keeps a draft; send it to the customer, then use Execute Final AWB once confirmed." />

      <KpiFilters cols={5} rows={state.awbs} kpis={KPIS} active={kpi} onChange={setKpi} />

      {waiting.length > 0 && (
        <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
          <b>{waiting.length} job{waiting.length > 1 && "s"} waiting for the AWB:</b>{" "}
          {waiting.map((j, i) => (
            <span key={j.id}>
              {i > 0 && ", "}
              <Link href={`/shipments/${j.id}?open=awb`} className={linkCls}>
                {j.ref}
              </Link>
            </span>
          ))}
        </div>
      )}

      <FilterBar>
        <SearchField label="Search airway bills" value={q} onChange={setQ} placeholder="Search job, AWB no, shipper, consignee…" />
        <FilterSelect label="AWB type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="all">Master & House</option>
          <option value="Master">Master AWB</option>
          <option value="House">House AWB</option>
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Job Number</th>
                <th>AWB Number</th>
                <th>Shipper</th>
                <th>Consignee</th>
                <th>POD</th>
                <th>Flight Number</th>
                <th>Flight Date</th>
                <th>Status</th>
                <th className="w-px whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const j = job(a.jobId);
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap">
                      {j ? (
                        <Link href={`/shipments/${j.id}`} className={`${linkCls} font-mono text-xs`}>
                          {j.ref}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap">
                      <button className={linkCls} onClick={() => setView(a)}>
                        {awbLabel(a)}
                      </button>
                      {a.type === "House" && <div className="text-slate-500">MAWB {a.mawbNo || "—"}</div>}
                    </td>
                    <td className="max-w-44 truncate" title={a.shipper}>
                      {a.shipper.split("\n")[0]}
                    </td>
                    <td className="max-w-44 truncate" title={a.consignee}>
                      {a.consignee.split("\n")[0]}
                    </td>
                    <td>{a.portOfDestination}</td>
                    <td className="whitespace-nowrap">{a.legs[0]?.flightNo}</td>
                    <td className="whitespace-nowrap">{fmtDate(a.legs[0]?.flightDate)}</td>
                    <td className="whitespace-nowrap">
                      <ToneBadge status={a.status} tones={AWB_TONE} />
                    </td>
                    <td className="whitespace-nowrap">
                      <RowActions
                        label={`Actions for ${awbLabel(a)}`}
                        items={[
                          { label: "View", onSelect: () => setView(a) },
                          ...(j ? [{ label: "Edit", onSelect: () => setEditing(a) }] : []),
                          // Sent to the customer for confirmation: finalise it in one click
                          ...(a.status === "Draft AWB Send" ? [{ label: "Execute Final AWB", onSelect: () => actions.setAwbStatus(a.id, "AWB Executed") }] : []),
                          { label: "Status Change", onSelect: () => setStatusFor(a) },
                          // An executed AWB is kept; it can only be cancelled
                          ...(a.status === "AWB Executed" ? [] : [{ label: "Delete", onSelect: () => window.confirm(`Delete ${awbLabel(a)}? Cancel keeps the record instead.`) && actions.deleteAwb(a.id) }]),
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
            No airway bills yet. Use Execute AWB on a job.
          </NoResults>
        )}
      </Card>

      {view && <AwbPreviewModal awb={view} siblings={awbsOf(view.jobId)} onClose={() => setView(null)} onEdit={job(view.jobId) ? () => (setEditing(view), setView(null)) : undefined} />}
      {editing && job(editing.jobId) && <AwbFormModal job={job(editing.jobId)!} existing={editing} onClose={() => setEditing(null)} />}
      {statusFor && <AwbStatusModal awb={statusFor} onClose={() => setStatusFor(null)} />}
    </>
  );
}
