"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BellRing, ExternalLink, Mail, MessageCircle, Pencil, RefreshCw, Scale, Send } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Channel, Enquiry } from "@/lib/types";
import { fmtDate, fmtDateTime, laps, money, quoteTotals, ratesForRoute, volumeCbm } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  KeyValue,
  LinkButton,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Textarea,
  linkCls,
} from "@/components/ui";
import { ChangeStatusModal, ForwardFlow, GetRatesModal, ReminderFlow, RouteInsights, WorkflowStepper } from "@/components/workflow";

type Dialog = { kind: "rates" | "forward" | "status" | "notify" } | { kind: "reminder"; airlineIds: string[] } | null;

function EnquiryPageInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { enquiry } = useLookups();
  const enq = enquiry(id);
  if (!enq) {
    return (
      <Empty action={<Link href="/enquiries" className={linkCls}>Back to Enquiries</Link>}>
        This enquiry doesn&apos;t exist. It may have been removed when the demo data was reset.
      </Empty>
    );
  }
  const open = params.get("open");
  return <EnquiryWorkspace key={enq.id} enq={enq} initialDialog={open === "rates" || open === "forward" ? { kind: open } : null} />;
}

export default function EnquiryPage() {
  return (
    <Suspense>
      <EnquiryPageInner />
    </Suspense>
  );
}

function EnquiryWorkspace({ enq, initialDialog }: { enq: Enquiry; initialDialog: Dialog }) {
  const { state } = useStore();
  const { customer, portLabel, quotation, airline } = useLookups();
  const [dialog, setDialog] = useState<Dialog>(initialDialog);
  const close = () => setDialog(null);
  const cust = customer(enq.customerId);
  const qt = quotation(enq.quotationId);
  const email = state.inbox.find((m) => m.id === enq.sourceEmailId);
  const pendingRequests = enq.rateRequests.filter((r) => !r.repliedAt).map((r) => r.airlineId);

  // One timeline for everything sent about this enquiry
  const activity = [
    ...state.emailLogs.filter((l) => l.enquiryId === enq.id).map((l) => ({ id: l.id, at: l.at, kind: l.kind, detail: `To ${l.to.join("; ")}`, email: true })),
    ...state.notifications
      .filter((n) => n.enquiryId === enq.id)
      .map((n) => ({ id: n.id, at: n.at, kind: `${n.channel} to client`, detail: n.message, email: n.channel === "Email" })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <PageHeader
        back={{ href: "/enquiries", label: "Enquiries" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {enq.ref} <StatusBadge status={enq.status} />
          </span>
        }
        subtitle={
          <>
            {cust?.name} · {portLabel(enq.pol)} → {portLabel(enq.pod)} · in this status for {laps(enq.statusAt).toLowerCase()}
          </>
        }
        actions={
          <>
            <LinkButton href={`/enquiries/${enq.id}/edit`} variant="secondary" size="sm">
              <Pencil size={14} aria-hidden /> Edit Enquiry
            </LinkButton>
            <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "status" })}>
              <RefreshCw size={14} aria-hidden /> Change Status
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "notify" })}>
              <BellRing size={14} aria-hidden /> Notify Client
            </Button>
          </>
        }
      />

      <Card className="mb-6" bodyClassName="px-2 py-4">
        <WorkflowStepper status={enq.status} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <NextAction enq={enq} openDialog={setDialog} />

          {enq.rateRequests.length > 0 && (
            <Card
              title="Forwarded Rate Requests"
              actions={
                pendingRequests.length > 1 && (
                  <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "reminder", airlineIds: pendingRequests })}>
                    Remind all pending
                  </Button>
                )
              }
              bodyClassName="p-0"
            >
              <Table>
                <thead>
                  <tr>
                    <th>Airline</th>
                    <th>Sent / Reminders</th>
                    <th>Response</th>
                  </tr>
                </thead>
                <tbody>
                  {enq.rateRequests.map((r) => (
                    <RateRequestRow key={r.airlineId} enq={enq} request={r} onRemind={() => setDialog({ kind: "reminder", airlineIds: [r.airlineId] })} />
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          <Card title="Enquiry Details">
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Customer and routing</h3>
                <KeyValue
                  cols={4}
                  items={[
                    ["Customer", cust?.name],
                    ["Enquiry Date", fmtDate(enq.enquiryDate)],
                    ["Branch / FY", `${enq.branch} / ${enq.financialYear}`],
                    ["Mode / Type", `${enq.cargoMode} / ${enq.shipmentMode}`],
                    ["Job Type", enq.jobType],
                    ["INCO Terms", enq.incoterm],
                    ["POL", portLabel(enq.pol)],
                    ["POD", portLabel(enq.pod)],
                    ["Route", enq.route],
                  ]}
                />
              </section>
              <section className="border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Cargo</h3>
                <KeyValue
                  cols={4}
                  items={[
                    ["Commodity", enq.commodity],
                    ["Product Type", enq.productType],
                    ["Packages", `${enq.packages} ${enq.packageType} (${enq.unitType})`],
                    ["Dimensions", enq.length ? `${enq.length} × ${enq.width} × ${enq.height} cm` : ""],
                    ["Gross Weight", `${enq.grossWeight} kg`],
                    ["Chargeable Weight", `${enq.chargeableWeight} kg`],
                    ["Volume", `${volumeCbm(enq).toFixed(4)} CBM`],
                    ["Requested Date", enq.requestedDate ? fmtDate(enq.requestedDate) : ""],
                    ["Clearance Place", enq.clearancePlace],
                    ["Transit Time", enq.transitTime],
                  ]}
                />
              </section>
              <section className="border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Assignment</h3>
                <KeyValue
                  cols={4}
                  items={[
                    ["Preferred Airlines", enq.airlineIds.map((a) => airline(a)?.name).join(", ")],
                    ["Sales Person", enq.salesPerson],
                    ["Pricing Person", enq.pricingPerson],
                  ]}
                />
              </section>
              {enq.remarks && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{enq.remarks}</p>}
            </div>
          </Card>

          {(qt || enq.booking || enq.docs || enq.shipmentDate) && (
            <Card title="Shipment Record">
              <KeyValue
                cols={4}
                items={[
                  ["Quotation", qt ? <Link href={`/quotations/${qt.id}`} className={linkCls}>{qt.ref}</Link> : ""],
                  ["Quotation Status", qt?.status],
                  ["Grand Total", qt ? money(quoteTotals(qt).grand) : ""],
                  ["Shipment Date", enq.shipmentDate ? fmtDate(enq.shipmentDate) : ""],
                  ["Booking Ref", enq.booking?.ref],
                  ["Flight", enq.booking ? `${enq.booking.flightNo} · ${fmtDate(enq.booking.flightDate)}` : ""],
                  ["Invoice", enq.docs ? `${enq.docs.invoiceNo} · ${money(enq.docs.invoiceValue)}` : ""],
                  ["Packing List", enq.docs ? (enq.docs.packingList ? "Received" : "Pending") : ""],
                ]}
              />
            </Card>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          {email && (
            <Card title="Source email">
              <Link href={`/mailbox?id=${email.id}`} className={`${linkCls} text-sm`}>
                {email.subject}
              </Link>
              <div className="mt-0.5 text-xs text-slate-500">
                {email.fromName} · {fmtDateTime(email.receivedAt)}
              </div>
            </Card>
          )}
          <Card title="Route insights">
            <RouteInsights enquiry={enq} />
          </Card>
          <Card title="Activity">
            {activity.length ? (
              <ol className="space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-2.5 text-sm">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500" aria-hidden>
                      {a.email ? <Mail size={12} /> : <MessageCircle size={12} />}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">{a.kind}</div>
                      <div className="truncate text-xs text-slate-500" title={a.detail}>
                        {a.detail}
                      </div>
                      <div className="text-xs text-slate-400">{fmtDateTime(a.at)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-500">No emails or notifications sent yet.</p>
            )}
          </Card>
        </aside>
      </div>

      {dialog?.kind === "rates" && <GetRatesModal enq={enq} onClose={close} onForward={() => setDialog({ kind: "forward" })} />}
      {dialog?.kind === "forward" && <ForwardFlow enq={enq} onClose={close} />}
      {dialog?.kind === "reminder" && <ReminderFlow enq={enq} airlineIds={dialog.airlineIds} onClose={close} />}
      {dialog?.kind === "status" && <ChangeStatusModal enq={enq} onClose={close} />}
      {dialog?.kind === "notify" && <NotifyModal enq={enq} onClose={close} />}
    </>
  );
}

function RateRequestRow({ enq, request: r, onRemind }: { enq: Enquiry; request: Enquiry["rateRequests"][number]; onRemind: () => void }) {
  const { state, actions } = useStore();
  const { airline } = useLookups();
  const a = airline(r.airlineId);
  const rate = state.rates.find((x) => x.enquiryId === enq.id && x.airlineId === r.airlineId && x.source === "Airline Reply");
  // An unlinked reply from this airline that mentions the enquiry ref
  const waitingReply = state.inbox.find((m) => m.from === "Airline" && m.airlineId === r.airlineId && !m.enquiryId && m.subject.includes(enq.ref));

  return (
    <tr>
      <td>
        <div className="font-medium">{a?.name}</div>
        <div className="text-xs break-all text-slate-500">{a?.email}</div>
      </td>
      <td className="text-xs whitespace-nowrap text-slate-600">
        {fmtDateTime(r.sentAt)}
        <div className="text-slate-500">{r.reminders.length ? `${r.reminders.length} reminder${r.reminders.length > 1 ? "s" : ""} · last ${fmtDateTime(r.reminders.at(-1))}` : "No reminders"}</div>
      </td>
      <td>
        {r.repliedAt ? (
          <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">Rate received{rate ? ` · ${money(rate.ratePerKg, rate.currency)}/kg` : ""}</Badge>
        ) : waitingReply ? (
          <Badge className="bg-violet-50 text-violet-800 ring-violet-200">Reply in Mail Box</Badge>
        ) : (
          <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Awaiting reply</Badge>
        )}
        {waitingReply ? (
          <LinkButton href={`/mailbox?id=${waitingReply.id}`} size="sm" className="mt-2 flex w-fit">
            Open reply
          </LinkButton>
        ) : (
          !r.repliedAt && (
            <div className="mt-2 flex flex-wrap gap-1">
              <Button size="sm" variant="secondary" onClick={onRemind}>
                Remind
              </Button>
              <Button size="sm" variant="ghost" onClick={() => actions.simulateAirlineReply(enq.id, r.airlineId)} title="Demo only: simulate the airline replying by email">
                Simulate reply
              </Button>
            </div>
          )
        )}
      </td>
    </tr>
  );
}

/** The contextual "what to do next" panel */
function NextAction({ enq, openDialog }: { enq: Enquiry; openDialog: (d: Dialog) => void }) {
  const router = useRouter();
  const { state, actions } = useStore();
  const { airline, quotation, job } = useLookups();
  const qt = quotation(enq.quotationId);
  const j = job(enq.jobId);
  const rates = ratesForRoute(state.rates, enq.pol, enq.pod, enq.id);
  const carrier = airline(qt?.airlineId);
  const ratePhase = ["New Enquiry", "Rate Requested", "Rate Received"].includes(enq.status);
  const closed = enq.status === "Cancelled" || enq.status === "Lost";
  // A status set by hand can run ahead of the data; fall back to the step that is actually missing
  const missingQuote = !qt && !ratePhase && !closed;
  const missingJob = !j && (enq.status === "Job Created" || enq.status === "AWB Created");

  const row = (text: React.ReactNode, action: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
      <p className="min-w-0 flex-1">{text}</p>
      {action}
    </div>
  );

  let body: React.ReactNode;
  if (closed) {
    body = row(
      <>This enquiry is closed as <b>{enq.status}</b>.</>,
      <Button variant="secondary" onClick={() => openDialog({ kind: "status" })}>
        Reopen (Change Status)
      </Button>,
    );
  } else if (ratePhase || missingQuote) {
    body = (
      <>
        {missingQuote && <p className="mb-3 text-sm text-amber-800">The status is <b>{enq.status}</b> but there is no quotation yet. Create one first.</p>}
        {qt?.status === "Draft" && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
            Draft quotation {qt.ref} is ready to review and send.
            <LinkButton href={`/quotations/${qt.id}`} size="sm">
              Open quotation
            </LinkButton>
          </div>
        )}
        <p className="text-sm text-slate-700">
          {rates.length ? (
            <>
              <b>{rates.length} rate{rates.length > 1 && "s"} available</b> for this POL & POD. Compare them and create the quotation.
            </>
          ) : enq.status === "Rate Requested" ? (
            <>
              <b>Waiting for airline rates.</b> When an airline replies, open the mail in the Mail Box and click <i>Add to Enquiry</i>.
            </>
          ) : (
            <>
              <b>No rates in the masters</b> for this POL & POD. Forward the enquiry to airlines to request rates.
            </>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant={rates.length ? "primary" : "secondary"} onClick={() => openDialog({ kind: "rates" })}>
            <Scale size={15} aria-hidden /> Get Rates / Compare
          </Button>
          <Button variant={rates.length ? "secondary" : "primary"} onClick={() => openDialog({ kind: "forward" })}>
            <Send size={15} aria-hidden /> Save & Forward to airlines
          </Button>
        </div>
      </>
    );
  } else if (missingJob) {
    body = row(
      "The status says a job exists, but none was created. Convert the quotation to a job now.",
      <Button onClick={() => router.push(`/shipments/${actions.convertToJob(enq.id).id}`)}>Convert Quotation to Job</Button>,
    );
  } else {
    switch (enq.status) {
      case "Quote Confirmation Pending":
        body = row(
          <>
            Quotation <b>{qt?.ref}</b> was emailed on {fmtDateTime(qt?.sentAt)}. Waiting for the client to confirm. Update the status or send a reminder from the
            quotation.
          </>,
          <LinkButton href={`/quotations/${qt?.id}`}>Open quotation</LinkButton>,
        );
        break;
      case "Waiting for Shipment Date":
        body = <ShipmentDateForm enq={enq} />;
        break;
      case "Booking in Progress":
        body = <BookingForm enq={enq} portalUrl={carrier?.portalUrl} carrierName={carrier?.name} carrierCode={carrier?.code} />;
        break;
      case "Booking Confirmed":
        body = <DocsForm enq={enq} />;
        break;
      case "Docs Received":
        body = row(
          "Invoice and packing list received. Convert the quotation to a shipment job.",
          <Button onClick={() => router.push(`/shipments/${actions.convertToJob(enq.id).id}`)}>Convert Quotation to Job</Button>,
        );
        break;
      default:
        body = row(
          <>
            Shipment <b>{j?.ref}</b> {j?.awb ? `· ${j.awb.type} AWB ${j.awb.number} issued. This shipment is complete.` : "is created. Next, create the AWB."}
          </>,
          <LinkButton href={`/shipments/${j?.id}`}>{j?.awb ? "View shipment" : "Create AWB"}</LinkButton>,
        );
    }
  }

  return (
    <Card title="Next action" className="border-brand-200 ring-1 ring-brand-100">
      {body}
    </Card>
  );
}

function ShipmentDateForm({ enq }: { enq: Enquiry }) {
  const { actions } = useStore();
  const [date, setDate] = useState(enq.requestedDate || "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        actions.confirmShipmentDate(enq.id, date);
      }}
    >
      <p className="mb-3 text-sm text-slate-700">
        The client confirmed the rate. <b>Follow up for the shipment date</b> and enter it once confirmed. The status then moves to <i>Booking in Progress</i>.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Confirmed shipment date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Button type="submit">Confirm shipment date</Button>
      </div>
    </form>
  );
}

function BookingForm({ enq, portalUrl, carrierName, carrierCode }: { enq: Enquiry; portalUrl?: string; carrierName?: string; carrierCode?: string }) {
  const { actions } = useStore();
  const [b, setB] = useState({ ref: "", flightNo: carrierCode ? `${carrierCode} ` : "", flightDate: enq.shipmentDate ?? "" });
  const extLink = "inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        actions.confirmBooking(enq.id, b);
      }}
    >
      <p className="mb-2 text-sm text-slate-700">
        Book the shipment{carrierName && <> with <b>{carrierName}</b></>} in the airline portal{enq.shipmentDate && <> for {fmtDate(enq.shipmentDate)}</>}, then record the
        confirmation below.
      </p>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
        {portalUrl && (
          <a href={portalUrl} target="_blank" rel="noopener noreferrer" className={extLink}>
            <ExternalLink size={13} aria-hidden /> {carrierName} booking portal
          </a>
        )}
        <a href={`https://www.flightradar24.com/data/airports/${enq.pol.toLowerCase()}/routes`} target="_blank" rel="noopener noreferrer" className={extLink}>
          <ExternalLink size={13} aria-hidden /> Flight routings (Flightradar24)
        </a>
        <a href={`https://www.skyscanner.co.in/transport/flights/${enq.pol.toLowerCase()}/${enq.pod.toLowerCase()}/`} target="_blank" rel="noopener noreferrer" className={extLink}>
          <ExternalLink size={13} aria-hidden /> Flights {enq.pol} → {enq.pod} (Skyscanner)
        </a>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Booking reference">
          <Input value={b.ref} onChange={(e) => setB({ ...b, ref: e.target.value })} required />
        </Field>
        <Field label="Flight no.">
          <Input value={b.flightNo} onChange={(e) => setB({ ...b, flightNo: e.target.value })} required />
        </Field>
        <Field label="Flight date">
          <Input type="date" value={b.flightDate} onChange={(e) => setB({ ...b, flightDate: e.target.value })} required />
        </Field>
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Booking Confirmed
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">The client is notified on WhatsApp and asked for the invoice and packing list.</p>
    </form>
  );
}

function DocsForm({ enq }: { enq: Enquiry }) {
  const { actions } = useStore();
  const [d, setD] = useState({ invoiceNo: "", invoiceValue: 0, packingList: false });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        actions.receiveDocs(enq.id, d);
      }}
    >
      <p className="mb-3 text-sm text-slate-700">
        Booking {enq.booking ? <b>{enq.booking.ref}</b> : null} is confirmed. Record the invoice and packing list received from the client.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Commercial invoice no.">
          <Input value={d.invoiceNo} onChange={(e) => setD({ ...d, invoiceNo: e.target.value })} required />
        </Field>
        <Field label="Invoice value (INR)">
          <Input type="number" min="0" value={d.invoiceValue || ""} onChange={(e) => setD({ ...d, invoiceValue: Number(e.target.value) })} />
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={d.packingList} onChange={(e) => setD({ ...d, packingList: e.target.checked })} className="size-4 accent-brand-600" />
          Packing list received
        </label>
        <div className="flex items-end">
          <Button type="submit" className="w-full" disabled={!d.invoiceNo || !d.packingList} title={!d.packingList ? "Tick Packing list received first" : undefined}>
            Save documents
          </Button>
        </div>
      </div>
    </form>
  );
}

function NotifyModal({ enq, onClose }: { enq: Enquiry; onClose: () => void }) {
  const { actions } = useStore();
  const { customer } = useLookups();
  const cust = customer(enq.customerId);
  const [channel, setChannel] = useState<Channel>("WhatsApp");
  const [message, setMessage] = useState(`Update on ${enq.ref} (${enq.pol} → ${enq.pod}): status is now "${enq.status}".`);
  const to = (channel === "Email" ? cust?.email : cust?.phone) ?? "";

  return (
    <Modal
      open
      onClose={onClose}
      title="Notify client"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!message.trim() || !to}
            onClick={() => {
              actions.notify(enq.id, message, channel);
              onClose();
            }}
          >
            <Send size={14} aria-hidden /> Send
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Channel">
          <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            <option>WhatsApp</option>
            <option>Email</option>
          </Select>
        </Field>
        <Field label="To" hint={!to ? `This customer has no ${channel === "Email" ? "email" : "phone number"} in the master.` : undefined}>
          <Input value={to} readOnly />
        </Field>
        <Field label="Message">
          <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
