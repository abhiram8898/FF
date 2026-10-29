"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, Eye, FilePen, Inbox, Package, Paperclip, PenSquare, Plane, Plus, Save, Send, Trash2 } from "lucide-react";
import { type RateInput, useLookups, useStore } from "@/lib/store";
import type { Draft, InboxEmail } from "@/lib/types";
import { MAIL_TAG, addDays, cn, fmtDateTime, isEmail, matches, splitEmails } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  FilterBar,
  FilterSelect,
  Input,
  KeyValue,
  Kpi,
  type KpiDef,
  KpiGrid,
  kpiTest,
  LinkButton,
  Modal,
  NoResults,
  PageHeader,
  ResetFilters,
  SearchField,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
} from "@/components/ui";
import { RateForm } from "@/components/workflow";

const FOLDERS = ["Inbox", "Compose", "Drafts", "Sent"] as const;
type Folder = (typeof FOLDERS)[number];

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

/** View Enquiry / View Booking for a mail linked to an enquiry */
function MailLinks({ enquiryId }: { enquiryId?: string }) {
  const { enquiry, job } = useLookups();
  const enq = enquiry(enquiryId);
  const booking = job(enq?.jobId);
  return (
    <>
      {enq ? (
        <LinkButton href={`/enquiries/${enq.id}`} variant="secondary" size="sm" title={enq.ref}>
          <Eye size={14} aria-hidden /> View Enquiry
        </LinkButton>
      ) : (
        <Button variant="secondary" size="sm" disabled title="This mail isn't linked to an enquiry yet">
          <Eye size={14} aria-hidden /> View Enquiry
        </Button>
      )}
      {booking ? (
        <LinkButton href={`/shipments/${booking.id}`} variant="secondary" size="sm" title={booking.ref}>
          <Package size={14} aria-hidden /> View Booking
        </LinkButton>
      ) : (
        <Button variant="secondary" size="sm" disabled title={enq ? "No booking/job for this enquiry yet" : "This mail isn't linked to an enquiry yet"}>
          <Package size={14} aria-hidden /> View Booking
        </Button>
      )}
    </>
  );
}

const EMPTY_MAIL = { to: "", cc: "", bcc: "", subject: "", body: "", enquiryId: "" };
/** Compose tab: write a mail, save it as a draft or send it */
function Composer({ draft, onDone }: { draft?: Draft; onDone: (to: Folder) => void }) {
  const { state, actions } = useStore();
  const { customer } = useLookups();
  const [m, setM] = useState(() => (draft ? { ...draft, to: draft.to.join("; "), enquiryId: draft.enquiryId ?? "" } : EMPTY_MAIL));
  const set = (patch: Partial<typeof m>) => setM((x) => ({ ...x, ...patch }));
  const invalid = splitEmails(m.to).filter((e) => !isEmail(e));
  const canSend = splitEmails(m.to).length > 0 && !invalid.length && m.subject.trim() && m.body.trim();
  const hasContent = Object.values(m).some((v) => v.trim());
  const mail = { to: splitEmails(m.to), cc: m.cc, bcc: m.bcc, subject: m.subject, body: m.body };

  return (
    <Card
      title={draft ? "Edit draft" : "New email"}
      actions={draft && <span className="text-xs text-slate-500">Draft saved {fmtDateTime(draft.savedAt)}</span>}
    >
      <div className="space-y-3">
        <Field label="To *" hint={invalid.length > 0 && <span className="text-red-600">Check these addresses: {invalid.join(", ")}</span>}>
          <Input value={m.to} onChange={(e) => set({ to: e.target.value })} placeholder="Separate addresses with ;" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="CC">
            <Input value={m.cc} onChange={(e) => set({ cc: e.target.value })} />
          </Field>
          <Field label="BCC">
            <Input value={m.bcc} onChange={(e) => set({ bcc: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Field label="Subject *">
            <Input value={m.subject} onChange={(e) => set({ subject: e.target.value })} />
          </Field>
          <Field label="Link to enquiry" hint="Shows the mail in that enquiry's activity">
            <Select value={m.enquiryId} onChange={(e) => set({ enquiryId: e.target.value })}>
              <option value="">Not linked</option>
              {state.enquiries.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.ref} · {customer(e.customerId)?.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Message *">
          <Textarea rows={10} value={m.body} onChange={(e) => set({ body: e.target.value })} />
        </Field>
        <div className="text-xs text-slate-500">
          Your signature is added when sending. Demo mode: sent mail is recorded in Sent and Email Logs; no external email leaves the app.
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3">
        <Button
          variant="ghost"
          onClick={() => {
            if (draft) actions.deleteDraft(draft.id);
            onDone(draft ? "Drafts" : "Inbox");
          }}
        >
          <Trash2 size={14} aria-hidden /> {draft ? "Delete draft" : "Discard"}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={!hasContent}
            onClick={() => {
              actions.saveDraft({ ...mail, enquiryId: m.enquiryId || undefined }, draft?.id);
              onDone("Drafts");
            }}
          >
            <Save size={14} aria-hidden /> Save Draft
          </Button>
          <Button
            disabled={!canSend}
            onClick={() => {
              actions.sendMail(mail, m.enquiryId || undefined, draft?.id);
              onDone("Sent");
            }}
          >
            <Send size={14} aria-hidden /> Send
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Mailbox() {
  const { state, actions } = useStore();
  const { enquiry } = useLookups();
  const params = useSearchParams();
  const [folder, setFolder] = useState<Folder>("Inbox");
  const [selectedId, setSelectedId] = useState(params.get("id") ?? state.inbox[0]?.id);
  const [linking, setLinking] = useState<InboxEmail | null>(null);
  const selected = state.inbox.find((m) => m.id === selectedId);
  const [sentId, setSentId] = useState(state.emailLogs[0]?.id);
  // Draft open in the Compose tab (undefined = new mail); bump the key to reset the form
  const [editing, setEditing] = useState<Draft | undefined>();
  const [composeKey, setComposeKey] = useState(0);
  // On small screens show either the list or the open mail
  const [showDetail, setShowDetail] = useState(!!params.get("id"));
  const open = (fn: () => void) => {
    fn();
    setShowDetail(true);
  };
  const go = (f: Folder) => {
    setFolder(f);
    setShowDetail(false);
  };
  const compose = (draft?: Draft) => {
    setEditing(draft);
    setComposeKey((k) => k + 1);
    go("Compose");
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

  const [q, setQ] = useState("");
  const [sender, setSender] = useState<"all" | InboxEmail["from"]>("all");
  const [link, setLink] = useState<"all" | "linked" | "unlinked">("all");
  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<InboxEmail>[] = [
    { id: "unread", icon: Inbox, label: "Unread", test: (m) => !m.read },
    { id: "new", icon: Building2, tone: "sky", label: "New (customer enquiries)", test: (m) => m.from === "Customer" },
    { id: "response", icon: Plane, tone: "indigo", label: "Responses (airlines)", test: (m) => m.from === "Airline" },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || sender !== "all" || link !== "all" || kpi !== null;
  const inbox = state.inbox.filter(kpiOk).filter(
    (m) =>
      (sender === "all" || m.from === sender) &&
      (link === "all" || (link === "linked") === !!m.enquiryId) &&
      matches(q, [m.fromName, m.fromEmail, m.subject, enquiry(m.enquiryId)?.ref]),
  );
  const sentMail = state.emailLogs.filter((l) => matches(q, [l.subject, ...l.to]));
  const drafts = state.drafts.filter((d) => matches(q, [d.subject, ...d.to, d.body]));
  const reset = () => {
    setQ("");
    setSender("all");
    setLink("all");
    setKpi(null);
  };
  const listItem = "block w-full px-3 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none";

  return (
    <>
      <PageHeader
        title="Mail Box"
        subtitle="New enquiries from customers and responses from airlines. Compose, save drafts, and find everything you send under Sent."
        actions={
          <Button onClick={() => compose()}>
            <PenSquare size={16} aria-hidden /> Compose
          </Button>
        }
      />

      {/* Cards filter the inbox on this page; Drafts opens the Drafts tab */}
      <KpiGrid cols={4}>
        {KPIS.map(({ id, test, ...card }) => (
          <Kpi
            key={id}
            {...card}
            value={state.inbox.filter(test!).length}
            active={folder === "Inbox" && kpi === id}
            onClick={() => {
              setKpi(folder === "Inbox" && kpi === id ? null : id);
              go("Inbox");
            }}
          />
        ))}
        <Kpi icon={FilePen} tone="amber" value={state.drafts.length} label="Drafts" active={folder === "Drafts"} onClick={() => go(folder === "Drafts" ? "Inbox" : "Drafts")} />
      </KpiGrid>

      <Tabs tabs={FOLDERS} value={folder} onChange={(f) => (f === "Compose" ? compose() : go(f))} />

      {folder !== "Compose" && (
        <FilterBar>
          <SearchField label={`Search ${folder.toLowerCase()}`} value={q} onChange={setQ} />
          {folder === "Inbox" && (
            <>
              <FilterSelect label="Tag" value={sender} onChange={(e) => setSender(e.target.value as typeof sender)}>
                <option value="all">All Tags</option>
                <option value="Customer">New</option>
                <option value="Airline">Response</option>
              </FilterSelect>
              <FilterSelect label="Enquiry link" value={link} onChange={(e) => setLink(e.target.value as typeof link)}>
                <option value="all">All Emails</option>
                <option value="linked">Linked to an enquiry</option>
                <option value="unlinked">Needs linking</option>
              </FilterSelect>
            </>
          )}
          <ResetFilters onClick={reset} disabled={!filtered} />
        </FilterBar>
      )}

      {folder === "Compose" && <Composer key={composeKey} draft={editing} onDone={go} />}

      {folder === "Drafts" && (
        <Card bodyClassName="p-0">
          {drafts.length ? (
            <ul className="divide-y divide-slate-100">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center gap-2 pr-3">
                  <button onClick={() => compose(d)} className={cn(listItem, "min-w-0 flex-1")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-800">{d.subject || "(no subject)"}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">Saved {fmtDateTime(d.savedAt)}</span>
                    </div>
                    <div className="truncate text-xs text-slate-500">To: {d.to.join("; ") || "—"}</div>
                    {d.enquiryId && <Badge className="mt-1">{enquiry(d.enquiryId)?.ref}</Badge>}
                  </button>
                  <button onClick={() => actions.deleteDraft(d.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete draft ${d.subject}`}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <NoResults filtered={!!q.trim()} onClear={reset}>
              No drafts. Use Compose and Save Draft to keep a mail for later.
            </NoResults>
          )}
        </Card>
      )}

      {folder === "Inbox" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Card bodyClassName="p-0" className={cn(showDetail && "hidden lg:block")}>
            {!inbox.length && (
              <NoResults filtered={filtered} onClear={reset}>
                The inbox is empty.
              </NoResults>
            )}
            <ul className="divide-y divide-slate-100">
              {inbox.map((m) => (
                <li key={m.id}>
                  <button onClick={() => open(() => setSelectedId(m.id))} aria-current={m.id === selectedId ? "true" : undefined} className={cn(listItem, m.id === selectedId && "bg-brand-50")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", m.read ? "text-slate-700" : "font-semibold text-slate-900")}>{m.fromName}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{fmtDateTime(m.receivedAt)}</span>
                    </div>
                    <div className={cn("truncate text-xs", m.read ? "text-slate-500" : "font-medium text-slate-700")}>{m.subject}</div>
                    <div className="mt-1 flex gap-1">
                      <Badge className={MAIL_TAG[m.from].className}>{MAIL_TAG[m.from].label}</Badge>
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
                  <>
                    {!linked &&
                      (selected.from === "Airline" ? (
                        <Button size="sm" onClick={() => setLinking(selected)}>
                          <Plus size={14} /> Add to Enquiry
                        </Button>
                      ) : (
                        <LinkButton href={`/enquiries/new?emailId=${selected.id}`} size="sm">
                          <Plus size={14} /> Add to Enquiry
                        </LinkButton>
                      ))}
                    <MailLinks enquiryId={selected.enquiryId} />
                  </>
                }
              >
                <div className="mb-3 text-sm">
                  <Badge className={cn("mr-2", MAIL_TAG[selected.from].className)}>{MAIL_TAG[selected.from].label}</Badge>
                  <span className="font-medium text-slate-800">{selected.fromName}</span> <span className="text-slate-500">&lt;{selected.fromEmail}&gt;</span>
                  <div className="text-xs text-slate-400">{fmtDateTime(selected.receivedAt)}</div>
                </div>
                <pre className="font-sans text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-700">{selected.body}</pre>
                {!linked && (
                  <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                    {selected.from === "Airline"
                      ? "Add to Enquiry links this response to the enquiry in its subject line, records the quoted rate and sets the status to Rate Received."
                      : "Add to Enquiry opens a new enquiry pre-filled from this email."}
                  </p>
                )}
              </Card>
            </div>
          ) : (
            <Empty>Select an email</Empty>
          )}
        </div>
      )}

      {folder === "Sent" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Card bodyClassName="p-0" className={cn(showDetail && "hidden lg:block")}>
            {sentMail.length ? (
              <ul className="divide-y divide-slate-100">
                {sentMail.map((l) => (
                  <li key={l.id}>
                    <button onClick={() => open(() => setSentId(l.id))} aria-current={l.id === sentId ? "true" : undefined} className={cn(listItem, l.id === sentId && "bg-brand-50")}>
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
              <NoResults filtered={!!q.trim()} onClear={reset}>
                No sent mail yet.
              </NoResults>
            )}
          </Card>
          {sent ? (
            <div className={cn("min-w-0", !showDetail && "hidden lg:block")}>
              {backBtn}
              <Card title={sent.subject} actions={<MailLinks enquiryId={sent.enquiryId} />}>
                <div className="mb-3 space-y-0.5 text-xs text-slate-500">
                  <div>To: {sent.to.join("; ")}</div>
                  {sent.cc && <div>CC: {sent.cc}</div>}
                  {sent.bcc && <div>BCC: {sent.bcc}</div>}
                  <div>{fmtDateTime(sent.at)}</div>
                </div>
                <pre className="font-sans text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-700">{sent.body}</pre>
                {sent.attachments.map((a) => (
                  <span key={a} className="mt-3 mr-2 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
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
  const router = useRouter();
  const { state, actions } = useStore();
  const { customer, portLabel } = useLookups();
  // Refs follow the configurable pattern, so look for any enquiry's ref in the subject (longest first)
  const matched = [...state.enquiries].sort((a, b) => b.ref.length - a.ref.length).find((e) => email.subject.includes(e.ref));
  const [enquiryId, setEnquiryId] = useState(matched?.id ?? "");
  const [saveToMaster, setSaveToMaster] = useState(false);
  const enq = state.enquiries.find((e) => e.id === enquiryId);
  const airlineId = email.airlineId ?? state.airlines.find((a) => a.email === email.fromEmail)?.id;

  return (
    <Modal open onClose={onClose} title="Add to Enquiry" wide>
      <div className="space-y-3">
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
                useLabel="Add & Use Rate"
                extra={
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" checked={saveToMaster} onChange={(e) => setSaveToMaster(e.target.checked)} className="accent-brand-600" />
                    Also save to Airline Rate masters
                  </label>
                }
                onSubmit={(rate, use) => {
                  const rateId = actions.addReplyToEnquiry(email.id, enq.id, rate, saveToMaster);
                  onClose();
                  if (use) router.push(`/quotations/${actions.createQuotation(enq.id, rateId).id}`);
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
