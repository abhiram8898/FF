"use client";

import { useState } from "react";
import { type JobInput, nextJobRef, useLookups, useStore } from "@/lib/store";
import { JOB_STATUSES, type JobStatus } from "@/lib/types";
import { fmtPort } from "@/lib/utils";
import { Button, Card, Field, Input, Select, Textarea } from "./ui";
import { DocumentsInput } from "./inputs";

const TEMP = "__temporary";

/** Pick from a master list, or type a temporary name that isn't saved to the master */
function MasterOrTemporary({
  label,
  options,
  id,
  name,
  onChange,
  tempLabel,
}: {
  label: string;
  options: { id: string; name: string }[];
  id?: string;
  name: string;
  onChange: (v: { id?: string; name: string }) => void;
  tempLabel: string;
}) {
  const [temp, setTemp] = useState(!id && !!name);
  return (
    <Field label={label}>
      <Select
        value={temp ? TEMP : (id ?? "")}
        onChange={(e) => {
          const v = e.target.value;
          if (v === TEMP) {
            setTemp(true);
            onChange({ id: undefined, name: "" });
          } else {
            setTemp(false);
            onChange({ id: v || undefined, name: options.find((o) => o.id === v)?.name ?? "" });
          }
        }}
      >
        <option value="">Select</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
        <option value={TEMP}>+ {tempLabel}</option>
      </Select>
      {temp && <Input className="mt-1.5" value={name} onChange={(e) => onChange({ id: undefined, name: e.target.value })} placeholder="Name (not saved to the master)" aria-label={`${label} name`} autoFocus />}
    </Field>
  );
}

export const JOB_STATUS_TONE: Record<JobStatus, string> = {
  BOOKED: "bg-sky-50 text-sky-800 ring-sky-200",
  "ON HOLD": "bg-amber-50 text-amber-800 ring-amber-200",
  DEPARTED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 ring-red-200",
};

/** Booking/Job fields (FRD changes 8.e i–xxxi). Used for "+ Add Booking" and for editing. */
export function BookingJobForm({
  initial,
  jobRef,
  onSubmit,
  submitLabel,
  requireChanges,
}: {
  initial: JobInput;
  /** The saved job's number; left out for a new booking, which shows the next number */
  jobRef?: string;
  onSubmit: (data: JobInput) => void;
  submitLabel: string;
  /** Keep the button disabled until something changes (editing) */
  requireChanges?: boolean;
}) {
  const { state } = useStore();
  const { customer, quotation } = useLookups();
  const [f, setF] = useState<JobInput>(initial);
  const set = <K extends keyof JobInput>(k: K, v: JobInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const text = (k: keyof JobInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never);
  const num = (k: "weight" | "boxes") => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value));
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  const shippers = state.customers.filter((c) => c.type === "Shipper/Receiver");
  const chas = state.agents.filter((a) => a.type === "CHA");
  const port = (code: string) => fmtPort(state.ports.find((p) => p.code === code)) || code;
  const section = "mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase";
  const grid = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(f);
      }}
      className="space-y-3"
    >
      <Card>
        <h3 className={section}>Booking</h3>
        <div className={grid}>
          <Field label="Date">
            <Input type="date" value={f.date} onChange={text("date")} required />
          </Field>
          <Field label="Quotation Number">
            <Input value={quotation(f.quotationId)?.ref ?? ""} readOnly disabled />
          </Field>
          <Field label="Booking/Job No" hint={jobRef ? undefined : "Next number in the sequence (Settings → Ref Number)"}>
            <Input value={jobRef ?? nextJobRef(state, f)} readOnly disabled className="font-mono" />
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set("status", e.target.value as JobStatus)}>
              {JOB_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Customer">
            <Input value={customer(f.customerId)?.name ?? ""} readOnly disabled />
          </Field>
          <MasterOrTemporary
            label="Shipper"
            options={shippers}
            id={f.shipperId}
            name={f.shipperName}
            tempLabel="Temporary shipper"
            onChange={(v) => setF((x) => ({ ...x, shipperId: v.id, shipperName: v.name }))}
          />
          <Field label="POL">
            <Input value={port(f.pol)} readOnly disabled />
          </Field>
          <Field label="POD">
            <Input value={port(f.pod)} readOnly disabled />
          </Field>
        </div>
      </Card>

      <Card>
        <h3 className={section}>Flight & cargo</h3>
        <div className={grid}>
          <Field label="AWB No">
            <Input value={f.awbNo} onChange={text("awbNo")} placeholder="e.g. 098-30493323" />
          </Field>
          <Field label="Flight No">
            <Input value={f.flightNo} onChange={text("flightNo")} placeholder="e.g. AI 933" />
          </Field>
          <Field label="F.Date">
            <Input type="date" value={f.flightDate} onChange={text("flightDate")} />
          </Field>
          <Field label="Airline">
            <Select
              value={f.airlineId}
              onChange={(e) => {
                const a = state.airlines.find((x) => x.id === e.target.value);
                setF((x) => ({ ...x, airlineId: e.target.value, iataCode: a?.code ?? x.iataCode }));
              }}
            >
              <option value="">Select</option>
              {state.airlines.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="IATA Code">
            <Input value={f.iataCode} onChange={(e) => set("iataCode", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Stock">
            <Input value={f.stock} onChange={text("stock")} placeholder="e.g. ASL" />
          </Field>
          <Field label="Weight (kg)" hint="From the quotation">
            <Input type="number" min="0" step="0.01" value={f.weight} onChange={num("weight")} />
          </Field>
          <Field label="Box" hint="From the quotation">
            <Input type="number" min="0" value={f.boxes} onChange={num("boxes")} />
          </Field>
          <Field label="Commodity" hint="From the quotation" className="col-span-2">
            <Input value={f.commodity} onChange={(e) => set("commodity", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Offload" className="col-span-2">
            <Input value={f.offload} onChange={text("offload")} />
          </Field>
        </div>
      </Card>

      <Card>
        <h3 className={section}>Charges & billing</h3>
        <div className={grid}>
          <Field label="Rate" hint='Numbers, e.g. 280 or "280+10+6"'>
            <Input value={f.rate} onChange={(e) => set("rate", e.target.value.replace(/[^0-9.+,\s]/g, ""))} inputMode="decimal" />
          </Field>
          <Field label="INV No" hint="Pick a customer invoice or type one">
            <Input value={f.invoiceNo} onChange={text("invoiceNo")} list="customer-invoices" />
            <datalist id="customer-invoices">
              {state.invoices
                .filter((i) => !f.customerId || i.customerId === f.customerId)
                .map((i) => (
                  <option key={i.id} value={i.no} />
                ))}
            </datalist>
          </Field>
          <Field label="TSP" hint="Numbers">
            <Input value={f.tsp} onChange={(e) => set("tsp", e.target.value.replace(/[^0-9.+,\s]/g, ""))} inputMode="decimal" />
          </Field>
          <Field label="Loading">
            <Input value={f.loading} onChange={text("loading")} />
          </Field>
          <Field label="Months">
            <Input type="month" value={f.month.slice(0, 7)} onChange={text("month")} />
          </Field>
          <Field label="Years">
            <Input value={f.years} onChange={text("years")} inputMode="numeric" maxLength={4} />
          </Field>
          <Field label="Duty">
            <Input value={f.duty} onChange={text("duty")} />
          </Field>
          <MasterOrTemporary
            label="CHA"
            options={chas}
            id={f.chaId}
            name={f.chaName}
            tempLabel="Temporary CHA"
            onChange={(v) => setF((x) => ({ ...x, chaId: v.id, chaName: v.name }))}
          />
          <Field label="TSP (Additional)">
            <Input value={f.tspAdditional} onChange={text("tspAdditional")} />
          </Field>
          <Field label="Loading (Additional)">
            <Input value={f.loadingAdditional} onChange={text("loadingAdditional")} />
          </Field>
          <Field label="Additional Value 1">
            <Input value={f.additional1} onChange={text("additional1")} />
          </Field>
          <Field label="Additional Value 2">
            <Input value={f.additional2} onChange={text("additional2")} />
          </Field>
          <Field label="Booking Info" className="col-span-2 sm:col-span-3 lg:col-span-4">
            <Textarea rows={2} value={f.bookingInfo} onChange={text("bookingInfo")} />
          </Field>
        </div>
      </Card>

      <Card title="Documents">
        <DocumentsInput value={f.documents} onChange={(documents) => set("documents", documents)} />
      </Card>

      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-xs text-amber-700">You have unsaved changes</span>}
        <Button type="submit" disabled={requireChanges && !dirty}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
