"use client";

import { useState } from "react";
import { Globe, Plane, Plus, Scale, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Airline } from "@/lib/types";
import { matches } from "@/lib/utils";
import { Badge, Button, Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, NoResults, PageHeader, ResetFilters, RowMenu, SearchField, Table } from "@/components/ui";
import { FormModal } from "@/components/FormModal";

export default function AirlinesPage() {
  const { state, actions } = useStore();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [port, setPort] = useState("all");

  const served = [...new Set(state.airlines.flatMap((a) => a.ports))].sort();
  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<Airline>[] = [
    { id: "all", icon: Plane, label: "Airlines" },
    { id: "rates", icon: Scale, tone: "violet", label: "With Master Rates", test: (a) => state.rates.some((r) => r.source === "Master" && r.airlineId === a.id) },
    { id: "asked", icon: Send, tone: "indigo", label: "Asked for Rates", test: (a) => state.enquiries.some((e) => e.rateRequests.some((r) => r.airlineId === a.id)) },
    { id: "portal", icon: Globe, tone: "sky", label: "With Booking Portal", test: (a) => !!a.portalUrl },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || port !== "all" || kpi !== null;
  const rows = state.airlines.filter(kpiOk).filter((a) => (port === "all" || a.ports.includes(port)) && matches(q, [a.name, a.code, a.prefix, a.email]));
  const reset = () => {
    setQ("");
    setPort("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader
        title="Carriers"
        subtitle="Rate requests go to the email below. The airports served decide which airlines are offered for a route."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden /> Add Airline
          </Button>
        }
      />

      <KpiFilters rows={state.airlines} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search airlines" value={q} onChange={setQ} />
        <FilterSelect label="Airport served" value={port} onChange={(e) => setPort(e.target.value)}>
          <option value="all">All Airports</option>
          {served.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Airline</th>
                <th>Code</th>
                <th>AWB Prefix</th>
                <th>Rate Request Email</th>
                <th>Airports Served</th>
                <th className="w-14 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="font-medium whitespace-nowrap">{a.name}</td>
                  <td>{a.code}</td>
                  <td className="font-mono">{a.prefix}</td>
                  <td className="text-slate-600">{a.email}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {a.ports.map((p) => (
                        <Badge key={p}>{p}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="text-center">
                    <RowMenu
                      label={`Actions for ${a.name}`}
                      items={[
                        ...(a.portalUrl ? [{ label: "Open booking portal", onSelect: () => window.open(a.portalUrl, "_blank", "noopener,noreferrer") }] : []),
                        { label: "Email rate desk", href: `mailto:${a.email}` },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No airlines yet. Add one with Add Airline.
          </NoResults>
        )}
      </Card>
      {adding && (
        <FormModal
          title="Add airline"
          initial={{ name: "", code: "", prefix: "", email: "", portalUrl: "", ports: "" }}
          fields={[
            { key: "name", label: "Airline name", required: true },
            { key: "code", label: "IATA code", required: true },
            { key: "prefix", label: "AWB prefix (3 digits)" },
            { key: "email", label: "Rate request email", required: true, email: true },
            { key: "portalUrl", label: "Booking portal URL" },
            { key: "ports", label: "Airports served (comma separated codes, e.g. COK, DXB, LHR)" },
          ]}
          onSave={(v) =>
            actions.addAirline({
              ...v,
              code: v.code.toUpperCase(),
              ports: v.ports
                .split(",")
                .map((p) => p.trim().toUpperCase())
                .filter(Boolean),
            })
          }
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}
