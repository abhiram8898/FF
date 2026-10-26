"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Paperclip, Plus } from "lucide-react";
import { type RateInput, useLookups, useStore } from "@/lib/store";
import type { InboxEmail } from "@/lib/types";
import { addDays, cn, fmtDateTime } from "@/lib/utils";
import { Badge, Button, Card, Empty, Field, KeyValue, LinkButton, Modal, PageHeader, Select, StatusBadge, Tabs } from "@/components/ui";
import { RateForm } from "@/components/workflow";

const FOLDERS = ["Inbox", "Sent"] as const;

/** Reads rate figures out of an airline's reply */
function parseRate(body: string): Partial<RateInput> {
  const num = (re: RegExp) => {
    const m = body.match(re);
    return m ? Number(m[1].replace(/,/g, "")) : undefined;
  };
  const valid = body.match(/valid\s*until[^0-9]*(\d{4}-\d{2}-\d{2})/i);
  const currency = body.match(/rate\s*\/\s*kg[^A-Z0-9]*([A-Z]{3})/i);
  return {
    ratePerKg: num(/rate\s*\/\s*kg[^0-9]*([\d.,]+)/i) ?? 0,
    awbFee: num(/awb\s*fee[^0-9]*([\d.,]+)/i) ?? 0,
    minCharge: num(/minimum\s*charge[^0-9]*([\d.,]+)/i) ?? 0,
    transitDays: num(/transit[^0-9]*(\d+)/i) ?? 1,
    validUntil: valid?.[1] ?? addDays(30),
    ...(currency && { currency: currency[1].toUpperCase() }),
  };
}

function Mailbox() {
  const { state, actions } = useStore();
  const { enquiry } = useLookups();
  const params = useSearchParams();
  const [folder, setFolder] = useState<(typeof FOLDERS)[number]>("Inbox");
  const [selectedId, setSelectedId] = useState(params.get("id") ?? state.inbox[0]?.id);
  const [linking, setLinking] = useState<InboxEmail | null>(null);
  const selected = state.inbox.find((m) => m.id === selectedId);
  const [sentId, setSentId] = useState(state.emailLogs[0]?.id);
  // On small screens show either the list or the open mail
  const [showDetail, setShowDetail] = useState(!!params.get("id"));
  const open = (fn: () => void) => {
    fn();
    setShowDetail(true);
  };
  const backBtn = (
    <button onClick={() => setShowDetail(false)} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 lg:hidden">
      <ArrowLeft size={14} aria-hidden /> Back to {folder}
    </button>
  );
  const sent = state.emailLogs.find((l) => l.id === sentId);

  useEffect(() => {
    if (selectedId) actions.markRead(selectedId);
  }, [selectedId, actions]);

  const linked = enquiry(selected?.enquiryId);

  return (
    <>
      <PageHeader title="Mail Box" subtitle="Customer enquiries and airline rate replies. Everything you send is kept under Sent." />
      <Tabs
        tabs={FOLDERS}
        value={folder}
        onChange={(f) => {
          setFolder(f);
          setShowDetail(false);
        }}
      />

      {folder === "Inbox" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Card bodyClassName="p-0" className={cn(showDetail && "hidden lg:block")}>
            <ul className="divide-y divide-slate-100">
              {state.inbox.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => open(() => setSelectedId(m.id))}
                    aria-current={m.id === selectedId ? "true" : undefined}
                    className={cn(
                      "block w-full px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none",
                      m.id === selectedId && "bg-brand-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", m.read ? "text-slate-700" : "font-semibold text-slate-900")}>{m.fromName}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{fmtDateTime(m.receivedAt)}</span>
                    </div>
                    <div className={cn("truncate text-xs", m.read ? "text-slate-500" : "font-medium text-slate-700")}>{m.subject}</div>
                    <div className="mt-1 flex gap-1">
                      <Badge className={m.from === "Airline" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : undefined}>{m.from}</Badge>
                      {m.enquiryId && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Linked</Badge>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {selected ? (
            <div className={cn("min-w-0", !showDetail && "hidden lg:block")}>
              {backBtn}
              <Card
                title={selected.subject}
                actions={
                  linked ? (
                    <LinkButton href={`/enquiries/${linked.id}`} variant="secondary" size="sm">
                      View {linked.ref}
                    </LinkButton>
                  ) : selected.from === "Airline" ? (
                    <Button size="sm" onClick={() => setLinking(selected)}>
                      <Plus size={14} /> Add to Enquiry
                    </Button>
                  ) : (
                    <LinkButton href={`/enquiries/new?emailId=${selected.id}`} size="sm">
                      <Plus size={14} /> Add to Enquiry
                    </LinkButton>
                  )
                }
              >
                <div className="mb-4 text-sm">
                  <span className="font-medium text-slate-800">{selected.fromName}</span> <span className="text-slate-500">&lt;{selected.fromEmail}&gt;</span>
                  <div className="text-xs text-slate-400">{fmtDateTime(selected.receivedAt)}</div>
                </div>
                <pre className="font-sans text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-700">{selected.body}</pre>
                {!linked && (
                  <p className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                    {selected.from === "Airline"
                      ? "Add to Enquiry links this reply to the enquiry in its subject line, records the quoted rate and sets the status to Rate Received."
                      : "Add to Enquiry opens a new enquiry pre-filled from this email."}
                  </p>
                )}
              </Card>
            </div>
          ) : (
            <Empty>Select an email</Empty>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Card bodyClassName="p-0" className={cn(showDetail && "hidden lg:block")}>
            {state.emailLogs.length ? (
              <ul className="divide-y divide-slate-100">
                {state.emailLogs.map((l) => (
                  <li key={l.id}>
                    <button
                      onClick={() => open(() => setSentId(l.id))}
                      aria-current={l.id === sentId ? "true" : undefined}
                      className={cn(
                        "block w-full px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none",
                        l.id === sentId && "bg-brand-50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-slate-700">To: {l.to.join("; ")}</span>
                        <span className="shrink-0 text-[11px] text-slate-400">{fmtDateTime(l.at)}</span>
                      </div>
                      <div className="truncate text-xs text-slate-500">{l.subject}</div>
                      <Badge className="mt-1">{l.kind}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-slate-500">No sent mail yet.</p>
            )}
          </Card>
          {sent ? (
            <div className={cn("min-w-0", !showDetail && "hidden lg:block")}>
              {backBtn}
              <Card title={sent.subject}>
                <div className="mb-4 space-y-0.5 text-xs text-slate-500">
                  <div>To: {sent.to.join("; ")}</div>
                  {sent.cc && <div>CC: {sent.cc}</div>}
                  {sent.bcc && <div>BCC: {sent.bcc}</div>}
                  <div>{fmtDateTime(sent.at)}</div>
                </div>
                <pre className="font-sans text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-700">{sent.body}</pre>
                {sent.attachments.map((a) => (
                  <span key={a} className="mt-4 mr-2 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    <Paperclip size={12} /> {a}
                  </span>
                ))}
              </Card>
            </div>
          ) : (
            <Empty>Select a sent mail</Empty>
          )}
        </div>
      )}

      {linking && <AddReplyModal email={linking} onClose={() => setLinking(null)} />}
    </>
  );
}

/** FRD XVI–XVIII: link an airline's rate reply to its enquiry */
function AddReplyModal({ email, onClose }: { email: InboxEmail; onClose: () => void }) {
  const { state, actions } = useStore();
  const { customer, portLabel } = useLookups();
  const refInSubject = email.subject.match(/EQ:\s*[A-Z0-9]+-\d{4}-\d{4}/)?.[0];
  const matched = state.enquiries.find((e) => e.ref === refInSubject);
  const [enquiryId, setEnquiryId] = useState(matched?.id ?? "");
  const [saveToMaster, setSaveToMaster] = useState(false);
  const enq = state.enquiries.find((e) => e.id === enquiryId);
  const airlineId = email.airlineId ?? state.airlines.find((a) => a.email === email.fromEmail)?.id;

  return (
    <Modal open onClose={onClose} title="Add to Enquiry" wide>
      <div className="space-y-4">
        <Field
          label="Enquiry"
          hint={matched ? `Matched from the reference ${matched.ref} in the subject line.` : "No enquiry reference found in the subject. Pick the enquiry."}
        >
          <Select value={enquiryId} onChange={(e) => setEnquiryId(e.target.value)}>
            <option value="">Select enquiry</option>
            {state.enquiries.map((e) => (
              <option key={e.id} value={e.id}>
                {e.ref} · {customer(e.customerId)?.name} · {e.pol} → {e.pod}
              </option>
            ))}
          </Select>
        </Field>

        {enq && (
          <>
            <div className="rounded-lg border border-brand-100 bg-brand-50/60 p-3">
              <KeyValue
                compact
                cols={4}
                items={[
                ["Reference", enq.ref],
                ["Customer", customer(enq.customerId)?.name],
                ["Mode / Type", `${enq.cargoMode} / ${enq.shipmentMode}`],
                ["Status", <StatusBadge key="status" status={enq.status} />],
                ["POL", portLabel(enq.pol)],
                ["POD", portLabel(enq.pod)],
                ["Commodity", enq.commodity],
                ["Chargeable Weight", `${enq.chargeableWeight} kg`],
                ]}
              />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-500 uppercase">Rate quoted in this mail</h3>
              <RateForm
                key={enq.id}
                initial={{
                  ...parseRate(email.body),
                  pol: enq.pol,
                  pod: enq.pod,
                  source: "Airline Reply",
                  enquiryId: enq.id,
                  ...(airlineId ? { airlineId } : {}),
                }}
                airlineIds={airlineId ? [airlineId] : undefined}
                lockRoute
                submitLabel="Add to Enquiry"
                extra={
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" checked={saveToMaster} onChange={(e) => setSaveToMaster(e.target.checked)} className="accent-brand-600" />
                    Also save to Airline Rate masters
                  </label>
                }
                onSubmit={(rate) => {
                  actions.addReplyToEnquiry(email.id, enq.id, rate, saveToMaster);
                  onClose();
                }}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function MailboxPage() {
  return (
    <Suspense>
      <Mailbox />
    </Suspense>
  );
}
