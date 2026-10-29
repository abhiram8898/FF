"use client";

import { useState } from "react";
import { useLookups, useStore } from "@/lib/store";
import { QUOTATION_STATUSES, type Quotation, type QuotationStatus } from "@/lib/types";
import { fmtDate, fmtDateTime, lineGst, lineNet, money, quoteTotals, volumetricWeight } from "@/lib/utils";
import { ComposeEmail } from "./ComposeEmail";
import { FooterBanner, Letterhead } from "./letterhead";
import { Button, Field, Modal, Select, StatusBadge } from "./ui";

/** Printable sales quotation, laid out like the company's sample */
function QuotationDocument({ q }: { q: Quotation }) {
  const { state } = useStore();
  const { enquiry, customer, airline, portLabel } = useLookups();
  const enq = enquiry(q.enquiryId)!;
  const cust = customer(enq.customerId);
  const rate = state.rates.find((r) => r.id === q.rateId);
  const t = quoteTotals(q);
  const { company } = state.settings;
  const f2 = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const groups = [
    { title: airline(q.airlineId)?.name.toUpperCase() ?? "AIRLINE CHARGES", lines: q.lines.filter((l) => l.group === "Airline") },
    { title: "", lines: q.lines.filter((l) => l.group === "Agency") },
  ].filter((g) => g.lines.length);

  const info = (rows: [string, React.ReactNode][]) => (
    <dl className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5">
      {rows.map(([k, v]) => [
        <dt key={`${k}-k`} className="font-semibold">
          {k}
        </dt>,
        <dd key={`${k}-v`}>: {v}</dd>,
      ])}
    </dl>
  );
  const cell = "border border-navy-700/60 px-2 py-1.5";

  return (
    <div className="text-xs text-navy-800">
      <Letterhead />
      <div className="mb-3 text-center text-sm font-bold">SALES QUOTATION</div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex gap-2">
          <span className="font-semibold">To</span>
          <div>
            <div className="font-semibold">M/s. {cust?.name}</div>
            <div className="whitespace-pre-line">{cust?.address}</div>
            {q.kindlyAttention && <div>Kind Attn: {q.kindlyAttention}</div>}
          </div>
        </div>
        {info([
          ["Quotation No", <b key="no">{q.ref}</b>],
          ["Date", fmtDate(q.createdAt)],
        ])}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {info([
          ["Terms of Shipment", `${enq.incoterm} ${enq.cargoMode.toUpperCase()}`],
          ["Port of Loading", portLabel(enq.pol)],
          ["Port of Discharge", portLabel(enq.pod)],
          ["Commodity", enq.commodity.toUpperCase()],
        ])}
        {info([
          ["Dimension", q.cargoDimension],
          ["Total Packages", f2(enq.packages)],
          ["Gross Weight", f2(enq.grossWeight)],
          ["Volume Weight", f2(Math.max(volumetricWeight(enq), enq.chargeableWeight))],
        ])}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse">
          <thead>
            <tr className="font-semibold [&>th]:border [&>th]:border-navy-700/60 [&>th]:px-2 [&>th]:py-2">
              <th className="text-left">Particulars</th>
              <th>Currency</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Unit</th>
              <th className="text-right">Ex Rate</th>
              <th className="text-right">Net Amount</th>
              <th className="text-right">GST%</th>
              <th className="text-right">Total GST</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const net = g.lines.reduce((s, l) => s + lineNet(l, q.roe), 0);
              const gst = g.lines.reduce((s, l) => s + lineGst(l, q.roe), 0);
              return [
                g.title && (
                  <tr key={`${g.title}-h`}>
                    <td colSpan={9} className={`${cell} font-bold underline`}>
                      {g.title}
                    </td>
                  </tr>
                ),
                ...g.lines.map((l) => (
                  <tr key={l.id} className="font-semibold">
                    <td className={cell}>{l.particulars}</td>
                    <td className={`${cell} text-center`}>{q.currency}</td>
                    {/* The customer sees the selling rate: rate + markup */}
                    <td className={`${cell} text-right tabular-nums`}>{f2(l.rate + l.markup)}</td>
                    <td className={`${cell} text-right tabular-nums`}>{f2(l.qty)}</td>
                    <td className={`${cell} text-right tabular-nums`}>{f2(q.roe)}</td>
                    <td className={`${cell} text-right tabular-nums`}>{f2(lineNet(l, q.roe))}</td>
                    <td className={`${cell} text-right tabular-nums`}>{f2(l.gstPercent)}</td>
                    <td className={`${cell} text-right tabular-nums`}>{f2(lineGst(l, q.roe))}</td>
                    <td className={cell}>{l.remarks}</td>
                  </tr>
                )),
                <tr key={`${g.title}-t`} className="font-semibold">
                  <td className={cell} colSpan={4} />
                  <td className={`${cell} text-right`}>Total</td>
                  <td className={`${cell} text-right tabular-nums`}>{f2(net)}</td>
                  <td className={cell} />
                  <td className={`${cell} text-right tabular-nums`}>{f2(gst)}</td>
                  <td className={`${cell} text-right tabular-nums`}>{f2(net + gst)}</td>
                </tr>,
              ];
            })}
            <tr className="font-semibold">
              <td className={cell} colSpan={5}>
                <span className="float-right">Total</span>
              </td>
              <td className={`${cell} text-right tabular-nums`}>{f2(t.net)}</td>
              <td className={cell} />
              <td className={`${cell} text-right tabular-nums`}>{f2(t.gst)}</td>
              <td className={cell} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {info([
          ["Routing", enq.route.toUpperCase()],
          ["Transit Time", enq.transitTime || (rate ? `${rate.transitDays} day${rate.transitDays !== 1 ? "s" : ""}` : "")],
          ["Rate Validity", rate ? fmtDate(rate.validUntil) : ""],
        ])}
        <div className="flex items-start justify-end gap-3 text-sm font-bold">
          Grand Total <span className="min-w-32 border border-navy-700/60 px-2 py-1 text-right tabular-nums">{f2(t.grand)}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="font-semibold">Notes:</div>
        <p className="whitespace-pre-wrap">{q.terms}</p>
      </div>
      <div className="mt-3 text-right font-semibold">
        For {company.name.toUpperCase()}
        <div className="mt-10">Authorised Signatory</div>
      </div>
      <FooterBanner />
    </div>
  );
}

export function PreviewModal({ q, onClose, onSend }: { q: Quotation; onClose: () => void; onSend?: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`Preview · ${q.ref}`}
      wide
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">Print this preview or save it as PDF from your browser.</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print / Save PDF
            </Button>
            {onSend && <Button onClick={onSend}>Send to Customer</Button>}
          </div>
        </div>
      }
    >
      <QuotationDocument q={q} />
    </Modal>
  );
}

/** FRD XI–XV: Send to Customer → Compose Email (customer email from masters, PDF attached) */
export function SendQuotationFlow({ q, reminder, onClose }: { q: Quotation; reminder?: boolean; onClose: () => void }) {
  const { state, actions } = useStore();
  const { enquiry, customer, portLabel } = useLookups();
  const enq = enquiry(q.enquiryId)!;
  const cust = customer(enq.customerId);
  const total = money(quoteTotals(q).grand);

  return (
    <ComposeEmail
      title={reminder ? "Send Reminder to Customer" : "Compose Email"}
      initial={{
        to: cust?.email ? [cust.email] : [],
        cc: state.settings.company.email,
        subject: `${reminder ? "Reminder: " : ""}Quotation ${q.ref} – ${portLabel(enq.pol)} to ${portLabel(enq.pod)}`,
        body: reminder
          ? `Dear ${q.kindlyAttention || "Sir / Madam"},\n\nThis is a gentle reminder on our quotation ${q.ref} (${total}) sent on ${fmtDate(q.sentAt)}.\n\nKindly confirm so that we can proceed with the booking.`
          : `Dear ${q.kindlyAttention || "Sir / Madam"},\n\nPlease find attached our quotation ${q.ref} for your ${enq.commodity} shipment from ${portLabel(enq.pol)} to ${portLabel(enq.pod)}.\n\nGrand Total: ${total}\n\nKindly confirm the rate and the shipment date to proceed with the booking.`,
      }}
      attachments={[`${q.ref}.pdf`]}
      onClose={onClose}
      onSend={(mail) => {
        if (reminder) actions.sendQuotationReminder(q.id, mail);
        else actions.sendQuotation(q.id, mail);
        onClose();
      }}
    />
  );
}

/**
 * Where "Take Action" leads for a quotation: the editor while it's a draft, the status / reminder
 * dialog while waiting on the client (null), and otherwise the enquiry's next step
 * (shipment date, booking, documents…).
 */
export function takeActionHref(q: Quotation): string | null {
  if (q.status === "Draft") return `/quotations/${q.id}`;
  if (q.status === "Quote Confirmation Pending") return null;
  return `/enquiries/${q.enquiryId}#next-action`;
}

/** FRD XVI / XVIII: Quotation Actions (update status, send reminder) */
export function QuotationActionsModal({ q, onClose }: { q: Quotation; onClose: () => void }) {
  const { actions } = useStore();
  const [status, setStatus] = useState<QuotationStatus>(q.status);
  const [reminder, setReminder] = useState(false);

  if (reminder) return <SendQuotationFlow q={q} reminder onClose={onClose} />;

  return (
    <Modal
      open
      onClose={onClose}
      title="Quotation Actions"
      footer={
        <div className="flex w-full flex-wrap justify-between gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!q.sentAt} onClick={() => setReminder(true)}>
              Send Reminder
            </Button>
            <Button
              disabled={status === q.status}
              onClick={() => {
                actions.setQuotationStatus(q.id, status);
                onClose();
              }}
            >
              Update Status
            </Button>
          </div>
        </div>
      }
    >
      <div className="mb-3 flex items-center gap-2 text-sm">
        <b>{q.ref}</b> · <StatusBadge status={q.status} />
      </div>
      <Field label="Update Status">
        <Select value={status} onChange={(e) => setStatus(e.target.value as QuotationStatus)}>
          {QUOTATION_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </Field>
      <p className="mt-3 text-xs text-slate-500">
        {q.sentAt ? `Sent ${fmtDateTime(q.sentAt)}.` : "Not sent yet."}
        {q.reminders.length > 0 && ` ${q.reminders.length} reminder(s), last ${fmtDateTime(q.reminders.at(-1))}.`}
      </p>
    </Modal>
  );
}
