"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, ClipboardList, List, Package, Plane, Ship, X } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import { type Planned, type PlannedSource, SOURCE_PREFIX, monthWeeks, plannedShipments, rowWeekNo } from "@/lib/planned";
import { cn, fmtDate, isoDay, matches, today, utcDay } from "@/lib/utils";
import { Badge, Button, Card, DateJump, FilterBar, FilterSelect, Kpi, KpiGrid, NoResults, PageHeader, SearchField, Table, linkCls } from "@/components/ui";

type Source = PlannedSource;
type View = "Month" | "Week" | "List";

/** Colour per source, used on chips, the legend and the KPI cards */
const SOURCE_STYLE: Record<Source, { chip: string; dot: string; icon: typeof Package; label: string }> = {
  Job: { chip: "bg-brand-50 text-brand-800 ring-brand-200", dot: "bg-brand-600", icon: Package, label: "Jobs / bookings" },
  Reservation: { chip: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-600", icon: CalendarRange, label: "Reserved shipments" },
  Enquiry: { chip: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500", icon: ClipboardList, label: "Confirmed enquiries (no job yet)" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function PlannedShipmentsPage() {
  const { state } = useStore();
  const { customer, portLabel } = useLookups();
  const [view, setView] = useState<View>(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 639.98px)").matches ? "List" : "Month"));
  const [anchor, setAnchor] = useState(today());
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"all" | Source>("all");
  const [airlineId, setAirlineId] = useState("all");
  const [showCancelled, setShowCancelled] = useState(false);
  const [open, setOpen] = useState<{ item: Planned; rect: DOMRect } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const t = today();

  const all = useMemo(() => plannedShipments(state), [state]);
  const airlineName = (id?: string) => state.airlines.find((a) => a.id === id);

  const weeks = useMemo(() => monthWeeks(anchor), [anchor]);
  const weekDays = useMemo(() => {
    const a = utcDay(anchor);
    const sunday = new Date(a.getTime() - a.getUTCDay() * 86_400_000);
    return Array.from({ length: 7 }, (_, i) => isoDay(new Date(sunday.getTime() + i * 86_400_000)));
  }, [anchor]);
  const monthStart = anchor.slice(0, 7);
  const [from, to] = view === "Week" ? [weekDays[0], weekDays[6]] : view === "Month" ? [weeks[0][0], weeks.at(-1)![6]] : [`${monthStart}-01`, isoDay(new Date(Date.UTC(+anchor.slice(0, 4), +anchor.slice(5, 7), 0)))];

  // Every filter except the type, so the per-type cards count what the calendar would show for that type
  const inView = all.filter(
    (p) =>
      p.date >= from &&
      p.date <= to &&
      (showCancelled || !p.cancelled) &&
      (airlineId === "all" || p.airlineId === airlineId) &&
      matches(q, [p.ref, customer(p.customerId)?.name, p.shipper, p.pol, p.pod, p.flightNo, p.commodity, airlineName(p.airlineId)?.name]),
  );
  const visible = inView.filter((p) => source === "all" || p.source === source);
  const byDay = (d: string) => visible.filter((p) => p.date === d).sort((a, b) => a.source.localeCompare(b.source) || a.ref.localeCompare(b.ref));
  const filtered = !!q.trim() || source !== "all" || airlineId !== "all" || showCancelled;
  const reset = () => {
    setQ("");
    setSource("all");
    setAirlineId("all");
    setShowCancelled(false);
  };

  const shift = (by: -1 | 1) => {
    const a = utcDay(anchor);
    if (view === "Week") a.setUTCDate(a.getUTCDate() + 7 * by);
    else a.setUTCMonth(a.getUTCMonth() + by, 1);
    setAnchor(isoDay(a));
    setOpen(null);
  };
  const periodLabel = view === "Week" ? `${fmtDate(weekDays[0])} – ${fmtDate(weekDays[6])}` : utcDay(anchor).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  const chip = (p: Planned, compact: boolean) => {
    const st = SOURCE_STYLE[p.source];
    const al = airlineName(p.airlineId);
    return (
      <button
        key={p.key}
        type="button"
        onClick={(e) => setOpen(open?.item.key === p.key ? null : { item: p, rect: e.currentTarget.getBoundingClientRect() })}
        aria-expanded={open?.item.key === p.key}
        title={`${p.ref} · ${customer(p.customerId)?.name ?? ""} · ${p.pol} → ${p.pod}${al ? ` · ${al.name}` : ""} · ${p.status}`}
        className={cn(
          "flex min-h-6 w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-[0.6875rem] leading-tight ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-brand-500",
          st.chip,
          p.cancelled && "line-through opacity-60",
          open?.item.key === p.key && "outline-2 outline-brand-600",
        )}
      >
        <span className={cn("size-1.5 shrink-0 rounded-full", st.dot)} aria-hidden />
        {p.mode === "Sea" ? <Ship size={10} className="shrink-0" aria-hidden /> : <Plane size={10} className="shrink-0" aria-hidden />}
        <span className="truncate font-semibold">{compact ? shortRef(p) : p.ref}</span>
        <span className="truncate">({customer(p.customerId)?.code || customer(p.customerId)?.name?.split(" ")[0] || ""})</span>
        {al?.code && <span className="ml-auto shrink-0 font-mono">{al.code}</span>}
      </button>
    );
  };

  /** "JOB 0001": the type prefix and running number, short enough for a month cell */
  const shortRef = (p: Planned) => {
    const parts = p.ref.split(/[-/]/).filter(Boolean);
    const last = parts.at(-1) ?? p.ref;
    const no = /^(19|20)\d{2}$/.test(last) && parts.length > 1 ? parts.at(-2)! : last;
    return `${SOURCE_PREFIX[p.source]} ${no}`;
  };

  const dayCell = (d: string, inMonth: boolean, tall: boolean) => {
    const items = byDay(d);
    const isToday = d === t;
    // The day picked in Go to date, when it isn't today
    const picked = d === anchor && !isToday;
    const limit = tall || expanded === d ? items.length : 3;
    return (
      <div key={d} data-day={d} aria-current={picked ? "date" : undefined} className={cn("min-h-28 min-w-0 border-b border-l border-slate-200 p-1", !inMonth && "bg-slate-50/70", tall && "min-h-[26rem]", picked && "bg-amber-50/60 ring-2 ring-amber-400 ring-inset")}>
        <div className="mb-1 flex items-center justify-between px-0.5">
          {items.length > 0 && <span className="text-[0.6875rem] text-slate-500">{items.length}</span>}
          <span className={cn("ml-auto text-xs", isToday ? "grid size-6 place-items-center rounded-full bg-navy-900 font-semibold text-white dark:bg-[#2a62e6]" : inMonth ? "font-medium text-slate-700" : "text-slate-500")}>
            {Number(d.slice(8))}
          </span>
        </div>
        <div className="space-y-1">
          {items.slice(0, limit).map((p) => chip(p, !tall))}
          {items.length > limit ? (
            <button type="button" onClick={() => setExpanded(d)} className="w-full rounded px-1 text-left text-[0.6875rem] font-semibold text-brand-700 hover:bg-brand-50">
              +{items.length - limit} more
            </button>
          ) : (
            !tall &&
            expanded === d &&
            items.length > 3 && (
              <button type="button" onClick={() => setExpanded(null)} className="w-full rounded px-1 text-left text-[0.6875rem] font-semibold text-brand-700 hover:bg-brand-50">
                Show less
              </button>
            )
          )}
        </div>
      </div>
    );
  };

  const count = (s: Source) => inView.filter((p) => p.source === s).length;

  return (
    <>
      <PageHeader title="Planned Shipments" subtitle="All shipments in one calendar: jobs on their flight date, reserved shipments and confirmed enquiries on their planned date." />

      <KpiGrid cols={4}>
        <Kpi icon={CalendarDays} label="Shipments in view" value={visible.length} active={source === "all"} onClick={() => setSource("all")} />
        {(Object.keys(SOURCE_STYLE) as Source[]).map((s) => (
          <Kpi
            key={s}
            icon={SOURCE_STYLE[s].icon}
            tone={s === "Job" ? "blue" : s === "Reservation" ? "green" : "amber"}
            label={SOURCE_STYLE[s].label}
            value={count(s)}
            active={source === s}
            onClick={() => setSource(source === s ? "all" : s)}
          />
        ))}
      </KpiGrid>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setAnchor(today())}>
          Today
        </Button>
        <div className="flex">
          <Button variant="secondary" className="rounded-r-none px-2" onClick={() => shift(-1)} aria-label="Previous">
            <ChevronLeft size={16} />
          </Button>
          <Button variant="secondary" className="-ml-px rounded-l-none px-2" onClick={() => shift(1)} aria-label="Next">
            <ChevronRight size={16} />
          </Button>
        </div>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <CalendarRange size={15} aria-hidden /> {periodLabel}
        </span>
        <DateJump value={anchor} onChange={(d) => (setAnchor(d), setOpen(null))} />
        <div className="ml-auto flex overflow-hidden rounded-lg ring-1 ring-slate-300" role="group" aria-label="Calendar view">
          {(
            [
              ["Month", CalendarDays],
              ["Week", CalendarRange],
              ["List", List],
            ] as const
          ).map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => (setView(v), setOpen(null))}
              aria-pressed={view === v}
              className={cn("inline-flex h-9 items-center gap-1.5 px-3 text-sm font-medium sm:h-8", view === v ? "bg-navy-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50")}
            >
              <Icon size={14} aria-hidden /> {v}
            </button>
          ))}
        </div>
      </div>

      <FilterBar>
        <SearchField label="Search shipments" value={q} onChange={setQ} placeholder="Search reference, customer, route, flight…" />
        <FilterSelect label="Type" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
          <option value="all">All types</option>
          <option value="Job">Jobs / bookings</option>
          <option value="Reservation">Reserved shipments</option>
          <option value="Enquiry">Confirmed enquiries</option>
        </FilterSelect>
        <FilterSelect label="Airline" value={airlineId} onChange={(e) => setAirlineId(e.target.value)}>
          <option value="all">All Airlines</option>
          {state.airlines.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </FilterSelect>
        <label className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-slate-700 sm:h-8">
          <input type="checkbox" name="show-cancelled" className="accent-brand-600" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
          Show cancelled
        </label>
      </FilterBar>

      {view === "List" ? (
        <Card bodyClassName="p-0">
          {visible.length ? (
            <Table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Route</th>
                  <th>Airline / Flight</th>
                  <th className="text-right">Pieces / Weight</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...visible]
                  .sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref))
                  .map((p) => (
                    <tr key={p.key} className={cn("hover:bg-slate-50", p.cancelled && "text-slate-500 line-through")}>
                      <td className="whitespace-nowrap">{fmtDate(p.date)}</td>
                      <td>
                        <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                          <span className={cn("size-2 rounded-full", SOURCE_STYLE[p.source].dot)} aria-hidden />
                          {p.source}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <Link href={p.href} prefetch className={`${linkCls} font-mono text-xs`}>
                          {p.ref}
                        </Link>
                      </td>
                      <td className="max-w-44 truncate">{customer(p.customerId)?.name}</td>
                      <td className="whitespace-nowrap">
                        {p.pol} → {p.pod}
                      </td>
                      <td className="whitespace-nowrap">{[airlineName(p.airlineId)?.name, p.flightNo].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="text-right whitespace-nowrap tabular-nums">
                        {p.pieces} / {p.weight} kg
                      </td>
                      <td>
                        <Badge className={p.tone}>{p.status}</Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          ) : (
            <NoResults filtered={filtered} onClear={reset}>
              No shipments planned in {periodLabel}.
            </NoResults>
          )}
        </Card>
      ) : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto" tabIndex={0} aria-label="Planned shipments calendar, scrolls sideways">
            <div className="min-w-[56rem]">
              <div className={cn("grid border-slate-200 text-center text-xs font-semibold text-slate-600", view === "Month" ? "grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]" : "grid-cols-7")}>
                {view === "Month" && <div className="border-b border-slate-200 py-2 text-[0.6875rem] text-slate-500">Wk</div>}
                {(view === "Month" ? WEEKDAYS : weekDays).map((d, i) => (
                  <div key={d} className={cn("border-b border-l border-slate-200 py-2", view === "Week" && d === t && "bg-brand-50 text-brand-700")}>
                    {view === "Month" ? d : `${WEEKDAYS[i]} ${Number(d.slice(8))}`}
                  </div>
                ))}
              </div>
              {view === "Month" ? (
                weeks.map((w) => (
                  <div key={w[0]} className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]">
                    <div className="border-b border-slate-200 pt-1.5 text-center text-[0.6875rem] text-slate-500">{rowWeekNo(w)}</div>
                    {w.map((d) => dayCell(d, d.slice(0, 7) === monthStart, false))}
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-7">{weekDays.map((d) => dayCell(d, true, true))}</div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
            {(Object.keys(SOURCE_STYLE) as Source[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", SOURCE_STYLE[s].dot)} aria-hidden /> {SOURCE_STYLE[s].label}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <Plane size={12} aria-hidden /> Air
            </span>
            <span className="flex items-center gap-1">
              <Ship size={12} aria-hidden /> Sea
            </span>
            <span className="ml-auto">Click a shipment for details</span>
          </div>
        </Card>
      )}

      {open && <ShipmentPopover item={open.item} rect={open.rect} onClose={() => setOpen(null)} airline={airlineName(open.item.airlineId)?.name} customerName={customer(open.item.customerId)?.name} portLabel={portLabel} />}
    </>
  );
}

/** Details card next to the clicked shipment, like the reference calendar's pop-up */
function ShipmentPopover({ item: p, rect, onClose, airline, customerName, portLabel }: { item: Planned; rect: DOMRect; onClose: () => void; airline?: string; customerName?: string; portLabel: (code?: string) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest("[aria-expanded=true]") && onClose();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onClose);
    // The card is fixed to the screen, so it closes when the page content (or the calendar) scrolls under it
    document.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onClose);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);
  // Below the chip, kept on screen
  const width = 288;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const top = rect.bottom + 6 + 300 > window.innerHeight ? Math.max(8, rect.top - 6 - 300) : rect.bottom + 6;
  const st = SOURCE_STYLE[p.source];
  return (
    <div ref={ref} role="dialog" aria-label={`${p.ref} details`} style={{ left, top, width }} className="menu-in fixed z-50 rounded-xl bg-white p-3 text-sm shadow-2xl ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-mono font-semibold text-slate-900">{p.ref}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
            <span className={cn("size-2 rounded-full", st.dot)} aria-hidden /> {st.label}
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close details">
          <X size={14} />
        </button>
      </div>
      <dl className="mt-2.5 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
        <dt className="text-slate-500">Date</dt>
        <dd className="font-medium text-slate-800">{fmtDate(p.date)}</dd>
        <dt className="text-slate-500">Customer</dt>
        <dd className="truncate font-medium text-slate-800">{customerName || "—"}</dd>
        {p.shipper && (
          <>
            <dt className="text-slate-500">Shipper</dt>
            <dd className="truncate text-slate-800">{p.shipper}</dd>
          </>
        )}
        <dt className="text-slate-500">Route</dt>
        <dd className="text-slate-800">
          {portLabel(p.pol) || p.pol} → {portLabel(p.pod) || p.pod}
        </dd>
        <dt className="text-slate-500">Airline / Flight</dt>
        <dd className="text-slate-800">{[airline, p.flightNo].filter(Boolean).join(" · ") || "—"}</dd>
        <dt className="text-slate-500">Cargo</dt>
        <dd className="text-slate-800">
          {p.pieces} pcs · {p.weight} kg{p.commodity ? ` · ${p.commodity}` : ""}
        </dd>
        <dt className="text-slate-500">Status</dt>
        <dd>
          <Badge className={p.tone}>{p.status}</Badge>
        </dd>
      </dl>
      <Link href={p.href} prefetch className="mt-3 flex h-8 items-center justify-center rounded-lg bg-navy-900 text-xs font-semibold text-white hover:bg-navy-700 dark:bg-[#2a62e6] dark:hover:bg-[#2259e0]">
        Open {p.source === "Job" ? "job" : p.source === "Reservation" ? "reservation" : "enquiry"}
      </Link>
    </div>
  );
}
