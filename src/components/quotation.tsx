"use client";

import { useState } from "react";
import { useLookups, useStore } from "@/lib/store";
import { QUOTATION_STATUSES, type Quotation, type QuotationStatus } from "@/lib/types";
import { fmtDate, fmtDateTime, lineGst, lineNet, lineTotal, money, quoteTotals, volumeCbm } from "@/lib/utils";
import { ComposeEmail } from "./ComposeEmail";
import { Button, Field, Modal, Select, StatusBadge } from "./ui";

/** Printable sales quotation (FRD p.11–12) */
function QuotationDocument({ q }: { q: Quotation }) {
  const { state } = useStore();
  const { enquiry, customer, airline, portLabel } = useLookups();
  const enq = enquiry(q.enquiryId)!;
  const cust = customer(enq.customerId);
  const t = quoteTotals(q);
  const { company } = state.settings;

  const groups = [
    { title: airline(q.airlineId)?.name.toUpperCase() ?? "AIRLINE CHARGES", lines: q.lines.filter((l) => l.group === "Airline") },
    { title: "AGENCY / CLEARANCE CHARGES", lines: q.lines.filter((l) => l.group === "Agency") },
  ];

  return (
    <div className="text-sm text-slate-800">
      <div className="flex items-start justify-between gap-4 border-b-2 border-brand-700 pb-3">
        <div>
          <div className="text-lg font-bold text-brand-800">{company.name}</div>
          <div className="max-w-sm text-xs text-slate-500">{company.address}</div>
          <div className="text-xs text-slate-500">
            {company.phone} · {company.email}
          </div>
          <div className="text-xs text-slate-500">
            GSTIN: {company.gstin} · PAN: {company.pan}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold">SALES QUOTATION</div>
          <div className="text-xs">Quotation No: {q.ref}</div>
          <div className="text-xs text-slate-500">Date: {fmtDate(q.createdAt)}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-4 text-xs sm:grid-cols-2">
        <div>
          <div className="font-semibold">To</div>
          <div>{cust?.name}</div>
          <div>{cust?.address}</div>
          <div>{cust?.email}</div>
          {q.kindlyAttention && <div>Kind Attn: {q.kindlyAttention}</div>}
        </div>
        <div>
          <div className="font-semibold">Shipment Details</div>
          <div>
            Mode: {enq.cargoMode} · {enq.shipmentMode} · {enq.incoterm}
          </div>
          <div>POL: {portLabel(enq.pol)}</div>
          <div>POD: {portLabel(enq.pod)}</div>
          <div>Commodity: {enq.commodity}</div>
          <div>
            Weight: {enq.grossWeight} kg (chargeable {enq.chargeableWeight} kg) · CBM: {volumeCbm(enq).toFixed(4)}
          </div>
          <div>Dimension: {q.cargoDimension}</div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-xs">
          <thead>
            <tr className="bg-brand-700 text-white [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left">
              <th>Particulars</th>
              <th>Currency</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Markup</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Ex Rate</th>
              <th className="text-right">Net Amount</th>
              <th className="text-right">GST</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => [
              <tr key={g.title} className="bg-slate-50">
                <td colSpan={9} className="px-2 py-1 font-semibold text-brand-800 underline">
                  {g.title}
                </td>
              </tr>,
              ...g.lines.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 [&>td]:px-2 [&>td]:py-1.5">
                  <td>{l.particulars}</td>
                  <td>{q.currency}</td>
                  <td className="text-right">{l.rate.toFixed(2)}</td>
                  <td className="text-right">{l.markup.toFixed(2)}</td>
                  <td className="text-right">{l.qty}</td>
                  <td className="text-right">{q.roe.toFixed(2)}</td>
                  <td className="text-right">{lineNet(l, q.roe).toFixed(2)}</td>
                  <td className="text-right">
                    {lineGst(l, q.roe).toFixed(2)} ({l.gstPercent}%)
                  </td>
                  <td className="text-right">{lineTotal(l, q.roe).toFixed(2)}</td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-right text-sm font-semibold">Grand Total: {money(t.grand)}</div>

      <div className="mt-4 text-xs">
        <div className="font-semibold">Notes / Terms & Conditions</div>
        <p className="whitespace-pre-wrap text-slate-600">{q.terms}</p>
        <pre className="mt-3 font-sans whitespace-pre-wrap text-slate-600">{company.signature}</pre>
      </div>
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
