"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Globe, Landmark, Plus, Truck, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { AGENT_TYPES, type Agent, type AgentType } from "@/lib/types";
import { matches } from "@/lib/utils";
import { Badge, Button, Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, NoResults, PageHeader, ResetFilters, RowMenu, SearchField, Table } from "@/components/ui";
import { AgentFormModal } from "@/components/PartyForm";

const TYPE_LOOK: Record<AgentType, { icon: LucideIcon; tone: KpiDef<Agent>["tone"]; label: string }> = {
  "Overseas Agent": { icon: Globe, tone: "indigo", label: "Overseas Agents" },
  CHA: { icon: Landmark, tone: "amber", label: "CHA" },
  Transporter: { icon: Truck, tone: "green", label: "Transporters" },
};

export default function AgentsPage() {
  const { state } = useStore();
  const [editing, setEditing] = useState<Agent | "new" | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | AgentType>("all");
  const [country, setCountry] = useState("all");

  const countries = [...new Set(state.agents.map((a) => a.country).filter(Boolean))].sort();
  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<Agent>[] = [
    { id: "all", icon: Users, label: "All Agents" },
    ...AGENT_TYPES.map((t) => ({ id: t, icon: TYPE_LOOK[t].icon, tone: TYPE_LOOK[t].tone, label: TYPE_LOOK[t].label, test: (a: Agent) => a.type === t })),
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || type !== "all" || country !== "all" || kpi !== null;
  const rows = state.agents.filter(kpiOk).filter(
    (a) =>
      (type === "all" || a.type === type) &&
      (country === "all" || a.country === country) &&
      matches(q, [a.name, a.contact, a.email, a.phone, a.city, ...a.altEmails, ...a.altPhones]),
  );
  const reset = () => {
    setQ("");
    setType("all");
    setCountry("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader
        title="Agents"
        subtitle="Overseas agents, CHA (customs house agents) and transporters. Forwarders / logistics companies are under Customers."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden /> Add Agent
          </Button>
        }
      />

      <KpiFilters rows={state.agents} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search agents" value={q} onChange={setQ} />
        <FilterSelect label="Agent type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="all">All Types</option>
          {AGENT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Country" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="all">All Countries</option>
          {countries.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th>City / Country</th>
                <th className="text-right">Docs</th>
                <th className="w-14 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="font-medium whitespace-nowrap">{a.name}</td>
                  <td className="whitespace-nowrap">
                    <Badge>{a.type}</Badge>
                  </td>
                  <td>{a.contact}</td>
                  <td className="text-slate-600" title={[a.email, ...a.altEmails].join("\n")}>
                    {a.email || "—"}
                    {a.altEmails.length > 0 && <span className="ml-1 text-xs text-slate-400">+{a.altEmails.length}</span>}
                  </td>
                  <td className="whitespace-nowrap" title={[a.phone, ...a.altPhones].join("\n")}>
                    {a.phone || "—"}
                    {a.altPhones.length > 0 && <span className="ml-1 text-xs text-slate-400">+{a.altPhones.length}</span>}
                  </td>
                  <td className="whitespace-nowrap">{[a.city, a.country].filter(Boolean).join(", ")}</td>
                  <td className="text-right text-slate-600 tabular-nums">{a.documents.length || "—"}</td>
                  <td className="text-center">
                    <RowMenu
                      label={`Actions for ${a.name}`}
                      items={[
                        { label: "Edit", onSelect: () => setEditing(a) },
                        ...(a.email ? [{ label: "Send email", href: `mailto:${[a.email, ...a.altEmails].join(",")}` }] : []),
                        ...(a.phone ? [{ label: "Call", href: `tel:${a.phone.replace(/\s/g, "")}` }] : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No agents yet. Add one with Add Agent.
          </NoResults>
        )}
      </Card>
      {editing && <AgentFormModal existing={editing === "new" ? undefined : editing} defaultType={type === "all" ? undefined : type} onClose={() => setEditing(null)} />}
    </>
  );
}
