import type {
  Airline,
  AirlineRate,
  Enquiry,
  EnquiryStatus,
  Port,
  Quotation,
  QuotationStatus,
  QuoteLine,
  Settings,
} from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const round4 = (n: number) => Math.round(n * 10000) / 10000;

export const today = () => new Date().toISOString().slice(0, 10);

export function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO timestamp `days` days (and `hours` hours) in the past */
export function ago(days: number, hours = 0) {
  return new Date(Date.now() - (days * 24 + hours) * 3600_000).toISOString();
}

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function money(n: number, currency = "INR") {
  return `${currency} ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** e.g. makeRef("EQ", "AIS", 5, 2026) → "EQ: AIS-0005-2026" */
export function makeRef(kind: "EQ" | "QT" | "JOB", prefix: string, no: number, year: number | string) {
  return `${kind}: ${prefix}-${String(no).padStart(4, "0")}-${year}`;
}

/** KOCHI-COK-INDIA */
export function fmtPort(p?: Port) {
  return p ? `${p.name}-${p.code}-${p.country}`.toUpperCase() : "";
}

/** Volume in CBM: packages × L × W × H (cm) / 1,000,000 */
export function volumeCbm(e: Pick<Enquiry, "packages" | "length" | "width" | "height">) {
  return round4((e.packages * e.length * e.width * e.height) / 1_000_000);
}

/** IATA volumetric weight in kg: packages × L × W × H (cm) / 6000 */
export function volumetricWeight(e: Pick<Enquiry, "packages" | "length" | "width" | "height">) {
  return round2((e.packages * e.length * e.width * e.height) / 6000);
}

/** Indicative total = higher of (chargeable weight × rate/kg) or minimum charge, plus AWB fee */
export function estimatedTotal(r: AirlineRate, chargeable: number) {
  return round2(Math.max(chargeable * r.ratePerKg, r.minCharge) + r.awbFee);
}

export const isRateValid = (r: AirlineRate) => r.validUntil >= today();

/** Valid rates for a route: master rate sheets, plus airline replies for this enquiry */
export function ratesForRoute(rates: AirlineRate[], pol: string, pod: string, enquiryId?: string) {
  return rates.filter(
    (r) => r.pol === pol && r.pod === pod && isRateValid(r) && (r.source === "Master" || (enquiryId && r.enquiryId === enquiryId)),
  );
}

export function airlinesForRoute(airlines: Airline[], pol: string, pod: string) {
  return airlines.filter((a) => (!pol || a.ports.includes(pol)) && (!pod || a.ports.includes(pod)));
}

export function previousShipments(
  enquiries: Enquiry[],
  e: Pick<Enquiry, "customerId" | "pol" | "pod" | "commodity"> & { id?: string },
) {
  const others = enquiries.filter((x) => x.id !== e.id);
  const commodity = e.commodity.trim().toLowerCase();
  return {
    sameDestination: e.pod ? others.filter((x) => x.pod === e.pod) : [],
    sameRoute: e.pol && e.pod ? others.filter((x) => x.pol === e.pol && x.pod === e.pod) : [],
    sameCustomer: e.customerId ? others.filter((x) => x.customerId === e.customerId) : [],
    sameCargo: commodity ? others.filter((x) => x.commodity.toLowerCase().includes(commodity)) : [],
  };
}

/** "Laps": time spent in the current status */
export function laps(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "Today" : d === 1 ? "1 day" : `${d} days`;
}

export function buildQuoteLines(chargeable: number, rate: AirlineRate | undefined, settings: Settings): QuoteLine[] {
  const line = (l: Omit<QuoteLine, "id" | "markup" | "gstPercent">): QuoteLine => ({
    id: uid(),
    markup: 0,
    gstPercent: settings.gstPercent,
    ...l,
  });
  const freight =
    rate && chargeable * rate.ratePerKg < rate.minCharge
      ? line({ group: "Airline", particulars: "AIR FREIGHT CHARGES (MINIMUM)", unit: "Per shipment", qty: 1, rate: rate.minCharge })
      : line({ group: "Airline", particulars: "AIR FREIGHT CHARGES", unit: "Per kg", qty: chargeable, rate: rate?.ratePerKg ?? 0 });
  return [
    freight,
    line({ group: "Airline", particulars: "AIRWAY BILL FEES - AWA", unit: "Per shipment", qty: 1, rate: rate?.awbFee ?? 0 }),
    ...settings.agencyCharges.map((c) =>
      line({ group: "Agency", particulars: c.particulars, unit: c.unit, qty: c.unit === "Per kg" ? chargeable : 1, rate: c.rate }),
    ),
  ];
}

/** Net Amount = (Rate + Mark Up) × Qty × ROE */
export const lineNet = (l: QuoteLine, roe: number) => round2((l.rate + l.markup) * l.qty * roe);
export const lineGst = (l: QuoteLine, roe: number) => round2((lineNet(l, roe) * l.gstPercent) / 100);
export const lineTotal = (l: QuoteLine, roe: number) => round2(lineNet(l, roe) + lineGst(l, roe));

export function quoteTotals(q: Pick<Quotation, "lines" | "roe">) {
  const sum = (lines: QuoteLine[], f: (l: QuoteLine, roe: number) => number) => round2(lines.reduce((s, l) => s + f(l, q.roe), 0));
  const airline = q.lines.filter((l) => l.group === "Airline");
  const agency = q.lines.filter((l) => l.group === "Agency");
  return {
    airline: sum(airline, lineTotal),
    agency: sum(agency, lineTotal),
    net: sum(q.lines, lineNet),
    gst: sum(q.lines, lineGst),
    grand: sum(q.lines, lineTotal),
    profit: round2(q.lines.reduce((s, l) => s + l.markup * l.qty * q.roe, 0)),
  };
}

/** Progress steps shown on the enquiry page */
export const STEPS = [
  "Enquiry",
  "Airline Rates",
  "Quotation",
  "Client Confirmation",
  "Shipment Date",
  "Booking",
  "Invoice & Packing List",
  "Shipment Job",
  "AWB",
] as const;

const STEP_INDEX: Record<EnquiryStatus, number> = {
  "New Enquiry": 1,
  "Rate Requested": 1,
  "Rate Received": 2,
  "Quote Confirmation Pending": 3,
  "Waiting for Shipment Date": 4,
  "Booking in Progress": 5,
  "Booking Confirmed": 6,
  "Docs Received": 7,
  "Job Created": 8,
  "AWB Created": 9,
  Cancelled: -1,
  Lost: -1,
};

/** Index of the step in progress; earlier steps are complete. -1 when cancelled/lost. */
export const currentStep = (status: EnquiryStatus) => STEP_INDEX[status];

// Few hues, each with one meaning: blue = new, amber = waiting on someone else,
// violet = action needed from us, green = booked / done, red = closed
const TONE = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  new: "bg-sky-50 text-sky-800 ring-sky-200",
  waiting: "bg-amber-50 text-amber-800 ring-amber-200",
  action: "bg-violet-50 text-violet-800 ring-violet-200",
  done: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  closed: "bg-red-50 text-red-700 ring-red-200",
};

export const STATUS_TONE: Record<EnquiryStatus | QuotationStatus, string> = {
  Draft: TONE.neutral,
  "New Enquiry": TONE.new,
  "Rate Requested": TONE.waiting,
  "Rate Received": TONE.action,
  "Quote Confirmation Pending": TONE.waiting,
  "Waiting for Shipment Date": TONE.waiting,
  "Booking in Progress": TONE.action,
  "Booking Confirmed": TONE.done,
  "Docs Received": TONE.done,
  "Job Created": TONE.done,
  "AWB Created": TONE.neutral,
  Cancelled: TONE.closed,
  Lost: TONE.closed,
};

/** Dashboard slides A–F, as defined in the FRD */
export const STAGES = [
  { key: "pending", label: "Enquiries Pending to Confirm", hint: "Received, yet to revert with rates", statuses: ["New Enquiry", "Rate Received"] },
  { key: "rates", label: "Rates Yet to Receive", hint: "Forwarded to airlines", statuses: ["Rate Requested"] },
  { key: "quoted", label: "Quotation Pending to Confirm", hint: "Sent to client", statuses: ["Quote Confirmation Pending"] },
  { key: "date", label: "Waiting for Shipment Date", hint: "Rate confirmed, date pending", statuses: ["Waiting for Shipment Date"] },
  { key: "booking", label: "Waiting for Booking Confirmation", hint: "Booking in progress", statuses: ["Booking in Progress"] },
  { key: "booked", label: "Booking Confirmed", hint: "Booked with airline", statuses: ["Booking Confirmed", "Docs Received", "Job Created", "AWB Created"] },
] as const satisfies readonly { key: string; label: string; hint: string; statuses: readonly EnquiryStatus[] }[];

export type StageKey = (typeof STAGES)[number]["key"];

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
