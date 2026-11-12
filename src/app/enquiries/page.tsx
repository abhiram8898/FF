"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, CircleCheck, CircleX, ClipboardList, Clock, FilePlus2, FileText, Filter, Plus, X } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import { ENQUIRY_STATUSES, type Enquiry, type EnquiryStatus } from "@/lib/types";
import {
  CONVERTED_STATUSES,
  DATE_RANGES,
  type DateRange,
  STAGES,
  type StageKey,
  cn,
  fmtDate,
  followUps,
  inRange,
  isDue,
  isEnquiryLocked,
  laps,
  matches,
} from "@/lib/utils";
import {
  Button,
  Card,
  FilterBar,
  FilterSelect,
  type KpiDef,
  KpiFilters,
  kpiTest,
  LinkButton,
  NoResults,
  PageHeader,
  ResetFilters,
  RowActions,
  SearchField,
  StatusBadge,
  Table,
  linkCls,
} from "@/components/ui";
import { ChangeStatusModal } from "@/components/workflow";
import { JobsTabs } from "@/components/JobsTabs";

function Enquiries() {
  const { state } = useStore();
  const { customer, portLabel } = useLookups();
  const params = useSearchParams();
  const initialStage = params.get("stage") as StageKey | null;
  const [stage, setStage] = useState<StageKey | "all">(initialStage && STAGES.some((s) => s.key === initialStage) ? initialStage : "all");
  const [showStages, setShowStages] = useState(stage !== "all");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<EnquiryStatus | "all">("all");
  const [mode, setMode] = useState<"all" | "Air" | "Sea">("all");
  const [range, setRange] = useState<DateRange>("all");
  const [newestFirst, setNewestFirst] = useState(true);
  const [statusFor, setStatusFor] = useState<Enquiry | null>(null);

  const [kpi, setKpi] = useState<string | null>(null);
  const count = (statuses: readonly string[]) => state.enquiries.filter((e) => statuses.includes(e.status)).length;
  // Enquiries with a rate request or quotation whose reminder is due
  const dueIds = new Set(followUps(state.enquiries, state.quotations, state.settings.alerts).filter(isDue).map((f) => f.enquiry.id));
  const is = (...statuses: EnquiryStatus[]) => (e: Enquiry) => statuses.includes(e.status);
  const KPIS: KpiDef<Enquiry>[] = [
    { id: "new", icon: FilePlus2, label: "New Enquiries", test: is("New Enquiry") },
    { id: "rates", icon: ClipboardList, tone: "indigo", label: "Rate Requested", test: is("Rate Requested") },
    { id: "quoted", icon: FileText, tone: "sky", label: "Quotation Sent", test: is("Quote Confirmation Pending") },
    { id: "due", icon: Clock, tone: "amber", label: "Follow-up Due", test: (e) => dueIds.has(e.id) },
    { id: "converted", icon: CircleCheck, tone: "green", label: "Converted", test: is(...CONVERTED_STATUSES) },
    { id: "lost", icon: CircleX, tone: "red", label: "Lost / Cancelled", test: is("Lost", "Cancelled") },
  ];
  const kpiOk = kpiTest(KPIS, kpi);

  const stageDef = STAGES.find((s) => s.key === stage);
  const filtered = !!q.trim() || status !== "all" || mode !== "all" || range !== "all" || stage !== "all" || kpi !== null;
  const rows = state.enquiries
    .filter(
      (e) =>
        kpiOk(e) &&
        (!stageDef || (stageDef.statuses as readonly string[]).includes(e.status)) &&
        (status === "all" || e.status === status) &&
        (mode === "all" || e.cargoMode === mode) &&
        inRange(e.enquiryDate, range) &&
        matches(q, [e.ref, customer(e.customerId)?.name, customer(e.customerId)?.type, e.pol, e.pod, e.commodity, e.status, e.salesPerson]),
    )
    .sort((a, b) => (newestFirst ? b.no - a.no : a.no - b.no));

  const reset = () => {
    setQ("");
    setStatus("all");
    setMode("all");
    setRange("all");
    setStage("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="From enquiry to job in one place: enquiries, quotations and bookings"
        actions={
          <>
            <LinkButton href="/enquiries/new">
              <Plus size={16} aria-hidden /> Add Enquiry
            </LinkButton>
            <Button variant="secondary" onClick={() => setShowStages((s) => !s)} aria-pressed={showStages} aria-label="Filter by stage" title="Filter by stage">
              <Filter size={16} aria-hidden />
            </Button>
          </>
        }
      />

      <JobsTabs />

      <KpiFilters cols={6} rows={state.enquiries} kpis={KPIS} active={kpi} onChange={setKpi} />

      {showStages && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by stage">
          {[{ key: "all", label: "All stages", n: state.enquiries.length } as const, ...STAGES.map((s) => ({ ...s, n: count(s.statuses) }))].map((s) => (
            <button
              key={s.key}
              onClick={() => setStage(s.key)}
              aria-pressed={stage === s.key}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500",
                stage === s.key ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {s.label} <span className={stage === s.key ? "text-brand-100" : "text-slate-400"}>{s.n}</span>
            </button>
          ))}
        </div>
      )}

      <FilterBar>
        <SearchField label="Search enquiries" value={q} onChange={setQ} />
        <FilterSelect label="Status" value={status} onChange={(e) => setStatus(e.target.value as EnquiryStatus | "all")} className="flex-[1_1_10rem]">
          <option value="all">All Status</option>
          {ENQUIRY_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
          <option value="all">All Mode</option>
          <option value="Air">Air</option>
          <option value="Sea">Sea</option>
        </FilterSelect>
        <FilterSelect label="Enquiry date" value={range} onChange={(e) => setRange(e.target.value as DateRange)}>
          {DATE_RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      {stageDef && !showStages && (
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-600">
          Stage:
          <button onClick={() => setStage("all")} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100">
            {stageDef.label} <X size={12} aria-label="Clear stage" />
          </button>
        </div>
      )}

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th className="w-px whitespace-nowrap">Actions</th>
                <th aria-sort={newestFirst ? "descending" : "ascending"}>
                  <button onClick={() => setNewestFirst((n) => !n)} className="inline-flex items-center gap-1 rounded-sm hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-500">
                    Enquiry ID {newestFirst ? <ArrowDown size={12} aria-hidden /> : <ArrowUp size={12} aria-hidden />}
                  </button>
                </th>
                <th>EQ Date</th>
                <th>Type</th>
                <th>Mode</th>
                <th>Customer Name</th>
                <th>POL</th>
                <th>Route</th>
                <th>POD</th>
                <th>Status</th>
                <th>Status Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap">
                    <RowActions
                      label={`Actions for ${e.ref}`}
                      items={[
                        { label: "View", href: `/enquiries/${e.id}` },
                        ...(isEnquiryLocked(e) ? [] : [{ label: "Edit", href: `/enquiries/${e.id}/edit` }]),
                        { label: "Change Status", onSelect: () => setStatusFor(e) },
                      ]}
                    />
                  </td>
                  <td className="whitespace-nowrap">
                    <Link href={`/enquiries/${e.id}`} className={linkCls}>
                      {e.ref}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-slate-600">{fmtDate(e.enquiryDate)}</td>
                  <td className="whitespace-nowrap">{e.shipmentMode}</td>
                  <td className="whitespace-nowrap">{e.cargoMode}</td>
                  <td className="max-w-40 truncate" title={customer(e.customerId)?.name}>
                    {customer(e.customerId)?.name}
                  </td>
                  <td className="whitespace-nowrap">
                    <abbr title={portLabel(e.pol)} className="no-underline">
                      {e.pol}
                    </abbr>
                  </td>
                  <td className="whitespace-nowrap text-slate-600" title={e.connections.map((c) => c.transit).join(" → ")}>
                    {e.route}
                    {e.route === "Connection" && e.connections.length > 0 && <span className="text-xs text-slate-400"> via {e.connections.map((c) => c.transit).join(", ")}</span>}
                  </td>
                  <td className="whitespace-nowrap">
                    <abbr title={portLabel(e.pod)} className="no-underline">
                      {e.pod}
                    </abbr>
                  </td>
                  <td className="whitespace-nowrap">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="whitespace-nowrap text-slate-600">
                    {fmtDate(e.statusAt)}
                    <div className="text-xs text-slate-400">{laps(e.statusAt)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No enquiries yet. Add one from the Mail Box or with Add Enquiry.
          </NoResults>
        )}
      </Card>
      {statusFor && <ChangeStatusModal enq={statusFor} onClose={() => setStatusFor(null)} />}
    </>
  );
}

export default function EnquiriesPage() {
  return (
    <Suspense>
      <Enquiries />
    </Suspense>
  );
}
