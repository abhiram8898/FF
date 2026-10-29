"use client";

import { useState } from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import { type InvoiceInput, nextInvoiceNo, useLookups, useStore } from "@/lib/store";
import type { CustomerInvoice, InvoiceItem } from "@/lib/types";
import { amountInWords, fmtPort, round2, uid } from "@/lib/utils";
import { Button, Card, Field, Input, Modal, Select, Textarea } from "./ui";

const f2 = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDot = (iso: string) => (iso ? iso.split("-").reverse().join(".") : "");

export const itemAmount = (i: InvoiceItem) => round2(i.quantity * i.rate);

export function invoiceTotals(inv: Pick<CustomerInvoice, "items">) {
  return {
    packages: inv.items.reduce((s, i) => s + i.packages, 0),
    quantity: round2(inv.items.reduce((s, i) => s + i.quantity, 0)),
    amount: round2(inv.items.reduce((s, i) => s + itemAmount(i), 0)),
  };
}

const CURRENCY_NAME: Record<string, [string, string]> = {
  USD: ["Dollars", "cents"],
  EUR: ["Euros", "cents"],
  AED: ["Dirhams", "fils"],
  INR: ["Rupees", "paise"],
};

/** "USD Nine Hundred and Sixty-One Dollars and Ninety-Three Cents Only" */
export function amountChargeable(amount: number, currency: string) {
  const [unit, sub] = CURRENCY_NAME[currency] ?? [currency, "cents"];
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  return `${currency} ${amountInWords(whole)} ${unit}${cents ? ` and ${amountInWords(cents)} ${sub[0].toUpperCase()}${sub.slice(1)}` : ""} Only`;
}

export function emptyInvoice(customerId = ""): InvoiceInput {
  return {
    date: new Date().toISOString().slice(0, 10),
    customerId,
    exporter: "",
    exporterRef: "",
    iecNo: "",
    buyerOrder: "",
    consignee: "",
    buyer: "",
    preCarriage: "BY ROAD",
    placeOfReceipt: "",
    flightNo: "BY AIR",
    portOfLoading: "",
    portOfDischarge: "",
    finalDestination: "",
    countryOfOrigin: "INDIA",
    countryOfDestination: "",
    terms: "C & F",
    currency: "USD",
    marks: "",
    packageRange: "",
    items: [{ id: uid(), description: "", packages: 0, quantity: 0, rate: 0 }],
    grossWeight: 0,
    declaration: "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
  };
}

/** Invoice cum packing list, laid out like the customer's sample (008 INDOGA INVOICE) */
export function InvoiceDocument({ inv }: { inv: CustomerInvoice }) {
  const t = invoiceTotals(inv);
  const cell = "border border-slate-800 px-2 py-1 align-top";
  const label = "font-bold";
  return (
    <div className="overflow-x-auto bg-white text-[11px] text-slate-900">
      <table className="w-full min-w-[44rem] border-collapse font-serif">
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[22%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
          <col className="w-[10%]" />
          <col className="w-[16%]" />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={6} className={`${cell} text-center text-base font-bold`}>
              INVOICE CUM PACKING LIST
            </td>
          </tr>
          <tr>
            <td colSpan={2} rowSpan={2} className={cell}>
              <div className={label}>Exporter :</div>
              <div className="font-bold whitespace-pre-line uppercase">{inv.exporter}</div>
            </td>
            <td colSpan={3} className={cell}>
              <div className={label}>Invoice No:</div>
              <div className="font-bold">{inv.no}</div>
              <div className="font-bold">Date :{fmtDot(inv.date)}</div>
            </td>
            <td className={`${cell} text-center`}>
              <div>Exporter Ref :</div>
              <div className="font-bold">{inv.exporterRef}</div>
              <div className="font-bold">IEC NO : {inv.iecNo}</div>
            </td>
          </tr>
          <tr>
            <td colSpan={4} className={cell}>
              <div className={label}>Buyers order No &amp; date:</div>
              <div>{inv.buyerOrder}</div>
            </td>
          </tr>
          <tr>
            <td colSpan={2} className={`${cell} h-24`}>
              <div className={label}>Consignee :</div>
              <div className="font-bold whitespace-pre-line uppercase">{inv.consignee}</div>
            </td>
            <td colSpan={4} className={cell}>
              <div className={label}>Buyer other than consignee :</div>
              <div className="font-bold whitespace-pre-line uppercase">{inv.buyer}</div>
            </td>
          </tr>
          <tr>
            <td className={cell}>
              <div className={label}>Pre -Carriage by :</div>
              <div className="text-center font-bold uppercase">{inv.preCarriage}</div>
            </td>
            <td className={`${cell} text-center`}>
              <div className="text-[10px] font-bold">Place of receipt by Pre-Carrier</div>
              <div className="font-bold uppercase">{inv.placeOfReceipt}</div>
            </td>
            <td colSpan={4} className={cell}>
              <span className={label}>Country of origin of goods :</span> <b className="uppercase">{inv.countryOfOrigin}</b>
            </td>
          </tr>
          <tr>
            <td className={cell}>
              <div className={label}>Vessel / Flight no :</div>
              <div className="text-center font-bold uppercase">{inv.flightNo}</div>
            </td>
            <td className={`${cell} text-center`}>
              <div className="font-bold">Port of loading :</div>
              <div className="font-bold uppercase">{inv.portOfLoading}</div>
            </td>
            <td colSpan={4} className={cell}>
              <span className={label}>Country of final destination:</span> <b className="uppercase">{inv.countryOfDestination}</b>
            </td>
          </tr>
          <tr>
            <td className={cell}>
              <div className={label}>Port of Discharge :</div>
              <div className="pt-3 text-center font-bold uppercase">{inv.portOfDischarge}</div>
            </td>
            <td className={cell}>
              <div className={label}>Final destination :</div>
              <div className="pt-3 text-center font-bold uppercase">{inv.finalDestination}</div>
            </td>
            <td colSpan={4} className={cell}>
              <div className={label}>Terms of delivery of payment</div>
              <div className="pt-3 text-center font-bold uppercase">{inv.terms}</div>
            </td>
          </tr>
          <tr className="text-center font-bold">
            <td colSpan={2} className={cell}>
              Description of Goods
            </td>
            <td className={cell}>
              No.&amp; Kind
              <br />
              of Packages
            </td>
            <td className={cell}>
              Quantity
              <br />
              in NT Kgs
            </td>
            <td className={cell}>
              Rate
              <br />
              Per Kg
            </td>
            <td className={cell}>
              Amount
              <br />
              in {inv.currency}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border-x border-slate-800 px-2 pt-3 pb-2 font-bold uppercase">
              <span className="inline-block w-20">{inv.marks}</span> {inv.packageRange}
            </td>
            <td className="border-x border-slate-800" />
            <td className="border-x border-slate-800" />
            <td className="border-x border-slate-800" />
            <td className="border-x border-slate-800" />
          </tr>
          {inv.items.map((i) => (
            <tr key={i.id} className="font-bold">
              <td className="border-l border-slate-800" />
              <td className="border-r border-slate-800 px-2 py-0.5 uppercase">{i.description}</td>
              <td className="border-x border-slate-800 px-2 py-0.5 text-center tabular-nums">{i.packages || ""}</td>
              <td className="border-x border-slate-800 px-2 py-0.5 text-right tabular-nums">{f2(i.quantity)}</td>
              <td className="border-x border-slate-800 px-2 py-0.5 text-right tabular-nums">{f2(i.rate)}</td>
              <td className="border-x border-slate-800 px-2 py-0.5 text-right tabular-nums">{f2(itemAmount(i))}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className="h-10 border-x border-slate-800" />
            <td className="border-x border-slate-800" />
            <td className="border-x border-slate-800" />
            <td className="border-x border-slate-800" />
            <td className="border-x border-slate-800" />
          </tr>
          <tr className="font-bold">
            <td colSpan={2} className={cell} />
            <td className={`${cell} text-center tabular-nums`}>{t.packages}</td>
            <td className={`${cell} text-right tabular-nums`}>{f2(t.quantity)}</td>
            <td className={cell} />
            <td className={`${cell} text-right tabular-nums`}>{f2(t.amount)}</td>
          </tr>
          <tr className="font-bold">
            <td colSpan={2} className={cell}>
              GR:WT: <span className="ml-3 tabular-nums">{inv.grossWeight || ""}</span>
            </td>
            <td colSpan={3} className={`${cell} text-right`}>
              Total {inv.terms} {inv.currency} :
            </td>
            <td className={`${cell} text-right tabular-nums`}>{f2(t.amount)}</td>
          </tr>
          <tr>
            <td colSpan={6} className={`${cell} h-14`}>
              Amount Chargeable : {amountChargeable(t.amount, inv.currency)}
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="border-l border-slate-800 px-2 pt-6 pb-1 font-bold align-bottom">
              Declaration :<div className="max-w-sm font-bold">{inv.declaration}</div>
            </td>
            <td colSpan={2} className="border border-slate-800 px-2 pt-10 pb-1 align-bottom font-bold">
              Signature &amp; Date <span className="ml-3">{fmtDot(inv.date)}</span>
            </td>
          </tr>
          <tr>
            <td colSpan={6} className="border-b border-slate-800" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function InvoicePreview({ inv, onClose }: { inv: CustomerInvoice; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`Invoice · ${inv.no}`}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>Print / Save PDF</Button>
        </>
      }
    >
      <InvoiceDocument inv={inv} />
    </Modal>
  );
}

/** Create / edit a customer invoice. Picking a booking fills the routing from its enquiry. */
export function InvoiceForm({ initial, existing, onSubmit }: { initial: InvoiceInput; existing?: CustomerInvoice; onSubmit: (data: InvoiceInput) => void }) {
  const { state } = useStore();
  const { customer, enquiry, port } = useLookups();
  const [f, setF] = useState<InvoiceInput>(initial);
  const [preview, setPreview] = useState(false);
  const set = <K extends keyof InvoiceInput>(k: K, v: InvoiceInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const text = (k: keyof InvoiceInput, upper = false) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    set(k, (upper ? e.target.value.toUpperCase() : e.target.value) as never);
  const setItem = (id: string, patch: Partial<InvoiceItem>) => set("items", f.items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const t = invoiceTotals(f);
  const no = existing?.no ?? nextInvoiceNo(state);
  const valid = f.customerId && f.exporter.trim() && f.consignee.trim() && f.items.some((i) => i.description.trim() && i.quantity > 0);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const city = (code: string) => port(code)?.name.toUpperCase() ?? code;

  const pickCustomer = (id: string) => {
    const c = customer(id);
    setF((x) => ({ ...x, customerId: id, exporter: c ? [c.name, c.address].filter(Boolean).join("\n").toUpperCase() : x.exporter }));
  };
  const pickJob = (jobId: string) => {
    const j = state.jobs.find((x) => x.id === jobId);
    const e = enquiry(j?.enquiryId);
    if (!j || !e) return setF((x) => ({ ...x, jobId: undefined, enquiryId: undefined }));
    const c = customer(e.customerId);
    setF((x) => ({
      ...x,
      jobId,
      enquiryId: e.id,
      customerId: e.customerId,
      exporter: x.exporter || (c ? [c.name, c.address].filter(Boolean).join("\n").toUpperCase() : ""),
      placeOfReceipt: city(e.pol),
      portOfLoading: city(e.pol),
      portOfDischarge: city(e.pod),
      finalDestination: city(e.pod),
      countryOfDestination: (port(e.pod)?.country ?? "").toUpperCase(),
      flightNo: j.flightNo || x.flightNo,
      grossWeight: x.grossWeight || e.grossWeight,
      terms: x.terms || e.incoterm,
    }));
  };

  const draftInvoice: CustomerInvoice = { ...f, id: existing?.id ?? "preview", no, createdAt: existing?.createdAt ?? "" };
  const section = "mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase";

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(f);
      }}
    >
      <Card>
        <h3 className={section}>Invoice</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field label="Invoice No">
            <Input value={no} readOnly disabled className="font-mono" />
          </Field>
          <Field label="Date">
            <Input type="date" value={f.date} onChange={text("date")} required />
          </Field>
          <Field label="Booking/Job" hint="Optional: fills ports and flight">
            <Select value={f.jobId ?? ""} onChange={(e) => pickJob(e.target.value)}>
              <option value="">Not linked</option>
              {state.jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.ref} · {customer(j.customerId)?.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Currency">
            <Select value={f.currency} onChange={(e) => set("currency", e.target.value)}>
              {[...new Set(["USD", ...state.settings.currencies.map((c) => c.code)])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <h3 className={section}>Parties</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Customer (exporter) *">
              <Select value={f.customerId} onChange={(e) => pickCustomer(e.target.value)} required>
                <option value="">Select customer</option>
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Exporter name & address *">
              <Textarea rows={4} value={f.exporter} onChange={text("exporter", true)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 content-start gap-3">
            <Field label="Exporter Ref">
              <Input value={f.exporterRef} onChange={text("exporterRef")} />
            </Field>
            <Field label="IEC No">
              <Input value={f.iecNo} onChange={text("iecNo", true)} />
            </Field>
            <Field label="Buyer's order No & date" className="col-span-2">
              <Input value={f.buyerOrder} onChange={text("buyerOrder")} />
            </Field>
          </div>
          <Field label="Consignee *">
            <Textarea rows={3} value={f.consignee} onChange={text("consignee", true)} placeholder="Name and address" />
          </Field>
          <Field label="Buyer other than consignee">
            <Textarea rows={3} value={f.buyer} onChange={text("buyer", true)} />
          </Field>
        </div>
      </Card>

      <Card>
        <h3 className={section}>Shipment</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Field label="Pre-Carriage by">
            <Input value={f.preCarriage} onChange={text("preCarriage", true)} />
          </Field>
          <Field label="Place of receipt by Pre-Carrier">
            <Input value={f.placeOfReceipt} onChange={text("placeOfReceipt", true)} />
          </Field>
          <Field label="Vessel / Flight no">
            <Input value={f.flightNo} onChange={text("flightNo", true)} />
          </Field>
          <Field label="Port of loading">
            <Input value={f.portOfLoading} onChange={text("portOfLoading", true)} list="invoice-ports" />
          </Field>
          <Field label="Port of discharge">
            <Input value={f.portOfDischarge} onChange={text("portOfDischarge", true)} list="invoice-ports" />
          </Field>
          <Field label="Final destination">
            <Input value={f.finalDestination} onChange={text("finalDestination", true)} list="invoice-ports" />
          </Field>
          <datalist id="invoice-ports">
            {state.ports.map((p) => (
              <option key={p.code} value={p.name.toUpperCase()}>
                {fmtPort(p)}
              </option>
            ))}
          </datalist>
          <Field label="Country of origin of goods">
            <Input value={f.countryOfOrigin} onChange={text("countryOfOrigin", true)} />
          </Field>
          <Field label="Country of final destination">
            <Input value={f.countryOfDestination} onChange={text("countryOfDestination", true)} />
          </Field>
          <Field label="Terms of delivery & payment">
            <Input value={f.terms} onChange={text("terms", true)} placeholder="e.g. C & F, FOB" />
          </Field>
        </div>
      </Card>

      <Card
        title="Goods"
        actions={
          <Button size="sm" variant="secondary" onClick={() => set("items", [...f.items, { id: uid(), description: "", packages: 0, quantity: 0, rate: 0 }])}>
            <Plus size={13} aria-hidden /> Add item
          </Button>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field label="Marks & Nos" hint="e.g. F/ADD">
            <Input value={f.marks} onChange={text("marks", true)} />
          </Field>
          <Field label="Package range" hint="e.g. 01 TO 238 BOXES" className="lg:col-span-2">
            <Input value={f.packageRange} onChange={text("packageRange", true)} />
          </Field>
          <Field label="Gross weight (kg)">
            <Input type="number" min="0" step="0.01" value={f.grossWeight || ""} onChange={(e) => set("grossWeight", Number(e.target.value))} />
          </Field>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                <th>Description of goods</th>
                <th className="w-28">Packages</th>
                <th className="w-32">Qty (net kg)</th>
                <th className="w-28">Rate / kg</th>
                <th className="w-32 text-right">Amount ({f.currency})</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {f.items.map((i) => (
                <tr key={i.id} className="border-t border-slate-100 [&>td]:px-2 [&>td]:py-1.5">
                  <td>
                    <Input aria-label="Description" value={i.description} onChange={(e) => setItem(i.id, { description: e.target.value.toUpperCase() })} />
                  </td>
                  <td>
                    <Input aria-label="Packages" type="number" min="0" value={i.packages || ""} onChange={(e) => setItem(i.id, { packages: Number(e.target.value) })} />
                  </td>
                  <td>
                    <Input aria-label="Quantity in net kg" type="number" min="0" step="0.01" value={i.quantity || ""} onChange={(e) => setItem(i.id, { quantity: Number(e.target.value) })} />
                  </td>
                  <td>
                    <Input aria-label="Rate per kg" type="number" min="0" step="0.01" value={i.rate || ""} onChange={(e) => setItem(i.id, { rate: Number(e.target.value) })} />
                  </td>
                  <td className="text-right font-medium tabular-nums">{f2(itemAmount(i))}</td>
                  <td>
                    {f.items.length > 1 && (
                      <button type="button" onClick={() => set("items", f.items.filter((x) => x.id !== i.id))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove item">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold [&>td]:px-2 [&>td]:py-2">
                <td>Total</td>
                <td className="tabular-nums">{t.packages}</td>
                <td className="tabular-nums">{f2(t.quantity)}</td>
                <td />
                <td className="text-right tabular-nums">{f2(t.amount)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Amount chargeable: {amountChargeable(t.amount, f.currency)}</p>
        <Field label="Declaration" className="mt-3">
          <Textarea rows={2} value={f.declaration} onChange={text("declaration")} />
        </Field>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!valid && <span className="mr-auto text-xs text-amber-700">To save, choose the customer, fill in the exporter and consignee, and add at least one item with a quantity.</span>}
        <Button variant="secondary" onClick={() => setPreview(true)}>
          <Eye size={15} aria-hidden /> Preview
        </Button>
        <Button type="submit" disabled={!valid || (!!existing && !dirty)}>
          {existing ? "Save changes" : "Create Invoice"}
        </Button>
      </div>
      {preview && <InvoicePreview inv={draftInvoice} onClose={() => setPreview(false)} />}
    </form>
  );
}
