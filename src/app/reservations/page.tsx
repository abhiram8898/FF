"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  ExternalLink,
  List,
  Package,
  Plane,
  Plus,
  Repeat,
  Ship,
  X,
} from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import {
  RESERVATION_STATUSES,
  type Reservation,
  type ReservationStatus,
} from "@/lib/types";
import {
  RESERVATION_TONE,
  addDays,
  cn,
  fmtDate,
  matches,
  today,
  isoDay,
  utcDay,
} from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  DateJump,
  FilterBar,
  FilterSelect,
  Kpi,
  KpiGrid,
  LinkButton,
  NoResults,
  PageHeader,
  RowActions,
  SearchField,
  Table,
  buttonCls,
  linkCls,
} from "@/components/ui";
import { CancelModal, RescheduleModal } from "@/components/reservation";
import { DayShipmentsModal } from "@/components/DayShipments";
import { reservationAsPlanned } from "@/lib/planned";

type View = "Month" | "Week" | "List";
const iso = isoDay;
const utc = utcDay;
const PENDING: ReservationStatus[] = [
  "Reserved",
  "Ready for Booking",
  "Booking In Progress",
  "Rescheduled",
];

/** Days shown: the anchor's month, or its Monday–Sunday week */
function daysFor(view: View, anchor: string) {
  const a = utc(anchor);
  if (view === "Week") {
    const monday = new Date(a);
    monday.setUTCDate(a.getUTCDate() - ((a.getUTCDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) =>
      iso(new Date(monday.getTime() + i * 86_400_000)),
    );
  }
  const first = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1));
  const n = new Date(
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return Array.from({ length: n }, (_, i) =>
    iso(new Date(first.getTime() + i * 86_400_000)),
  );
}

export default function PlannerPage() {
  const { state } = useStore();
  const { customer } = useLookups();
  // Phones open on the list: a month grid only fits a day or two across. (The page renders client-side, after sign-in.)
  const [view, setView] = useState<View>(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 639.98px)").matches
      ? "List"
      : "Month",
  );
  const [anchor, setAnchor] = useState(today());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | ReservationStatus>("all");
  const [mode, setMode] = useState<"all" | "Air" | "Sea">("all");
  const [airlineId, setAirlineId] = useState("all");
  const airlineCode = (id: string) => {
    const a = state.airlines.find((x) => x.id === id);
    return a?.code || a?.name || "";
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kpi, setKpi] = useState<string | null>(null);
  // Day whose full list of reservations is open
  const [dayList, setDayList] = useState<string | null>(null);
  const selected = state.reservations.find((r) => r.id === selectedId);

  const days = useMemo(
    () => daysFor(view === "List" ? "Month" : view, anchor),
    [view, anchor],
  );
  const [from, to] = [days[0], days.at(-1)!];
  const inPeriod = state.reservations.filter(
    (r) => r.shipmentDate >= from && r.shipmentDate <= to,
  );
  const t = today();
  const KPIS: {
    id: string;
    icon: typeof Package;
    tone: React.ComponentProps<typeof Kpi>["tone"];
    label: string;
    test: (r: Reservation) => boolean;
    all?: boolean;
  }[] = [
    {
      id: "total",
      icon: CalendarDays,
      tone: "blue",
      label: "Total Reserved",
      test: (r) => r.status !== "Cancelled",
    },
    {
      id: "upcoming",
      icon: Clock,
      tone: "indigo",
      label: "Upcoming (7 Days)",
      test: (r) =>
        r.status !== "Cancelled" &&
        r.shipmentDate >= t &&
        r.shipmentDate <= addDays(7),
      all: true,
    },
    {
      id: "pending",
      icon: Package,
      tone: "amber",
      label: "Booking Pending",
      test: (r) => PENDING.includes(r.status),
    },
    {
      id: "confirmed",
      icon: CircleCheck,
      tone: "green",
      label: "Booking Confirmed",
      test: (r) => r.status === "Booking Confirmed",
    },
    {
      id: "cancelled",
      icon: CircleX,
      tone: "red",
      label: "Cancelled",
      test: (r) => r.status === "Cancelled",
    },
  ];
  const kpiDef = KPIS.find((k) => k.id === kpi);
  // "Upcoming" looks a week ahead regardless of the month shown; the rest count the period on screen
  // Search, status, mode and airline: applied to the calendar and to the KPI counts alike
  const byFilters = (list: Reservation[]) =>
    list.filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (mode === "all" || r.cargoMode === mode) &&
        (airlineId === "all" || r.airlineId === airlineId) &&
        matches(q, [
          customer(r.customerId)?.name,
          r.ref,
          r.pol,
          r.pod,
          r.commodity,
        ]),
    );
  const base = kpiDef?.all ? state.reservations : inPeriod;
  const visible = byFilters(base).filter((r) => !kpiDef || kpiDef.test(r));
  // The picked day (Go to date, Today, the arrows) is scrolled into view: a month is wider than the screen
  useEffect(() => {
    document
      .querySelector(`[data-day="${anchor}"]`)
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [anchor, view]);
  const customerIds = [...new Set(visible.map((r) => r.customerId))].sort(
    (a, b) => (customer(a)?.name ?? "").localeCompare(customer(b)?.name ?? ""),
  );

  const shift = (by: -1 | 1) => {
    const a = utc(anchor);
    if (view === "Week") a.setUTCDate(a.getUTCDate() + 7 * by);
    else a.setUTCMonth(a.getUTCMonth() + by, 1);
    setAnchor(iso(a));
  };
  const periodLabel =
    view === "Week"
      ? `${fmtDate(from)} – ${fmtDate(to)}`
      : utc(anchor).toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });
  const viewBtn = (v: View, Icon: typeof List) => (
    <button
      key={v}
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 px-3 text-sm font-medium sm:h-8 first:rounded-l-lg last:rounded-r-lg",
        view === v
          ? "bg-navy-900 text-white"
          : "bg-white text-slate-700 hover:bg-slate-50",
      )}
    >
      <Icon size={14} aria-hidden /> {v}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Shipment Planner"
        subtitle="Plan, view and manage reserved shipments a month ahead."
        actions={
          <LinkButton href="/reservations/new">
            <Plus size={16} aria-hidden /> New Reservation
          </LinkButton>
        }
      />

      <KpiGrid cols={5}>
        {KPIS.map((k) => (
          <Kpi
            key={k.id}
            icon={k.icon}
            tone={k.tone}
            label={k.label}
            value={
              byFilters(k.all ? state.reservations : inPeriod).filter(k.test)
                .length
            }
            active={kpi === k.id}
            onClick={() => setKpi(kpi === k.id ? null : k.id)}
          />
        ))}
      </KpiGrid>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setAnchor(today())}>
          Today
        </Button>
        <div className="flex">
          <Button
            variant="secondary"
            className="rounded-r-none px-2"
            onClick={() => shift(-1)}
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="secondary"
            className="-ml-px rounded-l-none px-2"
            onClick={() => shift(1)}
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <CalendarRange size={15} aria-hidden /> {periodLabel}
        </span>
        <DateJump value={anchor} onChange={setAnchor} />
        <div className="ml-auto flex overflow-hidden rounded-lg ring-1 ring-slate-300">
          {[
            viewBtn("Month", CalendarDays),
            viewBtn("Week", CalendarRange),
            viewBtn("List", List),
          ]}
        </div>
      </div>

      <FilterBar>
        <SearchField
          label="Search customer"
          value={q}
          onChange={setQ}
          placeholder="Search customer, reservation, route…"
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="all">All Status</option>
          {RESERVATION_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Shipment mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="all">Air & Sea</option>
          <option value="Air">Air Freight</option>
          <option value="Sea">Sea Freight</option>
        </FilterSelect>
        <FilterSelect
          label="Airline"
          value={airlineId}
          onChange={(e) => setAirlineId(e.target.value)}
        >
          <option value="all">All Airlines</option>
          {state.airlines.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          selected && "xl:grid-cols-[minmax(0,1fr)_19rem]",
        )}
      >
        {view === "List" ? (
          <Card bodyClassName="p-0">
            {visible.length ? (
              <Table>
                <thead>
                  <tr>
                    <th>Reservation</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Route</th>
                    <th>Airline</th>
                    <th>Cargo</th>
                    <th>Status</th>
                    <th className="w-px whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...visible]
                    .sort((a, b) =>
                      a.shipmentDate.localeCompare(b.shipmentDate),
                    )
                    .map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap">
                          <Link
                            href={`/reservations/${r.id}`}
                            className={`${linkCls} font-mono text-xs`}
                          >
                            {r.ref}
                          </Link>
                          {r.seriesId && (
                            <Repeat
                              size={12}
                              className="ml-1 inline text-slate-400"
                              aria-label="Recurring"
                            />
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          {fmtDate(r.shipmentDate)}
                        </td>
                        <td className="max-w-44 truncate">
                          {customer(r.customerId)?.name}
                        </td>
                        <td className="whitespace-nowrap">
                          {r.pol} → {r.pod}
                        </td>
                        <td>
                          {
                            state.airlines.find((a) => a.id === r.airlineId)
                              ?.name
                          }
                        </td>
                        <td className="text-xs whitespace-nowrap text-slate-600">
                          {r.packages} pkgs / {r.grossWeight} kg
                        </td>
                        <td>
                          <Badge className={RESERVATION_TONE[r.status]}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap">
                          <RowActions
                            label={`Actions for ${r.ref}`}
                            items={[
                              {
                                label: "View details",
                                href: `/reservations/${r.id}`,
                              },
                              {
                                label: "Edit",
                                href: `/reservations/${r.id}/edit`,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            ) : (
              <NoResults
                filtered
                onClear={() => (
                  setQ(""),
                  setStatus("all"),
                  setMode("all"),
                  setAirlineId("all"),
                  setKpi(null)
                )}
              >
                No reservations.
              </NoResults>
            )}
          </Card>
        ) : (
          <Card bodyClassName="p-0">
            <div
              className="relative overflow-x-auto"
              tabIndex={0}
              aria-label="Shipment planner calendar, scrolls sideways"
            >
              <div
                className="grid w-max min-w-full"
                style={{
                  gridTemplateColumns: `min(13rem, 34vw) repeat(${days.length}, minmax(${view === "Week" ? "8.5rem" : "5.5rem"}, 1fr))`,
                }}
              >
                <div className="sticky left-0 z-10 border-r border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                  Customers ({customerIds.length})
                </div>
                {days.map((d) => {
                  const dt = utc(d);
                  const isToday = d === t;
                  // The day picked in Go to date, when it isn't today
                  const picked = d === anchor && !isToday;
                  const onDay = visible.filter((r) => r.shipmentDate === d).length;
                  return (
                    // The date opens every reservation of the day (all customers) in one list
                    <button
                      type="button"
                      key={d}
                      data-day={d}
                      onClick={() => setDayList(d)}
                      aria-current={picked ? "date" : undefined}
                      aria-label={`${onDay} reservation${onDay === 1 ? "" : "s"} on ${fmtDate(d)}: show all`}
                      className={cn(
                        "border-b border-l border-slate-100 px-1.5 py-1.5 text-center text-xs hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500",
                        isToday
                          ? "bg-brand-50 font-semibold text-brand-700"
                          : picked
                            ? "bg-amber-50 font-semibold text-amber-800 ring-2 ring-amber-400 ring-inset"
                            : "text-slate-500",
                        [0, 6].includes(dt.getUTCDay()) &&
                          !isToday &&
                          !picked &&
                          "bg-slate-50/70",
                      )}
                    >
                      {isToday && (
                        <div className="mx-auto mb-0.5 w-fit rounded bg-navy-900 px-1.5 text-[0.6875rem] text-white dark:bg-[#2a62e6]">
                          Today
                        </div>
                      )}
                      {picked && (
                        <div className="mx-auto mb-0.5 w-fit rounded bg-amber-500 px-1.5 text-[0.6875rem] font-semibold text-navy-900">
                          Selected
                        </div>
                      )}
                      <div>
                        {dt.toLocaleDateString("en-GB", {
                          weekday: "short",
                          timeZone: "UTC",
                        })}
                      </div>
                      <div className="text-sm text-slate-800">
                        {String(dt.getUTCDate()).padStart(2, "0")}
                      </div>
                      {onDay > 0 && (
                        <div className="mx-auto mt-0.5 w-fit rounded-full bg-slate-100 px-1.5 text-[0.6875rem] font-semibold text-slate-600">
                          {onDay} shipment{onDay === 1 ? "" : "s"}
                        </div>
                      )}
                    </button>
                  );
                })}
                {customerIds.length ? (
                  customerIds.map((cid) => {
                    const mine = visible.filter((r) => r.customerId === cid);
                    return [
                      <div
                        key={`${cid}-name`}
                        className="sticky left-0 z-10 flex items-center justify-between gap-2 border-r border-b border-slate-100 bg-white px-3 py-2 text-sm"
                      >
                        <span
                          className="truncate font-medium text-slate-800"
                          title={customer(cid)?.name}
                        >
                          {customer(cid)?.name}
                        </span>
                        <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">
                          {mine.length}
                        </span>
                      </div>,
                      ...days.map((d) => {
                        const items = mine.filter((r) => r.shipmentDate === d);
                        return (
                          <div
                            key={`${cid}-${d}`}
                            className={cn(
                              "group relative min-h-16 space-y-1 border-b border-l border-slate-100 p-1",
                              d === t && "bg-brand-50/40",
                            )}
                          >
                            {/* Several bookings by this customer on one day (e.g. on different airlines) */}
                            {items.length > 1 && (
                              <div className="px-0.5 text-[0.6875rem] font-semibold text-slate-600">
                                {items.length} bookings
                              </div>
                            )}
                            {items.map((r) => (
                              <button
                                key={r.id}
                                onClick={() => setSelectedId(r.id)}
                                className={cn(
                                  "block w-full rounded-md px-1.5 py-1 text-left text-xs leading-tight ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-brand-500",
                                  RESERVATION_TONE[r.status],
                                  selectedId === r.id &&
                                    "outline-2 outline-brand-600",
                                  r.status === "Cancelled" &&
                                    "line-through opacity-70",
                                )}
                                title={`${r.ref} · ${state.airlines.find((a) => a.id === r.airlineId)?.name ?? "No airline"} · ${r.status}`}
                              >
                                <span className="flex items-center gap-1 font-semibold">
                                  {r.cargoMode === "Air" ? (
                                    <Plane size={11} aria-hidden />
                                  ) : (
                                    <Ship size={11} aria-hidden />
                                  )}
                                  {airlineCode(r.airlineId) && (
                                    <span className="rounded border border-current/40 px-1 font-mono text-[0.6875rem]">
                                      {airlineCode(r.airlineId)}
                                    </span>
                                  )}
                                  {r.pol} → {r.pod}
                                  {r.seriesId && (
                                    <Repeat
                                      size={10}
                                      className="ml-auto shrink-0"
                                      aria-label="Recurring"
                                    />
                                  )}
                                </span>
                                <span className="block truncate font-mono text-[0.6875rem] opacity-90">
                                  {r.ref.split("-").slice(-2).join("-")}
                                </span>
                                <span className="block text-[0.6875rem]">
                                  {r.status}
                                </span>
                              </button>
                            ))}
                            <Link
                              href={`/reservations/new?date=${d}&customer=${cid}`}
                              className="absolute right-1 bottom-1 hidden rounded p-0.5 text-slate-400 group-hover:block hover:bg-white hover:text-brand-700"
                              aria-label={`New reservation for ${customer(cid)?.name} on ${fmtDate(d)}`}
                            >
                              <Plus size={12} />
                            </Link>
                          </div>
                        );
                      }),
                    ];
                  })
                ) : (
                  <div className="col-span-full p-3">
                    {/* Kept on screen while the month is scrolled sideways (e.g. after Go to date) */}
                    <div className="sticky left-3 w-[min(48rem,calc(100vw-3rem))]">
                      <NoResults
                        filtered={
                          !!q ||
                          status !== "all" ||
                          mode !== "all" ||
                          airlineId !== "all" ||
                          !!kpi
                        }
                        onClear={() => (
                          setQ(""),
                          setStatus("all"),
                          setMode("all"),
                          setAirlineId("all"),
                          setKpi(null)
                        )}
                      >
                        No reservations in this period. Use New Reservation to
                        plan one.
                      </NoResults>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
              <span className="font-medium">Shipment Mode:</span>
              <span className="flex items-center gap-1">
                <Plane size={12} aria-hidden /> Air Freight
              </span>
              <span className="flex items-center gap-1">
                <Ship size={12} aria-hidden /> Sea Freight
              </span>
              <span className="flex items-center gap-1">
                <Repeat size={12} aria-hidden /> Recurring
              </span>
              <span className="ml-2 font-medium">Status:</span>
              {(
                [
                  "Reserved",
                  "Booking In Progress",
                  "Booking Confirmed",
                  "On Hold",
                  "Cancelled",
                ] as const
              ).map((s) => (
                <Badge key={s} className={RESERVATION_TONE[s]}>
                  {s}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {selected && (
          <PlannerPanel r={selected} onClose={() => setSelectedId(null)} />
        )}
      </div>
      {dayList && (
        <DayShipmentsModal
          date={dayList}
          items={visible.filter((r) => r.shipmentDate === dayList).map(reservationAsPlanned)}
          onClose={() => setDayList(null)}
        />
      )}
    </>
  );
}

/** Side panel with the selected reservation's key details and quick actions */
function PlannerPanel({ r, onClose }: { r: Reservation; onClose: () => void }) {
  const { airline, customer, portLabel } = useLookups();
  const [dialog, setDialog] = useState<"reschedule" | "cancel" | null>(null);
  const a = airline(r.airlineId);
  const closed = r.status === "Cancelled" || r.status === "Departed";
  const rows: [string, React.ReactNode][] = [
    ["Route", `${r.pol} → ${r.pod}`],
    ["Planned Date", fmtDate(r.shipmentDate)],
    ["Cargo Details", `${r.packages} ${r.packageType} / ${r.grossWeight} KG`],
    ["Commodity", r.commodity],
    ["Preferred Airline", a?.name ?? "—"],
    ["Booking Ref.", r.booking?.ref ?? "—"],
    ["Booking Status", r.bookingStatus],
  ];
  return (
    <aside
      className="h-fit rounded-xl border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-20"
      aria-label={`Reservation ${r.ref}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-xs font-semibold text-brand-700">
            {r.ref}
          </div>
          <div className="truncate text-sm font-semibold text-slate-900">
            {customer(r.customerId)?.name}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge className={RESERVATION_TONE[r.status]}>{r.status}</Badge>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Close panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <dl className="space-y-1.5 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-slate-500">{k}</dt>
            <dd
              className="text-right font-medium text-slate-900"
              title={
                k === "Route"
                  ? `${portLabel(r.pol)} → ${portLabel(r.pod)}`
                  : undefined
              }
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 space-y-2">
        {a?.portalUrl && !closed && (
          <a
            href={a.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonCls("primary", "sm", "w-full")}
          >
            <ExternalLink size={13} aria-hidden /> Open Airline Portal
          </a>
        )}
        <div className="grid grid-cols-2 gap-2">
          <LinkButton
            href={`/reservations/${r.id}/edit`}
            variant="secondary"
            size="sm"
          >
            Edit
          </LinkButton>
          <Button
            variant="secondary"
            size="sm"
            disabled={closed || !!r.jobId}
            title={
              r.jobId
                ? "This reservation has a job; change the date on the job"
                : undefined
            }
            onClick={() => setDialog("reschedule")}
          >
            Reschedule
          </Button>
        </div>
        {!closed && !r.jobId && (
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            onClick={() => setDialog("cancel")}
          >
            Cancel Shipment
          </Button>
        )}
        <Link
          href={`/reservations/${r.id}`}
          className={`${linkCls} block text-center text-sm`}
        >
          View Details →
        </Link>
      </div>
      {dialog === "reschedule" && (
        <RescheduleModal r={r} onClose={() => setDialog(null)} />
      )}
      {dialog === "cancel" && (
        <CancelModal r={r} onClose={() => setDialog(null)} />
      )}
    </aside>
  );
}
