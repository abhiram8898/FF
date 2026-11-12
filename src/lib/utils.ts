import type {
  Airline,
  AirlineRate,
  AwbStatus,
  Bill,
  BillLine,
  BillStatus,
  Customer,
  CustomerType,
  Enquiry,
  EnquiryStatus,
  InvoiceStatus,
  JobStatus,
  Port,
  Quotation,
  QuotationStatus,
  QuoteLine,
  RefPattern,
  ReservationStatus,
  Settings,
  StoredDoc,
  User,
} from "./types";
import { CUSTOMER_TYPES, JOB_STATUSES } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** Local calendar date as YYYY-MM-DD (not UTC: in India a UTC date is still "yesterday" until 05:30) */
export const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const today = () => localDate(new Date());

export function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
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

/** 2-decimal number in Indian grouping: 339822.3 → "3,39,822.30" */
export const f2 = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function money(n: number, currency = "INR") {
  return `${currency} ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Short form for tight spaces, e.g. "₹2.42L" */
export function moneyShort(n: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(n);
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
  branch?: string;
  pol?: string;
  pod?: string;
  year: number | string;
  seq: number;
}

/**
 * Builds a reference number from the pattern chosen in Settings → Ref Number Format,
 * e.g. label "QUO" with parts [company, branch, seq, year] → "QUO-AIS-COK-0005-2026".
 * A label ending in a space or ": " is followed directly by the number ("EQ: AIS-0005-2026").
 */
export function buildRef(pattern: RefPattern, v: RefValues) {
  const value = { ...v, seq: String(v.seq).padStart(pattern.digits, "0"), year: String(v.year) };
  const body = pattern.parts
    .map((p) => value[p])
    .filter(Boolean)
    .join(pattern.separator);
  if (!pattern.label) return body;
  return /[\s:\-/]$/.test(pattern.label) ? `${pattern.label}${body}` : `${pattern.label}${pattern.separator || "-"}${body}`;
}

/** First number in a free-text rate such as "1,250" or "280+10+6" (0 when there is none) */
export const parseRate = (v: string) => Number(v.replace(/,/g, "").split("+")[0].trim()) || 0;

/**
 * A web address that is safe to open: http(s) only. A bare "www.x.com" gets https://; anything else
 * (javascript:, data:, relative paths) becomes "".
 */
export function safeHttpUrl(v: string) {
  const t = v.trim();
  if (!t) return "";
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}

/** Branch code for reference numbers, falling back to the first letters of the name */
export const branchCode = (s: Settings, branch?: string) => {
  const b = s.branches.find((x) => x.name === branch) ?? s.branches[0];
  return b?.code || b?.name.slice(0, 3).toUpperCase() || "";
};

/** The default financial year, or the last one listed */
export const defaultFy = (s: Settings) => (s.financialYears.find((f) => f.isDefault) ?? s.financialYears.at(-1))?.name ?? "";

export const userName = (u: Pick<User, "firstName" | "lastName">) => `${u.firstName} ${u.lastName}`.trim();
/** Active users' names, for Sales / Operations / Pricing person dropdowns */
export const userNames = (s: Settings) => s.users.filter((u) => u.active).map(userName);

/** "Address 1, Address 2, City, State, Postal Code, Country" with empty parts left out */
export const joinAddress = (parts: (string | undefined)[]) => parts.map((p) => p?.trim()).filter(Boolean).join(", ");

/** Stakeholders that can place enquiries and be billed */
export const customersOnly = (all: Customer[]) => all.filter((c) => (CUSTOMER_TYPES as readonly string[]).includes(c.type) && c.status !== "Inactive");

/** KOCHI-COK-INDIA */
export function fmtPort(p?: Port) {
  return p ? `${p.name}-${p.code}-${p.country}`.toUpperCase() : "";
}

/** Volume in CBM: packages × L × W × H (cm) / 1,000,000 */
export function volumeCbm(e: Pick<Enquiry, "packages" | "length" | "width" | "height">) {
  return round4((e.packages * e.length * e.width * e.height) / 1_000_000);
}

/** Volumetric weight in kg: packages × L × W × H (cm) / divisor (IATA: 6000, configurable in Settings) */
export function volumetricWeight(e: Pick<Enquiry, "packages" | "length" | "width" | "height">, divisor = 6000) {
  return round2((e.packages * e.length * e.width * e.height) / (divisor || 6000));
}

/**
 * Suggested chargeable weight: the higher of gross and volumetric weight,
 * rounded up to the step set in Settings (e.g. 0.5 kg). 100 kg gross / 125 kg volumetric → 125 kg.
 */
export function suggestedChargeable(e: Pick<Enquiry, "grossWeight" | "packages" | "length" | "width" | "height">, s: Pick<Settings, "volumetricDivisor" | "weightRounding">) {
  const higher = Math.max(e.grossWeight || 0, volumetricWeight(e, s.volumetricDivisor));
  return s.weightRounding > 0 ? round2(Math.ceil(higher / s.weightRounding - 1e-9) * s.weightRounding) : round2(higher);
}

/** Rate per kg for a weight: the highest weight break reached, else the N rate */
export function rateForWeight(r: Pick<AirlineRate, "ratePerKg" | "slabs">, kg: number) {
  const slab = [...(r.slabs ?? [])].sort((a, b) => b.minKg - a.minKg).find((x) => x.rate > 0 && kg >= x.minKg);
  return slab?.rate ?? r.ratePerKg;
}

/** Indicative total = higher of (chargeable weight × rate/kg) or minimum charge, plus AWB fee and other charges */
export function estimatedTotal(r: AirlineRate, chargeable: number) {
  return round2(Math.max(chargeable * rateForWeight(r, chargeable), r.minCharge) + r.awbFee + (r.otherCharges ?? 0));
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

/** Job stages after the AWB is executed and before the documents reach the CHA */
export const DOCUMENT_STAGE_STATUSES: readonly JobStatus[] = ["Pending Documents", "Documents Uploaded", "CHA Dispatch Pending"];

/** Statuses reached once a Booking/Job exists */
export const JOB_STAGE_STATUSES: readonly EnquiryStatus[] = JOB_STATUSES.filter((s) => s !== "Cancelled");

/** From the client's confirmation onwards the enquiry is fixed: the quotation and booking are built on it */
const LOCKED_STATUSES: readonly EnquiryStatus[] = ["Waiting for Shipment Date", "Booking in Progress", "Booking Confirmed", ...JOB_STAGE_STATUSES];
export const isEnquiryLocked = (e: Pick<Enquiry, "status">) => LOCKED_STATUSES.includes(e.status);

/** Mail Box tags: customer mails are new enquiries, airline mails are responses to rate requests */
export const MAIL_TAG = {
  Customer: { label: "New", className: "bg-sky-50 text-sky-800 ring-sky-200" },
  Airline: { label: "Response", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
} as const;

export const CUSTOMER_TYPE_TONE: Record<CustomerType, string> = {
  Logistics: "bg-violet-50 text-violet-800 ring-violet-200",
  "Freight Forwarders": "bg-indigo-50 text-indigo-800 ring-indigo-200",
  Shipper: "bg-sky-50 text-sky-800 ring-sky-200",
  Consignee: "bg-teal-50 text-teal-800 ring-teal-200",
  Vendors: "bg-slate-100 text-slate-700 ring-slate-200",
  Agents: "bg-amber-50 text-amber-800 ring-amber-200",
  CHA: "bg-rose-50 text-rose-800 ring-rose-200",
};

/** Enquiry statuses that count as converted into a booking */
export const CONVERTED_STATUSES: readonly EnquiryStatus[] = ["Booking Confirmed", ...JOB_STAGE_STATUSES];

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

/** Indian numbering: 339822 → "Three Lakhs Thirty-Nine Thousand Eight Hundred and Twenty-Two" */
export function amountInWordsIndian(amount: number) {
  const scales: [number, string, string][] = [
    [1e7, "Crore", "Crores"],
    [1e5, "Lakh", "Lakhs"],
    [1e3, "Thousand", "Thousand"],
  ];
  let n = Math.floor(Math.abs(amount));
  const parts: string[] = [];
  for (const [size, one, many] of scales) {
    if (n >= size) {
      const k = Math.floor(n / size);
      parts.push(`${amountInWordsIndian(k)} ${k === 1 ? one : many}`);
      n %= size;
    }
  }
  if (n || !parts.length) parts.push(below1000(n) || "Zero");
  return `${amount < 0 ? "Minus " : ""}${parts.join(" ")}`;
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
  const perKg = rate ? rateForWeight(rate, chargeable) : 0;
  const freight =
    rate && chargeable * perKg < rate.minCharge
      ? line({ group: "Airline", particulars: "AIR FREIGHT CHARGES (MINIMUM)", unit: "Per shipment", qty: 1, rate: rate.minCharge })
      : line({ group: "Airline", particulars: "AIR FREIGHT CHARGES", unit: "Per kg", qty: chargeable, rate: perKg });
  return [
    freight,
    line({ group: "Airline", particulars: "AIRWAY BILL FEES - AWA", unit: "Per shipment", qty: 1, rate: rate?.awbFee ?? 0 }),
    ...(rate?.otherCharges ? [line({ group: "Airline", particulars: "OTHER CHARGES", unit: "Per shipment", qty: 1, rate: rate.otherCharges })] : []),
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

/** Progress steps shown on the enquiry page (FRD: Add Enquiry → … → Complete) */
export const STEPS = [
  "Enquiry",
  "Airline Rates",
  "Quotation",
  "Client Confirmation",
  "Shipment Date",
  "Booking",
  "Job",
  "AWB",
  "Upload Documents",
  "Merge Documents",
  "Dispatch to CHA",
  "Complete",
] as const;

const STEP_INDEX: Record<EnquiryStatus, number> = {
  "New Enquiry": 1,
  "Rate Requested": 1,
  "Rate Received": 2,
  "Quote Confirmation Pending": 3,
  "Waiting for Shipment Date": 4,
  "Booking in Progress": 5,
  "Booking Confirmed": 6,
  "AWB In Progress": 7,
  "Pending Documents": 8,
  "Documents Uploaded": 9,
  "CHA Dispatch Pending": 10,
  "Booking Completed": 11,
  Departed: 12,
  "Cargo In Transit": 12,
  "On Hold": -1,
  Cancelled: -1,
  Lost: -1,
};

/** Index of the step in progress; earlier steps are complete. -1 when cancelled, lost or on hold. */
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
  "AWB In Progress": TONE.action,
  "Pending Documents": TONE.action,
  "Documents Uploaded": TONE.action,
  "CHA Dispatch Pending": TONE.action,
  "Booking Completed": TONE.done,
  Departed: TONE.done,
  "Cargo In Transit": TONE.done,
  "On Hold": TONE.waiting,
  Cancelled: TONE.closed,
  Lost: TONE.closed,
};

export const RESERVATION_TONE: Record<ReservationStatus, string> = {
  Draft: TONE.neutral,
  Reserved: TONE.new,
  "Ready for Booking": TONE.action,
  "Booking In Progress": TONE.waiting,
  "Booking Confirmed": TONE.done,
  "On Hold": TONE.waiting,
  Rescheduled: TONE.new,
  Cancelled: TONE.closed,
  Departed: TONE.done,
};

export const AWB_TONE: Record<AwbStatus, string> = {
  Draft: TONE.neutral,
  "Draft AWB Send": TONE.waiting,
  "AWB Executed": TONE.done,
  Cancelled: TONE.closed,
};

export const INVOICE_TONE: Record<InvoiceStatus, string> = {
  Draft: TONE.neutral,
  "Awaiting Confirmation": TONE.waiting,
  Generated: TONE.action,
  Completed: TONE.done,
  Cancelled: TONE.closed,
};

export const BILL_TONE: Record<BillStatus, string> = {
  Draft: TONE.neutral,
  "Proforma INV Send": TONE.waiting,
  Approved: TONE.done,
  "Sent / Issued": TONE.new,
  Overdue: TONE.closed,
  "Partially Paid": TONE.waiting,
  Paid: TONE.done,
  Issued: TONE.done,
  Cancelled: TONE.closed,
};

/** Dashboard slides A–H, as defined in the FRD */
export const STAGES = [
  { key: "pending", label: "Enquiries Pending to Complete", hint: "Received, yet to revert with rates", statuses: ["New Enquiry", "Rate Received"] },
  { key: "rates", label: "Rates Yet to Receive", hint: "Forwarded to airlines", statuses: ["Rate Requested"] },
  { key: "quoted", label: "Quotation Pending to Confirm", hint: "Sent to client", statuses: ["Quote Confirmation Pending"] },
  { key: "date", label: "Waiting for Shipment Date", hint: "Quotation approved, date pending", statuses: ["Waiting for Shipment Date"] },
  { key: "booking", label: "Waiting for Booking Confirmation", hint: "Date confirmed, airline to confirm", statuses: ["Booking in Progress"] },
  { key: "booked", label: "Booking Confirmed", hint: "Flight booked", statuses: ["Booking Confirmed"] },
  { key: "awb", label: "AWB Pending", hint: "Job created, AWB not executed", statuses: ["AWB In Progress"] },
  { key: "docs", label: "Document Upload Pending", hint: "Upload, merge & dispatch to CHA", statuses: ["Pending Documents", "Documents Uploaded", "CHA Dispatch Pending"] },
] as const satisfies readonly { key: string; label: string; hint: string; statuses: readonly EnquiryStatus[] }[];

export type StageKey = (typeof STAGES)[number]["key"];

/** Line value in INR: qty × rate × exchange rate */
export const billLineValue = (l: BillLine) => round2(l.qty * l.rate * (l.exRate || 1));

/**
 * Bill totals. IGST bills carry each line's whole GST rate as IGST; CGST+SGST bills split it in half.
 * The total is rounded to the nearest rupee and the difference shown as Round Off.
 */
export function billTotals(b: Pick<Bill, "lines" | "taxMode" | "gstPercent" | "payments">) {
  const taxable = round2(b.lines.filter((l) => l.taxable).reduce((s, l) => s + billLineValue(l), 0));
  const nonTaxable = round2(b.lines.filter((l) => !l.taxable).reduce((s, l) => s + billLineValue(l), 0));
  // Each line carries its own rate, so a 5% line stays at 5% next to 18% lines
  const gst = round2(b.lines.reduce((s, l) => s + billLineTax(l, b.gstPercent), 0));
  const igst = b.taxMode === "IGST" ? gst : 0;
  const cgst = b.taxMode === "IGST" ? 0 : round2(gst / 2);
  const sgst = b.taxMode === "IGST" ? 0 : round2(gst - cgst);
  const exact = round2(taxable + nonTaxable + igst + cgst + sgst);
  // Round half away from zero so a credit note mirrors its invoice exactly (-1180.5 → -1181, like 1180.5 → 1181)
  const total = Math.sign(exact) * Math.round(Math.abs(exact));
  const received = round2(b.payments.reduce((s, p) => s + p.amount, 0));
  return { taxable, nonTaxable, igst, cgst, sgst, exact, roundOff: round2(total - exact), total, received, balance: round2(total - received) };
}

/**
 * Bills that can no longer be edited. An issued tax invoice is final (GST): corrections go through
 * cancelling it, which raises a credit note, and approving a fresh proforma.
 */
export const isBillLocked = (b: Pick<Bill, "kind" | "status">) =>
  b.kind === "Invoice" || b.status === "Cancelled" || b.status === "Approved" || (b.kind === "Credit Note" && b.status === "Issued");

/** GST per line, for the printed bill */
export const billLineTax = (l: BillLine, billGst: number) => round2((billLineValue(l) * billLineRate(l, billGst)) / 100);

/** GST rate of a bill line: its own rate, or the bill's for older bills; 0 when not taxable */
export const billLineRate = (l: BillLine, billGst: number) => (l.taxable ? (l.gstPercent ?? billGst) : 0);

/** Copy of an object without the given keys */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const copy = { ...obj };
  for (const k of keys) delete copy[k];
  return copy;
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ---- Mail bodies: plain text (older mails) or HTML from the rich-text editor ----

/** True when a mail body was written in the rich-text editor */
export const isHtml = (s: string) => /^\s*<(p|div|h[1-6]|ul|ol|blockquote|img|br|table)[\s>/]/i.test(s);

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Plain text → paragraphs, keeping line breaks */
export const textToHtml = (s: string) =>
  s
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

/** HTML → plain text for search and previews */
export const htmlToText = (s: string) =>
  isHtml(s)
    ? s
        .replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .trim()
    : s;
