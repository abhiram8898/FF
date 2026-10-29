"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CircleCheck,
  FilePen,
  FileText,
  Package,
  Plus,
  Send,
} from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import {
  QUOTATION_STATUSES,
  type Quotation,
  type QuotationStatus,
} from "@/lib/types";
import {
  DATE_RANGES,
  type DateRange,
  cn,
  fmtDate,
  inRange,
  laps,
  matches,
  money,
  quoteTotals,
} from "@/lib/utils";
import {
  Button,
  Card,
  Empty,
  Field,
  FilterBar,
  FilterSelect,
  type KpiDef,
  KpiFilters,
  kpiTest,
  Modal,
  NoResults,
  PageHeader,
  ResetFilters,
  RowMenu,
  SearchField,
  Select,
  StatusBadge,
  Table,
  linkCls,
} from "@/components/ui";
import {
  PreviewModal,
  QuotationActionsModal,
  takeActionHref,
} from "@/components/quotation";
import { RouteCell } from "@/components/workflow";

export default function QuotationsPage() {
  const router = useRouter();
  const { state } = useStore();
  const { enquiry, customer } = useLookups();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<QuotationStatus | "all">("all");
  const [mode, setMode] = useState<"all" | "Air" | "Sea">("all");
  const [range, setRange] = useState<DateRange>("all");
  const [view, setView] = useState<Quotation | null>(null);
  const [actionsFor, setActionsFor] = useState<Quotation | null>(null);
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState("");

  const [kpi, setKpi] = useState<string | null>(null);
  const is = (s: QuotationStatus) => (x: Quotation) => x.status === s;
  const KPIS: KpiDef<Quotation>[] = [
    { id: "all", icon: FileText, label: "Total Quotations" },
    { id: "draft", icon: FilePen, tone: "slate", label: "Drafts", test: is("Draft") },
    { id: "pending", icon: Send, tone: "sky", label: "Confirmation Pending", test: is("Quote Confirmation Pending") },
    { id: "booking", icon: Package, tone: "violet", label: "Booking in Progress", test: is("Booking in Progress") },
    { id: "booked", icon: CircleCheck, tone: "green", label: "Booking Confirmed", test: is("Booking Confirmed") },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered =
    !!q.trim() || status !== "all" || mode !== "all" || range !== "all" || kpi !== null;
  const rows = state.quotations.filter((x) => {
    const e = enquiry(x.enquiryId);
    return (
      kpiOk(x) &&
      (status === "all" || x.status === status) &&
      (mode === "all" || e?.cargoMode === mode) &&
      inRange(x.createdAt, range) &&
      matches(q, [
        x.ref,
        customer(e?.customerId)?.name,
        e?.pol,
        e?.pod,
        x.status,
      ])
    );
  });
  const reset = () => {
    setQ("");
    setStatus("all");
    setMode("all");
    setRange("all");
    setKpi(null);
  };
  const withoutQuote = state.enquiries.filter(
    (e) => !e.quotationId && !["Cancelled", "Lost"].includes(e.status),
  );

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

      <KpiFilters cols={5} rows={state.quotations} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search quotations" value={q} onChange={setQ} />
        <FilterSelect
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as QuotationStatus | "all")}
          className="flex-[1_1_10rem]"
        >
          <option value="all">All Status</option>
          {QUOTATION_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="all">All Mode</option>
          <option value="Air">Air</option>
          <option value="Sea">Sea</option>
        </FilterSelect>
        <FilterSelect
          label="Quotation date"
          value={range}
          onChange={(e) => setRange(e.target.value as DateRange)}
        >
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
                <th>Quotation ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Mode</th>
                <th className="text-right">Grand Total</th>
                <th>Status</th>
                <th className="w-14 text-center">Actions</th>
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
                    </td>
                    <td className="whitespace-nowrap text-slate-600">
                      {fmtDate(x.createdAt)}
                    </td>
                    <td
                      className="max-w-44 truncate"
                      title={customer(e?.customerId)?.name}
                    >
                      {customer(e?.customerId)?.name}
                    </td>
                    <td>
                      <RouteCell pol={e?.pol} pod={e?.pod} />
                    </td>
                    <td className="whitespace-nowrap">
                      {e?.cargoMode}{" "}
                      <span className="text-xs text-slate-400">
                        {e?.shipmentMode}
                      </span>
                    </td>
                    <td className="text-right whitespace-nowrap tabular-nums">
                      {money(quoteTotals(x).grand)}
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusBadge status={x.status} />
                      {x.status !== "Draft" && (
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {laps(x.statusAt)}
                        </div>
                      )}
                    </td>
                    <td className="text-center">
                      <RowMenu
                        label={`Actions for ${x.ref}`}
                        items={[
                          { label: "View", onSelect: () => setView(x) },
                          { label: "Edit", href: `/quotations/${x.id}` },
                          {
                            label: "Take Action",
                            ...(takeActionHref(x)
                              ? { href: takeActionHref(x)! }
                              : { onSelect: () => setActionsFor(x) }),
                          },
                          {
                            label: "Update status / Reminder",
                            onSelect: () => setActionsFor(x),
                          },
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
            No quotations yet. Create one from an enquiry with Compare Available
            Rates.
          </NoResults>
        )}
      </Card>

      {view && <PreviewModal q={view} onClose={() => setView(null)} />}
      {actionsFor && (
        <QuotationActionsModal
          q={actionsFor}
          onClose={() => setActionsFor(null)}
        />
      )}
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
                <Button
                  disabled={!pick}
                  onClick={() => router.push(`/enquiries/${pick}?open=rates`)}
                >
                  Continue to Compare Available Rates
                </Button>
              </>
            )
          }
        >
          <p className="mb-3 text-sm text-slate-600">
            Quotations are created from an enquiry, and the Enquiry ID becomes
            the Quotation ID.
          </p>
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
