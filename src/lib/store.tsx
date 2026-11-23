"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { createSeed } from "./seed";
import type {
  Airline,
  AirlineRate,
  Awb,
  AwbStatus,
  BankDetails,
  Bill,
  BillLine,
  BillStatus,
  Booking,
  Channel,
  Currency,
  Customer,
  CustomerInvoice,
  Draft,
  EmailKind,
  Enquiry,
  EnquiryStatus,
  InboxEmail,
  InvoiceStatus,
  Job,
  JobStatus,
  MailDraft,
  MergedDocs,
  NotificationEvent,
  Quotation,
  QuotationStatus,
  Reservation,
  ReservationStatus,
  Settings,
  State,
  StoredDoc,
} from "./types";
import { JOB_STATUSES, NOTIFICATION_EVENTS, QUOTATION_STATUSES } from "./types";
import { DOCUMENT_STAGE_STATUSES, addDays, awbLabel, awbNumber, billTotals, branchCode, buildQuoteLines, buildRef, fmtPort, isBillLocked, isHtml, joinAddress, omit, parseRate, round2, safeHttpUrl, textToHtml, today, uid, airlineEmailFor } from "./utils";
import { PageLoader } from "@/components/ui";

// Bumped when the saved data's shape changes, so old demo data is reseeded
const STORAGE_KEY = "freighttask:v6";

/** Brings data saved by an older version up to date */
export function migrate(s: State): State {
  // One bank account → a list of accounts (Company Set up → Bank Account)
  const settings = s.settings as State["settings"] & { bank?: BankDetails };
  if (!Array.isArray(settings.banks)) {
    const { bank, ...rest } = settings;
    s = { ...s, settings: { ...rest, banks: bank ? [{ ...bank, id: uid(), isDefault: true }] : [] } };
  }
  // House AWB number format and counters added later
  if (!s.settings.hawbRef) s = { ...s, settings: { ...s.settings, hawbRef: { label: "", auto: true, parts: ["company", "branch", "seq"], separator: "-", digits: 5 } } };
  if (s.counters.hawb === undefined || s.counters.creditNote === undefined) s = { ...s, counters: { ...s.counters, hawb: s.counters.hawb ?? 0, creditNote: s.counters.creditNote ?? 0 } };
  // The single "Invoice Details" text on an AWB became Invoice Number + Invoice Date
  if (s.awbs.some((a) => a.invoiceNo === undefined)) s = { ...s, awbs: s.awbs.map((a) => (a.invoiceNo === undefined ? { ...a, invoiceNo: a.invoiceDetails, invoiceDate: "" } : a)) };
  // Renamed job stages (enquiries mirror them): documents now go to the shipper as a pre-alert, and the
  // stage after the AWB is executed names both what happened and what is next
  const RENAMED: Record<string, JobStatus> = { "CHA Dispatch Pending": "Pre-alert Pending", "Pending Documents": "AWB Executed, Pending Documents" };
  if (s.jobs.some((j) => j.status in RENAMED)) s = { ...s, jobs: s.jobs.map((j) => (j.status in RENAMED ? { ...j, status: RENAMED[j.status] } : j)) };
  if (s.enquiries.some((e) => e.status in RENAMED)) s = { ...s, enquiries: s.enquiries.map((e) => (e.status in RENAMED ? { ...e, status: RENAMED[e.status] } : e)) };
  return s;
}

/** Removes the saved workspace so the next load starts from the demo data (used when the app can't start) */
export function clearSavedData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage blocked: nothing saved to clear */
  }
}

export type EnquiryInput = Omit<Enquiry, "id" | "no" | "ref" | "createdAt" | "status" | "statusAt" | "rateRequests">;
export type RateInput = Omit<AirlineRate, "id" | "createdAt">;
export type JobInput = Omit<Job, "id" | "ref" | "createdAt" | "statusAt" | "uploadCompletedAt" | "merged" | "dispatchedAt">;
export type InvoiceInput = Omit<CustomerInvoice, "id" | "createdAt" | "status" | "statusAt" | "sentAt">;
export type AwbInput = Omit<Awb, "id" | "status" | "statusAt" | "createdAt" | "sentAt">;
export type CustomerInput = Omit<Customer, "id" | "address" | "contact" | "createdAt">;
export type ReservationInput = Omit<Reservation, "id" | "ref" | "createdAt" | "status" | "statusAt" | "history" | "previousDates" | "seriesId" | "jobId">;
/** Which occurrences of a recurring reservation an edit or cancel applies to */
export type SeriesScope = "one" | "future" | "series";

interface Toast {
  id: string;
  message: string;
}

const now = () => new Date().toISOString();
// Dates are local YYYY-MM-DD strings, so the year is their first 4 characters
const yearOf = (date?: string) => (date || today()).slice(0, 4);

/** A Booking/Job pre-filled from the confirmed quotation and its enquiry */
export function jobDraft(s: State, enq: Enquiry, q: Quotation): JobInput {
  const cust = s.customers.find((c) => c.id === enq.customerId);
  const airline = s.airlines.find((a) => a.id === q.airlineId);
  return {
    enquiryId: enq.id,
    quotationId: q.id,
    status: "AWB In Progress",
    date: today(),
    branch: enq.branch,
    customerId: enq.customerId,
    // A shipper customer usually ships their own cargo; forwarders name the shipper per booking
    shipperId: cust?.type === "Shipper" ? cust.id : undefined,
    shipperName: cust?.type === "Shipper" ? cust.name : "",
    pol: enq.pol,
    pod: enq.pod,
    bookingRef: enq.booking?.ref ?? "",
    awbNo: "",
    flightDate: enq.booking?.flightDate ?? enq.shipmentDate ?? "",
    flightNo: enq.booking?.flightNo ?? "",
    stock: "",
    weight: enq.chargeableWeight,
    boxes: enq.packages,
    commodity: enq.commodity.toUpperCase(),
    offload: "",
    chaName: "",
    chaEmail: "",
    rate: "",
    invoiceNo: s.invoices.find((i) => i.enquiryId === enq.id && i.status !== "Cancelled")?.no ?? "",
    tsp: "",
    loading: "",
    month: enq.booking?.flightDate ?? "",
    iataCode: airline?.code ?? "",
    airlineId: q.airlineId,
    years: yearOf(),
    duty: "",
    tspAdditional: "",
    loadingAdditional: "",
    bookingInfo: enq.booking ? `Booking ref ${enq.booking.ref}` : "",
    additional1: "",
    additional2: "",
    documents: enq.documents ?? [],
  };
}

/** A Booking/Job from a reservation whose booking is confirmed, without copying the reservation itself */
export function jobFromReservation(s: State, r: Reservation): JobInput {
  const airline = s.airlines.find((a) => a.id === r.airlineId);
  return {
    reservationId: r.id,
    status: "AWB In Progress",
    date: today(),
    branch: r.branch,
    customerId: r.customerId,
    shipperId: r.shipperId,
    shipperName: r.shipperName,
    pol: r.pol,
    pod: r.pod,
    bookingRef: r.booking?.ref ?? "",
    awbNo: r.awbNo,
    flightDate: r.booking?.flightDate || r.flightDate || r.shipmentDate,
    flightNo: r.booking?.flightNo || r.flightNo,
    stock: "",
    weight: r.chargeableWeight,
    boxes: r.packages,
    commodity: r.commodity.toUpperCase(),
    offload: "",
    chaName: "",
    chaEmail: "",
    rate: "",
    invoiceNo: "",
    tsp: "",
    loading: "",
    month: r.shipmentDate,
    iataCode: airline?.code ?? "",
    airlineId: r.airlineId,
    years: yearOf(r.shipmentDate),
    duty: "",
    tspAdditional: "",
    loadingAdditional: "",
    bookingInfo: r.booking ? `Booking ref ${r.booking.ref}` : "",
    additional1: "",
    additional2: "",
    documents: r.booking?.documents ?? [],
  };
}

const customerCode = (s: State, id?: string) => s.customers.find((c) => c.id === id)?.code;

/** Next quotation number (Settings → Ref Number Format → Quote Number) */
export function nextQuoteRef(s: State, branch?: string) {
  return buildRef(s.settings.quoteRef, { company: s.settings.refPrefix, branch: branchCode(s.settings, branch), year: yearOf(), seq: s.counters.quote + 1 });
}

/** Next Booking/Job number (Settings → Ref Number Format → Job Number) */
export function nextJobRef(s: State, data: Pick<JobInput, "customerId" | "pol" | "pod" | "date" | "branch">) {
  return buildRef(s.settings.jobRef, {
    company: s.settings.refPrefix,
    client: customerCode(s, data.customerId),
    branch: branchCode(s.settings, data.branch),
    pol: data.pol,
    pod: data.pod,
    year: yearOf(data.date),
    seq: s.counters.job + 1,
  });
}

/** House AWB number for "HAWB by Own" (Settings → Ref Number Format → House AWB Number); offset for several at once */
export function nextHawbNo(s: State, branch?: string, offset = 1) {
  return buildRef(s.settings.hawbRef, { company: s.settings.refPrefix, branch: branchCode(s.settings, branch), year: yearOf(), seq: s.counters.hawb + offset });
}

/**
 * A credit note raised by hand for a job: invoice pattern with CN in place of INV. Credit notes made when an
 * invoice is cancelled share the pattern, so numbers already on a bill are skipped. seq is the counter to store.
 */
export function nextCreditNoteNo(s: State, data: { customerId: string; branch: string }) {
  const p = { ...s.settings.invoiceRef, label: "CN" };
  const parts = { company: s.settings.refPrefix, client: customerCode(s, data.customerId), branch: branchCode(s.settings, data.branch), year: yearOf() };
  for (let seq = s.counters.creditNote + 1; ; seq++) {
    const no = buildRef(p, { ...parts, seq });
    if (!s.bills.some((b) => b.no === no)) return { no, seq };
  }
}

/** Everything an AWB needs before it can be executed (number-only HAWBs are saved incomplete) */
export const awbMissing = (a: Pick<Awb, "type" | "hawbNo" | "mawbNo" | "shipper" | "consignee" | "legs">) =>
  [
    !awbNumber(a).trim() && "AWB number",
    // "157-" (only the airline prefix) is not a MAWB yet
    a.type === "House" && !a.mawbNo.replace(/^\s*\d{3}\s*-?/, "").trim() && "MAWB number",
    !a.shipper.trim() && "shipper",
    !a.consignee.trim() && "consignee",
    !a.legs[0]?.flightNo?.trim() && "first flight",
  ].filter(Boolean) as string[];

export function nextReservationRef(s: State, data: Pick<ReservationInput, "customerId" | "branch" | "shipmentDate" | "pol" | "pod">, offset = 1) {
  return buildRef(s.settings.reservationRef, {
    company: s.settings.refPrefix,
    client: customerCode(s, data.customerId),
    branch: branchCode(s.settings, data.branch),
    pol: data.pol,
    pod: data.pod,
    year: yearOf(data.shipmentDate),
    seq: s.counters.reservation + offset,
  });
}

/** Proforma "PINV-…" and tax invoice "INV-…" numbers share the invoice pattern; credit notes swap INV for CN */
export function nextBillNo(s: State, kind: "Proforma" | "Invoice", data: { customerId: string; branch: string; date?: string }) {
  const p = s.settings.invoiceRef;
  const pattern = kind === "Proforma" ? { ...p, label: `P${p.label || "INV"}${p.separator || "-"}` } : p;
  return buildRef(pattern, {
    company: s.settings.refPrefix,
    client: customerCode(s, data.customerId),
    branch: branchCode(s.settings, data.branch),
    year: yearOf(data.date),
    seq: (kind === "Proforma" ? s.counters.proforma : s.counters.invoice) + 1,
  });
}

export const creditNoteNo = (invoiceNo: string) => (/^INV/.test(invoiceNo) ? invoiceNo.replace(/^INV/, "CN") : `CN-${invoiceNo}`);

/** Same state as the company → CGST + SGST; otherwise IGST */
const taxModeFor = (s: State, customerId: string): Bill["taxMode"] => {
  const c = s.customers.find((x) => x.id === customerId);
  return c?.state && s.settings.company.state && c.state.toLowerCase() === s.settings.company.state.toLowerCase() ? "CGST+SGST" : "IGST";
};

/** Proforma pre-filled from the job, its AWB, quotation and customer (FRD X.6) */
export function proformaDraft(s: State, job: Job): Omit<Bill, "id" | "no" | "createdAt" | "status" | "statusAt"> {
  const cust = s.customers.find((c) => c.id === job.customerId);
  const shipper = s.customers.find((c) => c.id === job.shipperId);
  const awbs = s.awbs.filter((a) => a.jobId === job.id && a.status !== "Cancelled").sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  const awb = awbs[0];
  const houses = awbs.filter((a) => a.type === "House");
  const houseNos = houses.filter((a) => a.hawbNo);
  // Several HAWBs under one MAWB: the bill covers all of them (a Master AWB alongside them repeats their totals)
  const counted = houses.length ? houses : awbs;
  const sum = (k: "grossWeight" | "chargeableWeight" | "pieces") => (counted.length ? round2(counted.reduce((t, a) => t + (Number(a[k]) || 0), 0)) : undefined);
  const q = s.quotations.find((x) => x.id === job.quotationId);
  const airline = s.airlines.find((a) => a.id === job.airlineId);
  const inv = s.invoices.find((i) => i.jobId === job.id && i.status !== "Cancelled");
  const port = (code: string) => fmtPort(s.ports.find((p) => p.code === code)) || code;
  const sacFor = (particulars: string, group: string) =>
    s.settings.agencyCharges.find((c) => c.particulars === particulars)?.sac ?? (group === "Airline" ? "996531" : "996712");
  const lines: BillLine[] = q
    ? q.lines.map((l) => ({
        id: uid(),
        particulars: l.particulars,
        sac: sacFor(l.particulars, l.group),
        qty: l.qty,
        rate: l.rate + l.markup,
        currency: q.currency,
        exRate: q.roe,
        taxable: l.gstPercent > 0,
        gstPercent: l.gstPercent,
      }))
    : [{ id: uid(), particulars: "AIR FREIGHT CHARGES", sac: "996531", qty: job.weight, rate: parseRate(job.rate), currency: "INR", exRate: 1, taxable: true, gstPercent: s.settings.gstPercent }];
  return {
    kind: "Proforma",
    date: today(),
    jobId: job.id,
    customerId: job.customerId,
    branch: job.branch,
    to: [cust?.name, cust?.address, cust?.gstin && `GST NO: ${cust.gstin}`, cust?.pan && `PAN NO: ${cust.pan}`].filter(Boolean).join("\n"),
    exporter: [shipper?.name ?? job.shipperName, shipper?.address].filter(Boolean).join("\n"),
    consignee: awb?.consignee.split("\n")[0] ?? "",
    mawbNo: awb?.mawbNo || job.awbNo,
    mawbDate: awb?.mawbDate ?? "",
    hawbNo: houseNos.map((h) => h.hawbNo).join(", "),
    hawbDate: houseNos[0]?.hawbDate ?? "",
    pol: port(job.pol),
    pod: port(job.pod),
    shipmentType: "Air Cargo",
    airlineFlight: [airline?.name.toUpperCase(), job.flightNo].filter(Boolean).join(" / "),
    etd: job.flightDate,
    eta: job.flightDate,
    commodity: job.commodity,
    jobNo: job.ref,
    jobDate: job.date,
    sbNo: "",
    sbDate: "",
    invoiceNo: inv?.no ?? job.invoiceNo,
    invoiceDate: inv?.date ?? "",
    grossWeight: sum("grossWeight") ?? job.weight,
    chWeight: sum("chargeableWeight") ?? job.weight,
    packages: sum("pieces") ?? job.boxes,
    lines,
    taxMode: taxModeFor(s, job.customerId),
    gstPercent: s.settings.gstPercent,
    notes: s.settings.invoiceNotes,
    dueDate: addDays(30),
    payments: [],
  };
}

/**
 * Dates of a recurring reservation's occurrences. The series stops at the end date or after
 * the number of occurrences, whichever comes first.
 */
export function occurrenceDates(r: NonNullable<Reservation["recurrence"]>) {
  const out: string[] = [];
  if (!r.startDate) return out;
  const start = new Date(`${r.startDate}T00:00:00Z`);
  // Without an end date, a count of occurrences or a year from the start date ends the series
  const end = r.endDate ? new Date(`${r.endDate}T00:00:00Z`) : new Date(start.getTime() + 365 * 86_400_000);
  const max = r.occurrences > 0 ? r.occurrences : 120;
  for (let d = new Date(start); d <= end && out.length < max; d.setUTCDate(d.getUTCDate() + 1)) {
    const ok =
      r.type === "Daily" ||
      (r.type === "Weekly" && (r.repeatOn.length ? r.repeatOn : [start.getUTCDay()]).includes(d.getUTCDay())) ||
      (r.type === "Monthly" && (r.repeatOn.length ? r.repeatOn : [start.getUTCDate()]).includes(d.getUTCDate()));
    if (ok) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const patchEnquiry = (s: State, id: string, patch: Partial<Enquiry>): State => ({
  ...s,
  enquiries: s.enquiries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
});

const patchQuotation = (s: State, id: string, patch: Partial<Quotation>): State => ({
  ...s,
  quotations: s.quotations.map((q) => (q.id === id ? { ...q, ...patch } : q)),
});

const patchJob = (s: State, id: string, patch: Partial<Job>): State => ({
  ...s,
  jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
});

const patchAwb = (s: State, id: string, patch: Partial<Awb>): State => ({
  ...s,
  awbs: s.awbs.map((a) => (a.id === id ? { ...a, ...patch } : a)),
});

const patchBill = (s: State, id: string, patch: Partial<Bill>): State => ({
  ...s,
  bills: s.bills.map((b) => (b.id === id ? { ...b, ...patch } : b)),
});

const patchInvoice = (s: State, id: string, patch: Partial<CustomerInvoice>): State => ({
  ...s,
  invoices: s.invoices.map((i) => (i.id === id ? { ...i, ...patch } : i)),
});

/** Sets the enquiry status and keeps its quotation's status in step (they share the earlier statuses) */
function setStatus(s: State, enquiryId: string, status: EnquiryStatus): State {
  const enq = s.enquiries.find((e) => e.id === enquiryId);
  if (!enq) return s;
  let next = patchEnquiry(s, enquiryId, { status, statusAt: now() });
  if (enq.quotationId && (QUOTATION_STATUSES as readonly string[]).includes(status)) {
    next = patchQuotation(next, enq.quotationId, { status: status as QuotationStatus, statusAt: now() });
  }
  return next;
}

function useStoreState() {
  const { user } = useAuth();
  const [state, setState] = useState<State | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Actions read and write through this ref so that back-to-back calls see each other's changes.
  const ref = useRef<State | null>(null);
  const actor = useRef("System");
  const storageWarned = useRef(false);
  useEffect(() => {
    actor.current = user?.name ?? "System";
  }, [user]);

  useEffect(() => {
    let loaded: State | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) loaded = JSON.parse(raw) as State;
    } catch {
      /* ignore corrupt storage */
    }
    ref.current = loaded ? migrate(loaded) : createSeed();
    setState(ref.current);
  }, []);

  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageWarned.current = false;
    } catch {
      // Usually the browser's storage quota: uploaded files are the big items
      if (!storageWarned.current) {
        storageWarned.current = true;
        setToasts((t) => [...t, { id: uid(), message: "Browser storage is full. Recent changes won't survive a reload. Remove some uploaded files." }]);
      }
    }
  }, [state]);

  const toast = useCallback((message: string) => {
    const id = uid();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const actions = useMemo(() => {
    const get = () => ref.current!;
    const commit = (next: State) => {
      ref.current = next;
      setState(next);
    };
    type Refs = { enquiryId?: string; jobId?: string; reservationId?: string };

    const withLog = (s: State, kind: EmailKind, mail: MailDraft, refs: Refs = {}, attachments: string[] = []): State => ({
      ...s,
      emailLogs: [
        {
          id: uid(),
          at: now(),
          kind,
          ...mail,
          body: isHtml(mail.body) ? `${mail.body}${textToHtml(s.settings.company.signature)}` : `${mail.body}\n\n${s.settings.company.signature}`,
          attachments,
          ...refs,
        },
        ...s.emailLogs,
      ],
    });

    /** Settings → Email Notifications: an internal alert, copied to the branch's recipients when that's on */
    const withAlert = (s: State, event: NotificationEvent, detail: string, refs: Refs & { branch?: string } = {}): State => {
      const cfg = s.settings.notifications;
      const ev = cfg.events[event];
      if (!cfg.enabled || !ev?.enabled || !ev.to.trim()) return s;
      const { branch, ...links } = refs;
      const branchCc = s.settings.branchEmails.enabled ? (s.settings.branchEmails.rows.find((r) => r.branch === branch)?.emails ?? []) : [];
      return withLog(
        s,
        "Team Alert",
        { to: [ev.to], cc: [ev.cc, ...branchCc].filter(Boolean).join("; "), bcc: "", subject: `${NOTIFICATION_EVENTS[event]}: ${detail}`, body: detail },
        links,
      );
    };

    /** Audit trail entry for master data changes */
    const withAudit = (s: State, action: string, detail?: string): State => ({
      ...s,
      audit: [{ at: now(), by: actor.current, action, detail }, ...s.audit].slice(0, 500),
    });

    /** Adds an instant client notification for the enquiry's customer */
    const withNotification = (s: State, enquiryId: string, message: string, channel: Channel = "WhatsApp"): State => {
      const enq = s.enquiries.find((e) => e.id === enquiryId);
      const customer = s.customers.find((c) => c.id === enq?.customerId);
      const to = channel === "Email" ? customer?.email ?? "" : customer?.phone ?? "";
      toast(`${channel} notification sent to ${customer?.name ?? "customer"}`);
      return {
        ...s,
        notifications: [{ id: uid(), at: now(), enquiryId, to, channel, message }, ...s.notifications],
      };
    };

    const patchReservation = (s: State, id: string, patch: Partial<Reservation>, action?: string, detail?: string): State => ({
      ...s,
      reservations: s.reservations.map((r) =>
        r.id === id
          ? {
              ...r,
              ...patch,
              ...(patch.status && patch.status !== r.status && { statusAt: now() }),
              history: action ? [{ at: now(), by: actor.current, action, detail }, ...r.history] : r.history,
            }
          : r,
      ),
    });

    /** Proforma with status Draft, created automatically when a job departs */
    const withProforma = (s: State, jobId: string): State => {
      const job = s.jobs.find((j) => j.id === jobId);
      if (!job || s.bills.some((b) => b.jobId === jobId && b.kind === "Proforma" && b.status !== "Cancelled")) return s;
      const draft = proformaDraft(s, job);
      const bill: Bill = { ...draft, id: uid(), no: nextBillNo(s, "Proforma", draft), createdAt: now(), status: "Draft", statusAt: now() };
      toast(`Proforma ${bill.no} created in Billing`);
      return withAlert(
        { ...s, bills: [bill, ...s.bills], counters: { ...s.counters, proforma: s.counters.proforma + 1 } },
        "proforma",
        `${bill.no} for ${job.ref} is ready to review`,
        { jobId, branch: job.branch },
      );
    };

    /** Moves a job to a stage and mirrors it on its enquiry and reservation */
    const withJobStatus = (s: State, jobId: string, status: JobStatus): State => {
      const job = s.jobs.find((j) => j.id === jobId);
      if (!job) return s;
      let next = patchJob(s, jobId, { status, statusAt: now() });
      if (job.enquiryId) next = setStatus(next, job.enquiryId, status);
      if (job.reservationId && (status === "Departed" || status === "Cancelled")) {
        next = patchReservation(next, job.reservationId, { status: status === "Departed" ? "Departed" : "Cancelled" }, `Job ${job.ref} ${status.toLowerCase()}`);
      }
      if (status === "Departed") {
        next = withProforma(next, jobId);
        next = withAlert(next, "completed", `${job.ref} departed on ${job.flightNo || "the booked flight"}`, { jobId, enquiryId: job.enquiryId, branch: job.branch });
      }
      return next;
    };

    const nextCustomer = (data: CustomerInput, id?: string, prev?: Customer): Customer => ({
      ...data,
      id: id ?? uid(),
      address: joinAddress([data.address1, data.address2, data.city, data.state, data.postalCode, data.country]),
      contact: [data.firstName, data.middleName, data.lastName].filter((x) => x.trim()).join(" "),
      createdAt: prev?.createdAt ?? now(),
    });

    return {
      toast,

      reset() {
        commit(createSeed());
        toast("Demo data reset");
      },

      updateSettings(patch: Partial<Settings>, label = "Settings") {
        const s = get();
        commit(withAudit({ ...s, settings: { ...s.settings, ...patch } }, `${label} updated`, Object.keys(patch).join(", ")));
        toast(`${label} saved`);
      },

      setPorts(ports: State["ports"]) {
        commit(withAudit({ ...get(), ports }, "Geographical data updated", `${ports.length} ports`));
        toast("Ports saved");
      },

      setCurrencies(currencies: Currency[]) {
        commit(withAudit({ ...get(), currencies }, "Currencies updated", currencies.map((c) => c.code).join(", ")));
        toast("Currencies saved");
      },

      markRead(id: string) {
        const s = get();
        if (s.inbox.find((m) => m.id === id)?.read) return;
        commit({ ...s, inbox: s.inbox.map((m) => (m.id === id ? { ...m, read: true } : m)) });
      },

      /** Adds a stakeholder, or updates one when `id` is given */
      saveCustomer(data: CustomerInput, id?: string): Customer {
        const s = get();
        const prev = s.customers.find((c) => c.id === id);
        const customer = nextCustomer(data, id, prev);
        commit(
          withAudit(
            { ...s, customers: id ? s.customers.map((c) => (c.id === id ? customer : c)) : [...s.customers, customer] },
            `Stakeholder ${id ? "updated" : "added"}`,
            `${customer.name} (${customer.type})`,
          ),
        );
        toast(`${customer.type} ${customer.name} ${id ? "updated" : data.status === "Draft" ? "saved as draft" : "added"}`);
        return customer;
      },

      setCustomerStatus(id: string, status: Customer["status"]) {
        const s = get();
        const c = s.customers.find((x) => x.id === id)!;
        commit(withAudit({ ...s, customers: s.customers.map((x) => (x.id === id ? { ...x, status } : x)) }, "Stakeholder status changed", `${c.name}: ${status}`));
        toast(`${c.name} is now ${status}`);
      },

      saveAirline(data: Omit<Airline, "id">, id?: string) {
        const s = get();
        const airline = { ...data, portalUrl: safeHttpUrl(data.portalUrl), id: id ?? uid() };
        commit(withAudit({ ...s, airlines: id ? s.airlines.map((a) => (a.id === id ? airline : a)) : [...s.airlines, airline] }, `Airline ${id ? "updated" : "added"}`, data.name));
        toast(`Airline ${data.name} ${id ? "updated" : "added"}`);
      },

      saveRate(data: RateInput, id?: string) {
        const s = get();
        const rate: AirlineRate = { ...data, id: id ?? uid(), createdAt: s.rates.find((r) => r.id === id)?.createdAt ?? now() };
        commit(withAudit({ ...s, rates: id ? s.rates.map((r) => (r.id === id ? rate : r)) : [...s.rates, rate] }, `Airline rate ${id ? "updated" : "added"}`, `${data.pol} → ${data.pod}`));
        toast("Airline rate saved");
      },

      deleteRate(id: string) {
        const s = get();
        const r = s.rates.find((x) => x.id === id);
        commit(withAudit({ ...s, rates: s.rates.filter((x) => x.id !== id) }, "Airline rate deleted", r && `${r.pol} → ${r.pod}`));
      },

      /** Creates a new enquiry, or updates an existing one when `id` is given. `typedRef` is the number typed when automatic numbering is off. */
      saveEnquiry(data: EnquiryInput, id?: string, typedRef?: string): Enquiry {
        const s = get();
        if (id) {
          const next = patchEnquiry(s, id, data);
          commit(next);
          toast("Enquiry updated");
          return next.enquiries.find((e) => e.id === id)!;
        }
        const no = s.counters.enquiry + 1;
        const enquiry: Enquiry = {
          ...data,
          id: uid(),
          no,
          ref: (!s.settings.enquiryRef.auto && typedRef?.trim()) || buildRef(s.settings.enquiryRef, {
            company: s.settings.refPrefix,
            client: customerCode(s, data.customerId),
            branch: branchCode(s.settings, data.branch),
            pol: data.pol,
            pod: data.pod,
            year: data.enquiryDate.slice(0, 4),
            seq: no,
          }),
          createdAt: now(),
          status: "New Enquiry",
          statusAt: now(),
          rateRequests: [],
        };
        commit({
          ...s,
          enquiries: [enquiry, ...s.enquiries],
          inbox: s.inbox.map((m) => (m.id === data.sourceEmailId ? { ...m, enquiryId: enquiry.id, read: true } : m)),
          counters: { ...s.counters, enquiry: no },
        });
        toast(`Enquiry ${enquiry.ref} saved`);
        return enquiry;
      },

      changeStatus(enquiryId: string, status: EnquiryStatus) {
        let s = get();
        const enq = s.enquiries.find((e) => e.id === enquiryId);
        // Job stages belong to the job: change them there so the job, AWB and billing stay in step.
        // Earlier (pre-job) statuses only change the enquiry; the job keeps its own stage.
        const isJobStage = (JOB_STATUSES as readonly string[]).includes(status);
        s = enq?.jobId && s.jobs.some((j) => j.id === enq.jobId) && isJobStage ? withJobStatus(s, enq.jobId, status as JobStatus) : setStatus(s, enquiryId, status);
        commit(s);
        toast(`Status changed to ${status}`);
      },

      /** Rate request to one airline (one rate per mail); the mail goes to the To addresses as composed */
      sendRateRequest(enquiryId: string, airlineId: string | undefined, mail: MailDraft) {
        let s = withLog(get(), "Rate Request", mail, { enquiryId });
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        const airline = s.airlines.find((a) => a.id === airlineId);
        if (airlineId) {
          s = patchEnquiry(s, enquiryId, {
            rateRequests: [...enq.rateRequests.filter((r) => r.airlineId !== airlineId), { airlineId, sentAt: now(), reminders: [] }],
          });
        }
        if (enq.status === "New Enquiry") s = setStatus(s, enquiryId, "Rate Requested");
        commit(s);
        toast(`Rate request sent to ${airline?.name ?? mail.to.join(", ")}`);
      },

      sendRateReminder(enquiryId: string, airlineId: string, mail: MailDraft) {
        let s = withLog(get(), "Rate Reminder", mail, { enquiryId });
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        const airline = s.airlines.find((a) => a.id === airlineId);
        s = patchEnquiry(s, enquiryId, {
          rateRequests: enq.rateRequests.map((r) => (r.airlineId === airlineId ? { ...r, reminders: [...r.reminders, now()] } : r)),
        });
        commit(s);
        toast(`Reminder sent to ${airline?.name ?? "airline"}`);
      },

      /** Demo helper: drops an airline's rate reply into the Mailbox */
      simulateAirlineReply(enquiryId: string, airlineId: string) {
        const s = get();
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        const airline = s.airlines.find((a) => a.id === airlineId)!;
        const port = (code: string) => fmtPort(s.ports.find((p) => p.code === code));
        const base = 120 + Math.round(Math.random() * 300);
        const email: InboxEmail = {
          id: uid(),
          from: "Airline",
          airlineId,
          fromName: airline.name,
          fromEmail: airlineEmailFor(airline, enq.branch),
          subject: `RE: Request for Air Freight Rate – ${port(enq.pol)} to ${port(enq.pod)} [${enq.ref}]`,
          body: `Dear Airsteam team,\n\nThank you for your enquiry ${enq.ref}. Please find our rate below:\n\nRate/kg: INR ${base}\nAWB fee: INR ${[950, 1000, 1250][Math.floor(Math.random() * 3)]}\nOther charges: INR ${[0, 500, 750][Math.floor(Math.random() * 3)]}\nMinimum charge: INR ${base * 25}\nTransit: ${1 + Math.floor(Math.random() * 3)} days\nValid until: ${addDays(30)}\n\nRegards,\n${airline.name}`,
          receivedAt: now(),
          read: false,
        };
        commit({ ...s, inbox: [email, ...s.inbox] });
        toast(`Reply from ${airline.name} received in Mail Box`);
      },

      /** "Update Rate": a rate received or found elsewhere, entered by hand for one enquiry */
      addManualRate(enquiryId: string, rate: RateInput, saveToMaster: boolean): string {
        let s = get();
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        const id = uid();
        const newRates: AirlineRate[] = [{ ...rate, source: "Manual", enquiryId, id, createdAt: now() }];
        if (saveToMaster) newRates.push({ ...rate, source: "Master", enquiryId: undefined, id: uid(), createdAt: now() });
        s = { ...s, rates: [...s.rates, ...newRates] };
        if (enq.rateRequests.some((r) => r.airlineId === rate.airlineId && !r.repliedAt)) {
          s = patchEnquiry(s, enquiryId, { rateRequests: enq.rateRequests.map((r) => (r.airlineId === rate.airlineId ? { ...r, repliedAt: now() } : r)) });
        }
        if (enq.status === "New Enquiry" || enq.status === "Rate Requested") s = setStatus(s, enquiryId, "Rate Received");
        commit(s);
        toast(`Rate added to ${enq.ref}`);
        return id;
      },

      /** "Add to Enquiry" on an airline reply: links the mail, stores the rate, and moves to Rate Received. Returns the new rate's id. */
      addReplyToEnquiry(emailId: string, enquiryId: string, rate: RateInput, saveToMaster: boolean): string {
        let s = get();
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        const rateId = uid();
        const newRates: AirlineRate[] = [{ ...rate, source: "Airline Reply", enquiryId, id: rateId, createdAt: now() }];
        if (saveToMaster) newRates.push({ ...rate, source: "Master", enquiryId: undefined, id: uid(), createdAt: now() });
        s = {
          ...s,
          rates: [...s.rates, ...newRates],
          inbox: s.inbox.map((m) => (m.id === emailId ? { ...m, enquiryId, read: true } : m)),
        };
        const hasRequest = enq.rateRequests.some((r) => r.airlineId === rate.airlineId);
        s = patchEnquiry(s, enquiryId, {
          rateRequests: hasRequest
            ? enq.rateRequests.map((r) => (r.airlineId === rate.airlineId ? { ...r, repliedAt: now(), replyEmailId: emailId } : r))
            : [...enq.rateRequests, { airlineId: rate.airlineId, sentAt: now(), reminders: [], repliedAt: now(), replyEmailId: emailId }],
        });
        if (enq.status === "New Enquiry" || enq.status === "Rate Requested") s = setStatus(s, enquiryId, "Rate Received");
        commit(s);
        toast(`Rate added to ${enq.ref}`);
        return rateId;
      },

      /** Replaces the enquiry's uploaded documents (adds, removes and title edits) */
      setEnquiryDocs(enquiryId: string, docs: StoredDoc[]) {
        const s = get();
        const before = s.enquiries.find((e) => e.id === enquiryId)?.documents?.length ?? 0;
        commit(patchEnquiry(s, enquiryId, { documents: docs }));
        if (docs.length > before) toast(`${docs.length - before} document${docs.length - before > 1 ? "s" : ""} uploaded`);
      },

      /** Quotation numbers follow Settings → Ref Number Format → Quote Number */
      createQuotation(enquiryId: string, rateId?: string): Quotation {
        const s = get();
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        const existing = s.quotations.find((q) => q.id === enq.quotationId);
        if (existing && existing.status !== "Draft") return existing;
        const rate = s.rates.find((r) => r.id === rateId);
        const customer = s.customers.find((c) => c.id === enq.customerId);
        const currency = rate?.currency ?? "INR";
        const quotation: Quotation = {
          id: existing?.id ?? uid(),
          ref: existing?.ref ?? nextQuoteRef(s, enq.branch),
          enquiryId,
          rateId,
          createdAt: now(),
          status: "Draft",
          statusAt: now(),
          airlineId: rate?.airlineId ?? enq.airlineIds[0] ?? s.airlines[0]?.id ?? "",
          currency,
          roe: s.currencies.find((c) => c.code === currency)?.roe ?? 1,
          clearancePlace: enq.clearancePlace || s.settings.clearancePlaces[0]?.name || "",
          cargoDimension: `${enq.packages} packages / ${enq.grossWeight} kgs${enq.length ? ` (${enq.length} x ${enq.width} x ${enq.height} cm)` : ""}`,
          kindlyAttention: customer?.contact ?? "",
          lines: buildQuoteLines(enq.chargeableWeight, rate, s.settings),
          terms: s.settings.quotationTerms,
          reminders: [],
        };
        commit({
          ...patchEnquiry(s, enquiryId, { quotationId: quotation.id }),
          quotations: [quotation, ...s.quotations.filter((q) => q.id !== quotation.id)],
          counters: existing ? s.counters : { ...s.counters, quote: s.counters.quote + 1 },
        });
        toast(`Quotation ${quotation.ref} created`);
        return quotation;
      },

      /**
       * "Duplicate": a new draft quotation for a similar shipment for the same customer. The enquiry
       * is copied too (as Rate Received) so every field stays editable.
       */
      duplicateQuotation(id: string): Quotation {
        const s = get();
        const q = s.quotations.find((x) => x.id === id)!;
        const enq = s.enquiries.find((e) => e.id === q.enquiryId)!;
        const no = s.counters.enquiry + 1;
        const copyEnq: Enquiry = {
          ...enq,
          id: uid(),
          no,
          ref: buildRef(s.settings.enquiryRef, {
            company: s.settings.refPrefix,
            client: customerCode(s, enq.customerId),
            branch: branchCode(s.settings, enq.branch),
            pol: enq.pol,
            pod: enq.pod,
            year: yearOf(),
            seq: no,
          }),
          enquiryDate: today(),
          createdAt: now(),
          status: "Rate Received",
          statusAt: now(),
          rateRequests: [],
          sourceEmailId: undefined,
          shipmentDate: undefined,
          booking: undefined,
          documents: [],
          jobId: undefined,
        };
        const copy: Quotation = {
          ...q,
          id: uid(),
          ref: nextQuoteRef(s, enq.branch),
          enquiryId: copyEnq.id,
          createdAt: now(),
          status: "Draft",
          statusAt: now(),
          sentAt: undefined,
          reminders: [],
          lines: q.lines.map((l) => ({ ...l, id: uid() })),
        };
        copyEnq.quotationId = copy.id;
        commit({
          ...s,
          enquiries: [copyEnq, ...s.enquiries],
          quotations: [copy, ...s.quotations],
          counters: { ...s.counters, enquiry: no, quote: s.counters.quote + 1 },
        });
        toast(`Duplicated as ${copy.ref}`);
        return copy;
      },

      updateQuotation(id: string, patch: Partial<Quotation>) {
        commit(patchQuotation(get(), id, patch));
      },

      sendQuotation(id: string, mail: MailDraft) {
        let s = get();
        const q = s.quotations.find((x) => x.id === id)!;
        s = withLog(s, "Quotation", mail, { enquiryId: q.enquiryId }, [`${q.ref}.pdf`]);
        s = patchQuotation(s, id, { sentAt: now() });
        s = setStatus(s, q.enquiryId, "Quote Confirmation Pending");
        toast(`Quotation ${q.ref} emailed`);
        if (s.settings.alerts.notifyOnQuote) s = withNotification(s, q.enquiryId, `Quotation ${q.ref} has been emailed to you.`);
        commit(s);
      },

      sendQuotationReminder(id: string, mail: MailDraft) {
        let s = get();
        const q = s.quotations.find((x) => x.id === id)!;
        s = withLog(s, "Quotation Reminder", mail, { enquiryId: q.enquiryId }, [`${q.ref}.pdf`]);
        commit(patchQuotation(s, id, { reminders: [...q.reminders, now()] }));
        toast("Reminder sent to customer");
      },

      /** Once a job exists, the job owns the status: the quotation can no longer move the enquiry around */
      setQuotationStatus(id: string, status: QuotationStatus) {
        let s = get();
        const q = s.quotations.find((x) => x.id === id);
        if (!q) return;
        if (s.enquiries.find((e) => e.id === q.enquiryId)?.jobId) return toast(`${q.ref} already has a job. Change the job's status instead.`);
        s = status === "Draft" ? patchQuotation(s, id, { status, statusAt: now() }) : setStatus(s, q.enquiryId, status);
        if (status === "Waiting for Shipment Date") {
          const enq = s.enquiries.find((e) => e.id === q.enquiryId);
          s = withAlert(s, "shipmentDate", `${q.ref} confirmed by the client. Follow up for the shipment date.`, { enquiryId: q.enquiryId, branch: enq?.branch });
        }
        commit(s);
        toast(`${q.ref} → ${status}`);
      },

      confirmShipmentDate(enquiryId: string, shipmentDate: string) {
        let s = setStatus(patchEnquiry(get(), enquiryId, { shipmentDate }), enquiryId, "Booking in Progress");
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        s = withAlert(s, "booking", `${enq.ref}: book with the airline for ${shipmentDate}`, { enquiryId, branch: enq.branch });
        commit(s);
        toast("Shipment date confirmed. Booking in progress");
      },

      confirmBooking(enquiryId: string, booking: Omit<Booking, "confirmedAt">) {
        let s = patchEnquiry(get(), enquiryId, { booking: { ...booking, confirmedAt: now() } });
        s = setStatus(s, enquiryId, "Booking Confirmed");
        if (s.settings.alerts.notifyOnBooking) {
          s = withNotification(s, enquiryId, `Booking confirmed on ${booking.flightNo} (${booking.flightDate}). Booking ref ${booking.ref}.`);
        }
        commit(s);
      },

      /** "Create Job": a Booking/Job from a confirmed quotation or reservation. Status moves to AWB In Progress. */
      createJob(data: JobInput, typedRef?: string): Job {
        let s = get();
        const job: Job = { ...data, status: "AWB In Progress", id: uid(), ref: (!s.settings.jobRef.auto && typedRef?.trim()) || nextJobRef(s, data), createdAt: now(), statusAt: now() };
        s = { ...s, jobs: [job, ...s.jobs], counters: { ...s.counters, job: s.counters.job + 1 } };
        if (data.enquiryId) {
          s = patchEnquiry(s, data.enquiryId, { jobId: job.id });
          // Only a confirmed enquiry moves on; a cancelled, lost or still-quoting one keeps its status
          const enq = s.enquiries.find((e) => e.id === data.enquiryId);
          if (enq && ["Waiting for Shipment Date", "Booking in Progress", "Booking Confirmed"].includes(enq.status)) s = setStatus(s, data.enquiryId, "AWB In Progress");
        }
        if (data.reservationId) s = patchReservation(s, data.reservationId, { jobId: job.id }, "Job activated", job.ref);
        s = withAlert(s, "awb", `${job.ref} created. Execute the AWB.`, { jobId: job.id, enquiryId: data.enquiryId, branch: job.branch });
        commit(s);
        toast(`Booking/Job ${job.ref} created`);
        return job;
      },

      /**
       * Deletes a booking/job made by mistake. Refused once it has an executed AWB or any bill or
       * invoice (those are kept; cancel the job instead). Draft AWBs go with it; the enquiry is
       * unlinked and goes back to Booking Confirmed so it can be booked again; a reservation is unlinked.
       * Returns whether it was deleted.
       */
      deleteJob(id: string): boolean {
        let s = get();
        const job = s.jobs.find((j) => j.id === id);
        if (!job) return false;
        if (s.awbs.some((a) => a.jobId === id && a.status === "AWB Executed")) {
          toast(`${job.ref} has an executed AWB, so it can't be deleted. Change its status to Cancelled instead.`);
          return false;
        }
        if (s.bills.some((b) => b.jobId === id) || s.invoices.some((i) => i.jobId === id)) {
          toast(`${job.ref} has bills or invoices, so it can't be deleted. Change its status to Cancelled instead.`);
          return false;
        }
        s = { ...s, jobs: s.jobs.filter((j) => j.id !== id), awbs: s.awbs.filter((a) => a.jobId !== id) };
        const enq = s.enquiries.find((e) => e.id === job.enquiryId);
        if (enq?.jobId === id) {
          s = patchEnquiry(s, enq.id, { jobId: undefined });
          if ((JOB_STATUSES as readonly string[]).includes(enq.status) && enq.status !== "Cancelled") s = setStatus(s, enq.id, "Booking Confirmed");
        }
        if (job.reservationId) s = patchReservation(s, job.reservationId, { jobId: undefined }, "Job deleted", job.ref);
        commit(s);
        toast(`Booking/Job ${job.ref} deleted`);
        return true;
      },

      updateJob(id: string, patch: Partial<JobInput>) {
        let s = get();
        const job = s.jobs.find((j) => j.id === id)!;
        const { status, ...rest } = patch;
        s = patchJob(s, id, rest);
        if (status && status !== job.status) s = withJobStatus(s, id, status);
        commit(s);
        toast("Booking/Job saved");
      },

      setJobStatus(id: string, status: JobStatus) {
        const s = get();
        const job = s.jobs.find((j) => j.id === id)!;
        commit(withJobStatus(s, id, status));
        toast(`${job.ref} → ${status}`);
      },

      /** "Duplicate": a new job for a similar shipment for the same customer, with the next job number */
      duplicateJob(id: string): Job {
        const s = get();
        const j = s.jobs.find((x) => x.id === id)!;
        const copy: Job = {
          ...j,
          id: uid(),
          ref: nextJobRef(s, { ...j, date: now() }),
          enquiryId: undefined,
          reservationId: undefined,
          createdAt: now(),
          date: today(),
          status: "AWB In Progress",
          statusAt: now(),
          awbNo: "",
          bookingRef: "",
          flightDate: "",
          flightNo: "",
          documents: [],
          uploadCompletedAt: undefined,
          merged: undefined,
          dispatchedAt: undefined,
        };
        commit({ ...s, jobs: [copy, ...s.jobs], counters: { ...s.counters, job: s.counters.job + 1 } });
        toast(`Duplicated as ${copy.ref}`);
        return copy;
      },

      // ---- Airway Bills ----

      /**
       * Saves every AWB tab of a job (several House AWBs under one MAWB). "HAWB by Own" numbers are
       * given here, in tab order, so a cancelled form never uses up numbers. Drafts without an id are new.
       */
      saveAwbs(jobId: string, drafts: (AwbInput & { id?: string })[]): Awb[] | undefined {
        let s = get();
        const job = s.jobs.find((j) => j.id === jobId);
        let given = 0;
        const seen = new Set<string>();
        const saved: Awb[] = drafts.map((d) => {
          // An id used twice (a copied tab) is saved as a new AWB rather than overwriting the first
          const prev = d.id && !seen.has(d.id) ? s.awbs.find((a) => a.id === d.id) : undefined;
          if (d.id) seen.add(d.id);
          const data: AwbInput = omit(d, ["id"]);
          // Automatic generation off (Ref Number Format): Own numbers are typed like Others
          const needsNo = s.settings.hawbRef.auto && data.hawbSource === "Own" && !data.hawbNo.trim() && (!prev || !prev.hawbNo || prev.hawbSource !== "Own");
          // An Own number already given is kept when the tab comes back without it
          const kept = data.hawbSource === "Own" && prev?.hawbSource === "Own" ? prev.hawbNo : "";
          const hawbNo = needsNo ? nextHawbNo(s, job?.branch, ++given) : data.hawbNo.trim() || kept;
          return prev ? { ...prev, ...data, hawbNo } : { ...data, hawbNo, id: uid(), status: "Draft" as const, statusAt: now(), createdAt: now() };
        });
        // An executed AWB stays complete: refuse the whole save rather than store half of it
        const broken = saved.filter((a) => a.status === "AWB Executed" && awbMissing(a).length);
        if (broken.length) {
          toast(`${broken.map(awbLabel).join(", ")} ${broken.length > 1 ? "are" : "is"} executed, so ${broken.length > 1 ? "they need" : "it needs"} the ${[...new Set(broken.flatMap(awbMissing))].join(", ")}`);
          return undefined;
        }
        const ids = new Set(saved.map((a) => a.id));
        s = { ...s, awbs: [...saved.filter((a) => !s.awbs.some((x) => x.id === a.id)), ...s.awbs.map((a) => (ids.has(a.id) ? saved.find((x) => x.id === a.id)! : a))], counters: { ...s.counters, hawb: s.counters.hawb + given } };
        const first = saved[0];
        if (first) s = patchJob(s, jobId, { awbNo: first.mawbNo, ...(first.legs[0]?.flightNo && { flightNo: first.legs[0].flightNo, flightDate: first.legs[0].flightDate }) });
        commit(s);
        toast(saved.length > 1 ? `${saved.length} AWBs saved` : `${saved[0] ? awbLabel(saved[0]) : "AWB"} saved`);
        return saved;
      },

      /** Draft AWB emailed to the customer for confirmation */
      sendAwb(id: string, mail: MailDraft) {
        let s = get();
        const a = s.awbs.find((x) => x.id === id)!;
        const job = s.jobs.find((j) => j.id === a.jobId);
        s = withLog(s, "AWB", mail, { jobId: a.jobId, enquiryId: job?.enquiryId }, [`${a.type === "House" ? "HAWB" : "MAWB"}-${a.type === "House" ? a.hawbNo : a.mawbNo}.pdf`]);
        s = patchAwb(s, id, { sentAt: now(), ...(a.status === "Draft" && { status: "Draft AWB Send", statusAt: now() }) });
        commit(s);
        toast("Draft AWB sent to the customer");
      },

      /** Executed AWB moves the job on to the documents; cancelling keeps the record */
      /**
       * Executing the AWB moves the job on to the documents. Taking it back (Draft / Cancelled) rewinds the job
       * to AWB In Progress while the documents are still being prepared, and is refused once the pre-alert has gone.
       */
      setAwbStatus(id: string, status: AwbStatus): boolean {
        let s = get();
        const a = s.awbs.find((x) => x.id === id);
        if (!a) return false;
        const job = s.jobs.find((j) => j.id === a.jobId);
        const missing = awbMissing(a);
        if (status === "AWB Executed" && missing.length) {
          toast(`${awbLabel(a)} can't be executed yet: add the ${missing.join(", ")}`);
          return false;
        }
        const otherExecuted = s.awbs.some((x) => x.id !== id && x.jobId === a.jobId && x.status === "AWB Executed");
        if (job && a.status === "AWB Executed" && status !== "AWB Executed" && !otherExecuted && !["AWB In Progress", ...DOCUMENT_STAGE_STATUSES].includes(job.status)) {
          toast(`${job.ref} is already ${job.status.toLowerCase()}, so its AWB can't be taken back`);
          return false;
        }
        s = patchAwb(s, id, { status, statusAt: now() });
        if (job && status === "AWB Executed" && job.status === "AWB In Progress") {
          s = withJobStatus(s, job.id, "AWB Executed, Pending Documents");
          if (s.settings.alerts.notifyOnAwb && job.enquiryId) {
            s = withNotification(s, job.enquiryId, `${a.type} AWB ${a.type === "House" ? a.hawbNo : a.mawbNo} issued for your shipment.`, "Email");
          }
        }
        if (job && status !== "AWB Executed" && DOCUMENT_STAGE_STATUSES.includes(job.status) && !otherExecuted) {
          // Uploads are kept; the merged set is dropped because it contained this AWB
          s = withJobStatus(patchJob(s, job.id, { merged: undefined }), job.id, "AWB In Progress");
        }
        commit(s);
        toast(`${awbLabel(a)} → ${status}`);
        return true;
      },

      /**
       * "AWB Executed" for a job with several AWBs: every one not yet executed is checked first, and none is
       * executed while any is incomplete, so the job never moves on with HAWBs left behind as drafts.
       */
      executeAwbs(jobId: string): boolean {
        let s = get();
        const job = s.jobs.find((j) => j.id === jobId);
        const pending = s.awbs.filter((a) => a.jobId === jobId && a.status !== "Cancelled" && a.status !== "AWB Executed").sort((x, y) => x.createdAt.localeCompare(y.createdAt));
        if (!job || !pending.length) return false;
        const gaps = pending.map((a) => ({ a, missing: awbMissing(a) })).filter((g) => g.missing.length);
        if (gaps.length) {
          toast(
            gaps.length === 1
              ? `${awbLabel(gaps[0].a)} can't be executed yet: add the ${gaps[0].missing.join(", ")}. Nothing was executed.`
              : `${gaps.length} AWBs can't be executed yet (${gaps.map((g) => `${awbLabel(g.a)}: ${g.missing.join(", ")}`).join("; ")}). Nothing was executed.`,
          );
          return false;
        }
        for (const a of pending) s = patchAwb(s, a.id, { status: "AWB Executed", statusAt: now() });
        if (job.status === "AWB In Progress") {
          s = withJobStatus(s, job.id, "AWB Executed, Pending Documents");
          if (s.settings.alerts.notifyOnAwb && job.enquiryId) {
            s = withNotification(s, job.enquiryId, `${pending.length > 1 ? `${pending.length} AWBs` : `${pending[0].type} AWB ${awbNumber(pending[0])}`} issued for your shipment.`, "Email");
          }
        }
        commit(s);
        toast(pending.length > 1 ? `${pending.length} AWBs executed` : `${awbLabel(pending[0])} → AWB Executed`);
        return true;
      },

      /** Only a draft, sent or cancelled AWB can be deleted; an executed AWB is kept (cancel it instead) */
      deleteAwb(id: string) {
        let s = get();
        const a = s.awbs.find((x) => x.id === id);
        if (a?.status === "AWB Executed") return toast("An executed AWB can't be deleted. Change its status to Cancelled instead.");
        s = { ...s, awbs: s.awbs.filter((x) => x.id !== id) };
        const job = s.jobs.find((j) => j.id === a?.jobId);
        if (job && a) {
          const shared = s.awbs.some((x) => x.jobId === job.id && x.status !== "Cancelled" && x.mawbNo === a.mawbNo);
          if (job.awbNo === a.mawbNo && !shared) s = patchJob(s, job.id, { awbNo: "" });
          if (job.status === "AWB Executed, Pending Documents" && !s.awbs.some((x) => x.jobId === job.id && x.status === "AWB Executed")) s = withJobStatus(s, job.id, "AWB In Progress");
        }
        commit(s);
        toast("AWB deleted");
      },

      // ---- Documents handling ----

      setJobDocs(jobId: string, docs: StoredDoc[]) {
        const s = get();
        const before = s.jobs.find((j) => j.id === jobId)?.documents.length ?? 0;
        commit(patchJob(s, jobId, { documents: docs }));
        if (docs.length > before) toast(`${docs.length - before} document${docs.length - before > 1 ? "s" : ""} uploaded`);
      },

      /** "Uploading Completed": documents can still be added afterwards */
      completeUpload(jobId: string) {
        let s = patchJob(get(), jobId, { uploadCompletedAt: now() });
        const job = s.jobs.find((j) => j.id === jobId)!;
        // The documents stage only starts once the AWB is executed
        if (job.status === "AWB Executed, Pending Documents") s = withJobStatus(s, jobId, "Documents Uploaded");
        commit(s);
        toast(job.status === "AWB In Progress" ? "Uploading marked completed. Execute the AWB to move the job on" : "Uploading marked completed. Next: merge the documents");
      },

      /** Merged PDF saved on the job; a customer invoice merged in becomes Completed */
      saveMerge(jobId: string, merged: MergedDocs) {
        let s = patchJob(get(), jobId, { merged });
        const job = s.jobs.find((j) => j.id === jobId)!;
        for (const key of merged.order.filter((k) => k.startsWith("invoice:"))) {
          s = patchInvoice(s, key.slice(8), { status: "Completed", statusAt: now() });
        }
        if (["AWB Executed, Pending Documents", "Documents Uploaded"].includes(job.status)) s = withJobStatus(s, jobId, "Pre-alert Pending");
        commit(s);
        toast("Documents merged. Next: send the pre-alert to the shipper");
      },

      dispatchToCha(jobId: string, mail: MailDraft) {
        const job = get().jobs.find((j) => j.id === jobId)!;
        let s = withLog(get(), "Pre-alert", mail, { jobId, enquiryId: job.enquiryId }, job.merged ? [job.merged.fileName] : []);
        s = patchJob(s, jobId, { dispatchedAt: now() });
        if (job.status === "Pre-alert Pending" || job.status === "Documents Uploaded" || job.status === "AWB Executed, Pending Documents") s = withJobStatus(s, jobId, "Booking Completed");
        commit(s);
        toast("Pre-alert sent to the shipper. Booking completed");
      },

      /** "Notify Customer" from a job or reservation: an email to the customer */
      notifyCustomer(mail: MailDraft, refs: Refs) {
        let s = withLog(get(), refs.reservationId ? "Booking Confirmation" : "Shipment Update", mail, refs);
        if (refs.reservationId) s = patchReservation(s, refs.reservationId, { notifiedAt: now() }, "Customer notified", mail.subject);
        commit(s);
        toast("Customer notified");
      },

      // ---- Reserved shipments ----

      /**
       * Save Draft / Create Reservation. A recurring reservation creates one reservation per occurrence,
       * each with its own number, date, status and history, linked by a series id.
       */
      createReservation(data: ReservationInput, draft: boolean, typedRef?: string): Reservation[] {
        let s = get();
        const dates = data.recurring && data.recurrence ? occurrenceDates(data.recurrence) : [data.shipmentDate];
        const seriesId = dates.length > 1 ? uid() : undefined;
        const status: ReservationStatus = draft ? "Draft" : "Reserved";
        const created: Reservation[] = dates.map((date, i) => ({
          ...data,
          shipmentDate: date,
          flightDate: i === 0 ? data.flightDate || date : date,
          id: uid(),
          // A typed number (automatic numbering off) is used for a single reservation; a series keeps generated ones
          ref: (!s.settings.reservationRef.auto && dates.length === 1 && typedRef?.trim()) || nextReservationRef(s, { ...data, shipmentDate: date }, i + 1),
          createdAt: now(),
          status,
          statusAt: now(),
          seriesId,
          previousDates: [],
          history: [
            {
              at: now(),
              by: actor.current,
              action: draft ? "Saved as draft" : "Reservation created",
              detail: [data.fromJobId && `Converted from job ${s.jobs.find((j) => j.id === data.fromJobId)?.ref ?? ""}`, seriesId && `Occurrence ${i + 1} of ${dates.length}`].filter(Boolean).join(" · ") || undefined,
            },
          ],
        }));
        s = { ...s, reservations: [...created, ...s.reservations], counters: { ...s.counters, reservation: s.counters.reservation + created.length } };
        commit(s);
        toast(created.length > 1 ? `${created.length} reservations created (${created[0].ref} …)` : `Reservation ${created[0].ref} ${draft ? "saved as draft" : "created"}`);
        return created;
      },

      /** Edit one occurrence, this and the future ones, or the whole series. Dates stay per occurrence. */
      updateReservation(id: string, data: Partial<ReservationInput>, scope: SeriesScope = "one") {
        let s = get();
        const r = s.reservations.find((x) => x.id === id)!;
        // Other occurrences that already have a job, departed or were cancelled are left as they are
        const targets = s.reservations.filter(
          (x) => x.id === id || (scope !== "one" && r.seriesId && x.seriesId === r.seriesId && !x.jobId && x.status !== "Departed" && x.status !== "Cancelled" && (scope === "series" || x.shipmentDate >= r.shipmentDate)),
        );
        for (const t of targets) {
          // The date and per-occurrence booking only change on the one being edited
          const patch = t.id === id ? data : Object.fromEntries(Object.entries(data).filter(([k]) => !["shipmentDate", "flightDate", "booking", "awbNo"].includes(k)));
          s = patchReservation(s, t.id, patch, "Edited", scope === "one" ? undefined : `Applied to ${scope === "series" ? "the whole series" : "this and future occurrences"}`);
        }
        commit(s);
        toast(targets.length > 1 ? `${targets.length} reservations updated` : "Reservation updated");
      },

      /** Submit a draft for planning */
      submitReservation(id: string) {
        commit(patchReservation(get(), id, { status: "Reserved" }, "Reservation created"));
        toast("Reservation created");
      },

      setReservationStatus(id: string, status: ReservationStatus, detail?: string) {
        commit(patchReservation(get(), id, { status }, `Status → ${status}`, detail));
        toast(`Status → ${status}`);
      },

      rescheduleReservation(id: string, date: string, reason: string) {
        const r = get().reservations.find((x) => x.id === id);
        if (!r) return;
        if (r.jobId) return toast(`${r.ref} has a job. Change the flight date on the job instead.`);
        commit(
          patchReservation(
            get(),
            id,
            { shipmentDate: date, flightDate: date, status: "Rescheduled", previousDates: [...r.previousDates, { date: r.shipmentDate, reason, at: now() }] },
            "Rescheduled",
            `${r.shipmentDate} → ${date}: ${reason}`,
          ),
        );
        toast(`Rescheduled to ${date}`);
      },

      holdReservation(id: string, reason: string) {
        const r = get().reservations.find((x) => x.id === id);
        if (!r) return;
        if (r.jobId) return toast(`${r.ref} has a job. Put the job on hold instead.`);
        commit(patchReservation(get(), id, { status: "On Hold", holdReason: reason, heldFrom: r.status }, "Put on hold", reason));
        toast("Reservation on hold");
      },

      resumeReservation(id: string) {
        const r = get().reservations.find((x) => x.id === id)!;
        commit(patchReservation(get(), id, { status: r.heldFrom && r.heldFrom !== "On Hold" ? r.heldFrom : "Reserved", holdReason: undefined, heldFrom: undefined }, "Resumed"));
        toast("Reservation resumed");
      },

      /** Cancelled reservations are kept (never hard-deleted) */
      cancelReservation(id: string, reason: string, scope: SeriesScope = "one") {
        let s = get();
        const r = s.reservations.find((x) => x.id === id)!;
        const targets = s.reservations.filter(
          (x) => x.id === id || (scope !== "one" && r.seriesId && x.seriesId === r.seriesId && !x.jobId && x.status !== "Departed" && x.status !== "Cancelled" && (scope === "series" || x.shipmentDate >= r.shipmentDate)),
        );
        if (r.jobId) return toast(`${r.ref} has a job. Cancel the job instead.`);
        for (const t of targets) s = patchReservation(s, t.id, { status: "Cancelled", cancelReason: reason, bookingStatus: "Cancelled" }, "Cancelled", reason);
        commit(s);
        toast(targets.length > 1 ? `${targets.length} reservations cancelled` : "Reservation cancelled");
      },

      initiateCarrierBooking(id: string) {
        commit(patchReservation(get(), id, { status: "Booking In Progress", bookingStatus: "In Progress" }, "Carrier booking initiated"));
        toast("Carrier booking in progress");
      },

      confirmReservationBooking(id: string, booking: { ref: string; flightNo: string; flightDate: string; documents: StoredDoc[] }) {
        commit(
          patchReservation(
            get(),
            id,
            { status: "Booking Confirmed", bookingStatus: "Confirmed", flightNo: booking.flightNo, flightDate: booking.flightDate, booking: { ...booking, confirmedAt: now() } },
            "Booking confirmed",
            `${booking.ref} · ${booking.flightNo}`,
          ),
        );
        toast("Booking confirmed. Next: notify the customer");
      },

      // ---- Customer invoices ----

      saveInvoice(data: InvoiceInput, id?: string): CustomerInvoice {
        const s = get();
        if (id) {
          const inv = { ...s.invoices.find((x) => x.id === id)!, ...data };
          commit({ ...s, invoices: s.invoices.map((x) => (x.id === id ? inv : x)) });
          toast(`Invoice ${inv.no} saved`);
          return inv;
        }
        const inv: CustomerInvoice = { ...data, id: uid(), createdAt: now(), status: "Draft", statusAt: now() };
        commit({ ...s, invoices: [inv, ...s.invoices] });
        toast(`Invoice ${inv.no} saved as Draft`);
        return inv;
      },

      /** "Send" from the preview: the invoice goes to the customer for approval */
      sendInvoiceForApproval(id: string, mail: MailDraft) {
        let s = get();
        const inv = s.invoices.find((x) => x.id === id)!;
        s = withLog(s, "Customer Invoice", mail, { jobId: inv.jobId, enquiryId: inv.enquiryId }, [`Invoice-${inv.no}.pdf`]);
        commit(patchInvoice(s, id, { status: "Awaiting Confirmation", statusAt: now(), sentAt: now() }));
        toast("Invoice sent to the customer for approval");
      },

      setInvoiceStatus(id: string, status: InvoiceStatus) {
        const s = get();
        const inv = s.invoices.find((x) => x.id === id)!;
        let next = patchInvoice(s, id, { status, statusAt: now() });
        // A generated invoice linked to a job fills the job's INV No
        if (status === "Generated" && inv.jobId) next = patchJob(next, inv.jobId, { invoiceNo: inv.no });
        commit(next);
        toast(`Invoice ${inv.no} → ${status}`);
      },

      duplicateInvoice(id: string): CustomerInvoice {
        const s = get();
        const inv = s.invoices.find((x) => x.id === id)!;
        const copy: CustomerInvoice = {
          ...inv,
          id: uid(),
          no: `${inv.no}-COPY`,
          date: today(),
          createdAt: now(),
          status: "Draft",
          statusAt: now(),
          sentAt: undefined,
          jobId: undefined,
          enquiryId: undefined,
          items: inv.items.map((i) => ({ ...i, id: uid() })),
        };
        commit({ ...s, invoices: [copy, ...s.invoices] });
        toast("Invoice duplicated as a draft");
        return copy;
      },

      // ---- Finance / Billing ----

      /** Proforma for a job by hand (normally created automatically on Departed) */
      createProforma(jobId: string): Bill | undefined {
        const s = withProforma(get(), jobId);
        commit(s);
        return s.bills.find((b) => b.jobId === jobId && b.kind === "Proforma" && b.status !== "Cancelled");
      },

      /** Saves edits; on a locked (issued, approved or cancelled) bill only the due date can change */
      saveBill(id: string, patch: Partial<Bill>) {
        const s = get();
        const b = s.bills.find((x) => x.id === id);
        if (!b) return;
        if (isBillLocked(b)) {
          if (patch.dueDate === undefined || patch.dueDate === b.dueDate) return toast(`${b.no} can no longer be edited`);
          commit(patchBill(s, id, { dueDate: patch.dueDate }));
          return toast("Due date saved");
        }
        commit(patchBill(s, id, patch));
        toast("Saved");
      },

      /** Proforma → "Proforma INV Send"; a tax invoice is (re)issued to the customer */
      sendBill(id: string, mail: MailDraft) {
        let s = get();
        const b = s.bills.find((x) => x.id === id)!;
        s = withLog(s, b.kind === "Proforma" ? "Proforma" : "Invoice", mail, { jobId: b.jobId }, [`${b.no}.pdf`]);
        s = patchBill(s, id, { sentAt: now(), ...(b.kind === "Proforma" && b.status === "Draft" && { status: "Proforma INV Send", statusAt: now() }) });
        commit(s);
        toast(`${b.kind === "Proforma" ? "Proforma" : "Invoice"} ${b.no} sent`);
      },

      /** "Approve": the proforma becomes a tax invoice; the proforma stays in history as Approved */
      approveProforma(id: string): Bill {
        let s = get();
        const p = s.bills.find((x) => x.id === id)!;
        const inv: Bill = {
          ...p,
          id: uid(),
          kind: "Invoice",
          no: nextBillNo(s, "Invoice", p),
          date: today(),
          createdAt: now(),
          status: "Sent / Issued",
          statusAt: now(),
          sourceId: p.id,
          sentAt: undefined,
          payments: [],
          lines: p.lines.map((l) => ({ ...l, id: uid() })),
        };
        s = patchBill(s, id, { status: "Approved", statusAt: now() });
        s = { ...s, bills: [inv, ...s.bills], counters: { ...s.counters, invoice: s.counters.invoice + 1 } };
        commit(s);
        toast(`Invoice ${inv.no} created from ${p.no}`);
        return inv;
      },

      /**
       * Invoice status, with a payment recorded for Partially Paid / Paid. Paid needs the full total
       * received; a payment that clears the balance makes it Paid. Returns false when refused.
       */
      setBillStatus(id: string, status: BillStatus, payment?: { amount: number; note: string }): boolean {
        let s = get();
        const b = s.bills.find((x) => x.id === id);
        if (!b) return false;
        const amount = payment && payment.amount > 0 ? payment.amount : 0;
        const t = billTotals(b);
        const received = t.received + amount;
        if (amount > t.balance + 0.005) {
          toast(`The payment is more than the balance of INR ${t.balance.toFixed(2)}`);
          return false;
        }
        if (status === "Paid" && received < t.total - 0.005) {
          toast(`Record the full balance of INR ${t.balance.toFixed(2)} to mark ${b.no} Paid`);
          return false;
        }
        if (status === "Partially Paid" && amount <= 0) {
          toast("Enter the amount received");
          return false;
        }
        const final: BillStatus = status === "Partially Paid" && received >= t.total - 0.005 ? "Paid" : status;
        s = patchBill(s, id, {
          status: final,
          statusAt: now(),
          ...(amount > 0 && { payments: [...b.payments, { id: uid(), at: now(), amount, note: payment?.note ?? "" }] }),
        });
        commit(s);
        toast(`${b.no} → ${final}`);
        return true;
      },

      /**
       * Cancelling a tax invoice creates its credit note (CN-…) as a draft with every amount reversed,
       * and cancels the proforma it came from so the job can be billed again with a fresh proforma.
       */
      cancelBill(id: string): Bill | undefined {
        let s = get();
        const b = s.bills.find((x) => x.id === id);
        if (!b) return undefined;
        s = patchBill(s, id, { status: "Cancelled", statusAt: now() });
        if (b.kind === "Invoice" && b.sourceId) s = patchBill(s, b.sourceId, { status: "Cancelled", statusAt: now() });
        let cn: Bill | undefined;
        if (b.kind === "Invoice" && !s.bills.some((x) => x.kind === "Credit Note" && x.sourceId === id)) {
          cn = {
            ...b,
            id: uid(),
            kind: "Credit Note",
            no: s.bills.some((x) => x.no === creditNoteNo(b.no)) ? nextCreditNoteNo(s, b).no : creditNoteNo(b.no),
            date: today(),
            createdAt: now(),
            status: "Draft",
            statusAt: now(),
            sourceId: b.id,
            sentAt: undefined,
            payments: [],
            // Reverse each line (a discount line on the invoice becomes positive on the credit note)
            lines: b.lines.map((l) => ({ ...l, id: uid(), rate: -l.rate })),
          };
          s = { ...s, bills: [cn, ...s.bills] };
        }
        commit(s);
        toast(cn ? `${b.no} cancelled. Credit note ${cn.no} created` : `${b.no} cancelled`);
        return cn;
      },

      /**
       * Credit note raised by hand for an existing job (not from a cancelled invoice). Filled from the
       * job like a proforma, with the lines reversed; edit the lines, then Issue.
       */
      createCreditNote(jobId: string): Bill | undefined {
        let s = get();
        const job = s.jobs.find((j) => j.id === jobId);
        if (!job) return undefined;
        const draft = proformaDraft(s, job);
        const { no, seq } = nextCreditNoteNo(s, job);
        const cn: Bill = {
          ...draft,
          kind: "Credit Note",
          id: uid(),
          no,
          createdAt: now(),
          status: "Draft",
          statusAt: now(),
          payments: [],
          // Each line reversed, as for a cancelled invoice (a discount line becomes positive)
          lines: draft.lines.map((l) => ({ ...l, id: uid(), rate: -l.rate })),
        };
        s = { ...s, bills: [cn, ...s.bills], counters: { ...s.counters, creditNote: seq } };
        commit(s);
        toast(`Credit note ${cn.no} created for ${job.ref}`);
        return cn;
      },

      issueCreditNote(id: string) {
        const s = get();
        const b = s.bills.find((x) => x.id === id)!;
        commit(patchBill(s, id, { status: "Issued", statusAt: now() }));
        toast(`Credit note ${b.no} issued`);
      },

      // ---- Mail ----

      /** Mail Box → Compose: saves a draft, or updates it when `id` is given */
      saveDraft(draft: Omit<Draft, "id" | "savedAt">, id?: string): Draft {
        const s = get();
        const d: Draft = { ...draft, id: id ?? uid(), savedAt: now() };
        commit({ ...s, drafts: [d, ...s.drafts.filter((x) => x.id !== d.id)] });
        toast("Draft saved");
        return d;
      },

      deleteDraft(id: string) {
        const s = get();
        commit({ ...s, drafts: s.drafts.filter((d) => d.id !== id) });
      },

      /** Mail Box → Compose: sends a general mail and drops its draft */
      sendMail(mail: MailDraft, enquiryId?: string, draftId?: string) {
        const s = withLog(get(), "General", mail, { enquiryId }, mail.files?.map((f) => f.fileName));
        commit({ ...s, drafts: s.drafts.filter((d) => d.id !== draftId) });
        toast("Email sent");
      },

      notify(enquiryId: string, message: string, channel: Channel) {
        commit(withNotification(get(), enquiryId, message, channel));
      },
    };
  }, [toast]);

  return { state, toasts, actions };
}

type StoreValue = { state: State; actions: ReturnType<typeof useStoreState>["actions"] };

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { state, toasts, actions } = useStoreState();
  const value = useMemo(() => (state ? { state, actions } : null), [state, actions]);

  if (!value) {
    return <PageLoader fullScreen label="Loading workspace…" />;
  }

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast-in max-w-sm rounded-lg bg-navy-900 px-3 py-2.5 text-sm text-white shadow-lg">
            {t.message}
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** Lookup helpers used across most pages */
export function useLookups() {
  const { state } = useStore();
  return useMemo(
    () => ({
      customer: (id?: string) => state.customers.find((c) => c.id === id),
      airline: (id?: string) => state.airlines.find((a) => a.id === id),
      port: (code?: string) => state.ports.find((p) => p.code === code),
      portLabel: (code?: string) => fmtPort(state.ports.find((p) => p.code === code)) || code || "",
      enquiry: (id?: string) => state.enquiries.find((e) => e.id === id),
      quotation: (id?: string) => state.quotations.find((q) => q.id === id),
      job: (id?: string) => state.jobs.find((j) => j.id === id),
      rate: (id?: string) => state.rates.find((r) => r.id === id),
      reservation: (id?: string) => state.reservations.find((r) => r.id === id),
      /** The job's current AWB (ignoring cancelled ones) */
      /** The job's AWBs (one MAWB, possibly several House AWBs), oldest first; cancelled ones left out */
      awbsOf: (jobId?: string) => state.awbs.filter((a) => a.jobId === jobId && a.status !== "Cancelled").sort((x, y) => x.createdAt.localeCompare(y.createdAt)),
      awbOf: (jobId?: string) => state.awbs.filter((a) => a.jobId === jobId && a.status !== "Cancelled").sort((x, y) => x.createdAt.localeCompare(y.createdAt))[0],
    }),
    [state],
  );
}
