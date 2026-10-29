"use client";

import { useState } from "react";
import { MapPin, Pencil, Plane, PlaneLanding, Route } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Port } from "@/lib/types";
import { matches } from "@/lib/utils";
import { Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, LinkButton, NoResults, PageHeader, ResetFilters, RowMenu, SearchField, Table } from "@/components/ui";

const EDIT_HREF = "/settings?tab=Port%20%26%20Country";

export default function LocationsPage() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("all");

  const countries = [...new Set(state.ports.map((p) => p.country))].sort();
  const usage = (code: string) => state.enquiries.filter((e) => e.pol === code || e.pod === code).length;
  const [kpi, setKpi] = useState<string | null>(null);
  const servedBy = (code: string) => state.airlines.some((a) => a.ports.includes(code));
  const KPIS: KpiDef<Port>[] = [
    { id: "all", icon: MapPin, label: "Airports" },
    { id: "used", icon: Route, tone: "violet", label: "Used in Enquiries", test: (p) => usage(p.code) > 0 },
    { id: "served", icon: Plane, tone: "sky", label: "Served by Carriers", test: (p) => servedBy(p.code) },
    { id: "unserved", icon: PlaneLanding, tone: "amber", label: "Not Served by Carriers", test: (p) => !servedBy(p.code) },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || country !== "all" || kpi !== null;
  const rows = state.ports.filter(kpiOk).filter((p) => (country === "all" || p.country === country) && matches(q, [p.code, p.name, p.country]));
  const reset = () => {
    setQ("");
    setCountry("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader
        title="Locations"
        subtitle="Airports used as ports of loading and discharge"
        actions={
          <LinkButton href={EDIT_HREF}>
            <Pencil size={14} aria-hidden /> Edit in Settings
          </LinkButton>
        }
      />

      <KpiFilters rows={state.ports} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search airports" value={q} onChange={setQ} />
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
                <th>Code</th>
                <th>Airport / City</th>
                <th>Country</th>
                <th>Carriers</th>
                <th className="text-right">Enquiries</th>
                <th className="w-14 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.code} className="hover:bg-slate-50">
                  <td className="font-mono font-medium">{p.code}</td>
                  <td>{p.name}</td>
                  <td className="text-slate-600">{p.country}</td>
                  <td className="text-slate-600 tabular-nums">{state.airlines.filter((a) => a.ports.includes(p.code)).length || "—"}</td>
                  <td className="text-right text-slate-600 tabular-nums">{usage(p.code)}</td>
                  <td className="text-center">
                    <RowMenu
                      label={`Actions for ${p.code}`}
                      items={[
                        { label: "View enquiries", href: `/enquiries?q=${p.code}` },
                        { label: "Edit in Settings", href: EDIT_HREF },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No airports yet. Add them in Settings → Port &amp; Country.
          </NoResults>
        )}
      </Card>
    </>
  );
}
