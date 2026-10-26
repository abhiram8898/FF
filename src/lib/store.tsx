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
} from "./types";
import { QUOTATION_STATUSES } from "./types";
import { addDays, buildQuoteLines, fmtPort, makeRef, uid } from "./utils";

const STORAGE_KEY = "airsteam-ff:v2";

export type EnquiryInput = Omit<Enquiry, "id" | "no" | "ref" | "createdAt" | "status" | "statusAt" | "rateRequests">;
export type RateInput = Omit<AirlineRate, "id" | "createdAt">;

interface Toast {
  id: string;
  message: string;
}

const now = () => new Date().toISOString();

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
    } catch {
      /* storage full or unavailable */
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

      addCustomer(data: Omit<Customer, "id">): Customer {
        const s = get();
        const customer = { ...data, id: uid() };
        commit({ ...s, customers: [...s.customers, customer] });
        toast(`Customer ${customer.name} added`);
        return customer;
      },

      addAgent(data: Omit<Agent, "id">) {
        const s = get();
        commit({ ...s, agents: [...s.agents, { ...data, id: uid() }] });
        toast(`${data.type} ${data.name} added`);
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
          ref: makeRef("EQ", s.settings.refPrefix, no, data.enquiryDate.slice(0, 4)),
          createdAt: now(),
          status: "New Enquiry",
          statusAt: now(),
          rateRequests: [],
        };
        commit({
          ...s,
          enquiries: [enquiry, ...s.enquiries],
          inbox: s.inbox.map((m) => (m.id === data.sourceEmailId ? { ...m, enquiryId: enquiry.id, read: true } : m)),
          counters: { enquiry: no },
        });
        toast(`Enquiry ${enquiry.ref} saved`);
        return enquiry;
      },

      changeStatus(enquiryId: string, status: EnquiryStatus) {
        commit(setStatus(get(), enquiryId, status));
        toast(`Status changed to ${status}`);
      },

      /** One email per airline (one rate per mail) */
      sendRateRequest(enquiryId: string, airlineIds: string[], mail: MailDraft) {
        let s = get();
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        for (const airlineId of airlineIds) {
          const airline = s.airlines.find((a) => a.id === airlineId)!;
          s = withLog(s, "Rate Request", { ...mail, to: [airline.email] }, enquiryId);
        }
        const kept = enq.rateRequests.filter((r) => !airlineIds.includes(r.airlineId));
        s = patchEnquiry(s, enquiryId, {
          rateRequests: [...kept, ...airlineIds.map((airlineId) => ({ airlineId, sentAt: now(), reminders: [] }))],
        });
        if (enq.status === "New Enquiry") s = setStatus(s, enquiryId, "Rate Requested");
        commit(s);
        toast(`Rate request sent to ${airlineIds.length} airline${airlineIds.length > 1 ? "s" : ""}`);
      },

      sendRateReminder(enquiryId: string, airlineIds: string[], mail: MailDraft) {
        let s = get();
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        for (const airlineId of airlineIds) {
          const airline = s.airlines.find((a) => a.id === airlineId)!;
          s = withLog(s, "Rate Reminder", { ...mail, to: [airline.email] }, enquiryId);
        }
        s = patchEnquiry(s, enquiryId, {
          rateRequests: enq.rateRequests.map((r) => (airlineIds.includes(r.airlineId) ? { ...r, reminders: [...r.reminders, now()] } : r)),
        });
        commit(s);
        toast(`Reminder sent to ${airlineIds.length} airline${airlineIds.length > 1 ? "s" : ""}`);
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

      /** "Add to Enquiry" on an airline reply: links the mail, stores the rate, and moves to Rate Received */
      addReplyToEnquiry(emailId: string, enquiryId: string, rate: RateInput, saveToMaster: boolean) {
        let s = get();
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        const newRates: AirlineRate[] = [{ ...rate, source: "Airline Reply", enquiryId, id: uid(), createdAt: now() }];
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
          ref: enq.ref.replace(/^EQ:/, "QT:"),
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

      convertToJob(enquiryId: string): Job {
        const s = get();
        const enq = s.enquiries.find((e) => e.id === enquiryId)!;
        // Re-converting (e.g. after a manual status change) reuses the existing job
        const existing = s.jobs.find((j) => j.id === enq.jobId);
        if (existing) {
          commit(setStatus(s, enquiryId, existing.awb ? "AWB Created" : "Job Created"));
          return existing;
        }
        const job: Job = {
          id: uid(),
          ref: enq.ref.replace(/^EQ:/, "JOB:"),
          enquiryId,
          quotationId: enq.quotationId!,
          createdAt: now(),
        };
        const next = setStatus(patchEnquiry({ ...s, jobs: [job, ...s.jobs] }, enquiryId, { jobId: job.id }), enquiryId, "Job Created");
        commit(next);
        toast(`Quotation converted to ${job.ref}`);
        return job;
      },

      createAwb(jobId: string, awb: Awb) {
        let s = get();
        const job = s.jobs.find((j) => j.id === jobId)!;
        s = { ...s, jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, awb } : j)) };
        s = setStatus(s, job.enquiryId, "AWB Created");
        if (s.settings.alerts.notifyOnAwb) {
          s = withNotification(s, job.enquiryId, `${awb.type} AWB ${awb.number} issued for your shipment on ${awb.flightNo}.`, "Email");
        }
        commit(s);
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
          <div key={t.id} className="max-w-sm rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
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
