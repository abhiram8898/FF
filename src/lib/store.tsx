"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createSeed } from "./seed";
import type {
  Agent,
  Airline,
  AirlineRate,
  Awb,
  Booking,
  Channel,
  Customer,
  CustomerInvoice,
  Draft,
  EmailKind,
  Enquiry,
  EnquiryStatus,
  InboxEmail,
  Job,
  MailDraft,
  Quotation,
  QuotationStatus,
  Settings,
  ShipmentDocs,
  State,
  StoredDoc,
} from "./types";
import { QUOTATION_STATUSES } from "./types";
import { addDays, buildQuoteLines, buildRef, fmtPort, quotationRef, uid } from "./utils";

// Bumped when the saved data's shape changes, so old demo data is reseeded
const STORAGE_KEY = "freighttask:v4";

export type EnquiryInput = Omit<Enquiry, "id" | "no" | "ref" | "createdAt" | "status" | "statusAt" | "rateRequests">;
export type RateInput = Omit<AirlineRate, "id" | "createdAt">;
export type JobInput = Omit<Job, "id" | "ref" | "createdAt" | "awb">;
export type InvoiceInput = Omit<CustomerInvoice, "id" | "no" | "createdAt">;

interface Toast {
  id: string;
  message: string;
}

const now = () => new Date().toISOString();

/** A Booking/Job pre-filled from the confirmed quotation and its enquiry */
export function jobDraft(s: State, enq: Enquiry, q: Quotation): JobInput {
  const cust = s.customers.find((c) => c.id === enq.customerId);
  const airline = s.airlines.find((a) => a.id === q.airlineId);
  return {
    enquiryId: enq.id,
    quotationId: q.id,
    date: now().slice(0, 10),
    customerId: enq.customerId,
    // A shipper customer usually ships their own cargo; forwarders name the shipper per booking
    shipperId: cust?.type === "Shipper/Receiver" ? cust.id : undefined,
    shipperName: cust?.type === "Shipper/Receiver" ? cust.name : "",
    pol: enq.pol,
    pod: enq.pod,
    awbNo: "",
    flightDate: enq.booking?.flightDate ?? enq.shipmentDate ?? "",
    flightNo: enq.booking?.flightNo ?? "",
    status: "BOOKED",
    stock: "",
    weight: enq.chargeableWeight,
    boxes: enq.packages,
    commodity: enq.commodity.toUpperCase(),
    offload: "",
    chaName: "",
    rate: "",
    invoiceNo: enq.docs?.invoiceNo ?? "",
    tsp: "",
    loading: "",
    month: enq.booking?.flightDate ?? "",
    iataCode: airline?.code ?? "",
    airlineId: q.airlineId,
    years: String(new Date().getFullYear()),
    duty: "",
    tspAdditional: "",
    loadingAdditional: "",
    bookingInfo: enq.booking ? `Booking ref ${enq.booking.ref}` : "",
    additional1: "",
    additional2: "",
    documents: [],
  };
}

/** Next Booking/Job number, from the pattern in Settings → Ref Number */
export function nextJobRef(s: State, data: Pick<JobInput, "customerId" | "pol" | "pod" | "date">) {
  return buildRef(s.settings.jobRef, {
    company: s.settings.refPrefix,
    client: s.customers.find((c) => c.id === data.customerId)?.code,
    pol: data.pol,
    pod: data.pod,
    year: (data.date || now()).slice(0, 4),
    seq: s.counters.job + 1,
  });
}

/** Next customer invoice number, e.g. AIS/INV/0002/26-27 */
export function nextInvoiceNo(s: State) {
  const fy = s.settings.financialYears.at(-1)?.replace(/^20/, "") ?? "";
  return `${s.settings.refPrefix}/INV/${String(s.counters.invoice + 1).padStart(4, "0")}/${fy}`;
}

const patchEnquiry = (s: State, id: string, patch: Partial<Enquiry>): State => ({
  ...s,
  enquiries: s.enquiries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
});

const patchQuotation = (s: State, id: string, patch: Partial<Quotation>): State => ({
  ...s,
  quotations: s.quotations.map((q) => (q.id === id ? { ...q, ...patch } : q)),
});

/** Sets the enquiry status and keeps its quotation's status in step (they share the later statuses) */
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
  const [state, setState] = useState<State | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Actions read and write through this ref so that back-to-back calls see each other's changes.
  const ref = useRef<State | null>(null);
  const storageWarned = useRef(false);

  useEffect(() => {
    let loaded: State | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) loaded = JSON.parse(raw) as State;
    } catch {
      /* ignore corrupt storage */
    }
    ref.current = loaded ?? createSeed();
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

    const withLog = (s: State, kind: EmailKind, mail: MailDraft, enquiryId?: string, attachments: string[] = []): State => ({
      ...s,
      emailLogs: [
        {
          id: uid(),
          at: now(),
          kind,
          ...mail,
          body: `${mail.body}\n\n${s.settings.company.signature}`,
          attachments,
          enquiryId,
        },
        ...s.emailLogs,
      ],
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

    return {
      toast,

      reset() {
        commit(createSeed());
        toast("Demo data reset");
      },

      updateSettings(patch: Partial<Settings>) {
        const s = get();
        commit({ ...s, settings: { ...s.settings, ...patch } });
        toast("Settings saved");
      },

      setPorts(ports: State["ports"]) {
        commit({ ...get(), ports });
        toast("Ports saved");
      },

      markRead(id: string) {
        const s = get();
        if (s.inbox.find((m) => m.id === id)?.read) return;
        commit({ ...s, inbox: s.inbox.map((m) => (m.id === id ? { ...m, read: true } : m)) });
      },

      /** Adds a customer, or updates one when `id` is given */
      saveCustomer(data: Omit<Customer, "id">, id?: string): Customer {
        const s = get();
        const customer = { ...data, id: id ?? uid() };
        commit({ ...s, customers: id ? s.customers.map((c) => (c.id === id ? customer : c)) : [...s.customers, customer] });
        toast(`Customer ${customer.name} ${id ? "updated" : "added"}`);
        return customer;
      },

      saveAgent(data: Omit<Agent, "id">, id?: string) {
        const s = get();
        const agent = { ...data, id: id ?? uid() };
        commit({ ...s, agents: id ? s.agents.map((a) => (a.id === id ? agent : a)) : [...s.agents, agent] });
        toast(`${data.type} ${data.name} ${id ? "updated" : "added"}`);
      },

      addAirline(data: Omit<Airline, "id">) {
        const s = get();
        commit({ ...s, airlines: [...s.airlines, { ...data, id: uid() }] });
        toast(`Airline ${data.name} added`);
      },

      addRate(data: RateInput) {
        const s = get();
        commit({ ...s, rates: [...s.rates, { ...data, id: uid(), createdAt: now() }] });
        toast("Airline rate saved");
      },

      deleteRate(id: string) {
        const s = get();
        commit({ ...s, rates: s.rates.filter((r) => r.id !== id) });
      },

      /** Creates a new enquiry, or updates an existing one when `id` is given */
      saveEnquiry(data: EnquiryInput, id?: string): Enquiry {
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
          ref: buildRef(s.settings.enquiryRef, { company: s.settings.refPrefix, pol: data.pol, pod: data.pod, year: data.enquiryDate.slice(0, 4), seq: no }),
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
        commit(setStatus(get(), enquiryId, status));
        toast(`Status changed to ${status}`);
      },

      /** Rate request to one airline (one rate per mail); the mail goes to the To addresses as composed */
      sendRateRequest(enquiryId: string, airlineId: string, mail: MailDraft) {
        let s = withLog(get(), "Rate Request", mail, enquiryId);
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        const airline = s.airlines.find((a) => a.id === airlineId);
        s = patchEnquiry(s, enquiryId, {
          rateRequests: [...enq.rateRequests.filter((r) => r.airlineId !== airlineId), { airlineId, sentAt: now(), reminders: [] }],
        });
        if (enq.status === "New Enquiry") s = setStatus(s, enquiryId, "Rate Requested");
        commit(s);
        toast(`Rate request sent to ${airline?.name ?? "airline"}`);
      },

      sendRateReminder(enquiryId: string, airlineId: string, mail: MailDraft) {
        let s = withLog(get(), "Rate Reminder", mail, enquiryId);
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
          fromEmail: airline.email,
          subject: `RE: Request for Air Freight Rate – ${port(enq.pol)} to ${port(enq.pod)} [${enq.ref}]`,
          body: `Dear Airsteam team,\n\nThank you for your enquiry ${enq.ref}. Please find our rate below:\n\nRate/kg: INR ${base}\nAWB fee: INR ${[950, 1000, 1250][Math.floor(Math.random() * 3)]}\nMinimum charge: INR ${base * 25}\nTransit: ${1 + Math.floor(Math.random() * 3)} days\nValid until: ${addDays(30)}\n\nRegards,\n${airline.name}`,
          receivedAt: now(),
          read: false,
        };
        commit({ ...s, inbox: [email, ...s.inbox] });
        toast(`Reply from ${airline.name} received in Mail Box`);
      },

      /** A rate found elsewhere (e.g. an open source) entered by hand for one enquiry */
      addManualRate(enquiryId: string, rate: RateInput, saveToMaster: boolean): string {
        let s = get();
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        const id = uid();
        const newRates: AirlineRate[] = [{ ...rate, source: "Manual", enquiryId, id, createdAt: now() }];
        if (saveToMaster) newRates.push({ ...rate, source: "Master", enquiryId: undefined, id: uid(), createdAt: now() });
        s = { ...s, rates: [...s.rates, ...newRates] };
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

      /** Quotation ID is the enquiry ID ("EQ: AIS-0005-2026" → "QT: AIS-0005-2026") */
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
          ref: quotationRef(enq.ref, s.settings.enquiryRef.label),
          enquiryId,
          rateId,
          createdAt: now(),
          status: "Draft",
          statusAt: now(),
          airlineId: rate?.airlineId ?? enq.airlineIds[0] ?? s.airlines[0]?.id ?? "",
          currency,
          roe: s.settings.currencies.find((c) => c.code === currency)?.roe ?? 1,
          clearancePlace: enq.clearancePlace || s.settings.clearancePlaces[0],
          cargoDimension: `${enq.packages} packages / ${enq.grossWeight} kgs${enq.length ? ` (${enq.length} x ${enq.width} x ${enq.height} cm)` : ""}`,
          kindlyAttention: customer?.contact ?? "",
          lines: buildQuoteLines(enq.chargeableWeight, rate, s.settings),
          terms: s.settings.quotationTerms,
          reminders: [],
        };
        commit({
          ...patchEnquiry(s, enquiryId, { quotationId: quotation.id }),
          quotations: [quotation, ...s.quotations.filter((q) => q.id !== quotation.id)],
        });
        toast(`Quotation ${quotation.ref} created`);
        return quotation;
      },

      updateQuotation(id: string, patch: Partial<Quotation>) {
        commit(patchQuotation(get(), id, patch));
      },

      sendQuotation(id: string, mail: MailDraft) {
        let s = get();
        const q = s.quotations.find((x) => x.id === id)!;
        s = withLog(s, "Quotation", mail, q.enquiryId, [`${q.ref}.pdf`]);
        s = patchQuotation(s, id, { sentAt: now() });
        s = setStatus(s, q.enquiryId, "Quote Confirmation Pending");
        toast(`Quotation ${q.ref} emailed`);
        if (s.settings.alerts.notifyOnQuote) s = withNotification(s, q.enquiryId, `Quotation ${q.ref} has been emailed to you.`);
        commit(s);
      },

      sendQuotationReminder(id: string, mail: MailDraft) {
        let s = get();
        const q = s.quotations.find((x) => x.id === id)!;
        s = withLog(s, "Quotation Reminder", mail, q.enquiryId, [`${q.ref}.pdf`]);
        commit(patchQuotation(s, id, { reminders: [...q.reminders, now()] }));
        toast("Reminder sent to customer");
      },

      setQuotationStatus(id: string, status: QuotationStatus) {
        const s = get();
        const q = s.quotations.find((x) => x.id === id)!;
        commit(status === "Draft" ? patchQuotation(s, id, { status, statusAt: now() }) : setStatus(s, q.enquiryId, status));
        toast(`${q.ref} → ${status}`);
      },

      confirmShipmentDate(enquiryId: string, shipmentDate: string) {
        const s = setStatus(patchEnquiry(get(), enquiryId, { shipmentDate }), enquiryId, "Booking in Progress");
        commit(s);
        toast("Shipment date confirmed. Booking in progress");
      },

      confirmBooking(enquiryId: string, booking: Omit<Booking, "confirmedAt">) {
        let s = patchEnquiry(get(), enquiryId, { booking: { ...booking, confirmedAt: now() } });
        s = setStatus(s, enquiryId, "Booking Confirmed");
        if (s.settings.alerts.notifyOnBooking) {
          s = withNotification(
            s,
            enquiryId,
            `Booking confirmed on ${booking.flightNo} (${booking.flightDate}). Booking ref ${booking.ref}. Please share the invoice & packing list.`,
          );
        }
        commit(s);
      },

      receiveDocs(enquiryId: string, docs: Omit<ShipmentDocs, "receivedAt">) {
        const s = patchEnquiry(get(), enquiryId, { docs: { ...docs, receivedAt: now() } });
        commit(setStatus(s, enquiryId, "Docs Received"));
        toast("Invoice & packing list recorded");
      },

      /** "+ Add Booking": a Booking/Job from a confirmed quotation */
      createJob(data: JobInput): Job {
        let s = get();
        const job: Job = { ...data, id: uid(), ref: nextJobRef(s, data), createdAt: now() };
        s = { ...s, jobs: [job, ...s.jobs], counters: { ...s.counters, job: s.counters.job + 1 } };
        s = patchEnquiry(s, data.enquiryId, { jobId: job.id });
        const enq = s.enquiries.find((e) => e.id === data.enquiryId);
        if (enq && (enq.status === "Booking Confirmed" || enq.status === "Docs Received")) s = setStatus(s, enq.id, "Job Created");
        commit(s);
        toast(`Booking/Job ${job.ref} created`);
        return job;
      },

      updateJob(id: string, patch: Partial<Job>) {
        const s = get();
        commit({ ...s, jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) });
        toast("Booking/Job saved");
      },

      convertToJob(enquiryId: string): Job {
        const s = get();
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        // Re-converting (e.g. after a manual status change) reuses the existing job
        const existing = s.jobs.find((j) => j.id === enq.jobId);
        if (existing) {
          commit(setStatus(s, enquiryId, existing.awb ? "AWB Created" : "Job Created"));
          return existing;
        }
        const q = s.quotations.find((x) => x.id === enq.quotationId)!;
        const job = this.createJob(jobDraft(s, enq, q));
        commit(setStatus(get(), enquiryId, "Job Created"));
        return job;
      },

      saveInvoice(data: InvoiceInput, id?: string): CustomerInvoice {
        const s = get();
        if (id) {
          const inv = { ...s.invoices.find((x) => x.id === id)!, ...data };
          commit({ ...s, invoices: s.invoices.map((x) => (x.id === id ? inv : x)) });
          toast(`Invoice ${inv.no} saved`);
          return inv;
        }
        const inv: CustomerInvoice = { ...data, id: uid(), no: nextInvoiceNo(s), createdAt: now() };
        commit({ ...s, invoices: [inv, ...s.invoices], counters: { ...s.counters, invoice: s.counters.invoice + 1 } });
        toast(`Invoice ${inv.no} created`);
        return inv;
      },

      deleteInvoice(id: string) {
        const s = get();
        commit({ ...s, invoices: s.invoices.filter((x) => x.id !== id) });
      },

      createAwb(jobId: string, awb: Awb) {
        let s = get();
        const job = s.jobs.find((j) => j.id === jobId)!;
        s = { ...s, jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, awb, awbNo: awb.number, flightNo: j.flightNo || awb.flightNo, flightDate: j.flightDate || awb.flightDate } : j)) };
        s = setStatus(s, job.enquiryId, "AWB Created");
        if (s.settings.alerts.notifyOnAwb) {
          s = withNotification(s, job.enquiryId, `${awb.type} AWB ${awb.number} issued for your shipment on ${awb.flightNo}.`, "Email");
        }
        commit(s);
      },

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
        const s = withLog(get(), "General", mail, enquiryId);
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
    return (
      <div className="grid h-screen place-items-center" role="status">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" aria-hidden />
          Loading workspace…
        </div>
      </div>
    );
  }

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="max-w-sm rounded-lg bg-slate-900 px-3 py-2.5 text-sm text-white shadow-lg">
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
    }),
    [state],
  );
}
