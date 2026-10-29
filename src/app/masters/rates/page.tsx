"use client";

import { useState } from "react";
import { CircleCheck, CircleX, Plus, Scale, TrendingDown } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { AirlineRate } from "@/lib/types";
import { cn, fmtDate, isRateValid, matches, money } from "@/lib/utils";
import { Badge, Button, Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, Modal, NoResults, PageHeader, ResetFilters, RowMenu, SearchField, Table } from "@/components/ui";
import { RateForm, RouteCell } from "@/components/workflow";

export default function RatesPage() {
  const { state, actions } = useStore();
  const { airline } = useLookups();
  const [q, setQ] = useState("");
  const [pol, setPol] = useState("");
  const [pod, setPod] = useState("");
  const [validity, setValidity] = useState<"all" | "valid" | "expired">("all");
  const [adding, setAdding] = useState(false);

  const master = state.rates.filter((r) => r.source === "Master");
  // Rates can be in different currencies; rank them in INR
  const inInr = (r: AirlineRate) => r.ratePerKg * (state.settings.currencies.find((c) => c.code === r.currency)?.roe ?? 1);
  // Lowest valid rate per kg on each route, to flag the cheapest option
  const cheapest = new Map<string, number>();
  for (const r of master.filter(isRateValid)) {
    const key = `${r.pol}-${r.pod}`;
    cheapest.set(key, Math.min(cheapest.get(key) ?? Infinity, inInr(r)));
  }
  const isCheapest = (r: AirlineRate) => isRateValid(r) && cheapest.get(`${r.pol}-${r.pod}`) === inInr(r);

  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<AirlineRate>[] = [
    { id: "all", icon: Scale, label: "Master Rates" },
    { id: "lowest", icon: TrendingDown, tone: "indigo", label: "Lowest/kg per Route", test: isCheapest },
    { id: "valid", icon: CircleCheck, tone: "green", label: "Valid", test: isRateValid },
    { id: "expired", icon: CircleX, tone: "red", label: "Expired", test: (r) => !isRateValid(r) },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || !!pol || !!pod || validity !== "all" || kpi !== null;
  const rows = master
    .filter(kpiOk).filter(
      (r) =>
        (!pol || r.pol === pol) &&
        (!pod || r.pod === pod) &&
        (validity === "all" || (validity === "valid") === isRateValid(r)) &&
        matches(q, [airline(r.airlineId)?.name, r.pol, r.pod, r.currency]),
    )
    .sort((a, b) => a.pol.localeCompare(b.pol) || a.pod.localeCompare(b.pod) || a.ratePerKg - b.ratePerKg);
  const reset = () => {
    setQ("");
    setPol("");
    setPod("");
    setValidity("all");
    setKpi(null);
  };

  const portOptions = state.ports.map((p) => (
    <option key={p.code} value={p.code}>
      {p.code} – {p.name}
    </option>
  ));

  return (
    <>
      <PageHeader
        title="Rate Management"
        subtitle="Airline rate sheets saved in the masters. Used by Compare Available Rates on an enquiry."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden /> Add Rate
          </Button>
        }
      />

      <KpiFilters rows={master} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search rates" value={q} onChange={setQ} placeholder="Search airline, port…" />
        <FilterSelect label="POL" value={pol} onChange={(e) => setPol(e.target.value)} className="flex-[1_1_11rem]">
          <option value="">All POL</option>
          {portOptions}
        </FilterSelect>
        <FilterSelect label="POD" value={pod} onChange={(e) => setPod(e.target.value)} className="flex-[1_1_11rem]">
          <option value="">All POD</option>
          {portOptions}
        </FilterSelect>
        <FilterSelect label="Validity" value={validity} onChange={(e) => setValidity(e.target.value as typeof validity)}>
          <option value="all">All Validity</option>
          <option value="valid">Valid</option>
          <option value="expired">Expired</option>
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Route</th>
                <th>Airline</th>
                <th className="text-right">Rate / kg</th>
                <th className="text-right">AWB Fee</th>
                <th className="text-right">Minimum Charge</th>
                <th>Transit</th>
                <th>Valid Until</th>
                <th className="w-14 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const valid = isRateValid(r);
                return (
                  <tr key={r.id} className={cn("hover:bg-slate-50", !valid && "text-slate-400")}>
                    <td>
                      <RouteCell pol={r.pol} pod={r.pod} />
                    </td>
                    <td className="font-medium whitespace-nowrap">
                      {airline(r.airlineId)?.name}
                      {isCheapest(r) && <Badge className="ml-1.5 bg-emerald-50 text-emerald-700 ring-emerald-200">Lowest/kg</Badge>}
                    </td>
                    <td className="text-right whitespace-nowrap tabular-nums">{money(r.ratePerKg, r.currency)}</td>
                    <td className="text-right whitespace-nowrap tabular-nums">{money(r.awbFee, r.currency)}</td>
                    <td className="text-right whitespace-nowrap tabular-nums">{money(r.minCharge, r.currency)}</td>
                    <td className="whitespace-nowrap">{r.transitDays}d</td>
                    <td className="whitespace-nowrap">
                      {fmtDate(r.validUntil)} {!valid && <Badge className="ml-1 bg-red-50 text-red-600 ring-red-200">Expired</Badge>}
                    </td>
                    <td className="text-center">
                      <RowMenu
                        label={`Actions for ${airline(r.airlineId)?.name} ${r.pol} to ${r.pod}`}
                        items={[{ label: "Delete rate", onSelect: () => window.confirm("Delete this rate?") && actions.deleteRate(r.id) }]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No rates yet. Add one with Add Rate.
          </NoResults>
        )}
      </Card>

      {adding && (
        <Modal open onClose={() => setAdding(false)} title="Add airline rate" wide>
          <RateForm
            initial={{ pol, pod }}
            onSubmit={(r) => {
              actions.addRate(r);
              setAdding(false);
            }}
          />
        </Modal>
      )}
    </>
  );
}
