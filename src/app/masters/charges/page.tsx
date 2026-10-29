"use client";

import { useState } from "react";
import { Coins, MessageSquareText, Package, Pencil, Scale } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ChargeUnit } from "@/lib/types";
import { matches, money } from "@/lib/utils";
import { Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, LinkButton, NoResults, PageHeader, ResetFilters, SearchField, Table } from "@/components/ui";

export default function ChargesPage() {
  const { state } = useStore();
  const { agencyCharges, gstPercent, currencies } = state.settings;
  const [q, setQ] = useState("");
  const [unit, setUnit] = useState<"all" | ChargeUnit>("all");

  const [kpi, setKpi] = useState<string | null>(null);
  type Charge = (typeof agencyCharges)[number];
  const KPIS: KpiDef<Charge>[] = [
    { id: "all", icon: Coins, label: "Agency Charges" },
    { id: "shipment", icon: Package, tone: "sky", label: "Per Shipment", test: (c) => c.unit === "Per shipment" },
    { id: "kg", icon: Scale, tone: "violet", label: "Per kg", test: (c) => c.unit === "Per kg" },
    { id: "remarks", icon: MessageSquareText, tone: "amber", label: "With Remarks", test: (c) => !!c.remarks },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || unit !== "all" || kpi !== null;
  const rows = agencyCharges.filter(kpiOk).filter((c) => (unit === "all" || c.unit === unit) && matches(q, [c.particulars]));
  const reset = () => {
    setQ("");
    setUnit("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader
        title="Charges"
        subtitle={`Agency charges added to every quotation, plus GST at ${gstPercent}%. Airline charges come from the rate used.`}
        actions={
          <LinkButton href="/settings?tab=Service%20Charges">
            <Pencil size={14} aria-hidden /> Edit in Settings
          </LinkButton>
        }
      />

      <KpiFilters rows={agencyCharges} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search charges" value={q} onChange={setQ} />
        <FilterSelect label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)}>
          <option value="all">All Units</option>
          <option value="Per shipment">Per shipment</option>
          <option value="Per kg">Per kg</option>
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Agency charges" bodyClassName="p-0" className="lg:col-span-2">
          {rows.length ? (
            <Table>
              <thead>
                <tr>
                  <th>Particulars</th>
                  <th>Unit</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">With GST</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.particulars} className="hover:bg-slate-50">
                    <td className="font-medium">{c.particulars}</td>
                    <td className="text-slate-600">{c.unit}</td>
                    <td className="text-right tabular-nums">{money(c.rate)}</td>
                    <td className="text-right text-slate-600 tabular-nums">{money(c.rate * (1 + gstPercent / 100))}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <NoResults filtered={filtered} onClear={reset}>
              No agency charges yet. Add them in Settings → Service Charges.
            </NoResults>
          )}
        </Card>
        <Card title="Currencies · rate of exchange to INR" bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <th>Currency</th>
                <th className="text-right">ROE</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((c) => (
                <tr key={c.code}>
                  <td className="font-mono font-medium">{c.code}</td>
                  <td className="text-right tabular-nums">{c.roe}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
