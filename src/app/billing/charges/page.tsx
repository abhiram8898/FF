"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { AgencyCharge, ChargeUnit } from "@/lib/types";
import { Button, Card, Field, Input, PageHeader, Select, Table, Textarea } from "@/components/ui";

/** Agency service charges: added to every quotation and offered on proformas (moved here from Settings) */
export default function AgencyChargesPage() {
  const { state, actions } = useStore();
  const [charges, setCharges] = useState<AgencyCharge[]>(state.settings.agencyCharges);
  const [gst, setGst] = useState(state.settings.gstPercent);
  const [terms, setTerms] = useState(state.settings.quotationTerms);
  const set = (i: number, patch: Partial<AgencyCharge>) => setCharges(charges.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const clean = charges.filter((c) => c.particulars.trim());
  const dirty = JSON.stringify(charges) !== JSON.stringify(state.settings.agencyCharges) || gst !== state.settings.gstPercent || terms !== state.settings.quotationTerms;
  const dupes = clean.map((c) => c.particulars.trim().toUpperCase()).filter((p, i, a) => a.indexOf(p) !== i);

  return (
    <>
      <PageHeader title="Agency Service Charges" subtitle="Default agency / clearance charges on every quotation, and the particulars offered on proforma invoices." />
      <Card
        title="Service charges"
        actions={
          <Button size="sm" variant="secondary" onClick={() => setCharges([...charges, { particulars: "", sac: "996712", unit: "Per shipment", rate: 0, remarks: "" }])}>
            <Plus size={13} aria-hidden /> Add charge
          </Button>
        }
        bodyClassName="p-0"
      >
        <datalist id="charge-sac">
          {state.settings.sacCodes.map((c) => (
            <option key={c.id} value={c.code}>
              {c.short}
            </option>
          ))}
        </datalist>
        <Table>
          <thead>
            <tr>
              <th>Particulars</th>
              <th>SAC</th>
              <th>Unit</th>
              <th>Default rate (INR)</th>
              <th>Remarks</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {charges.map((c, i) => (
              <tr key={i}>
                <td className="min-w-64">
                  <Input aria-label="Charge name" value={c.particulars} onChange={(e) => set(i, { particulars: e.target.value.toUpperCase() })} />
                </td>
                <td>
                  <Input aria-label="SAC code" list="charge-sac" className="w-28" value={c.sac} onChange={(e) => set(i, { sac: e.target.value })} />
                </td>
                <td>
                  <Select aria-label="Unit" className="w-36" value={c.unit} onChange={(e) => set(i, { unit: e.target.value as ChargeUnit })}>
                    <option>Per shipment</option>
                    <option>Per kg</option>
                  </Select>
                </td>
                <td>
                  <Input aria-label="Default rate" type="number" step="0.01" className="w-28" value={c.rate} onChange={(e) => set(i, { rate: Number(e.target.value) })} />
                </td>
                <td>
                  <Input aria-label="Remarks" placeholder="e.g. AT ACTUALS" className="w-44" value={c.remarks} onChange={(e) => set(i, { remarks: e.target.value.toUpperCase() })} />
                </td>
                <td className="w-10">
                  <button onClick={() => setCharges(charges.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${c.particulars || "charge"}`}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="grid gap-3 border-t border-slate-100 p-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <Field label="Default GST %" hint="Picked automatically on quotations">
            <Input type="number" min="0" value={gst} onChange={(e) => setGst(Number(e.target.value))} />
          </Field>
          <Field label="Default notes / terms & conditions on quotations">
            <Textarea rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 p-3">
          {dupes.length > 0 ? <span className="text-xs text-red-600">Each charge name can be listed once ({dupes[0]}).</span> : dirty && <span className="text-xs text-amber-700">You have unsaved changes</span>}
          <Button disabled={!dirty || dupes.length > 0} onClick={() => actions.updateSettings({ agencyCharges: clean, gstPercent: gst, quotationTerms: terms }, "Agency service charges")}>
            Save changes
          </Button>
        </div>
      </Card>
    </>
  );
}
