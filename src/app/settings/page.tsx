"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  REF_PARTS,
  type ChargeUnit,
  type Port,
  type RefPart,
  type RefPattern,
  type Settings,
} from "@/lib/types";
import { buildRef, cn, fmtPort } from "@/lib/utils";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Tabs,
  Textarea,
} from "@/components/ui";
import { ImageUpload } from "@/components/inputs";

const TABS = [
  "General Setup",
  "Ref Number",
  "Port & Country",
  "Currency",
  "Lists",
  "Roles & Users",
  "Service Charges",
  "Alerts & Notifications",
  "AWB Template",
] as const;

type Tab = (typeof TABS)[number];

const removeBtn =
  "rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600";

/** One dropdown list with "+ Add" and a remove button per item */
function ListEditor({
  title,
  items,
  onChange,
  addLabel,
}: {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
}) {
  return (
    <div className="min-w-0 rounded-lg ">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">
          {title}{" "}
          <span className="font-normal text-slate-400">{items.length}</span>
        </h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onChange([...items, ""])}
        >
          <Plus size={13} aria-hidden /> {addLabel}
        </Button>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <Input
              aria-label={`${title} ${i + 1}`}
              value={item}
              autoFocus={!item && i === items.length - 1}
              onChange={(e) =>
                onChange(items.map((x, j) => (j === i ? e.target.value : x)))
              }
              className="h-8"
            />
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className={removeBtn}
              aria-label={`Remove ${item || "empty item"}`}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  const ordered = [
    ...pattern.parts,
    ...allowed.filter((p) => !pattern.parts.includes(p)),
  ];
  const toggle = (part: RefPart) =>
    onChange({
      ...pattern,
      parts: pattern.parts.includes(part)
        ? pattern.parts.filter((p) => p !== part)
        : [...pattern.parts, part],
    });
  const move = (part: RefPart, by: -1 | 1) => {
    const parts = [...pattern.parts];
    const i = parts.indexOf(part);
    const j = i + by;
    if (j < 0 || j >= parts.length) return;
    [parts[i], parts[j]] = [parts[j], parts[i]];
    onChange({ ...pattern, parts });
  };

  return (
    <Card title={title}>
      <p className="mb-3 text-xs text-slate-500">{description}</p>
      <ul className="space-y-1.5" aria-label={`${title} parts`}>
        {ordered.map((part) => {
          const on = pattern.parts.includes(part);
          const i = pattern.parts.indexOf(part);
          return (
            <li
              key={part}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                on
                  ? "border-brand-200 bg-brand-50/50"
                  : "border-slate-200 text-slate-500",
              )}
            >
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(part)}
                  className="size-4 accent-brand-600"
                />
                {on && (
                  <span className="w-4 text-xs font-semibold text-brand-700">
                    {i + 1}
                  </span>
                )}
                {REF_PARTS[part]}
              </label>
              {on && (
                <span className="flex">
                  <button
                    onClick={() => move(part, -1)}
                    disabled={i === 0}
                    className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"
                    aria-label={`Move ${REF_PARTS[part]} up`}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => move(part, 1)}
                    disabled={i === pattern.parts.length - 1}
                    className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"
                    aria-label={`Move ${REF_PARTS[part]} down`}
                  >
                    <ArrowDown size={14} />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field
          label="Label before the number"
          hint='e.g. "EQ: " or leave empty'
        >
          <Input
            value={pattern.label}
            onChange={(e) => onChange({ ...pattern, label: e.target.value })}
          />
        </Field>
        <Field label="Separator">
          <Select
            value={pattern.separator}
            onChange={(e) =>
              onChange({
                ...pattern,
                separator: e.target.value as RefPattern["separator"],
              })
            }
          >
            <option value="-">Hyphen ( - )</option>
            <option value="/">Slash ( / )</option>
            <option value="">None</option>
          </Select>
        </Field>
        <Field label="Sequence digits">
          <Select
            value={pattern.digits}
            onChange={(e) =>
              onChange({ ...pattern, digits: Number(e.target.value) })
            }
          >
            {[3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {d} ({"1".padStart(d, "0")})
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
        Next number: <b className="font-mono">{preview}</b>
      </div>
    </Card>
  );
}

function SettingsForm() {
  const { state, actions } = useStore();
  // ?tab= opens a tab directly, e.g. from Masters → Locations
  const requested = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(
    TABS.find((t) => t === requested) ?? "General Setup",
  );
  // Each tab edits this draft; Save writes it back
  const [s, setS] = useState<Settings>(state.settings);
  const [ports, setPorts] = useState<Port[]>(state.ports);
  const clean = (v: string[]) => v.map((x) => x.trim()).filter(Boolean);
  const save = () =>
    actions.updateSettings({
      ...s,
      branches: s.branches.filter((b) => b.name.trim()),
      financialYears: clean(s.financialYears),
      clearancePlaces: clean(s.clearancePlaces),
      packageTypes: clean(s.packageTypes),
      unitTypes: clean(s.unitTypes),
      roles: clean(s.roles),
      users: s.users.filter((u) => u.name.trim()),
      agencyCharges: s.agencyCharges.filter((c) => c.particulars.trim()),
    });
  const dirty =
    JSON.stringify(s) !== JSON.stringify(state.settings) ||
    JSON.stringify(ports) !== JSON.stringify(state.ports);
  // Enquiry and quotation screens rely on these never being empty
  const lists: [string, unknown[]][] = [
    ["branch", s.branches.filter((b) => b.name.trim())],
    ["financial year", clean(s.financialYears)],
    ["clearance place", clean(s.clearancePlaces)],
    ["package type", clean(s.packageTypes)],
    ["unit type", clean(s.unitTypes)],
    ["role", clean(s.roles)],
  ];
  const emptyList = lists.find(([, list]) => !list.length)?.[0];
  const problem = !s.refPrefix
    ? "Enter a company code (Ref Number)."
    : !s.enquiryRef.parts.includes("seq") || !s.jobRef.parts.includes("seq")
      ? "Reference numbers must include the Sequence Number so they stay unique."
      : emptyList
        ? `Keep at least one ${emptyList}.`
        : !s.users.some((u) => u.name.trim())
          ? "Keep at least one user."
          : s.users.some((u) => u.name.trim() && !s.roles.includes(u.role))
            ? "Every user needs one of the roles listed."
            : !ports.some((p) => p.code.length === 3 && p.name)
              ? "Keep at least one airport."
              : "";
  const saveBar = (onSave = save) => (
    <div className="mt-3 flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
      {problem ? (
        <span className="text-xs text-red-600">{problem}</span>
      ) : (
        dirty && (
          <span className="text-xs text-amber-700">
            You have unsaved changes
          </span>
        )
      )}
      <Button onClick={onSave} disabled={!dirty || !!problem}>
        Save changes
      </Button>
    </div>
  );
  const company = (patch: Partial<Settings["company"]>) =>
    setS({ ...s, company: { ...s.company, ...patch } });
  const year = new Date().getFullYear();
  const sample = state.customers[0];

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Company set up and the lists used across enquiries, quotations, bookings and invoices"
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "General Setup" && (
        <div className="space-y-3">
          <Card title="Company set up">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  <Input
                    value={s.company[k]}
                    onChange={(e) => company({ [k]: e.target.value })}
                  />
                </Field>
              ))}
              <Field label="Address" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={s.company.address}
                  onChange={(e) => company({ address: e.target.value })}
                />
              </Field>
              <Field label="Email signature" className="sm:col-span-2">
                <Textarea
                  rows={3}
                  value={s.company.signature}
                  onChange={(e) => company({ signature: e.target.value })}
                />
              </Field>
            </div>
          </Card>

          <Card title="Logo & letterhead">
            <p className="mb-3 text-xs text-slate-500">
              Used on quotations and customer invoices. With a letterhead banner
              the banner replaces the generated header (logo, company details
              and second logo). The footer banner prints at the bottom of each
              document.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ImageUpload
                label="Company logo"
                hint="Left of the letterhead. PNG with a transparent background works best."
                value={s.company.logo}
                onChange={(v) => company({ logo: v })}
              />
              <ImageUpload
                label="Second logo (e.g. IATA)"
                hint="Right of the letterhead, as on the sample quotation."
                value={s.company.accreditationLogo}
                onChange={(v) => company({ accreditationLogo: v })}
              />
              <ImageUpload
                label="Letterhead banner"
                hint="Full-width image, about 2000 × 300 px."
                value={s.company.letterhead}
                onChange={(v) => company({ letterhead: v })}
                wide
              />
              <ImageUpload
                label="Footer banner"
                hint="Full-width image, about 2000 × 200 px."
                value={s.company.footer}
                onChange={(v) => company({ footer: v })}
                wide
              />
            </div>
          </Card>

          <Card
            title="Office branches"
            actions={
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setS({
                    ...s,
                    branches: [
                      ...s.branches,
                      { name: "", address: "", phone: "" },
                    ],
                  })
                }
              >
                <Plus size={13} aria-hidden /> Add branch
              </Button>
            }
            bodyClassName="p-0"
          >
            <Table>
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Address</th>
                  <th>Phone</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {s.branches.map((b, i) => {
                  const set = (patch: Partial<Settings["branches"][number]>) =>
                    setS({
                      ...s,
                      branches: s.branches.map((x, j) =>
                        j === i ? { ...x, ...patch } : x,
                      ),
                    });
                  return (
                    <tr key={i}>
                      <td className="w-48">
                        <Input
                          aria-label="Branch name"
                          value={b.name}
                          onChange={(e) => set({ name: e.target.value })}
                        />
                      </td>
                      <td className="min-w-64">
                        <Input
                          aria-label={`Address of ${b.name || "branch"}`}
                          value={b.address}
                          onChange={(e) => set({ address: e.target.value })}
                        />
                      </td>
                      <td className="w-48">
                        <Input
                          aria-label={`Phone of ${b.name || "branch"}`}
                          value={b.phone}
                          onChange={(e) => set({ phone: e.target.value })}
                        />
                      </td>
                      <td className="w-10">
                        <button
                          onClick={() =>
                            setS({
                              ...s,
                              branches: s.branches.filter((_, j) => j !== i),
                            })
                          }
                          className={removeBtn}
                          aria-label={`Remove ${b.name || "branch"}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="px-3 pb-3">{saveBar()}</div>
          </Card>
        </div>
      )}

      {tab === "Ref Number" && (
        <div className="space-y-3">
          <Card title="Company code">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field
                label="Company Code"
                hint="Used in enquiry, quotation, booking/job and invoice numbers"
              >
                <Input
                  value={s.refPrefix}
                  onChange={(e) =>
                    setS({
                      ...s,
                      refPrefix: e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, ""),
                    })
                  }
                />
              </Field>
            </div>
          </Card>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <RefPatternEditor
              title="Enquiry Ref Number"
              description="Given when an enquiry is saved. The quotation reuses it (EQ becomes QT). An enquiry can be cancelled without ever becoming a job, so jobs have their own sequence."
              pattern={s.enquiryRef}
              allowed={["company", "pol", "pod", "year", "seq"]}
              onChange={(enquiryRef) => setS({ ...s, enquiryRef })}
              preview={buildRef(s.enquiryRef, {
                company: s.refPrefix,
                pol: "COK",
                pod: "DXB",
                year,
                seq: state.counters.enquiry + 1,
              })}
            />
            <RefPatternEditor
              title="Booking/Job Ref Number"
              description={`Given when a booking/job is created from a confirmed quotation. Client Code comes from the customer master${sample ? ` (e.g. ${sample.name}: ${sample.code || "no code"})` : ""}.`}
              pattern={s.jobRef}
              allowed={["company", "client", "pol", "pod", "year", "seq"]}
              onChange={(jobRef) => setS({ ...s, jobRef })}
              preview={buildRef(s.jobRef, {
                company: s.refPrefix,
                client: sample?.code || "CLT",
                pol: "COK",
                pod: "DXB",
                year,
                seq: state.counters.job + 1,
              })}
            />
          </div>
          <div>{saveBar()}</div>
        </div>
      )}

      {tab === "Port & Country" && (
        <Card
          title="Airports (global list)"
          actions={
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setPorts([...ports, { code: "", name: "", country: "" }])
              }
            >
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
                const set = (patch: Partial<Port>) =>
                  setPorts(
                    ports.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                  );
                return (
                  <tr key={i}>
                    <td>
                      <Input
                        aria-label="Airport code"
                        className="w-20"
                        value={p.code}
                        onChange={(e) =>
                          set({
                            code: e.target.value.toUpperCase().slice(0, 3),
                          })
                        }
                      />
                    </td>
                    <td>
                      <Input
                        aria-label="Airport or city name"
                        value={p.name}
                        onChange={(e) => set({ name: e.target.value })}
                      />
                    </td>
                    <td>
                      <Input
                        aria-label="Country"
                        value={p.country}
                        onChange={(e) => set({ country: e.target.value })}
                      />
                    </td>
                    <td className="text-xs text-slate-500">{fmtPort(p)}</td>
                    <td>
                      <button
                        onClick={() =>
                          setPorts(ports.filter((_, j) => j !== i))
                        }
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <div className="p-3 pt-0">
            {saveBar(() =>
              actions.setPorts(
                ports.filter((p) => p.code.length === 3 && p.name),
              ),
            )}
          </div>
        </Card>
      )}

      {tab === "Currency" && (
        <Card
          title="Currencies & rate of exchange (to INR)"
          actions={
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setS({
                  ...s,
                  currencies: [...s.currencies, { code: "", roe: 1 }],
                })
              }
            >
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
                  onChange={(e) =>
                    setS({
                      ...s,
                      currencies: s.currencies.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              code: e.target.value.toUpperCase().slice(0, 3),
                            }
                          : x,
                      ),
                    })
                  }
                />
                <Input
                  aria-label={`Rate of exchange for ${c.code || "currency"}`}
                  type="number"
                  step="0.0001"
                  className="w-32"
                  value={c.roe}
                  disabled={c.code === "INR"}
                  onChange={(e) =>
                    setS({
                      ...s,
                      currencies: s.currencies.map((x, j) =>
                        j === i ? { ...x, roe: Number(e.target.value) } : x,
                      ),
                    })
                  }
                />
                {c.code !== "INR" && (
                  <button
                    onClick={() =>
                      setS({
                        ...s,
                        currencies: s.currencies.filter((_, j) => j !== i),
                      })
                    }
                    className="rounded p-1.5 text-slate-400 hover:text-red-600"
                    aria-label="Remove row"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {saveBar(() =>
            actions.updateSettings({
              ...s,
              currencies: s.currencies.filter((c) => c.code.length === 3),
            }),
          )}
        </Card>
      )}

      {tab === "Lists" && (
        <Card title="Dropdown lists">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ListEditor
              title="Financial years"
              items={s.financialYears}
              onChange={(financialYears) => setS({ ...s, financialYears })}
              addLabel="Add"
            />
            <ListEditor
              title="Clearance places"
              items={s.clearancePlaces}
              onChange={(clearancePlaces) => setS({ ...s, clearancePlaces })}
              addLabel="Add"
            />
            <ListEditor
              title="Package types"
              items={s.packageTypes}
              onChange={(packageTypes) => setS({ ...s, packageTypes })}
              addLabel="Add"
            />
            <ListEditor
              title="Unit types"
              items={s.unitTypes}
              onChange={(unitTypes) => setS({ ...s, unitTypes })}
              addLabel="Add"
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Office branches are under General Setup.
          </p>
          {saveBar()}
        </Card>
      )}

      {tab === "Roles & Users" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card>
            <ListEditor
              title="Roles"
              items={s.roles}
              onChange={(roles) => setS({ ...s, roles })}
              addLabel="Add role"
            />
            <p className="mt-2 text-xs text-slate-500">
              A role in use by a user can&apos;t be saved empty or removed.
            </p>
          </Card>
          <Card
            title="Users"
            actions={
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setS({
                    ...s,
                    users: [
                      ...s.users,
                      { name: "", role: clean(s.roles)[0] ?? "" },
                    ],
                  })
                }
              >
                <Plus size={13} aria-hidden /> Add user
              </Button>
            }
          >
            <p className="mb-3 text-xs text-slate-500">
              Users appear as Sales Person and Assigned / Pricing Person on
              enquiries. Login and permissions come in a later phase.
            </p>
            <div className="space-y-2">
              {s.users.map((u, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    aria-label="User name"
                    className="max-w-xs"
                    value={u.name}
                    onChange={(e) =>
                      setS({
                        ...s,
                        users: s.users.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <Select
                    aria-label="Role"
                    className="w-44"
                    value={u.role}
                    onChange={(e) =>
                      setS({
                        ...s,
                        users: s.users.map((x, j) =>
                          j === i ? { ...x, role: e.target.value } : x,
                        ),
                      })
                    }
                  >
                    {!s.roles.includes(u.role) && (
                      <option value={u.role}>{u.role || "Select role"}</option>
                    )}
                    {clean(s.roles).map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                  <button
                    onClick={() =>
                      setS({ ...s, users: s.users.filter((_, j) => j !== i) })
                    }
                    className={removeBtn}
                    aria-label={`Remove ${u.name || "user"}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            {saveBar()}
          </Card>
        </div>
      )}

      {tab === "Service Charges" && (
        <Card title="Service charges">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Default GST %">
              <Input
                type="number"
                value={s.gstPercent}
                onChange={(e) =>
                  setS({ ...s, gstPercent: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <h3 className="mt-3 mb-2 text-xs font-semibold text-slate-500 uppercase">
            Default agency / clearance charges on every quotation
          </h3>
          <div className="space-y-2">
            {s.agencyCharges.map((c, i) => {
              const set = (patch: Partial<Settings["agencyCharges"][number]>) =>
                setS({
                  ...s,
                  agencyCharges: s.agencyCharges.map((x, j) =>
                    j === i ? { ...x, ...patch } : x,
                  ),
                });
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="Charge name"
                    className="max-w-xs"
                    value={c.particulars}
                    onChange={(e) => set({ particulars: e.target.value })}
                  />
                  <Select
                    aria-label="Unit"
                    className="w-36"
                    value={c.unit}
                    onChange={(e) =>
                      set({ unit: e.target.value as ChargeUnit })
                    }
                  >
                    <option>Per shipment</option>
                    <option>Per kg</option>
                  </Select>
                  <Input
                    aria-label="Default rate"
                    type="number"
                    step="0.01"
                    className="w-28"
                    value={c.rate}
                    onChange={(e) => set({ rate: Number(e.target.value) })}
                  />
                  <Input
                    aria-label="Remarks"
                    placeholder="Remarks, e.g. AT ACTUALS"
                    className="w-44"
                    value={c.remarks}
                    onChange={(e) =>
                      set({ remarks: e.target.value.toUpperCase() })
                    }
                  />
                  <button
                    onClick={() =>
                      setS({
                        ...s,
                        agencyCharges: s.agencyCharges.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                    className={removeBtn}
                    aria-label={`Remove ${c.particulars || "charge"}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setS({
                  ...s,
                  agencyCharges: [
                    ...s.agencyCharges,
                    {
                      particulars: "",
                      unit: "Per shipment",
                      rate: 0,
                      remarks: "",
                    },
                  ],
                })
              }
            >
              <Plus size={13} aria-hidden /> Add charge
            </Button>
          </div>
          <Field label="Default notes / terms & conditions" className="mt-3">
            <Textarea
              rows={6}
              value={s.quotationTerms}
              onChange={(e) => setS({ ...s, quotationTerms: e.target.value })}
            />
          </Field>
          {saveBar()}
        </Card>
      )}

      {tab === "Alerts & Notifications" && (
        <Card title="Client notifications & reminders">
          <div className="space-y-3 text-sm">
            {(
              [
                [
                  "notifyOnQuote",
                  "WhatsApp the client when a quotation is emailed",
                ],
                [
                  "notifyOnBooking",
                  "WhatsApp the client when the booking is confirmed",
                ],
                ["notifyOnAwb", "Email the client when the AWB is issued"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={s.alerts[k]}
                  onChange={(e) =>
                    setS({
                      ...s,
                      alerts: { ...s.alerts, [k]: e.target.checked },
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field
              label="Remind airlines after (hours)"
              hint="Reminder suggestion for pending rate requests"
            >
              <Input
                type="number"
                value={s.alerts.rateReminderHours}
                onChange={(e) =>
                  setS({
                    ...s,
                    alerts: {
                      ...s.alerts,
                      rateReminderHours: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <Field
              label="Remind customers after (days)"
              hint="Reminder suggestion for pending quotations"
            >
              <Input
                type="number"
                value={s.alerts.quoteReminderDays}
                onChange={(e) =>
                  setS({
                    ...s,
                    alerts: {
                      ...s.alerts,
                      quoteReminderDays: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
          </div>
          {saveBar()}
        </Card>
      )}

      {tab === "AWB Template" && (
        <Card title="AWB template">
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <b>Master AWB (MAWB)</b>: issued by the airline. Number =
              airline&apos;s 3-digit prefix (Airlines master) + 8-digit serial.
            </p>
            <p>
              <b>House AWB (HAWB)</b>: issued by the agent for shared
              (consolidated) cargo, using your own serial.
            </p>
            <p className="text-xs text-slate-400">
              The printable AWB uses the company name from General Setup. Custom
              AWB layouts are planned for a later phase.
            </p>
          </div>
        </Card>
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
