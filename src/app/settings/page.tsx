"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ChargeUnit, Port, Settings, UserRole } from "@/lib/types";
import { fmtPort, makeRef } from "@/lib/utils";
import { Button, Card, Field, Input, PageHeader, Select, Table, Tabs, Textarea } from "@/components/ui";

const TABS = [
  "General Setup",
  "Ref Number",
  "Port & Country",
  "Currency",
  "Lists",
  "Roles & Users",
  "Quotation Format",
  "Alerts & Notifications",
  "AWB Template",
] as const;

const ROLES: UserRole[] = ["Admin", "Sales", "Pricing", "Operations"];

export default function SettingsPage() {
  const { state, actions } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("General Setup");
  // Each tab edits this draft; Save writes it back
  const [s, setS] = useState<Settings>(state.settings);
  const [ports, setPorts] = useState<Port[]>(state.ports);
  const save = () => actions.updateSettings(s);
  const lines = (v: string[]) => v.join("\n");
  const unlines = (v: string) =>
    v
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  const dirty = JSON.stringify(s) !== JSON.stringify(state.settings) || JSON.stringify(ports) !== JSON.stringify(state.ports);
  // Enquiry and quotation screens rely on these never being empty
  const lists: [string, string[]][] = [
    ["branch", s.branches],
    ["financial year", s.financialYears],
    ["clearance place", s.clearancePlaces],
    ["package type", s.packageTypes],
    ["unit type", s.unitTypes],
  ];
  const emptyList = lists.find(([, list]) => !list.length)?.[0];
  const problem = !s.refPrefix
    ? "Enter a reference prefix."
    : emptyList
      ? `Keep at least one ${emptyList}.`
      : !s.users.some((u) => u.name.trim())
        ? "Keep at least one user."
        : !ports.some((p) => p.code.length === 3 && p.name)
          ? "Keep at least one airport."
          : "";
  const saveBar = (onSave = save) => (
    <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
      {problem ? <span className="text-xs text-red-600">{problem}</span> : dirty && <span className="text-xs text-amber-700">You have unsaved changes</span>}
      <Button onClick={onSave} disabled={!dirty || !!problem}>
        Save changes
      </Button>
    </div>
  );

  return (
    <>
      <PageHeader title="Settings" subtitle="Company set up and the lists used across enquiries, quotations and AWBs" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "General Setup" && (
        <Card title="Company set up · Letterhead">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(
              [
                ["name", "Company name"],
                ["phone", "Phone"],
                ["email", "Email"],
                ["website", "Website"],
                ["gstin", "GSTIN"],
                ["pan", "PAN"],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                <Input value={s.company[k]} onChange={(e) => setS({ ...s, company: { ...s.company, [k]: e.target.value } })} />
              </Field>
            ))}
            <Field label="Address" className="sm:col-span-2">
              <Textarea rows={2} value={s.company.address} onChange={(e) => setS({ ...s, company: { ...s.company, address: e.target.value } })} />
            </Field>
            <Field label="Email signature" className="sm:col-span-2">
              <Textarea rows={3} value={s.company.signature} onChange={(e) => setS({ ...s, company: { ...s.company, signature: e.target.value } })} />
            </Field>
          </div>
          {saveBar()}
        </Card>
      )}

      {tab === "Ref Number" && (
        <Card title="Reference numbers">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Prefix" hint="Used for Enquiry, Quotation and Job numbers">
              <Input value={s.refPrefix} onChange={(e) => setS({ ...s, refPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} />
            </Field>
            <Field label="Next enquiry number">
              <Input value={state.counters.enquiry + 1} disabled />
            </Field>
          </div>
          <div className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
            <div>Enquiry: <b>{makeRef("EQ", s.refPrefix, state.counters.enquiry + 1, new Date().getFullYear())}</b></div>
            <div>Quotation: <b>{makeRef("QT", s.refPrefix, state.counters.enquiry + 1, new Date().getFullYear())}</b> (the Enquiry ID becomes the Quotation ID)</div>
            <div>Shipment job: <b>{makeRef("JOB", s.refPrefix, state.counters.enquiry + 1, new Date().getFullYear())}</b></div>
          </div>
          {saveBar()}
        </Card>
      )}

      {tab === "Port & Country" && (
        <Card
          title="Airports (global list)"
          actions={
            <Button size="sm" variant="secondary" onClick={() => setPorts([...ports, { code: "", name: "", country: "" }])}>
              <Plus size={13} /> Add port
            </Button>
          }
          bodyClassName="p-0"
        >
          <Table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Airport / City</th>
                <th>Country</th>
                <th>Shown as</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ports.map((p, i) => {
                const set = (patch: Partial<Port>) => setPorts(ports.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <tr key={i}>
                    <td>
                      <Input aria-label="Airport code" className="w-20" value={p.code} onChange={(e) => set({ code: e.target.value.toUpperCase().slice(0, 3) })} />
                    </td>
                    <td>
                      <Input aria-label="Airport or city name" value={p.name} onChange={(e) => set({ name: e.target.value })} />
                    </td>
                    <td>
                      <Input aria-label="Country" value={p.country} onChange={(e) => set({ country: e.target.value })} />
                    </td>
                    <td className="text-xs text-slate-500">{fmtPort(p)}</td>
                    <td>
                      <button onClick={() => setPorts(ports.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove row">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <div className="p-4 pt-0">{saveBar(() => actions.setPorts(ports.filter((p) => p.code.length === 3 && p.name)))}</div>
        </Card>
      )}

      {tab === "Currency" && (
        <Card
          title="Currencies & rate of exchange (to INR)"
          actions={
            <Button size="sm" variant="secondary" onClick={() => setS({ ...s, currencies: [...s.currencies, { code: "", roe: 1 }] })}>
              <Plus size={13} /> Add currency
            </Button>
          }
        >
          <div className="space-y-2">
            {s.currencies.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  aria-label="Currency code"
                  className="w-24"
                  value={c.code}
                  onChange={(e) => setS({ ...s, currencies: s.currencies.map((x, j) => (j === i ? { ...x, code: e.target.value.toUpperCase().slice(0, 3) } : x)) })}
                />
                <Input
                  aria-label={`Rate of exchange for ${c.code || "currency"}`}
                  type="number"
                  step="0.0001"
                  className="w-32"
                  value={c.roe}
                  disabled={c.code === "INR"}
                  onChange={(e) => setS({ ...s, currencies: s.currencies.map((x, j) => (j === i ? { ...x, roe: Number(e.target.value) } : x)) })}
                />
                {c.code !== "INR" && (
                  <button onClick={() => setS({ ...s, currencies: s.currencies.filter((_, j) => j !== i) })} className="rounded p-1.5 text-slate-400 hover:text-red-600" aria-label="Remove row">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {saveBar(() => actions.updateSettings({ ...s, currencies: s.currencies.filter((c) => c.code.length === 3) }))}
        </Card>
      )}

      {tab === "Lists" && (
        <Card title="Dropdown lists (one per line)">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Branches">
              <Textarea rows={5} value={lines(s.branches)} onChange={(e) => setS({ ...s, branches: unlines(e.target.value) })} />
            </Field>
            <Field label="Financial years">
              <Textarea rows={5} value={lines(s.financialYears)} onChange={(e) => setS({ ...s, financialYears: unlines(e.target.value) })} />
            </Field>
            <Field label="Clearance places">
              <Textarea rows={5} value={lines(s.clearancePlaces)} onChange={(e) => setS({ ...s, clearancePlaces: unlines(e.target.value) })} />
            </Field>
            <Field label="Package types">
              <Textarea rows={10} value={lines(s.packageTypes)} onChange={(e) => setS({ ...s, packageTypes: unlines(e.target.value) })} />
            </Field>
            <Field label="Unit types">
              <Textarea rows={10} value={lines(s.unitTypes)} onChange={(e) => setS({ ...s, unitTypes: unlines(e.target.value) })} />
            </Field>
          </div>
          {saveBar()}
        </Card>
      )}

      {tab === "Roles & Users" && (
        <Card
          title="Users"
          actions={
            <Button size="sm" variant="secondary" onClick={() => setS({ ...s, users: [...s.users, { name: "", role: "Sales" }] })}>
              <Plus size={13} /> Add user
            </Button>
          }
        >
          <p className="mb-3 text-xs text-slate-500">Users appear as Sales Person and Assigned / Pricing Person on enquiries. Login and permissions come in a later phase.</p>
          <div className="space-y-2">
            {s.users.map((u, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input aria-label="User name" className="max-w-xs" value={u.name} onChange={(e) => setS({ ...s, users: s.users.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <Select aria-label="Role" className="w-40" value={u.role} onChange={(e) => setS({ ...s, users: s.users.map((x, j) => (j === i ? { ...x, role: e.target.value as UserRole } : x)) })}>
                  {ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
                <button onClick={() => setS({ ...s, users: s.users.filter((_, j) => j !== i) })} className="rounded p-1.5 text-slate-400 hover:text-red-600" aria-label="Remove row">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          {saveBar(() => actions.updateSettings({ ...s, users: s.users.filter((u) => u.name.trim()) }))}
        </Card>
      )}

      {tab === "Quotation Format" && (
        <Card title="Quotation defaults">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Default GST %">
              <Input type="number" value={s.gstPercent} onChange={(e) => setS({ ...s, gstPercent: Number(e.target.value) })} />
            </Field>
          </div>
          <h3 className="mt-5 mb-2 text-xs font-semibold text-slate-500 uppercase">Default agency charges</h3>
          <div className="space-y-2">
            {s.agencyCharges.map((c, i) => {
              const set = (patch: Partial<Settings["agencyCharges"][number]>) =>
                setS({ ...s, agencyCharges: s.agencyCharges.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input aria-label="Charge name" className="max-w-xs" value={c.particulars} onChange={(e) => set({ particulars: e.target.value })} />
                  <Select aria-label="Unit" className="w-36" value={c.unit} onChange={(e) => set({ unit: e.target.value as ChargeUnit })}>
                    <option>Per shipment</option>
                    <option>Per kg</option>
                  </Select>
                  <Input aria-label="Default rate" type="number" step="0.01" className="w-28" value={c.rate} onChange={(e) => set({ rate: Number(e.target.value) })} />
                  <button onClick={() => setS({ ...s, agencyCharges: s.agencyCharges.filter((_, j) => j !== i) })} className="rounded p-1.5 text-slate-400 hover:text-red-600" aria-label="Remove row">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            <Button size="sm" variant="secondary" onClick={() => setS({ ...s, agencyCharges: [...s.agencyCharges, { particulars: "", unit: "Per shipment", rate: 0 }] })}>
              <Plus size={13} /> Add charge
            </Button>
          </div>
          <Field label="Default notes / terms & conditions" className="mt-5">
            <Textarea rows={3} value={s.quotationTerms} onChange={(e) => setS({ ...s, quotationTerms: e.target.value })} />
          </Field>
          {saveBar()}
        </Card>
      )}

      {tab === "Alerts & Notifications" && (
        <Card title="Client notifications & reminders">
          <div className="space-y-3 text-sm">
            {(
              [
                ["notifyOnQuote", "WhatsApp the client when a quotation is emailed"],
                ["notifyOnBooking", "WhatsApp the client when the booking is confirmed"],
                ["notifyOnAwb", "Email the client when the AWB is issued"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" className="accent-brand-600" checked={s.alerts[k]} onChange={(e) => setS({ ...s, alerts: { ...s.alerts, [k]: e.target.checked } })} />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Field label="Remind airlines after (hours)" hint="Reminder suggestion for pending rate requests">
              <Input type="number" value={s.alerts.rateReminderHours} onChange={(e) => setS({ ...s, alerts: { ...s.alerts, rateReminderHours: Number(e.target.value) } })} />
            </Field>
            <Field label="Remind customers after (days)" hint="Reminder suggestion for pending quotations">
              <Input type="number" value={s.alerts.quoteReminderDays} onChange={(e) => setS({ ...s, alerts: { ...s.alerts, quoteReminderDays: Number(e.target.value) } })} />
            </Field>
          </div>
          {saveBar()}
        </Card>
      )}

      {tab === "AWB Template" && (
        <Card title="AWB template">
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <b>Master AWB (MAWB)</b>: issued by the airline. Number = airline&apos;s 3-digit prefix (Airlines master) + 8-digit serial.
            </p>
            <p>
              <b>House AWB (HAWB)</b>: issued by the agent for shared (consolidated) cargo, using your own serial.
            </p>
            <p className="text-xs text-slate-400">The printable AWB uses the company name from General Setup. Custom AWB layouts are planned for a later phase.</p>
          </div>
        </Card>
      )}
    </>
  );
}
