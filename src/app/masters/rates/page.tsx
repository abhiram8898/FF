"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import { cn, fmtDate, isRateValid, money } from "@/lib/utils";
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Select, Table } from "@/components/ui";
import { RateForm } from "@/components/workflow";

export default function RatesPage() {
  const { state, actions } = useStore();
  const { airline } = useLookups();
  const [pol, setPol] = useState("");
  const [pod, setPod] = useState("");
  const [adding, setAdding] = useState(false);

  const rows = state.rates
    .filter((r) => r.source === "Master" && (!pol || r.pol === pol) && (!pod || r.pod === pod))
    .sort((a, b) => a.pol.localeCompare(b.pol) || a.pod.localeCompare(b.pod) || a.ratePerKg - b.ratePerKg);
  const routes = [...new Set(rows.map((r) => `${r.pol}-${r.pod}`))];

  const portSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All</option>
      {state.ports.map((p) => (
        <option key={p.code} value={p.code}>
          {p.code} – {p.name}
        </option>
      ))}
    </Select>
  );

  return (
    <>
      <PageHeader
        title="Airline Rates"
        subtitle="Rate sheets saved in the masters. Used by Save & Get Rates to compare service providers."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} /> Add rate
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Field label="POL" className="w-56">
          {portSelect(pol, setPol)}
        </Field>
        <Field label="POD" className="w-56">
          {portSelect(pod, setPod)}
        </Field>
      </div>

      <div className="space-y-6">
        {routes.length ? (
          routes.map((route) => {
            const [rPol, rPod] = route.split("-");
            const list = rows.filter((r) => r.pol === rPol && r.pod === rPod);
            const cheapest = Math.min(...list.filter(isRateValid).map((r) => r.ratePerKg));
            return (
              <Card key={route} title={`${rPol} → ${rPod}`} bodyClassName="p-0">
                <Table>
                  <thead>
                    <tr>
                      <th>Airline</th>
                      <th>Currency</th>
                      <th className="text-right">Rate / kg</th>
                      <th className="text-right">AWB Fee</th>
                      <th className="text-right">Minimum Charge</th>
                      <th>Transit</th>
                      <th>Valid Until</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => {
                      const valid = isRateValid(r);
                      return (
                        <tr key={r.id} className={cn(!valid && "text-slate-400", valid && r.ratePerKg === cheapest && "bg-emerald-50/60")}>
                          <td className="font-medium">
                            {airline(r.airlineId)?.name}
                            {valid && r.ratePerKg === cheapest && <Badge className="ml-1 bg-emerald-100 text-emerald-700 ring-emerald-200">Lowest/kg</Badge>}
                          </td>
                          <td>{r.currency}</td>
                          <td className="text-right tabular-nums">{money(r.ratePerKg, r.currency)}</td>
                          <td className="text-right tabular-nums">{money(r.awbFee, r.currency)}</td>
                          <td className="text-right tabular-nums">{money(r.minCharge, r.currency)}</td>
                          <td>{r.transitDays}d</td>
                          <td className="whitespace-nowrap">
                            {fmtDate(r.validUntil)} {!valid && <Badge className="ml-1 bg-red-50 text-red-600 ring-red-200">Expired</Badge>}
                          </td>
                          <td className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => window.confirm("Delete this rate?") && actions.deleteRate(r.id)}>
                              Delete
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Card>
            );
          })
        ) : (
          <Empty>No rates for this route.</Empty>
        )}
      </div>

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
