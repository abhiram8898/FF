"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileCheck2, FileStack, Merge, Send, Upload } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Job } from "@/lib/types";
import { fmtDateTime, matches } from "@/lib/utils";
import { Badge, Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, NoResults, PageHeader, ResetFilters, RowActions, SearchField, StatusBadge, Table, linkCls } from "@/components/ui";
import { DispatchChaFlow, DocsUploadModal, MergeModal, docsLineStatus } from "@/components/jobflow";
import { awbLabel } from "@/components/awb";

const LINE_TONE: Record<ReturnType<typeof docsLineStatus>, string> = {
  "Pending Documents": "bg-amber-50 text-amber-800 ring-amber-200",
  "Uploading Completed": "bg-violet-50 text-violet-800 ring-violet-200",
  "CHA Dispatch Pending": "bg-sky-50 text-sky-800 ring-sky-200",
  "Booking Completed": "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

type Dialog = { kind: "upload" | "merge" | "dispatch"; jobId: string } | null;

function Documents() {
  const { state } = useStore();
  const { customer, job, awbOf } = useLookups();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [line, setLine] = useState<"all" | ReturnType<typeof docsLineStatus>>("all");
  // "Manage Documents" from a job opens its upload pop-up straight away
  const [dialog, setDialog] = useState<Dialog>(params.get("job") ? { kind: "upload", jobId: params.get("job")! } : null);
  const open = job(dialog?.jobId);

  // Every job whose AWB has been executed
  const all = state.jobs.filter((j) => state.awbs.some((a) => a.jobId === j.id && a.status === "AWB Executed") || j.merged || j.dispatchedAt);
  const [kpi, setKpi] = useState<string | null>(null);
  const isLine = (s: ReturnType<typeof docsLineStatus>) => (j: Job) => docsLineStatus(j) === s;
  const KPIS: KpiDef<Job>[] = [
    { id: "all", icon: FileStack, label: "Executed AWBs" },
    { id: "pending", icon: Upload, tone: "amber", label: "Pending Documents", test: isLine("Pending Documents") },
    { id: "merge", icon: Merge, tone: "violet", label: "Merge Pending", test: isLine("Uploading Completed") },
    { id: "cha", icon: Send, tone: "sky", label: "CHA Dispatch Pending", test: isLine("CHA Dispatch Pending") },
    { id: "done", icon: FileCheck2, tone: "green", label: "Booking Completed", test: isLine("Booking Completed") },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || line !== "all" || kpi !== null;
  const rows = all
    .filter(kpiOk)
    .filter((j) => (line === "all" || docsLineStatus(j) === line) && matches(q, [j.ref, customer(j.customerId)?.name, j.awbNo, j.chaName, ...j.documents.map((d) => d.title)]))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reset = () => {
    setQ("");
    setLine("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader title="Documents" subtitle="Upload the shipment documents for each executed AWB, merge them into one PDF and dispatch to the CHA." />

      <KpiFilters cols={5} rows={all} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search documents" value={q} onChange={setQ} placeholder="Search job, AWB, customer, CHA, document…" />
        <FilterSelect label="Line status" value={line} onChange={(e) => setLine(e.target.value as typeof line)}>
          <option value="all">All Status</option>
          {Object.keys(LINE_TONE).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Job No</th>
                <th>AWB</th>
                <th>Customer</th>
                <th>CHA</th>
                <th className="text-right">Documents</th>
                <th>Merged</th>
                <th>Line Status</th>
                <th>Job Status</th>
                <th className="w-px whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => {
                const awb = awbOf(j.id);
                const status = docsLineStatus(j);
                return (
                  <tr key={j.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap">
                      <Link href={`/shipments/${j.id}`} className={`${linkCls} font-mono text-xs`}>
                        {j.ref}
                      </Link>
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap">{awb ? awbLabel(awb) : j.awbNo || "—"}</td>
                    <td className="max-w-44 truncate">{customer(j.customerId)?.name}</td>
                    <td className="max-w-40 truncate">{j.chaName || <span className="text-amber-700">Not chosen</span>}</td>
                    <td className="text-right tabular-nums">{j.documents.length}</td>
                    <td className="text-xs whitespace-nowrap text-slate-600">
                      {j.merged ? (
                        j.merged.dataUrl ? (
                          <a href={j.merged.dataUrl} download={j.merged.fileName} className={linkCls}>
                            {fmtDateTime(j.merged.at)}
                          </a>
                        ) : (
                          fmtDateTime(j.merged.at)
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <Badge className={LINE_TONE[status]}>{status}</Badge>
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusBadge status={j.status} />
                    </td>
                    <td className="whitespace-nowrap">
                      <RowActions
                        label={`Actions for ${j.ref}`}
                        items={[
                          { label: "Upload Documents", onSelect: () => setDialog({ kind: "upload", jobId: j.id }) },
                          ...(j.uploadCompletedAt ? [{ label: "Merge Documents", onSelect: () => setDialog({ kind: "merge", jobId: j.id }) }] : []),
                          ...(j.merged ? [{ label: "Dispatch To CHA", onSelect: () => setDialog({ kind: "dispatch", jobId: j.id }) }] : []),
                          { label: "Open job", href: `/shipments/${j.id}` },
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
            No executed AWBs yet. Documents are handled once a job&apos;s AWB is executed.
          </NoResults>
        )}
      </Card>

      {open && dialog?.kind === "upload" && <DocsUploadModal job={open} onClose={() => setDialog(null)} onMerge={() => setDialog({ kind: "merge", jobId: open.id })} />}
      {open && dialog?.kind === "merge" && <MergeModal job={open} onClose={() => setDialog(null)} onDispatch={() => setDialog({ kind: "dispatch", jobId: open.id })} />}
      {open && dialog?.kind === "dispatch" && <DispatchChaFlow job={open} onClose={() => setDialog(null)} />}
    </>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense>
      <Documents />
    </Suspense>
  );
}
