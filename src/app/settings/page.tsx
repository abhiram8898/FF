"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { NOTIFICATION_EVENTS, REF_PARTS, type CodedItem, type FinancialYear, type NotificationEvent, type RefPart, type RefPattern, type Settings, type TaxCode } from "@/lib/types";
import { branchCode, buildRef, cn, fmtDateTime, isEmail, splitEmails, uid } from "@/lib/utils";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Tabs, Textarea, Toggle, useUnsavedChanges } from "@/components/ui";

const TABS = ["Notifications", "Ref Number Format", "Dropdown List", "General", "Audit Trail"] as const;
type Tab = (typeof TABS)[number];
const removeBtn = "rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600";

/** Pick which parts make up a reference number, and their order */
function RefPatternEditor({
  title,
  description,
  pattern,
  allowed,
  onChange,
  preview,
}: {
  title: string;
  description: string;
  pattern: RefPattern;
  allowed: RefPart[];
  onChange: (p: RefPattern) => void;
  preview: string;
}) {
  // Selected parts in their chosen order, then the unused ones
  const ordered = [...pattern.parts, ...allowed.filter((p) => !pattern.parts.includes(p))];
  const toggle = (part: RefPart) => onChange({ ...pattern, parts: pattern.parts.includes(part) ? pattern.parts.filter((p) => p !== part) : [...pattern.parts, part] });
  const move = (part: RefPart, by: -1 | 1) => {
    const parts = [...pattern.parts];
    const i = parts.indexOf(part);
    const j = i + by;
    if (j < 0 || j >= parts.length) return;
    [parts[i], parts[j]] = [parts[j], parts[i]];
    onChange({ ...pattern, parts });
  };

  return (
    <Card
      title={title}
      actions={
        <label className="flex items-center gap-2 text-xs text-slate-600">
          Automatic Generation <Toggle checked={pattern.auto} onChange={(auto) => onChange({ ...pattern, auto })} label={`${title}: automatic generation`} />
        </label>
      }
    >
      <p className="mb-3 text-xs text-slate-500">{description}</p>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Label before the number" hint='e.g. "QUO" or "EQ: "'>
          <Input value={pattern.label} onChange={(e) => onChange({ ...pattern, label: e.target.value })} />
        </Field>
        <Field label="Separator">
          <Select value={pattern.separator} onChange={(e) => onChange({ ...pattern, separator: e.target.value as RefPattern["separator"] })}>
            <option value="-">Hyphen ( - )</option>
            <option value="/">Slash ( / )</option>
            <option value="">None</option>
          </Select>
        </Field>
        <Field label="Sequence digits">
          <Select value={pattern.digits} onChange={(e) => onChange({ ...pattern, digits: Number(e.target.value) })}>
            {[3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {d} ({"1".padStart(d, "0")})
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <ul className="space-y-1.5" aria-label={`${title} sections`}>
        {ordered.map((part) => {
          const on = pattern.parts.includes(part);
          const i = pattern.parts.indexOf(part);
          return (
            <li key={part} className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm", on ? "border-brand-200 bg-brand-50/50" : "border-slate-200 text-slate-500")}>
              <label className="flex flex-1 items-center gap-2">
                <input type="checkbox" checked={on} onChange={() => toggle(part)} className="size-4 accent-brand-600" />
                {on && <span className="text-xs font-semibold text-brand-700">Section {i + 1}</span>}
                {REF_PARTS[part]}
              </label>
              {on && (
                <span className="flex">
                  <button onClick={() => move(part, -1)} disabled={i === 0} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30" aria-label={`Move ${REF_PARTS[part]} up`}>
                    <ArrowUp size={14} />
                  </button>
                  <button onClick={() => move(part, 1)} disabled={i === pattern.parts.length - 1} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30" aria-label={`Move ${REF_PARTS[part]} down`}>
                    <ArrowDown size={14} />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
        Next number: <b className="font-mono">{preview}</b>
      </div>
    </Card>
  );
}

/** A list of short form + description pairs, e.g. package types */
function CodedListEditor({ title, items, onChange }: { title: string; items: CodedItem[]; onChange: (items: CodedItem[]) => void }) {
  return (
    <Card title={title} actions={<Button size="sm" variant="secondary" onClick={() => onChange([...items, { short: "", description: "" }])}><Plus size={13} aria-hidden /> Add</Button>}>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input aria-label={`${title} short form ${i + 1}`} className="w-24 font-mono" placeholder="Short" value={it.short} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, short: e.target.value.toUpperCase() } : x)))} />
            <Input aria-label={`${title} description ${i + 1}`} placeholder="Description" value={it.description} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className={removeBtn} aria-label={`Remove ${it.description || "item"}`}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** HSN / SAC codes: centrally maintained, no duplicate codes */
function TaxCodeEditor({ title, items, onChange }: { title: string; items: TaxCode[]; onChange: (items: TaxCode[]) => void }) {
  const set = (id: string, patch: Partial<TaxCode>) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const dupes = new Set(items.map((x) => x.code.trim()).filter((c, i, a) => c && a.indexOf(c) !== i));
  return (
    <Card
      title={title}
      bodyClassName="p-0"
      actions={
        <Button size="sm" variant="secondary" onClick={() => onChange([...items, { id: uid(), commodity: "", code: "", description: "", short: "" }])}>
          <Plus size={13} aria-hidden /> Add
        </Button>
      }
    >
      <Table>
        <thead>
          <tr>
            <th>Commodity</th>
            <th>Code</th>
            <th>Description (official)</th>
            <th>Short Description</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((x) => (
            <tr key={x.id}>
              <td>
                <Input aria-label="Commodity" value={x.commodity} onChange={(e) => set(x.id, { commodity: e.target.value })} />
              </td>
              <td>
                <Input aria-label="Code" className={cn("w-28 font-mono", dupes.has(x.code.trim()) && "border-red-400")} value={x.code} onChange={(e) => set(x.id, { code: e.target.value.replace(/\s/g, "") })} />
              </td>
              <td className="min-w-64">
                <Textarea aria-label="Description" rows={1} value={x.description} onChange={(e) => set(x.id, { description: e.target.value })} />
              </td>
              <td>
                <Input aria-label="Short description" value={x.short} onChange={(e) => set(x.id, { short: e.target.value })} />
              </td>
              <td className="w-10">
                <button onClick={() => onChange(items.filter((y) => y.id !== x.id))} className={removeBtn} aria-label={`Remove ${x.code || "code"}`}>
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {dupes.size > 0 && <p className="px-3 pb-3 text-xs text-red-600">Duplicate codes are not allowed: {[...dupes].join(", ")}</p>}
    </Card>
  );
}

function FinancialYearsEditor({ items, onChange }: { items: FinancialYear[]; onChange: (items: FinancialYear[]) => void }) {
  const set = (i: number, patch: Partial<FinancialYear>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : patch.isDefault ? { ...x, isDefault: false } : x)));
  return (
    <Card
      title="Financial years"
      bodyClassName="p-0"
      actions={
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const last = items.at(-1);
            const y = last ? Number(last.end.slice(0, 4)) : new Date().getFullYear();
            onChange([...items, { name: `${y}–${y + 1}`, code: `FY${y}-${String(y + 1).slice(2)}`, start: `${y}-04-01`, end: `${y + 1}-03-31`, status: "Upcoming", isDefault: false, remarks: "" }]);
          }}
        >
          <Plus size={13} aria-hidden /> Add New Financial Year
        </Button>
      }
    >
      <Table>
        <thead>
          <tr>
            <th>Financial Year Name</th>
            <th>Code</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Status</th>
            <th>Default</th>
            <th>Remarks</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((y, i) => (
            <tr key={i}>
              <td>
                <Input aria-label="Financial year name" className="w-32" value={y.name} onChange={(e) => set(i, { name: e.target.value })} />
              </td>
              <td>
                <Input aria-label="Financial year code" className="w-28 font-mono" value={y.code} onChange={(e) => set(i, { code: e.target.value.toUpperCase() })} />
              </td>
              <td>
                <Input aria-label="Start date" type="date" value={y.start} onChange={(e) => set(i, { start: e.target.value })} />
              </td>
              <td>
                <Input aria-label="End date" type="date" value={y.end} onChange={(e) => set(i, { end: e.target.value })} />
              </td>
              <td>
                <Select aria-label="Status" className="w-32" value={y.status} onChange={(e) => set(i, { status: e.target.value as FinancialYear["status"] })}>
                  <option>Upcoming</option>
                  <option>Active</option>
                  <option>Closed</option>
                </Select>
              </td>
              <td>
                <Toggle checked={y.isDefault} onChange={(v) => v && set(i, { isDefault: true })} label={`Default financial year ${y.name}`} />
              </td>
              <td>
                <Input aria-label="Remarks" value={y.remarks} onChange={(e) => set(i, { remarks: e.target.value })} />
              </td>
              <td className="w-10">
                <button onClick={() => onChange(items.filter((_, j) => j !== i))} className={removeBtn} aria-label={`Remove ${y.name}`} disabled={y.isDefault}>
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function NotificationsModal({ s, onClose, onSave }: { s: Settings["notifications"]; onClose: () => void; onSave: (n: Settings["notifications"]) => void }) {
  const [n, setN] = useState(s);
  const bad = Object.values(n.events).some((e) => (e.to && !isEmail(e.to)) || splitEmails(e.cc).some((x) => !isEmail(x)));
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Email Notification"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={bad} onClick={() => onSave(n)}>
            Submit
          </Button>
        </>
      }
    >
      <Table>
        <thead>
          <tr>
            <th>Notification Title</th>
            <th>Yes / No</th>
            <th>To Email ID</th>
            <th>CC Email IDs</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(NOTIFICATION_EVENTS) as NotificationEvent[]).map((k) => {
            const e = n.events[k];
            const set = (patch: Partial<typeof e>) => setN({ ...n, events: { ...n.events, [k]: { ...e, ...patch } } });
            return (
              <tr key={k}>
                <td className="font-medium whitespace-nowrap">{NOTIFICATION_EVENTS[k]}</td>
                <td>
                  <Toggle checked={e.enabled} onChange={(enabled) => set({ enabled })} label={NOTIFICATION_EVENTS[k]} />
                </td>
                <td>
                  <Input aria-label={`${NOTIFICATION_EVENTS[k]} to`} type="email" value={e.to} onChange={(ev) => set({ to: ev.target.value })} className={cn(e.to && !isEmail(e.to) && "border-red-400")} />
                </td>
                <td>
                  <Input aria-label={`${NOTIFICATION_EVENTS[k]} CC`} placeholder="Enter CC email IDs" value={e.cc} onChange={(ev) => set({ cc: ev.target.value })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Modal>
  );
}

function BranchEmailsModal({ s, branches, onClose, onSave }: { s: Settings["branchEmails"]; branches: string[]; onClose: () => void; onSave: (b: Settings["branchEmails"]) => void }) {
  const [rows, setRows] = useState(s.rows.map((r) => ({ branch: r.branch, emails: r.emails.join("; ") })));
  const bad = rows.some((r) => !r.branch || !splitEmails(r.emails).length || splitEmails(r.emails).some((x) => !isEmail(x)));
  return (
    <Modal
      open
      onClose={onClose}
      title="Branch Email Configuration"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={bad} onClick={() => onSave({ ...s, rows: rows.map((r) => ({ branch: r.branch, emails: splitEmails(r.emails) })) })}>
            Save
          </Button>
        </>
      }
    >
      <p className="mb-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
        These emails are added as CC when booking, AWB, shipment and proforma notifications are sent for the branch.
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[10rem_minmax(0,1fr)_2rem] items-end gap-2">
            <Field label="Branch *">
              <Select value={r.branch} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, branch: e.target.value } : x)))}>
                <option value="">Select Branch</option>
                {branches.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </Field>
            <Field label="Email Recipients *">
              <Input value={r.emails} placeholder="Add email address; separate with ;" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, emails: e.target.value } : x)))} />
            </Field>
            <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className={`${removeBtn} mb-1.5`} aria-label="Remove branch">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={() => setRows([...rows, { branch: "", emails: "" }])}>
          <Plus size={13} aria-hidden /> Add Branch
        </Button>
      </div>
    </Modal>
  );
}

function SettingsForm() {
  const { state, actions } = useStore();
  const requested = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(TABS.find((t) => t === requested) ?? "Notifications");
  const [s, setS] = useState<Settings>(state.settings);
  const [dialog, setDialog] = useState<"notifications" | "branches" | null>(null);
  const dirty = JSON.stringify(s) !== JSON.stringify(state.settings);
  useUnsavedChanges(dirty);
  const year = new Date().getFullYear();
  const sample = state.customers.find((c) => c.code) ?? state.customers[0];
  const refs = { company: s.refPrefix, client: sample?.code || "CLT", branch: branchCode(s), pol: "COK", pod: "DXB", year };
  const patterns: [string, keyof Settings & `${string}Ref`, RefPart[], string, number][] = [
    ["Enquiry Number", "enquiryRef", ["company", "client", "branch", "pol", "pod", "seq", "year"], "Given when an enquiry is saved.", state.counters.enquiry],
    ["Quote Number", "quoteRef", ["company", "branch", "seq", "year"], "Given when a quotation is created; duplicates take the next number.", state.counters.quote],
    ["Reservation Number", "reservationRef", ["company", "client", "branch", "seq", "year"], "Given when a reservation is created; each recurring occurrence gets its own.", state.counters.reservation],
    ["Job Number", "jobRef", ["company", "client", "branch", "pol", "pod", "seq", "year"], "Given when a job is created from a quotation or reservation.", state.counters.job],
    ["Invoice Number", "invoiceRef", ["company", "client", "branch", "seq", "year"], "Tax invoices. Proformas use the same format starting with P (PINV-…); credit notes swap INV for CN.", state.counters.invoice],
  ];
  const noSeq = patterns.find(([, k]) => !s[k].parts.includes("seq"));
  const lists: [string, number][] = [
    ["financial year", s.financialYears.length],
    ["clearance place", s.clearancePlaces.filter((c) => c.name.trim()).length],
    ["package type", s.packageTypes.filter((p) => p.description.trim()).length],
    ["unit type", s.unitTypes.filter((p) => p.short.trim()).length],
  ];
  const emptyList = lists.find(([, n]) => !n)?.[0];
  const dupeCode = [s.hsnCodes, s.sacCodes].some((list) => list.some((x, i) => x.code && list.findIndex((y) => y.code === x.code) !== i));
  const problem = !s.refPrefix
    ? "Enter a company code."
    : noSeq
      ? `${noSeq[0]} must include the Sequence Number so numbers stay unique.`
      : emptyList
        ? `Keep at least one ${emptyList}.`
        : !s.financialYears.some((y) => y.isDefault)
          ? "Mark one financial year as default."
          : dupeCode
            ? "Remove the duplicate HSN / SAC codes."
            : s.volumetricDivisor <= 0
              ? "The volumetric divisor must be more than 0."
              : "";
  const save = () =>
    actions.updateSettings({
      ...s,
      clearancePlaces: s.clearancePlaces.filter((c) => c.name.trim()),
      packageTypes: s.packageTypes.filter((p) => p.description.trim()),
      unitTypes: s.unitTypes.filter((p) => p.short.trim()),
      hsnCodes: s.hsnCodes.filter((c) => c.code.trim()),
      sacCodes: s.sacCodes.filter((c) => c.code.trim()),
    });
  const saveBar = (
    <div className="mt-3 flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
      {problem ? <span className="text-xs text-red-600">{problem}</span> : dirty && <span className="text-xs text-amber-700">You have unsaved changes</span>}
      <Button onClick={save} disabled={!dirty || !!problem}>
        Save changes
      </Button>
    </div>
  );
  const switchRow = (title: string, text: string, checked: boolean, onToggle: (v: boolean) => void, onEdit: () => void) => (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Mail size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{text}</div>
      </div>
      <Toggle checked={checked} onChange={onToggle} label={title} />
      <button onClick={onEdit} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label={`Edit ${title}`}>
        <Pencil size={15} />
      </button>
    </div>
  );

  return (
    <>
      <PageHeader title="Settings" subtitle="Notifications, reference number formats and the dropdown lists used across the application" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "Notifications" && (
        <div className="space-y-3">
          {switchRow(
            "Email Notifications",
            "Alert users via email about important updates, reminders and actions.",
            state.settings.notifications.enabled,
            (enabled) => {
              actions.updateSettings({ notifications: { ...state.settings.notifications, enabled } }, "Email notifications");
              setS((x) => ({ ...x, notifications: { ...x.notifications, enabled } }));
              if (enabled) setDialog("notifications");
            },
            () => setDialog("notifications"),
          )}
          {switchRow(
            "Branch Email Configuration",
            "Send branch notifications to branch-specific email recipients as CC.",
            state.settings.branchEmails.enabled,
            (enabled) => {
              actions.updateSettings({ branchEmails: { ...state.settings.branchEmails, enabled } }, "Branch email configuration");
              setS((x) => ({ ...x, branchEmails: { ...x.branchEmails, enabled } }));
              if (enabled) setDialog("branches");
            },
            () => setDialog("branches"),
          )}
          <Card title="Client notifications & reminders">
            <div className="space-y-3 text-sm">
              {(
                [
                  ["notifyOnQuote", "WhatsApp the client when a quotation is emailed"],
                  ["notifyOnBooking", "WhatsApp the client when the booking is confirmed"],
                  ["notifyOnAwb", "Email the client when the AWB is executed"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" className="accent-brand-600" checked={s.alerts[k]} onChange={(e) => setS({ ...s, alerts: { ...s.alerts, [k]: e.target.checked } })} />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Remind airlines after (hours)">
                <Input type="number" min="1" value={s.alerts.rateReminderHours} onChange={(e) => setS({ ...s, alerts: { ...s.alerts, rateReminderHours: Number(e.target.value) } })} />
              </Field>
              <Field label="Remind customers after (days)">
                <Input type="number" min="1" value={s.alerts.quoteReminderDays} onChange={(e) => setS({ ...s, alerts: { ...s.alerts, quoteReminderDays: Number(e.target.value) } })} />
              </Field>
            </div>
            {saveBar}
          </Card>
        </div>
      )}

      {tab === "Ref Number Format" && (
        <div className="space-y-3">
          <Card title="Company code">
            <Field label="Company Code" hint="Section used in every reference number" className="max-w-xs">
              <Input value={s.refPrefix} onChange={(e) => setS({ ...s, refPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} />
            </Field>
          </Card>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {patterns.map(([title, key, allowed, description, counter]) => (
              <RefPatternEditor
                key={key}
                title={title}
                description={`${description}${s[key].auto ? "" : " Automatic generation is off: users type the number."}`}
                pattern={s[key]}
                allowed={allowed}
                onChange={(p) => setS({ ...s, [key]: p })}
                preview={buildRef(s[key], { ...refs, seq: counter + 1 })}
              />
            ))}
          </div>
          {saveBar}
        </div>
      )}

      {tab === "Dropdown List" && (
        <div className="space-y-3">
          <FinancialYearsEditor items={s.financialYears} onChange={(financialYears) => setS({ ...s, financialYears })} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Card title="Clearance places" actions={<Button size="sm" variant="secondary" onClick={() => setS({ ...s, clearancePlaces: [...s.clearancePlaces, { country: "India", name: "" }] })}><Plus size={13} aria-hidden /> Add</Button>}>
              <div className="space-y-1.5">
                {s.clearancePlaces.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input aria-label="Country" className="w-28" value={c.country} onChange={(e) => setS({ ...s, clearancePlaces: s.clearancePlaces.map((x, j) => (j === i ? { ...x, country: e.target.value } : x)) })} />
                    <Input aria-label="Location name" placeholder="Location name" value={c.name} onChange={(e) => setS({ ...s, clearancePlaces: s.clearancePlaces.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <button onClick={() => setS({ ...s, clearancePlaces: s.clearancePlaces.filter((_, j) => j !== i) })} className={removeBtn} aria-label={`Remove ${c.name || "place"}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
            <CodedListEditor title="Package types" items={s.packageTypes} onChange={(packageTypes) => setS({ ...s, packageTypes })} />
            <CodedListEditor title="Unit types" items={s.unitTypes} onChange={(unitTypes) => setS({ ...s, unitTypes })} />
          </div>
          <TaxCodeEditor title="HSN Code (goods)" items={s.hsnCodes} onChange={(hsnCodes) => setS({ ...s, hsnCodes })} />
          <TaxCodeEditor title="SAC Code (services)" items={s.sacCodes} onChange={(sacCodes) => setS({ ...s, sacCodes })} />
          {saveBar}
        </div>
      )}

      {tab === "General" && (
        <Card title="Chargeable weight rules">
          <p className="mb-3 text-xs text-slate-500">
            Volumetric weight = packages × L × W × H (cm) ÷ divisor. Suggested chargeable weight = the higher of gross and volumetric weight, rounded up to the step below. A
            change by hand on a reservation keeps the calculated value, the revised value, the user and the reason.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Volumetric divisor" hint="IATA standard: 6000">
              <Input type="number" min="1" value={s.volumetricDivisor} onChange={(e) => setS({ ...s, volumetricDivisor: Number(e.target.value) })} />
            </Field>
            <Field label="Round chargeable weight up to (kg)" hint="0 = no rounding">
              <Select value={s.weightRounding} onChange={(e) => setS({ ...s, weightRounding: Number(e.target.value) })}>
                {[0, 0.5, 1].map((r) => (
                  <option key={r} value={r}>
                    {r === 0 ? "No rounding" : `${r} kg`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {saveBar}
        </Card>
      )}

      {tab === "Audit Trail" && (
        <Card title="Master data changes" bodyClassName="p-0">
          {state.audit.length ? (
            <Table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Change</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {state.audit.slice(0, 200).map((a, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap text-slate-600">{fmtDateTime(a.at)}</td>
                    <td className="whitespace-nowrap">{a.by}</td>
                    <td className="whitespace-nowrap">
                      <Badge>{a.action}</Badge>
                    </td>
                    <td className="max-w-md truncate text-slate-600" title={a.detail}>
                      {a.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="p-3 text-sm text-slate-500">No changes recorded yet. Changes to stakeholders, airlines, rates, ports, currencies and settings appear here.</p>
          )}
        </Card>
      )}

      {dialog === "notifications" && (
        <NotificationsModal
          s={state.settings.notifications}
          onClose={() => setDialog(null)}
          onSave={(notifications) => {
            actions.updateSettings({ notifications }, "Email notifications");
            setS((x) => ({ ...x, notifications }));
            setDialog(null);
          }}
        />
      )}
      {dialog === "branches" && (
        <BranchEmailsModal
          s={state.settings.branchEmails}
          branches={state.settings.branches.map((b) => b.name)}
          onClose={() => setDialog(null)}
          onSave={(branchEmails) => {
            actions.updateSettings({ branchEmails }, "Branch email configuration");
            setS((x) => ({ ...x, branchEmails }));
            setDialog(null);
          }}
        />
      )}
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsForm />
    </Suspense>
  );
}
