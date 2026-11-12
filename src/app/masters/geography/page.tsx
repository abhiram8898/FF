"use client";

import { useState } from "react";
import { Coins, Globe2, MapPin, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { PORT_STATUSES, type Currency, type Port } from "@/lib/types";
import { matches } from "@/lib/utils";
import { Badge, Button, Card, Field, FilterBar, FilterSelect, Input, type KpiDef, KpiFilters, kpiTest, Modal, NoResults, PageHeader, ResetFilters, RowActions, SearchField, Select, Table, Tabs, Toggle } from "@/components/ui";

const TABS = ["Ports & Countries", "Currency Management"] as const;
const ACTIVE = "bg-emerald-50 text-emerald-800 ring-emerald-200";
const INACTIVE = "bg-slate-100 text-slate-600 ring-slate-200";

export default function GeographyPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Ports & Countries");
  return (
    <>
      <PageHeader title="Geographical Data" subtitle="Ports shown as LOCATION-CODE-COUNTRY in every POL / POD dropdown, and the currencies used on rates, quotations and bills." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "Ports & Countries" ? <Ports /> : <Currencies />}
    </>
  );
}

function Ports() {
  const { state, actions } = useStore();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [editing, setEditing] = useState<Port | "new" | null>(null);
  const regions = [...new Set(state.ports.map((p) => p.region).filter(Boolean))].sort();
  const usage = (code: string) => state.enquiries.filter((e) => e.pol === code || e.pod === code).length + state.reservations.filter((r) => r.pol === code || r.pod === code).length;
  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<Port>[] = [
    { id: "all", icon: MapPin, label: "Ports" },
    { id: "countries", icon: Globe2, tone: "sky", label: "Countries", value: new Set(state.ports.map((p) => p.country)).size },
    { id: "active", icon: MapPin, tone: "green", label: "Active", test: (p) => p.status === "Active" },
    { id: "inactive", icon: MapPin, tone: "slate", label: "Inactive", test: (p) => p.status === "Inactive" },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || region !== "all" || kpi !== null;
  const rows = state.ports.filter(kpiOk).filter((p) => (region === "all" || p.region === region) && matches(q, [p.code, p.name, p.country, p.countryCode, p.region]));
  const reset = () => {
    setQ("");
    setRegion("all");
    setKpi(null);
  };

  return (
    <>
      <KpiFilters cols={4} rows={state.ports} kpis={KPIS} active={kpi} onChange={setKpi} />
      <FilterBar>
        <SearchField label="Search ports" value={q} onChange={setQ} />
        <FilterSelect label="Region" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">All Regions</option>
          {regions.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} aria-hidden /> Add Port
        </Button>
      </FilterBar>
      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th className="w-px whitespace-nowrap">Actions</th>
                <th>Port Name</th>
                <th>Port Code</th>
                <th>Country Name</th>
                <th>Country Code</th>
                <th>Region</th>
                <th>ISD Code</th>
                <th>Status</th>
                <th className="text-right">Used</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.code} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap">
                    <RowActions
                      label={`Actions for ${p.code}`}
                      items={[
                        { label: "Edit", onSelect: () => setEditing(p) },
                        {
                          label: p.status === "Active" ? "Make inactive" : "Make active",
                          onSelect: () => actions.setPorts(state.ports.map((x) => (x.code === p.code ? { ...x, status: p.status === "Active" ? "Inactive" : "Active" } : x))),
                        },
                      ]}
                    />
                  </td>
                  <td className="font-medium">{p.name}</td>
                  <td className="font-mono">{p.code}</td>
                  <td>{p.country}</td>
                  <td className="font-mono">{p.countryCode}</td>
                  <td>{p.region}</td>
                  <td>{p.isd}</td>
                  <td>
                    <Badge className={p.status === "Active" ? ACTIVE : INACTIVE}>{p.status}</Badge>
                  </td>
                  <td className="text-right tabular-nums">{usage(p.code)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No ports yet.
          </NoResults>
        )}
      </Card>
      {editing && (
        <PortModal
          existing={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            actions.setPorts(editing === "new" ? [...state.ports, p] : state.ports.map((x) => (x.code === editing.code ? p : x)));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function PortModal({ existing, onClose, onSave }: { existing?: Port; onClose: () => void; onSave: (p: Port) => void }) {
  const { state } = useStore();
  const [p, setP] = useState<Port>(existing ?? { code: "", name: "", country: "", countryCode: "", region: "", isd: "", status: "Active" });
  const taken = !existing && state.ports.some((x) => x.code === p.code);
  const valid = p.code.length === 3 && !taken && p.name.trim() && p.country.trim() && p.isd.trim();
  const str = (k: keyof Port, upper = false) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setP({ ...p, [k]: upper ? e.target.value.toUpperCase() : e.target.value });
  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? `Edit port · ${existing.code}` : "Add port"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={() => onSave(p)}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 max-xs:*:col-span-full xs:grid-cols-2 gap-3">
        <Field label="Port Name *">
          <Input value={p.name} onChange={str("name")} />
        </Field>
        <Field label="Port Code *" hint={taken ? <span className="text-red-600">Already in the list</span> : "3-letter IATA code"}>
          <Input value={p.code} maxLength={3} disabled={!!existing} onChange={(e) => setP({ ...p, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} />
        </Field>
        <Field label="Country Name *">
          <Input value={p.country} onChange={str("country")} />
        </Field>
        <Field label="Country Code">
          <Input value={p.countryCode} maxLength={3} onChange={str("countryCode", true)} />
        </Field>
        <Field label="Region">
          <Input value={p.region} onChange={str("region")} />
        </Field>
        <Field label="ISD Code *">
          <Input value={p.isd} onChange={str("isd")} placeholder="+91" />
        </Field>
        <Field label="Status">
          <Select value={p.status} onChange={str("status")}>
            {PORT_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function Currencies() {
  const { state, actions } = useStore();
  const [editing, setEditing] = useState<Currency | "new" | null>(null);
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} aria-hidden /> Add Currency
        </Button>
      </div>
      <Card bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <th className="w-px whitespace-nowrap">Actions</th>
              <th>Currency Code</th>
              <th>Currency Name</th>
              <th>Symbol</th>
              <th className="text-right">Decimal Places</th>
              <th className="text-right">ROE (to INR)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {state.currencies.map((c) => (
              <tr key={c.code} className="hover:bg-slate-50">
                <td className="whitespace-nowrap">
                  <RowActions label={`Actions for ${c.code}`} items={[{ label: "Edit", onSelect: () => setEditing(c) }]} />
                </td>
                <td className="font-mono font-medium">{c.code}</td>
                <td>{c.name}</td>
                <td>{c.symbol}</td>
                <td className="text-right tabular-nums">{c.decimals}</td>
                <td className="text-right tabular-nums">{c.roe}</td>
                <td>
                  <Badge className={c.active ? ACTIVE : INACTIVE}>{c.active ? "Active" : "Inactive"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
        <Coins size={13} aria-hidden /> Inactive currencies stay on existing records but are not offered on new ones. INR is the base currency.
      </p>
      {editing && (
        <CurrencyModal
          existing={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            actions.setCurrencies(editing === "new" ? [...state.currencies, c] : state.currencies.map((x) => (x.code === editing.code ? c : x)));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function CurrencyModal({ existing, onClose, onSave }: { existing?: Currency; onClose: () => void; onSave: (c: Currency) => void }) {
  const { state } = useStore();
  const [c, setC] = useState<Currency>(existing ?? { code: "", name: "", symbol: "", decimals: 2, active: true, roe: 1 });
  const taken = !existing && state.currencies.some((x) => x.code === c.code);
  const valid = c.code.length === 3 && !taken && c.name.trim() && c.decimals >= 0 && c.roe > 0;
  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? `Edit currency · ${existing.code}` : "Add currency"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={() => onSave(c)}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 max-xs:*:col-span-full xs:grid-cols-2 gap-3">
        <Field label="Currency Code *" hint={taken ? <span className="text-red-600">Already in the list</span> : undefined}>
          <Input value={c.code} maxLength={3} disabled={!!existing} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} />
        </Field>
        <Field label="Currency Name *">
          <Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        </Field>
        <Field label="Symbol">
          <Input value={c.symbol} onChange={(e) => setC({ ...c, symbol: e.target.value })} />
        </Field>
        <Field label="Decimal Places *">
          <Input type="number" min="0" max="4" value={c.decimals} onChange={(e) => setC({ ...c, decimals: Number(e.target.value) })} />
        </Field>
        <Field label="Rate of exchange to INR">
          <Input type="number" min="0" step="0.0001" value={c.roe} disabled={c.code === "INR"} onChange={(e) => setC({ ...c, roe: Number(e.target.value) })} />
        </Field>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">Active *</span>
          <div className="flex h-9 items-center gap-2 text-sm sm:h-8">
            <Toggle checked={c.active} onChange={(active) => setC({ ...c, active })} label="Active" disabled={c.code === "INR"} /> {c.active ? "Yes" : "No"}
          </div>
        </div>
      </div>
    </Modal>
  );
}
