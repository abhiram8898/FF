import type {
  Airline,
  AirlineRate,
  CustomerType,
  Enquiry,
  EnquiryStatus,
  Port,
  Quotation,
  QuotationStatus,
  QuoteLine,
  RefPattern,
  Settings,
  StoredDoc,
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

/** Short form for tight spaces, e.g. "₹2.42L" */
export function moneyShort(n: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(n);
}

/**
 * The Quotation ID follows the Enquiry ID: "EQ: AIS-0005-2026" → "QT: AIS-0005-2026".
 * `enquiryLabel` is the label from Settings → Ref Number, which the user can change.
 */
export function quotationRef(enquiryRef: string, enquiryLabel: string) {
  const body = enquiryLabel && enquiryRef.startsWith(enquiryLabel) ? enquiryRef.slice(enquiryLabel.length) : enquiryRef;
  return `QT: ${body.trim()}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (v: string) => EMAIL_RE.test(v.trim());

/** "a@x.com; b@y.com, c@z.com" → ["a@x.com", "b@y.com", "c@z.com"] */
export const splitEmails = (v: string) =>
  v
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);

export interface RefValues {
  company: string;
  client?: string;
  pol?: string;
  pod?: string;
  year: number | string;
  seq: number;
}

/**
 * Builds a reference number from the pattern chosen in Settings → Ref Number,
 * e.g. parts [company, seq, year] → "EQ: AIS-0005-2026", or [company, pol, seq] with no separator → "AECOK0001".
 */
export function buildRef(pattern: RefPattern, v: RefValues) {
  const value = { ...v, seq: String(v.seq).padStart(pattern.digits, "0"), year: String(v.year) };
  const body = pattern.parts
    .map((p) => value[p])
    .filter(Boolean)
    .join(pattern.separator);
  return `${pattern.label}${body}`;
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

export interface FollowUp {
  kind: "Rate request" | "Quotation";
  enquiry: Enquiry;
  quotation?: Quotation;
  airlineId?: string;
  sentAt: string;
  reminders: number;
  /** When the next reminder is due: last chase + the reminder interval from Settings → Alerts */
  dueAt: string;
}

/** Airline rate requests and sent quotations still waiting on a reply, oldest due first */
export function followUps(enquiries: Enquiry[], quotations: Quotation[], alerts: Settings["alerts"]): FollowUp[] {
  const plus = (iso: string, hours: number) => new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();
  const items: FollowUp[] = [];
  for (const e of enquiries) {
    if (e.status !== "Rate Requested") continue;
    for (const r of e.rateRequests) {
      if (r.repliedAt) continue;
      const last = r.reminders.at(-1) ?? r.sentAt;
      items.push({ kind: "Rate request", enquiry: e, airlineId: r.airlineId, sentAt: r.sentAt, reminders: r.reminders.length, dueAt: plus(last, alerts.rateReminderHours) });
    }
  }
  for (const q of quotations) {
    const e = enquiries.find((x) => x.id === q.enquiryId);
    if (!e || q.status !== "Quote Confirmation Pending" || !q.sentAt) continue;
    const last = q.reminders.at(-1) ?? q.sentAt;
    items.push({ kind: "Quotation", enquiry: e, quotation: q, sentAt: q.sentAt, reminders: q.reminders.length, dueAt: plus(last, alerts.quoteReminderDays * 24) });
  }
  return items.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export const isDue = (f: FollowUp) => f.dueAt <= new Date().toISOString();

/** Date Range filter options shared by the list pages */
export const DATE_RANGES = [
  { key: "all", label: "Date Range", days: 0 },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
] as const;
export type DateRange = (typeof DATE_RANGES)[number]["key"];

/** True when the ISO date falls inside the range ("all" lets everything through) */
export function inRange(iso: string | undefined, range: DateRange) {
  const days = DATE_RANGES.find((r) => r.key === range)!.days;
  if (!days) return true;
  return !!iso && iso.slice(0, 10) >= new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Case-insensitive search across a row's values; an empty term matches everything */
export function matches(term: string, values: (string | number | undefined)[]) {
  const t = term.trim().toLowerCase();
  return !t || values.some((v) => v !== undefined && String(v).toLowerCase().includes(t));
}

/** From the client's confirmation onwards the enquiry is fixed: the quotation and booking are built on it */
const LOCKED_STATUSES: readonly EnquiryStatus[] = ["Waiting for Shipment Date", "Booking in Progress", "Booking Confirmed", "Docs Received", "Job Created", "AWB Created"];
export const isEnquiryLocked = (e: Pick<Enquiry, "status">) => LOCKED_STATUSES.includes(e.status);

/** Mail Box tags: customer mails are new enquiries, airline mails are responses to rate requests */
export const MAIL_TAG = {
  Customer: { label: "New", className: "bg-sky-50 text-sky-800 ring-sky-200" },
  Airline: { label: "Response", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
} as const;

export const CUSTOMER_TYPE_TONE: Record<CustomerType, string> = {
  "Shipper/Receiver": "bg-sky-50 text-sky-800 ring-sky-200",
  "Forwarder/Logistics": "bg-violet-50 text-violet-800 ring-violet-200",
};

/** Enquiry statuses that count as converted into a booking */
export const CONVERTED_STATUSES: readonly EnquiryStatus[] = ["Booking Confirmed", "Docs Received", "Job Created", "AWB Created"];

/** Largest file whose content is kept (localStorage holds only a few MB in total) */
export const MAX_KEPT_FILE = 1024 * 1024;

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Turns picked files into stored documents; files over MAX_KEPT_FILE keep only their name */
export async function toStoredDocs(files: FileList | File[], title = ""): Promise<StoredDoc[]> {
  return Promise.all(
    [...files].map(async (f) => ({
      id: uid(),
      title: title || f.name.replace(/\.[^.]+$/, ""),
      fileName: f.name,
      mime: f.type,
      size: f.size,
      dataUrl: f.size <= MAX_KEPT_FILE ? await readFileAsDataUrl(f) : undefined,
      uploadedAt: new Date().toISOString(),
    })),
  );
}

export function fmtSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? `-${ONES[r % 10]}` : ""}`;
  return [h ? `${ONES[h]} Hundred` : "", rest].filter(Boolean).join(" and ");
}

/** Whole number in words: 961 → "Nine Hundred and Sixty-One" */
export function amountInWords(amount: number) {
  const scales: [number, string][] = [
    [1e9, "Billion"],
    [1e6, "Million"],
    [1e3, "Thousand"],
  ];
  let n = Math.floor(amount);
  const parts: string[] = [];
  for (const [size, name] of scales) {
    if (n >= size) {
      parts.push(`${below1000(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n || !parts.length) parts.push(below1000(n) || "Zero");
  return parts.join(" ");
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
      line({ group: "Agency", particulars: c.particulars, unit: c.unit, qty: c.unit === "Per kg" ? chargeable : 1, rate: c.rate, remarks: c.remarks }),
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

/** Copy of an object without the given keys */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const copy = { ...obj };
  for (const k of keys) delete copy[k];
  return copy;
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
