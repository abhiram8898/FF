"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleCheck, FileMinus, FilePen, Plus } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Bill } from "@/lib/types";
import { BILL_TONE, billTotals, f2, fmtDate, matches } from "@/lib/utils";
import { Badge, Button, Card, Field, FilterBar, type KpiDef, KpiFilters, kpiTest, Modal, NoResults, PageHeader, ResetFilters, RowActions, SearchField, Select, Table, linkCls } from "@/components/ui";
import { BillPreviewModal } from "@/components/billing";

export default function CreditNotesPage() {
  const { state } = useStore();
  const { customer, job } = useLookups();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [view, setView] = useState<Bill | null>(null);
  const [kpi, setKpi] = useState<string | null>(null);
  const all = state.bills.filter((b) => b.kind === "Credit Note");
  const KPIS: KpiDef<Bill>[] = [
    { id: "all", icon: FileMinus, label: "Credit Notes" },
    { id: "draft", icon: FilePen, tone: "slate", label: "Draft", test: (b) => b.status === "Draft" },
    { id: "issued", icon: CircleCheck, tone: "green", label: "Issued", test: (b) => b.status === "Issued" },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || kpi !== null;
  const rows = all.filter(kpiOk).filter((b) => matches(q, [b.no, b.jobNo, b.mawbNo, customer(b.customerId)?.name, b.branch]));
  const reset = () => {
    setQ("");
    setKpi(null);
  };

  return (
    <>
      <PageHeader
        title="Credit Note"
        subtitle="Created automatically when an invoice is cancelled, or by hand for any job. Same details with negative amounts; edit if needed, then Issue."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden /> New Credit Note
          </Button>
        }
      />
      <KpiFilters cols={3} rows={all} kpis={KPIS} active={kpi} onChange={setKpi} />
      <FilterBar>
        <SearchField label="Search credit notes" value={q} onChange={setQ} />
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>
      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Job Number</th>
                <th>AWB Number</th>
                <th>CN - Inv. Number</th>
                <th>Date</th>
                <th>Customer Name</th>
                <th>Branch Name</th>
                <th className="text-right">Inv. Amount</th>
                <th className="text-right">Received</th>
                <th>Status</th>
                <th className="w-px whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const j = job(b.jobId);
                const source = state.bills.find((x) => x.id === b.sourceId);
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap">
                      {j ? (
                        <Link href={`/shipments/${j.id}`} className={`${linkCls} font-mono text-xs`}>
                          {b.jobNo}
                        </Link>
                      ) : (
                        b.jobNo
                      )}
                    </td>
                    <td className="font-mono text-xs">{b.mawbNo || "—"}</td>
                    <td className="whitespace-nowrap">
                      <Link href={`/billing/${b.id}`} className={`${linkCls} font-mono text-xs`}>
                        {b.no}
                      </Link>
                      {source && <div className="text-xs text-slate-500">for {source.no}</div>}
                    </td>
                    <td className="whitespace-nowrap text-slate-600">{fmtDate(b.date)}</td>
                    <td className="max-w-44 truncate">{customer(b.customerId)?.name}</td>
                    <td>{b.branch}</td>
                    <td className="text-right tabular-nums">{f2(billTotals(b).total)}</td>
                    <td className="text-right tabular-nums">{source ? f2(billTotals(source).received) : "0.00"}</td>
                    <td>
                      <Badge className={BILL_TONE[b.status]}>{b.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap">
                      <RowActions
                        label={`Actions for ${b.no}`}
                        items={[
                          { label: "View", onSelect: () => setView(b) },
                          { label: "Edit", href: `/billing/${b.id}` },
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
            No credit notes. Cancelling an invoice creates one, or use New Credit Note for any job.
          </NoResults>
        )}
      </Card>
      {view && <BillPreviewModal bill={view} onClose={() => setView(null)} />}
      {adding && <NewCreditNoteModal onClose={() => setAdding(false)} />}
    </>
  );
}

/** Credit note by hand: pick the job; it opens as a draft filled from the job with the amounts reversed */
function NewCreditNoteModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { state, actions } = useStore();
  const { customer } = useLookups();
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const jobs = [...state.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Modal
      open
      onClose={onClose}
      title="New Credit Note"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!jobId || busy}
            onClick={() => {
              // A double click would otherwise raise two credit notes
              if (busy) return;
              setBusy(true);
              const cn = actions.createCreditNote(jobId);
              if (cn) router.push(`/billing/${cn.id}`);
              else setBusy(false);
            }}
          >
            Create Credit Note
          </Button>
        </>
      }
    >
      <Field label="Job Number *" hint="The credit note takes the job's customer, AWB and charges (as negative amounts). Adjust the lines before issuing.">
        <Select value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="">Select a job</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.ref} · {customer(j.customerId)?.name ?? j.shipperName} · {j.status}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}
