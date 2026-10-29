"use client";

import { useState } from "react";
import { CircleCheck, CircleX, FileStack } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Enquiry } from "@/lib/types";
import {
  CONVERTED_STATUSES,
  DATE_RANGES,
  type DateRange,
  STAGES,
  inRange,
} from "@/lib/utils";
import {
  Card,
  FilterBar,
  FilterSelect,
  type KpiDef,
  KpiFilters,
  kpiTest,
  PageHeader,
  ResetFilters,
  Table,
} from "@/components/ui";

const isConverted = (e: Enquiry) => CONVERTED_STATUSES.includes(e.status);
const pct = (n: number, of: number) =>
  of ? `${Math.round((n / of) * 100)}%` : "—";

/** Groups enquiries by a key, busiest first */
function breakdown(enquiries: Enquiry[], key: (e: Enquiry) => string) {
  const groups = new Map<string, Enquiry[]>();
  for (const e of enquiries)
    groups.set(key(e), [...(groups.get(key(e)) ?? []), e]);
  return [...groups.entries()]
    .map(([label, list]) => ({
      label,
      total: list.length,
      converted: list.filter(isConverted).length,
    }))
    .sort((a, b) => b.total - a.total);
}

function BreakdownTable({
  head,
  rows,
}: {
  head: string;
  rows: ReturnType<typeof breakdown>;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <th>{head}</th>
          <th className="text-right">Enquiries</th>
          <th className="text-right">Converted</th>
          <th className="text-right">Conversion</th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((r) => (
            <tr key={r.label}>
              <td className="font-medium">{r.label}</td>
              <td className="text-right tabular-nums">{r.total}</td>
              <td className="text-right tabular-nums">{r.converted}</td>
              <td className="text-right text-slate-600 tabular-nums">
                {pct(r.converted, r.total)}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={4} className="text-center text-slate-500">
              No enquiries in this period.
            </td>
          </tr>
        )}
      </tbody>
    </Table>
  );
}

export default function ReportsPage() {
  const { state } = useStore();
  const { customer } = useLookups();
  const [mode, setMode] = useState<"all" | "Air" | "Sea">("all");
  const [range, setRange] = useState<DateRange>("all");

  // Every figure on the page follows the filters
  const enquiries = state.enquiries.filter(
    (e) =>
      (mode === "all" || e.cargoMode === mode) && inRange(e.enquiryDate, range),
  );

  const converted = enquiries.filter(isConverted).length;

  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<Enquiry>[] = [
    { id: "all", icon: FileStack, label: "Total Enquiries" },
    {
      id: "converted",
      icon: CircleCheck,
      tone: "green",
      label: "Converted to Booking",
      hint: `${pct(converted, enquiries.length)} conversion`,
      test: isConverted,
    },
    { id: "lost", icon: CircleX, tone: "red", label: "Lost / Cancelled", test: (e) => e.status === "Lost" || e.status === "Cancelled" },
  ];
  // The tables below show the enquiries of the selected card
  const shown = enquiries.filter(kpiTest(KPIS, kpi));
  const filtered = mode !== "all" || range !== "all" || kpi !== null;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Enquiry pipeline and conversion across customers and routes"
      />

      <KpiFilters rows={enquiries} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <FilterSelect
          label="Mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          className="flex-none sm:w-44"
        >
          <option value="all">All Mode</option>
          <option value="Air">Air</option>
          <option value="Sea">Sea</option>
        </FilterSelect>
        <FilterSelect
          label="Enquiry date"
          value={range}
          onChange={(e) => setRange(e.target.value as DateRange)}
          className="flex-none sm:w-44"
        >
          {DATE_RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </FilterSelect>
        <ResetFilters
          onClick={() => {
            setMode("all");
            setRange("all");
            setKpi(null);
          }}
          disabled={!filtered}
        />
      </FilterBar>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Pipeline by stage" bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <th>Stage</th>
                <th className="text-right">Enquiries</th>
                <th className="text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {STAGES.map((s) => {
                const n = shown.filter((e) =>
                  (s.statuses as readonly string[]).includes(e.status),
                ).length;
                return (
                  <tr key={s.key}>
                    <td className="font-medium">{s.label}</td>
                    <td className="text-right tabular-nums">{n}</td>
                    <td className="text-right text-slate-600 tabular-nums">
                      {pct(n, shown.length)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
        <Card title="By customer" bodyClassName="p-0">
          <BreakdownTable
            head="Customer"
            rows={breakdown(
              shown,
              (e) => customer(e.customerId)?.name ?? "Unknown",
            )}
          />
        </Card>
        <Card title="By route" bodyClassName="p-0" className="lg:col-span-2">
          <BreakdownTable
            head="Route (POL → POD)"
            rows={breakdown(shown, (e) => `${e.pol} → ${e.pod}`)}
          />
        </Card>
      </div>
    </>
  );
}
