"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CirclePause,
  CircleX,
  Package,
  PlaneTakeoff,
  Plus,
} from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import { JOB_STATUSES, type Job, type JobStatus } from "@/lib/types";
import {
  DATE_RANGES,
  type DateRange,
  cn,
  fmtDate,
  inRange,
  matches,
} from "@/lib/utils";
import {
  Badge,
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
  linkCls,
} from "@/components/ui";
import { JOB_STATUS_TONE } from "@/components/BookingJobForm";

/** "2026-04" → "Apr 2026" */
const fmtMonth = (v: string) =>
  v
    ? new Date(`${v.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      })
    : "";

// Quotations the client has confirmed; they can become a booking
const CONFIRMED = [
  "Waiting for Shipment Date",
  "Booking in Progress",
  "Booking Confirmed",
];

export default function BookingJobPage() {
  const router = useRouter();
  const { state } = useStore();
  const { customer, airline, quotation, enquiry } = useLookups();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | JobStatus>("all");
  const [carrier, setCarrier] = useState("all");
  const [range, setRange] = useState<DateRange>("all");
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState("");

  const [kpi, setKpi] = useState<string | null>(null);
  const is = (s: JobStatus) => (j: Job) => j.status === s;
  const KPIS: KpiDef<Job>[] = [
    { id: "all", icon: Package, label: "Bookings / Jobs" },
    {
      id: "departed",
      icon: PlaneTakeoff,
      tone: "green",
      label: "Departed",
      test: is("DEPARTED"),
    },
    {
      id: "hold",
      icon: CirclePause,
      tone: "amber",
      label: "On Hold",
      test: is("ON HOLD"),
    },
    {
      id: "cancelled",
      icon: CircleX,
      tone: "red",
      label: "Cancelled",
      test: is("CANCELLED"),
    },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const bookable = state.quotations.filter(
    (x) => CONFIRMED.includes(x.status) && !enquiry(x.enquiryId)?.jobId,
  );
  const filtered =
    !!q.trim() ||
    status !== "all" ||
    carrier !== "all" ||
    range !== "all" ||
    kpi !== null;
  const rows = state.jobs
    .filter(
      (j) =>
        kpiOk(j) &&
        (status === "all" || j.status === status) &&
        (carrier === "all" || j.airlineId === carrier) &&
        inRange(j.date, range) &&
        matches(q, [
          j.ref,
          customer(j.customerId)?.name,
          j.shipperName,
          j.awbNo,
          j.flightNo,
          j.pol,
          j.pod,
          j.commodity,
          j.invoiceNo,
          j.chaName,
          quotation(j.quotationId)?.ref,
        ]),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.ref.localeCompare(a.ref));
  const reset = () => {
    setQ("");
    setStatus("all");
    setCarrier("all");
    setRange("all");
    setKpi(null);
  };

  // Every column of the booking sheet, in its order
  const columns: {
    head: string;
    cell: (j: Job) => React.ReactNode;
    className?: string;
  }[] = [
    { head: "Customer", cell: (j) => customer(j.customerId)?.name },
    { head: "Shipper", cell: (j) => j.shipperName },
    { head: "AWB No", cell: (j) => j.awbNo, className: "font-mono text-xs" },
    { head: "Flight No", cell: (j) => j.flightNo },
    { head: "POL", cell: (j) => j.pol },
    { head: "POD", cell: (j) => j.pod },
    { head: "Stock", cell: (j) => j.stock },
    {
      head: "Status",
      cell: (j) => (
        <Badge className={JOB_STATUS_TONE[j.status]}>{j.status}</Badge>
      ),
    },
    {
      head: "Weight",
      cell: (j) => j.weight || "",
      className: "text-right tabular-nums",
    },
    {
      head: "F.Date",
      cell: (j) => (j.flightDate ? fmtDate(j.flightDate) : ""),
    },
    {
      head: "Box",
      cell: (j) => j.boxes || "",
      className: "text-right tabular-nums",
    },
    { head: "Commodity", cell: (j) => j.commodity },
    { head: "Offload", cell: (j) => j.offload },
    { head: "CHA", cell: (j) => j.chaName },
    { head: "Rate", cell: (j) => j.rate, className: "text-right tabular-nums" },
    {
      head: "INV No",
      cell: (j) => j.invoiceNo,
      className: "font-mono text-xs",
    },
    { head: "TSP", cell: (j) => j.tsp, className: "text-right tabular-nums" },
    { head: "Loading", cell: (j) => j.loading },
    { head: "Months", cell: (j) => fmtMonth(j.month) },
    { head: "IATA Code", cell: (j) => j.iataCode },
    { head: "Airline", cell: (j) => airline(j.airlineId)?.name },
    { head: "Years", cell: (j) => j.years },
    { head: "Duty", cell: (j) => j.duty },
    { head: "TSP (Additional)", cell: (j) => j.tspAdditional },
    { head: "Loading (Additional)", cell: (j) => j.loadingAdditional },
    {
      head: "Booking Info",
      cell: (j) => j.bookingInfo,
      className: "max-w-56 truncate",
    },
    { head: "Additional Value 1", cell: (j) => j.additional1 },
    { head: "Additional Value 2", cell: (j) => j.additional2 },
    { head: "Quotation No", cell: (j) => quotation(j.quotationId)?.ref },
    {
      head: "Docs",
      cell: (j) => j.documents.length || "",
      className: "text-right tabular-nums",
    },
  ];

  return (
    <>
      <PageHeader
        title="Booking/Job"
        subtitle="Booking register for confirmed quotations. Scroll sideways to see every column."
        actions={
          <Button onClick={() => setPicking(true)}>
            <Plus size={16} aria-hidden /> Add Booking
          </Button>
        }
      />

      <KpiFilters
        cols={4}
        rows={state.jobs}
        kpis={KPIS}
        active={kpi}
        onChange={setKpi}
      />

      <FilterBar>
        <SearchField
          label="Search bookings"
          value={q}
          onChange={setQ}
          placeholder="Search job no, AWB, customer, shipper…"
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="all">All Status</option>
          {JOB_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Airline"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
        >
          <option value="all">All Airlines</option>
          {state.airlines.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Booking date"
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
          // Wide sheet: scrolls sideways with Date and Job No pinned on the left
          <div
            className="relative overflow-x-auto [scrollbar-color:var(--color-slate-300)_transparent]"
            tabIndex={0}
            aria-label="Booking register, scrolls sideways"
          >
            <table className="w-max min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-navy-700 text-xs text-white [&>th]:px-3 [&>th]:py-3 [&>th]:font-semibold">
                  <th className="sticky left-0 z-10 bg-navy-700">Date</th>
                  <th className="sticky left-[6.5rem] z-10 bg-navy-700 shadow-[2px_0_0_rgb(255_255_255/0.15)]">
                    Job No
                  </th>
                  {columns.map((c) => (
                    <th
                      key={c.head}
                      className={
                        c.className?.includes("text-right")
                          ? "text-right"
                          : undefined
                      }
                    >
                      {c.head}
                    </th>
                  ))}
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((j) => {
                  const rowBg =
                    j.status === "CANCELLED" ? "bg-orange-50" : "bg-white";
                  return (
                    <tr
                      key={j.id}
                      className={cn(
                        "group border-t border-slate-100 [&>td]:px-3 [&>td]:py-2",
                        rowBg,
                      )}
                    >
                      <td
                        className={cn(
                          "sticky left-0 z-[1] w-[6.5rem] text-slate-600",
                          rowBg,
                        )}
                      >
                        {fmtDate(j.date)}
                      </td>
                      <td
                        className={cn(
                          "sticky left-[6.5rem] z-[1] shadow-[2px_0_0_var(--color-slate-100)]",
                          rowBg,
                        )}
                      >
                        <Link
                          href={`/shipments/${j.id}`}
                          className={cn(linkCls, "font-mono text-xs")}
                        >
                          {j.ref}
                        </Link>
                      </td>
                      {columns.map((c) => (
                        <td key={c.head} className={c.className}>
                          {c.cell(j)}
                        </td>
                      ))}
                      <td className="text-center">
                        <RowMenu
                          label={`Actions for ${j.ref}`}
                          items={[
                            {
                              label: "Open / Edit",
                              href: `/shipments/${j.id}`,
                            },
                            {
                              label: "View enquiry",
                              href: `/enquiries/${j.enquiryId}`,
                            },
                            {
                              label: "View quotation",
                              href: `/quotations/${j.quotationId}`,
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No bookings yet. Use Add Booking and select a confirmed quotation.
          </NoResults>
        )}
      </Card>
      {rows.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Scroll the table sideways (or Shift + scroll) for all{" "}
          {columns.length + 2} columns. Cancelled bookings are shaded.
        </p>
      )}

      {picking && (
        <Modal
          open
          onClose={() => setPicking(false)}
          title="Add Booking · Select Quotation"
          footer={
            bookable.length > 0 && (
              <>
                <Button variant="secondary" onClick={() => setPicking(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!pick}
                  onClick={() =>
                    router.push(`/shipments/new?quotation=${pick}`)
                  }
                >
                  Continue
                </Button>
              </>
            )
          }
        >
          {bookable.length ? (
            <Field
              label="Confirmed quotation"
              hint="Quotations confirmed by the client that don't have a booking yet"
            >
              <Select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                autoFocus
              >
                <option value="">Select quotation</option>
                {bookable.map((x) => {
                  const e = enquiry(x.enquiryId);
                  return (
                    <option key={x.id} value={x.id}>
                      {x.ref} · {customer(e?.customerId)?.name} · {e?.pol} →{" "}
                      {e?.pod} · {x.status}
                    </option>
                  );
                })}
              </Select>
            </Field>
          ) : (
            <Empty
              action={
                <Link href="/quotations" className={cn(linkCls, "text-sm")}>
                  Go to Quotations
                </Link>
              }
            >
              No confirmed quotations without a booking. A quotation can be
              booked once the client confirms it (status Waiting for Shipment
              Date or later).
            </Empty>
          )}
        </Modal>
      )}
    </>
  );
}
