"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BellRing, Check, ExternalLink, Pause, Pencil, Play, Repeat, XCircle } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Reservation } from "@/lib/types";
import { RESERVATION_TONE, cn, fmtDate, fmtDateTime, volumeCbm } from "@/lib/utils";
import { Badge, Button, Card, Empty, KeyValue, LinkButton, PageHeader, StatusBadge, buttonCls, linkCls } from "@/components/ui";
import { BookingConfirmModal, CancelModal, HoldModal, InitiateBookingModal, RescheduleModal } from "@/components/reservation";
import { NotifyCustomerFlow } from "@/components/jobflow";
import { DocList } from "@/components/inputs";

const FLOW = ["Create Reservation", "Plan Shipment", "Initiate Carrier Booking", "Booking Confirmation", "Job Activation", "AWB / Transport Document", "Shipment Completion"] as const;

/** Step in progress on the reservation flow; earlier steps are done */
function flowStep(r: Reservation, jobStatus?: string) {
  if (r.status === "Departed" || jobStatus === "Departed" || jobStatus === "Cargo In Transit") return 7;
  if (r.jobId) return jobStatus === "AWB In Progress" ? 5 : 6;
  if (r.status === "Booking Confirmed") return 4;
  if (r.status === "Booking In Progress") return 3;
  if (r.status === "Ready for Booking") return 2;
  if (r.status === "Draft") return 0;
  return 1;
}

type Dialog = "reschedule" | "hold" | "cancel" | "initiate" | "confirm" | "notify" | null;

export default function ReservationPage() {
  const { id } = useParams<{ id: string }>();
  const { state, actions } = useStore();
  const { reservation, customer, airline, portLabel, job } = useLookups();
  const [dialog, setDialog] = useState<Dialog>(null);
  const r = reservation(id);
  if (!r) return <Empty action={<Link href="/reservations" className={linkCls}>Back to Shipment Planner</Link>}>This reservation doesn&apos;t exist.</Empty>;
  const cust = customer(r.customerId);
  const a = airline(r.airlineId);
  const j = job(r.jobId);
  const fromJob = job(r.fromJobId);
  const step = flowStep(r, j?.status);
  const closed = r.status === "Cancelled" || r.status === "Departed";
  const series = r.seriesId ? state.reservations.filter((x) => x.seriesId === r.seriesId).sort((x, y) => x.shipmentDate.localeCompare(y.shipmentDate)) : [];
  const close = () => setDialog(null);

  const row = (text: React.ReactNode, action: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
      <p className="min-w-0 flex-1">{text}</p>
      <div className="flex flex-wrap gap-2">{action}</div>
    </div>
  );
  let next: React.ReactNode;
  if (j) {
    next = row(
      <>
        Job <b className="font-mono">{j.ref}</b> is active ({j.status}).{" "}
        {j.status === "AWB In Progress" ? (
          <>
            Next action: <b>AWB Execution</b>.
          </>
        ) : (
          "Continue on the job."
        )}
      </>,
      <LinkButton href={j.status === "AWB In Progress" ? `/shipments/${j.id}?open=awb` : `/shipments/${j.id}`}>{j.status === "AWB In Progress" ? "Execute AWB" : "Open job"}</LinkButton>,
    );
  } else {
    switch (r.status) {
      case "Draft":
        next = row(
          <>Saved but not submitted for planning. Next action: <b>Complete Reservation</b>.</>,
          <>
            <LinkButton variant="secondary" href={`/reservations/${r.id}/edit`}>
              Complete details
            </LinkButton>
            <Button onClick={() => actions.submitReservation(r.id)} disabled={!r.pol || !r.pod || !r.commodity}>
              Create Reservation
            </Button>
          </>,
        );
        break;
      case "Reserved":
      case "Rescheduled":
      case "Ready for Booking":
        next = row(
          <>
            Planned for <b>{fmtDate(r.shipmentDate)}</b>. Next action: <b>{r.status === "Ready for Booking" ? "Initiate Carrier Booking" : "Review / Initiate Booking"}</b>.
          </>,
          <>
            {r.status !== "Ready for Booking" && (
              <Button variant="secondary" onClick={() => actions.setReservationStatus(r.id, "Ready for Booking")}>
                Ready for Booking
              </Button>
            )}
            <Button onClick={() => setDialog("initiate")}>Initiate Carrier Booking</Button>
          </>,
        );
        break;
      case "Booking In Progress":
        next = row(
          <>
            Booking with <b>{a?.name ?? "the carrier"}</b> in progress. Next action: <b>Update Booking Details</b> once the carrier confirms.
          </>,
          <>
            {a?.portalUrl && (
              <a href={a.portalUrl} target="_blank" rel="noopener noreferrer" className={buttonCls("secondary", "md")}>
                <ExternalLink size={14} aria-hidden /> Airline portal
              </a>
            )}
            <Button onClick={() => setDialog("confirm")}>Update Booking Confirmation</Button>
          </>,
        );
        break;
      case "Booking Confirmed":
        next = r.notifiedAt
          ? row(
              <>
                Customer notified on {fmtDateTime(r.notifiedAt)}. Next action: <b>Activate Job</b> (then AWB execution).
              </>,
              <>
                <Button variant="secondary" onClick={() => setDialog("notify")}>
                  <BellRing size={14} aria-hidden /> Notify again
                </Button>
                <LinkButton href={`/shipments/new?reservation=${r.id}`}>Activate Job</LinkButton>
              </>,
            )
          : row(
              <>
                Booking <b>{r.booking?.ref}</b> confirmed in the airline portal. Next action: send the confirmation to the customer.
              </>,
              <>
                <LinkButton variant="secondary" href={`/shipments/new?reservation=${r.id}`}>
                  Activate Job
                </LinkButton>
                <Button onClick={() => setDialog("notify")}>
                  <BellRing size={14} aria-hidden /> Notify Customer
                </Button>
              </>,
            );
        break;
      case "On Hold":
        next = row(
          <>
            On hold: <i>{r.holdReason}</i>. Next action: <b>Resume Reservation</b>.
          </>,
          <Button onClick={() => actions.resumeReservation(r.id)}>
            <Play size={14} aria-hidden /> Resume
          </Button>,
        );
        break;
      case "Cancelled":
        next = row(<>Cancelled: <i>{r.cancelReason}</i>. The record is kept for reference.</>, null);
        break;
      default:
        next = row(<>Shipment has departed. Update shipment milestones on the job.</>, null);
    }
  }

  return (
    <>
      <PageHeader
        back={{ href: "/reservations", label: "Shipment Planner" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{r.ref}</span> <Badge className={RESERVATION_TONE[r.status]}>{r.status}</Badge>
            {r.seriesId && (
              <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                <Repeat size={11} className="mr-1" aria-hidden /> Recurring
              </Badge>
            )}
          </span>
        }
        subtitle={
          <>
            {cust?.name} · {portLabel(r.pol)} → {portLabel(r.pod)} · planned {fmtDate(r.shipmentDate)}
            {fromJob && (
              <>
                {" "}
                · converted from job{" "}
                <Link href={`/shipments/${fromJob.id}`} className={linkCls}>
                  {fromJob.ref}
                </Link>
              </>
            )}
          </>
        }
        actions={
          !closed && (
            <>
              <LinkButton href={`/reservations/${r.id}/edit`} variant="secondary" size="sm">
                <Pencil size={14} aria-hidden /> Edit
              </LinkButton>
              {/* With a job, the date and hold status are managed on the job */}
              {!j && (
                <Button variant="secondary" size="sm" onClick={() => setDialog("reschedule")}>
                  Reschedule
                </Button>
              )}
              {j ? null : r.status === "On Hold" ? (
                <Button variant="secondary" size="sm" onClick={() => actions.resumeReservation(r.id)}>
                  <Play size={14} aria-hidden /> Resume
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setDialog("hold")}>
                  <Pause size={14} aria-hidden /> Put On Hold
                </Button>
              )}
              {!j && (
                <Button variant="danger" size="sm" onClick={() => setDialog("cancel")}>
                  <XCircle size={14} aria-hidden /> Cancel Reservation
                </Button>
              )}
            </>
          )
        }
      />

      <Card className="mb-3" bodyClassName="px-2 py-3">
        <ol className="flex overflow-x-auto pb-1">
          {FLOW.map((label, i) => {
            const done = i < step || (i === 6 && step === 7);
            const current = i === step && !(r.status === "Cancelled");
            return (
              <li key={label} className="flex min-w-[7rem] flex-1 flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <div className={cn("h-0.5 flex-1", i === 0 ? "invisible" : done || current ? "bg-brand-500" : "bg-slate-200")} />
                  <div className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold", done && "bg-brand-600 text-white", current && "bg-white text-brand-700 ring-2 ring-brand-500", !done && !current && "bg-slate-100 text-slate-400")}>
                    {done ? <Check size={14} /> : i + 1}
                  </div>
                  <div className={cn("h-0.5 flex-1", i === FLOW.length - 1 ? "invisible" : done ? "bg-brand-500" : "bg-slate-200")} />
                </div>
                <span className={cn("mt-1.5 px-1 text-xs leading-tight", current ? "font-semibold text-brand-700" : done ? "text-slate-700" : "text-slate-400")}>{label}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          <Card title="Next action" className="border-brand-200 ring-1 ring-brand-100">
            {next}
          </Card>
          <Card title="Reservation details">
            <div className="space-y-3">
              <KeyValue
                cols={4}
                items={[
                  ["Branch / FY", `${r.branch} / ${r.financialYear}`],
                  ["Customer", cust?.name],
                  ["Customer Type", cust?.type],
                  ["Shipper", r.shipperName],
                  ["Mode", `${r.cargoMode} / ${r.shipmentMode}`],
                  ["INCO Terms", r.incoterm],
                  ["AWB No.", r.awbNo],
                  ["Airline", a?.name],
                  ["Flight", [r.flightNo, r.flightDate && fmtDate(r.flightDate)].filter(Boolean).join(" · ")],
                  ["Booking Status", r.bookingStatus],
                  ["Route Type", r.routeType],
                  ["Transit Time", r.transitTime && `${r.transitTime} days`],
                  ...r.connections.map((c, i): [string, React.ReactNode] => [`Connection ${i + 1}`, `${airline(c.airlineId)?.name ?? "—"} via ${c.transit} · ${c.flightNo} ${c.date ? fmtDate(c.date) : ""}`]),
                ]}
              />
              <div className="border-t border-slate-100 pt-3">
                <KeyValue
                  cols={4}
                  items={[
                    ["Commodity", r.commodity],
                    ["Product Type", r.productType],
                    ["Packages", `${r.packages} ${r.packageType} (${r.unitType})`],
                    ["Dimensions", r.length ? `${r.length} × ${r.width} × ${r.height} cm` : ""],
                    ["Gross Weight", `${r.grossWeight} kg`],
                    ["Chargeable Weight", `${r.chargeableWeight} kg`],
                    ["Volume", `${volumeCbm(r).toFixed(4)} CBM`],
                    ["Clearance Place", r.clearancePlace],
                    ["Sales Person", r.salesPerson],
                    ["Operations Person", r.operationsPerson],
                    ["Pricing Person", r.pricingPerson],
                    ["Preferred Airlines", r.preferredAirlineIds.map((x) => airline(x)?.name).join(", ")],
                  ]}
                />
              </div>
              {r.weightOverride && (
                <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                  Chargeable weight changed from {r.weightOverride.calculated} kg (calculated) to {r.weightOverride.revised} kg by {r.weightOverride.by} on {fmtDateTime(r.weightOverride.at)}: {r.weightOverride.reason}
                </p>
              )}
              {r.remarks && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{r.remarks}</p>}
            </div>
          </Card>
          {r.booking && (
            <Card title="Booking confirmation">
              <KeyValue
                cols={4}
                items={[
                  ["Booking Ref.", r.booking.ref],
                  ["Flight", r.booking.flightNo],
                  ["Flight Date", fmtDate(r.booking.flightDate)],
                  ["Confirmed", fmtDateTime(r.booking.confirmedAt)],
                ]}
              />
              {r.booking.documents.length > 0 && (
                <div className="mt-3">
                  <DocList docs={r.booking.documents} />
                </div>
              )}
            </Card>
          )}
        </div>

        <aside className="min-w-0 space-y-3">
          {j && (
            <Card title="Job">
              <Link href={`/shipments/${j.id}`} className={`${linkCls} font-mono text-sm`}>
                {j.ref}
              </Link>
              <div className="mt-1">
                <StatusBadge status={j.status} />
              </div>
            </Card>
          )}
          {series.length > 1 && (
            <Card title={`Series · ${series.length} occurrences`}>
              <ul className="space-y-1 text-xs">
                {series.map((x) => (
                  <li key={x.id} className={cn("flex items-center justify-between gap-2 rounded px-1.5 py-1", x.id === r.id && "bg-brand-50")}>
                    <Link href={`/reservations/${x.id}`} className={linkCls}>
                      {fmtDate(x.shipmentDate)}
                    </Link>
                    <Badge className={RESERVATION_TONE[x.status]}>{x.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {r.previousDates.length > 0 && (
            <Card title="Previous dates">
              <ul className="space-y-2 text-xs">
                {r.previousDates.map((p, i) => (
                  <li key={i}>
                    <b>{fmtDate(p.date)}</b> · {p.reason}
                    <div className="text-slate-400">changed {fmtDateTime(p.at)}</div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Activity history">
            <ol className="space-y-2.5 text-xs">
              {r.history.map((h, i) => (
                <li key={i}>
                  <div className="font-medium text-slate-800">{h.action}</div>
                  {h.detail && <div className="text-slate-600">{h.detail}</div>}
                  <div className="text-slate-400">
                    {h.by} · {fmtDateTime(h.at)}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>

      {dialog === "reschedule" && <RescheduleModal r={r} onClose={close} />}
      {dialog === "hold" && <HoldModal r={r} onClose={close} />}
      {dialog === "cancel" && <CancelModal r={r} onClose={close} />}
      {dialog === "initiate" && <InitiateBookingModal r={r} onClose={close} />}
      {dialog === "confirm" && <BookingConfirmModal r={r} onClose={close} />}
      {dialog === "notify" && (
        <NotifyCustomerFlow
          customerId={r.customerId}
          refs={{ reservationId: r.id }}
          subject={`Booking confirmation – ${r.ref} · ${r.pol} → ${r.pod}`}
          body={`Your booking for the shipment below is confirmed with ${a?.name ?? "the airline"}.\n\nReservation: ${r.ref}\nBooking Ref: ${r.booking?.ref ?? "—"}\nFlight: ${r.booking?.flightNo ?? r.flightNo} on ${fmtDate(r.booking?.flightDate ?? r.flightDate)}\nRoute: ${portLabel(r.pol)} → ${portLabel(r.pod)}\nCargo: ${r.packages} ${r.packageType}, ${r.grossWeight} kg, ${r.commodity}\n\nPlease hand over the cargo and the shipping documents in time.`}
          onClose={close}
        />
      )}
    </>
  );
}
