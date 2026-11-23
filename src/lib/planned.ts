import { ENQUIRY_STATUSES, type EnquiryStatus, type Reservation, type State } from "./types";
import { RESERVATION_TONE, STATUS_TONE, isoDay, utcDay } from "./utils";

export type PlannedSource = "Job" | "Reservation" | "Enquiry";

/** One planned shipment on the Planned Shipments calendar, whichever screen it comes from */
export interface Planned {
  key: string;
  source: PlannedSource;
  ref: string;
  date: string;
  status: string;
  tone: string;
  customerId: string;
  shipper: string;
  pol: string;
  pod: string;
  airlineId?: string;
  flightNo: string;
  mode: "Air" | "Sea";
  pieces: number;
  weight: number;
  commodity: string;
  href: string;
  cancelled: boolean;
}

/** A reservation as a calendar entry (also used by the Shipment Planner's day list) */
export function reservationAsPlanned(r: Reservation): Planned {
  return {
    key: `res:${r.id}`,
    source: "Reservation",
    ref: r.ref,
    date: r.shipmentDate,
    status: r.status,
    tone: RESERVATION_TONE[r.status] ?? "",
    customerId: r.customerId,
    shipper: r.shipperName,
    pol: r.pol,
    pod: r.pod,
    airlineId: r.airlineId,
    flightNo: r.booking?.flightNo || r.flightNo,
    mode: r.cargoMode === "Sea" ? "Sea" : "Air",
    pieces: r.packages,
    weight: r.chargeableWeight || r.grossWeight,
    commodity: r.commodity,
    href: `/reservations/${r.id}`,
    cancelled: r.status === "Cancelled",
  };
}

/** Enquiries the customer has confirmed (from "Waiting for Shipment Date" on), short of cancelled or lost */
export const CONFIRMED_ENQUIRY_STATUSES: readonly EnquiryStatus[] = ENQUIRY_STATUSES.slice(ENQUIRY_STATUSES.indexOf("Waiting for Shipment Date")).filter((s) => s !== "Cancelled" && s !== "Lost");

/**
 * Every planned shipment in one list: jobs on their flight date, reservations that have no job yet on
 * their shipment date, and confirmed enquiries with a shipment date but no job. Nothing appears twice.
 */
export function plannedShipments(s: State): Planned[] {
  const out: Planned[] = [];
  for (const j of s.jobs) {
    const enq = s.enquiries.find((e) => e.id === j.enquiryId);
    out.push({
      key: `job:${j.id}`,
      source: "Job",
      ref: j.ref,
      date: j.flightDate || j.date,
      status: j.status,
      tone: STATUS_TONE[j.status] ?? "",
      customerId: j.customerId,
      shipper: j.shipperName,
      pol: j.pol,
      pod: j.pod,
      airlineId: j.airlineId,
      flightNo: j.flightNo,
      mode: enq?.cargoMode === "Sea" ? "Sea" : "Air",
      pieces: j.boxes,
      weight: j.weight,
      commodity: j.commodity,
      href: `/shipments/${j.id}`,
      cancelled: j.status === "Cancelled",
    });
  }
  for (const r of s.reservations) {
    if (r.jobId && s.jobs.some((j) => j.id === r.jobId)) continue;
    out.push(reservationAsPlanned(r));
  }
  for (const e of s.enquiries) {
    if (!e.shipmentDate || (e.jobId && s.jobs.some((j) => j.id === e.jobId)) || !CONFIRMED_ENQUIRY_STATUSES.includes(e.status)) continue;
    const q = s.quotations.find((x) => x.id === e.quotationId);
    out.push({
      key: `enq:${e.id}`,
      source: "Enquiry",
      ref: e.ref,
      // A confirmed booking's flight date wins over the requested shipment date
      date: e.booking?.flightDate || e.shipmentDate,
      status: e.status,
      tone: STATUS_TONE[e.status] ?? "",
      customerId: e.customerId,
      shipper: "",
      pol: e.pol,
      pod: e.pod,
      airlineId: q?.airlineId,
      flightNo: e.booking?.flightNo ?? "",
      mode: e.cargoMode === "Sea" ? "Sea" : "Air",
      pieces: e.packages,
      weight: e.chargeableWeight,
      commodity: e.commodity,
      href: `/enquiries/${e.id}`,
      cancelled: false,
    });
  }
  return out.filter((p) => p.date);
}

/** Weeks (Sunday first) covering the anchor's month, as in the reference calendar */
export function monthWeeks(anchor: string) {
  const a = utcDay(anchor);
  const first = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1));
  const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000);
  const last = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0));
  const weeks: string[][] = [];
  for (let d = start; d <= last || weeks.length < 5; ) {
    weeks.push(Array.from({ length: 7 }, (_, i) => isoDay(new Date(d.getTime() + i * 86_400_000))));
    d = new Date(d.getTime() + 7 * 86_400_000);
    if (weeks.length === 6) break;
  }
  return weeks;
}

/** ISO week number of a date (weeks run Monday to Sunday) */
export function weekNo(isoDate: string) {
  const d = utcDay(isoDate);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** Week number for a Sunday-first calendar row: its Monday decides, since the Sunday ends the previous ISO week */
export const rowWeekNo = (week: string[]) => weekNo(week[1]);

/** Reference prefix for a chip, so a job and a reservation with the same number can be told apart */
export const SOURCE_PREFIX: Record<PlannedSource, string> = { Job: "JOB", Reservation: "RSV", Enquiry: "EQ" };
