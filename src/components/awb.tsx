"use client";

/* eslint-disable @next/next/no-img-element -- logos are user-uploaded data URLs */
import { useState } from "react";
import { Eye, Plus, Printer, Send, Trash2 } from "lucide-react";
import { type AwbInput, useLookups, useStore } from "@/lib/store";
import { AWB_STATUSES, CHGS_CODES, FREIGHT_TERMS, RATE_CLASSES, type Awb, type AwbLeg, type AwbOtherCharge, type AwbStatus, type Job, type State } from "@/lib/types";
import { AWB_TONE, cn, f2, fmtDate, fmtPort, parseRate, round2, today, uid, volumeCbm } from "@/lib/utils";
import { ComposeEmail } from "./ComposeEmail";
import { Badge, Button, DISCARD_CHANGES, Field, Input, Modal, SectionTitle, Select, Textarea } from "./ui";

const awbNumber = (a: Pick<Awb, "type" | "hawbNo" | "mawbNo">) => (a.type === "House" ? a.hawbNo || a.mawbNo : a.mawbNo);
export const awbLabel = (a: Pick<Awb, "type" | "hawbNo" | "mawbNo">) => `${a.type === "House" ? "HAWB" : "MAWB"} ${awbNumber(a) || "—"}`;
/** Weight charge: rate × chargeable weight, or the flat minimum charge for rate class M */
export const awbTotal = (a: Pick<Awb, "rate" | "chargeableWeight"> & Partial<Pick<Awb, "rateClass">>) => round2(a.rateClass === "M" ? a.rate : a.rate * a.chargeableWeight);

export const RATE_CLASS_NAMES: Record<Awb["rateClass"], string> = { M: "Minimum", N: "Normal (under 45 kg)", Q: "Quantity (weight break)", C: "Specific commodity", U: "ULD" };

/** Common "Other Charges" codes; the last letter says who it is due to (A agent, C carrier) */
export const OTHER_CHARGE_CODES: [string, string][] = [
  ["AWC", "AWB fee"],
  ["AWA", "AWB fee (agent)"],
  ["FSC", "Fuel surcharge"],
  ["SCC", "Security"],
  ["MYC", "Fuel / insurance surcharge"],
  ["CGC", "Cargo handling"],
  ["DBC", "Disbursement fee"],
  ["RAC", "Dangerous goods check"],
];
export const chargeDueTo = (c: Pick<AwbOtherCharge, "code">) => (c.code.trim().toUpperCase().endsWith("A") ? "Agent" : "Carrier");

/**
 * AWB totals (boxes 33–40, 45). CHGS code: first letter = weight / valuation charges, second = other
 * charges (P prepaid, C collect). Collect charges convert into the destination currency at the given rate.
 */
export function awbTotals(a: Pick<Awb, "rate" | "chargeableWeight" | "rateClass" | "chgsCode" | "valuationCharge" | "tax" | "otherCharges" | "conversionRate" | "chargesAtDestination">) {
  const weight = awbTotal(a);
  const dueAgent = round2(a.otherCharges.filter((c) => chargeDueTo(c) === "Agent").reduce((s, c) => s + c.amount, 0));
  const dueCarrier = round2(a.otherCharges.filter((c) => chargeDueTo(c) === "Carrier").reduce((s, c) => s + c.amount, 0));
  const wtPrepaid = a.chgsCode[0] === "P";
  const otherPrepaid = a.chgsCode[1] === "P";
  const wtVal = round2(weight + (a.valuationCharge || 0) + (a.tax || 0));
  const other = round2(dueAgent + dueCarrier);
  const prepaid = round2((wtPrepaid ? wtVal : 0) + (otherPrepaid ? other : 0));
  const collect = round2((wtPrepaid ? 0 : wtVal) + (otherPrepaid ? 0 : other));
  const ccDest = a.conversionRate > 0 ? round2(collect * a.conversionRate) : 0;
  return { weight, dueAgent, dueCarrier, wtPrepaid, otherPrepaid, prepaid, collect, ccDest, totalCollect: round2(ccDest + (a.chargesAtDestination || 0)) };
}

/** "Execute AWB" pre-filled from the job, its enquiry or reservation, and the masters */
export function awbDraft(s: State, job: Job): AwbInput {
  const enq = s.enquiries.find((e) => e.id === job.enquiryId);
  const res = s.reservations.find((r) => r.id === job.reservationId);
  const cargo = enq ?? res;
  const shipper = s.customers.find((c) => c.id === (job.shipperId ?? job.customerId));
  const airline = s.airlines.find((a) => a.id === job.airlineId);
  const pol = s.ports.find((p) => p.code === job.pol);
  const branch = s.settings.branches.find((b) => b.name === job.branch);
  const q = s.quotations.find((x) => x.id === job.quotationId);
  const freight = q?.lines.find((l) => l.group === "Airline" && l.unit === "Per kg");
  const legs: AwbLeg[] = [
    ...(cargo?.connections ?? []).map((c) => ({ id: uid(), to: c.transit, carrier: s.airlines.find((a) => a.id === c.airlineId)?.name ?? "", flightNo: c.flightNo, flightDate: c.date })),
    { id: uid(), to: job.pod, carrier: airline?.name ?? "", flightNo: job.flightNo, flightDate: job.flightDate },
  ];
  const block = (name?: string, address?: string) => [name, address].filter(Boolean).join("\n").toUpperCase();
  return {
    jobId: job.id,
    type: "House",
    hawbNo: job.bookingRef,
    hawbDate: today(),
    mawbNo: job.awbNo || (airline?.prefix ? `${airline.prefix}-` : ""),
    mawbDate: today(),
    shipperId: shipper?.id,
    shipper: shipper ? block(shipper.name, shipper.address) : job.shipperName.toUpperCase(),
    shipperAccount: "",
    consignee: "",
    consigneeAccount: "",
    notifyParty: "SAME AS CONSIGNEE",
    localAgent: s.settings.company.name,
    agentIataCode: branch?.iataCode || s.settings.company.iataCode,
    agentAccountNo: "",
    optionalShippingInfo: "",
    sci: "",
    freightTerms: "Prepaid",
    freightTermDetails: "FREIGHT PREPAID",
    airportCode: job.pol,
    place: (pol?.name ?? "").toUpperCase(),
    legs,
    portOfDestination: job.pod,
    finalCarrier: airline?.name ?? "",
    agentSign: "",
    carrierSign: `As agent for ${airline?.name ?? "the carrier"}`,
    issuedAt: today(),
    currency: q?.currency ?? "INR",
    rateClass: job.weight < 45 ? "N" : "Q",
    weightUnit: "K",
    commodityItemNo: "",
    chgsCode: "PP",
    declaredCarriage: "N.V.D.",
    declaredCustoms: "N.C.V.",
    insurance: 0,
    commodity: job.commodity,
    pieces: job.boxes,
    packageType: cargo?.packageType ?? "",
    volume: cargo ? volumeCbm(cargo) : 0,
    grossWeight: cargo?.grossWeight ?? job.weight,
    netWeight: 0,
    chargeableWeight: job.weight,
    rate: freight ? freight.rate + freight.markup : parseRate(job.rate),
    invoiceDetails: job.invoiceNo,
    valuationCharge: 0,
    tax: 0,
    // AWB fee and other airline charges from the quotation
    otherCharges: (q?.lines ?? [])
      .filter((l) => l.group === "Airline" && l.unit === "Per shipment" && /AIRWAY BILL|OTHER/.test(l.particulars))
      .map((l) => ({ id: uid(), code: /AIRWAY BILL/.test(l.particulars) ? "AWC" : "MYC", description: l.particulars, amount: round2((l.rate + l.markup) * l.qty) })),
    conversionRate: 0,
    destCurrency: "",
    chargesAtDestination: 0,
    natureOfGoods: [job.commodity, cargo && `${cargo.packages} ${cargo.packageType}${cargo.length ? ` · DIMS ${cargo.length}x${cargo.width}x${cargo.height} CM` : ""}`].filter(Boolean).join("\n").toUpperCase(),
    handlingInfo:
      cargo?.productType === "Dangerous Cargo"
        ? "DANGEROUS GOODS AS PER ASSOCIATED SHIPPER'S DECLARATION. CARGO AIRCRAFT ONLY."
        : "PLEASE INFORM CONSIGNEE IMMEDIATELY ON ARRIVAL OF CARGO.",
  };
}

/** Execute AWB pop-up (FRD VII): Section I general, II airline, III cargo & freight. Save keeps it as Draft. */
export function AwbFormModal({ job, existing, onClose, onSaved }: { job: Job; existing?: Awb; onClose: () => void; onSaved?: (a: Awb) => void }) {
  const { state, actions } = useStore();
  const [a, setA] = useState<AwbInput>(() => existing ?? awbDraft(state, job));
  const [start] = useState(() => JSON.stringify(a));
  const dirty = JSON.stringify(a) !== start;
  const [preview, setPreview] = useState(false);
  const set = <K extends keyof AwbInput>(k: K, v: AwbInput[K]) => setA((x) => ({ ...x, [k]: v }));
  const str = (k: keyof AwbInput, upper = false) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    set(k, (upper ? e.target.value.toUpperCase() : e.target.value) as never);
  const num = (k: keyof AwbInput) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);
  const setLeg = (id: string, patch: Partial<AwbLeg>) => set("legs", a.legs.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const parties = state.customers.filter((c) => c.status !== "Inactive");
  const agents = state.customers.filter((c) => ["Agents", "Logistics", "Freight Forwarders"].includes(c.type));
  const pickParty = (kind: "shipper" | "consignee", id: string) => {
    const c = parties.find((x) => x.id === id);
    setA((x) => ({ ...x, [`${kind}Id`]: id || undefined, [kind]: c ? [c.name, c.address].filter(Boolean).join("\n").toUpperCase() : x[kind] }));
  };
  const valid = (a.type === "Master" ? a.mawbNo.trim() : a.hawbNo.trim()) && a.shipper.trim() && a.consignee.trim() && a.legs[0]?.flightNo;
  const t = awbTotals(a);
  const setCharge = (id: string, patch: Partial<AwbOtherCharge>) => set("otherCharges", a.otherCharges.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const grid = "grid grid-cols-1 max-xs:*:col-span-full xs:grid-cols-2 gap-3 sm:grid-cols-4";
  const carrierList = (
    <datalist id="awb-carriers">
      {state.airlines.map((x) => (
        <option key={x.id} value={x.name} />
      ))}
    </datalist>
  );
  const portList = (
    <datalist id="awb-ports">
      {state.ports.map((p) => (
        <option key={p.code} value={p.code}>
          {fmtPort(p)}
        </option>
      ))}
    </datalist>
  );

  const save = () => {
    const saved = actions.saveAwb(a, existing?.id);
    onSaved?.(saved);
    return saved;
  };

  if (preview) {
    const draft: Awb = { ...a, id: existing?.id ?? "preview", status: existing?.status ?? "Draft", statusAt: existing?.statusAt ?? "", createdAt: existing?.createdAt ?? "" };
    return <AwbPreviewModal awb={draft} onClose={() => setPreview(false)} onBack={() => setPreview(false)} unsaved={!existing} />;
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={existing ? `Edit AWB · ${awbLabel(existing)}` : `Execute AWB · ${job.ref}`}
      confirmClose={dirty && DISCARD_CHANGES}
      footer={
        <>
          {!valid && <span className="mr-auto self-center text-xs text-amber-700">Fill in the AWB number, shipper, consignee and the first flight.</span>}
          <Button variant="secondary" onClick={() => (!dirty || window.confirm(DISCARD_CHANGES)) && onClose()}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => setPreview(true)}>
            <Eye size={14} aria-hidden /> Preview
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              save();
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      {carrierList}
      {portList}
      <div className="space-y-3">
        <section>
          <SectionTitle>Section I · General details</SectionTitle>
          <div className={grid}>
            <Field label="Job Number">
              <Input value={job.ref} readOnly disabled className="font-mono" />
            </Field>
            <Field label="AWB type" hint={a.type === "Master" ? "Airline's AWB in both headings" : "MAWB on the left, HAWB on the right"}>
              <Select value={a.type} onChange={(e) => set("type", e.target.value as Awb["type"])}>
                <option value="House">House AWB (HAWB)</option>
                <option value="Master">Master AWB (MAWB)</option>
              </Select>
            </Field>
            <Field label="House AWB No" hint="Booking reference from the booking screen">
              <Input value={a.hawbNo} onChange={str("hawbNo", true)} disabled={a.type === "Master"} />
            </Field>
            <Field label="HAWB Date">
              <Input type="date" value={a.hawbDate} onChange={str("hawbDate")} disabled={a.type === "Master"} />
            </Field>
            <Field label="Master AWB No">
              <Input value={a.mawbNo} onChange={str("mawbNo")} placeholder="Enter Master AWB No" />
            </Field>
            <Field label="Master AWB Date">
              <Input type="date" value={a.mawbDate} onChange={str("mawbDate")} />
            </Field>
            <Field label="Freight Terms">
              <Select value={a.freightTerms} onChange={str("freightTerms")}>
                {FREIGHT_TERMS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Freight Term Details">
              <Input value={a.freightTermDetails} onChange={str("freightTermDetails", true)} />
            </Field>
            <div className="col-span-2 space-y-1.5">
              <Field label="Shipper Name & Address *">
                <Select value={a.shipperId ?? ""} onChange={(e) => pickParty("shipper", e.target.value)} aria-label="Search shipper in the masters">
                  <option value="">Type below or pick from the masters</option>
                  {parties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.type}
                    </option>
                  ))}
                </Select>
              </Field>
              <Textarea rows={3} value={a.shipper} onChange={str("shipper", true)} aria-label="Shipper name and address" />
              <Input value={a.shipperAccount} onChange={str("shipperAccount", true)} placeholder="Shipper's account number (optional)" aria-label="Shipper's account number" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Field label="Consignee Name & Address *">
                <Select value={a.consigneeId ?? ""} onChange={(e) => pickParty("consignee", e.target.value)} aria-label="Search consignee in the masters">
                  <option value="">Type below or pick from the masters</option>
                  {parties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.type}
                    </option>
                  ))}
                </Select>
              </Field>
              <Textarea rows={3} value={a.consignee} onChange={str("consignee", true)} aria-label="Consignee name and address" />
              <Input value={a.consigneeAccount} onChange={str("consigneeAccount", true)} placeholder="Consignee's account number (optional)" aria-label="Consignee's account number" />
            </div>
            <Field label="Notify Party" className="col-span-2" hint={<button type="button" className="text-brand-700 hover:underline" onClick={() => set("notifyParty", "SAME AS CONSIGNEE")}>Same as consignee</button>}>
              <Textarea rows={2} value={a.notifyParty} onChange={str("notifyParty", true)} />
            </Field>
            <Field label="Local Agent" className="col-span-2">
              <Input value={a.localAgent} onChange={str("localAgent")} list="awb-agents" />
              <datalist id="awb-agents">
                <option value={state.settings.company.name} />
                {agents.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Agent IATA Code" hint="From Company Set up / branch">
              <Input value={a.agentIataCode} onChange={str("agentIataCode")} />
            </Field>
            <Field label="Account No." hint="Agent's settlement (CASS) account">
              <Input value={a.agentAccountNo} onChange={str("agentAccountNo", true)} />
            </Field>
            <Field label="Optional Shipping Information" className="col-span-2">
              <Input value={a.optionalShippingInfo} onChange={str("optionalShippingInfo", true)} />
            </Field>
            <Field label="SCI" hint="Special Customs Information">
              <Input value={a.sci} onChange={str("sci", true)} />
            </Field>
          </div>
        </section>

        <section className="border-t border-slate-100 pt-3">
          <SectionTitle>Section II · Airline details</SectionTitle>
          <div className={grid}>
            <Field label="Airport Code">
              <Input value={a.airportCode} onChange={str("airportCode", true)} list="awb-ports" />
            </Field>
            <Field label="Place">
              <Input value={a.place} onChange={str("place", true)} />
            </Field>
            <Field label="Port of Destination">
              <Input value={a.portOfDestination} onChange={str("portOfDestination", true)} list="awb-ports" />
            </Field>
            <Field label="Final Carrier">
              <Input value={a.finalCarrier} onChange={str("finalCarrier")} list="awb-carriers" />
            </Field>
          </div>
          <div className="mt-3 space-y-2">
            {a.legs.map((l, i) => (
              <div key={l.id} className="grid grid-cols-2 items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_2rem]">
                <Field label={`${i + 1}${["st", "nd", "rd"][i] ?? "th"} POD (to)`}>
                  <Input value={l.to} onChange={(e) => setLeg(l.id, { to: e.target.value.toUpperCase() })} list="awb-ports" />
                </Field>
                <Field label={`${i + 1}${["st", "nd", "rd"][i] ?? "th"} by carrier`}>
                  <Input value={l.carrier} onChange={(e) => setLeg(l.id, { carrier: e.target.value })} list="awb-carriers" />
                </Field>
                <Field label="Flight No">
                  <Input value={l.flightNo} onChange={(e) => setLeg(l.id, { flightNo: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="Flight Date">
                  <Input type="date" value={l.flightDate} onChange={(e) => setLeg(l.id, { flightDate: e.target.value })} />
                </Field>
                {a.legs.length > 1 && (
                  <button type="button" onClick={() => set("legs", a.legs.filter((x) => x.id !== l.id))} className="mb-1.5 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove leg ${i + 1}`}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => set("legs", [...a.legs, { id: uid(), to: "", carrier: a.finalCarrier, flightNo: "", flightDate: "" }])}>
              <Plus size={13} aria-hidden /> Add
            </Button>
          </div>
          <div className={`${grid} mt-3`}>
            <Field label="Agent Sign" className="col-span-2">
              <Input value={a.agentSign} onChange={str("agentSign")} placeholder="Name of the agent" />
            </Field>
            <Field label="Signature of Carrier or Agent" className="col-span-2">
              <Input value={a.carrierSign} onChange={str("carrierSign")} />
            </Field>
          </div>
        </section>

        <section className="border-t border-slate-100 pt-3">
          <SectionTitle>Section III · Cargo & freight details</SectionTitle>
          <div className={grid}>
            <Field label="Date of Issue">
              <Input type="date" value={a.issuedAt} onChange={str("issuedAt")} />
            </Field>
            <Field label="Currency">
              <Select value={a.currency} onChange={str("currency")}>
                {state.currencies.filter((c) => c.active || c.code === a.currency).map((c) => (
                  <option key={c.code}>{c.code}</option>
                ))}
              </Select>
            </Field>
            <Field label="Rate Class">
              <Select value={a.rateClass} onChange={str("rateClass")}>
                {RATE_CLASSES.map((r) => (
                  <option key={r} value={r}>
                    {r} · {RATE_CLASS_NAMES[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="CHGS Code" hint="WT/VAL, then Other: P prepaid, C collect">
              <Select value={a.chgsCode} onChange={str("chgsCode")}>
                {CHGS_CODES.map((r) => (
                  <option key={r} value={r}>
                    {r} · WT/VAL {r[0] === "P" ? "PPD" : "COLL"}, Other {r[1] === "P" ? "PPD" : "COLL"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Declared value for carriage" hint="N.V.D. = no value declared">
              <Input value={a.declaredCarriage} onChange={str("declaredCarriage", true)} list="awb-declared-carriage" />
              <datalist id="awb-declared-carriage">
                <option value="N.V.D." />
              </datalist>
            </Field>
            <Field label="Declared value for customs" hint="N.C.V. = no commercial value">
              <Input value={a.declaredCustoms} onChange={str("declaredCustoms", true)} list="awb-declared-customs" />
              <datalist id="awb-declared-customs">
                <option value="N.C.V." />
                <option value="AS PER INVOICE" />
              </datalist>
            </Field>
            <Field label="Amount of Insurance" hint="Blank prints NIL">
              <Input type="number" min="0" step="0.01" value={a.insurance || ""} onChange={num("insurance")} />
            </Field>
            <Field label="Package Type">
              <Input value={a.packageType} onChange={str("packageType")} />
            </Field>
            <Field label="Commodity" className="col-span-2">
              <Input value={a.commodity} onChange={str("commodity", true)} />
            </Field>
            <Field label="No. of Packages">
              <Input type="number" min="0" value={a.pieces} onChange={num("pieces")} />
            </Field>
            <Field label="Volume (CBM)">
              <Input type="number" min="0" step="0.0001" value={a.volume} onChange={num("volume")} />
            </Field>
            <Field label="Gross Weight">
              <div className="flex gap-1.5">
                <Input type="number" min="0" step="0.01" value={a.grossWeight} onChange={num("grossWeight")} />
                <Select value={a.weightUnit} onChange={str("weightUnit")} aria-label="Weight unit" className="w-16">
                  <option value="K">kg</option>
                  <option value="L">lb</option>
                </Select>
              </div>
            </Field>
            <Field label="Net Weight (kg)">
              <Input type="number" min="0" step="0.01" value={a.netWeight || ""} onChange={num("netWeight")} />
            </Field>
            <Field label="Chargeable Weight (kg)">
              <Input type="number" min="0" step="0.01" value={a.chargeableWeight} onChange={num("chargeableWeight")} />
            </Field>
            <Field label={a.rateClass === "M" ? "Minimum charge" : "Rate / Charge (per kg)"}>
              <Input type="number" min="0" step="0.01" value={a.rate} onChange={num("rate")} />
            </Field>
            <Field label="Commodity Item No." hint="For rate class C">
              <Input value={a.commodityItemNo} onChange={str("commodityItemNo", true)} />
            </Field>
            <Field label="Total (weight charge)">
              <Input value={`${a.currency} ${t.weight.toFixed(2)}`} readOnly disabled />
            </Field>
            <Field label="Invoice Details" className="col-span-2 sm:col-span-3">
              <Input value={a.invoiceDetails} onChange={str("invoiceDetails")} />
            </Field>
            <Field label="Nature & quantity of goods (incl. dimensions or volume)" className="col-span-2">
              <Textarea rows={3} value={a.natureOfGoods} onChange={str("natureOfGoods", true)} />
            </Field>
            <Field label="Handling Information" className="col-span-2">
              <Textarea rows={3} value={a.handlingInfo} onChange={str("handlingInfo", true)} />
            </Field>
          </div>
        </section>

        <section className="border-t border-slate-100 pt-3">
          <SectionTitle>Section IV · Charges & totals</SectionTitle>
          <div className={grid}>
            <Field label="Valuation Charge">
              <Input type="number" min="0" step="0.01" value={a.valuationCharge || ""} onChange={num("valuationCharge")} />
            </Field>
            <Field label="Tax">
              <Input type="number" min="0" step="0.01" value={a.tax || ""} onChange={num("tax")} />
            </Field>
          </div>
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium text-slate-700">Other Charges (code ending A = due agent, C = due carrier)</div>
            <datalist id="awb-charge-codes">
              {OTHER_CHARGE_CODES.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </datalist>
            {a.otherCharges.map((c) => (
              <div key={c.id} className="flex flex-wrap items-end gap-2">
                <Field label="Code" className="w-24">
                  <Input
                    value={c.code}
                    list="awb-charge-codes"
                    maxLength={3}
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase();
                      setCharge(c.id, { code, ...(!c.description && { description: OTHER_CHARGE_CODES.find(([k]) => k === code)?.[1] ?? "" }) });
                    }}
                  />
                </Field>
                <Field label="Description" className="min-w-40 flex-1">
                  <Input value={c.description} onChange={(e) => setCharge(c.id, { description: e.target.value })} />
                </Field>
                <Field label={`Amount (${a.currency})`} className="w-32">
                  <Input type="number" min="0" step="0.01" value={c.amount || ""} onChange={(e) => setCharge(c.id, { amount: Number(e.target.value) })} />
                </Field>
                <span className="mb-2 w-24 text-xs text-slate-500">Due {chargeDueTo(c).toLowerCase()}</span>
                <button type="button" onClick={() => set("otherCharges", a.otherCharges.filter((x) => x.id !== c.id))} className="mb-1.5 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${c.code || "charge"}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => set("otherCharges", [...a.otherCharges, { id: uid(), code: "", description: "", amount: 0 }])}>
              <Plus size={13} aria-hidden /> Add other charge
            </Button>
          </div>
          <div className={`${grid} mt-3`}>
            <Field label="Destination currency" hint="For CC charges in destination currency">
              <Input value={a.destCurrency} maxLength={3} onChange={str("destCurrency", true)} placeholder="e.g. AED" />
            </Field>
            <Field label="Currency conversion rate">
              <Input type="number" min="0" step="0.0001" value={a.conversionRate || ""} onChange={num("conversionRate")} />
            </Field>
            <Field label="Charges at destination" hint="Usually filled by the carrier">
              <Input type="number" min="0" step="0.01" value={a.chargesAtDestination || ""} onChange={num("chargesAtDestination")} />
            </Field>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3 text-xs tabular-nums sm:grid-cols-4">
            <dt className="text-slate-500">Due agent</dt>
            <dd className="font-medium">{t.dueAgent.toFixed(2)}</dd>
            <dt className="text-slate-500">Due carrier</dt>
            <dd className="font-medium">{t.dueCarrier.toFixed(2)}</dd>
            <dt className="text-slate-500">Total prepaid</dt>
            <dd className="font-medium">{t.prepaid.toFixed(2)}</dd>
            <dt className="text-slate-500">Total collect</dt>
            <dd className="font-medium">{t.collect.toFixed(2)}</dd>
            <dt className="text-slate-500">CC charges in dest. currency</dt>
            <dd className="font-medium">{t.ccDest ? `${a.destCurrency} ${t.ccDest.toFixed(2)}` : "—"}</dd>
            <dt className="text-slate-500">Total collect charges</dt>
            <dd className="font-medium">{t.totalCollect ? t.totalCollect.toFixed(2) : "—"}</dd>
          </dl>
        </section>
      </div>
    </Modal>
  );
}

const AWB_CONDITIONS =
  "It is agreed that the goods described herein are accepted in apparent good order and condition (except as noted) for carriage SUBJECT TO THE CONDITIONS OF CONTRACT ON THE REVERSE HEREOF. ALL GOODS MAY BE CARRIED BY ANY OTHER MEANS INCLUDING ROAD OR ANY OTHER CARRIER UNLESS SPECIFIC CONTRARY INSTRUCTIONS ARE GIVEN HEREON BY THE SHIPPER, AND SHIPPER AGREES THAT THE SHIPMENT MAY BE CARRIED VIA INTERMEDIATE STOPPING PLACES WHICH THE CARRIER DEEMS APPROPRIATE. THE SHIPPER'S ATTENTION IS DRAWN TO THE NOTICE CONCERNING CARRIER'S LIMITATION OF LIABILITY. Shipper may increase such limitation of liability by declaring a higher value for carriage and paying a supplemental charge if required.";

const AWB_LIABILITY_NOTICE =
  "If the carriage involves an ultimate destination or stop in a country other than the country of departure, the Montreal Convention or the Warsaw Convention may be applicable to the liability of the Carrier in respect of loss of, damage or delay to cargo. Carrier's limitation of liability in accordance with those Conventions shall be as set forth in subparagraph 4 unless a higher value is declared.";

/** Conditions of contract as given in the AWB template (clauses 1–3, 6.2–10.1.3) */
const AWB_CONTRACT_CLAUSES = [
  "1. In this contract and the Notices appearing hereon: CARRIER includes the air carrier issuing this air waybill and all carriers that carry or undertake to carry the cargo or perform any other services related to such carriage. SPECIAL DRAWING RIGHT (SDR) is a Special Drawing Right as defined by the International Monetary Fund. WARSAW CONVENTION means whichever of the following instruments is applicable to the contract of carriage: the Convention for the Unification of Certain Rules Relating to International Carriage by Air, signed at Warsaw, 12 October 1929; that Convention as amended at The Hague on 28 September 1955; that Convention as amended at The Hague 1955 and by Montreal Protocol No. 1, 2, or 4 (1975) as the case may be. MONTREAL CONVENTION means the Convention for the Unification of Certain Rules for International Carriage by Air, done at Montreal on 28 May 1999.",
  "2. 2.1 Carriage is subject to the rules relating to liability established by the Warsaw Convention or the Montreal Convention unless such carriage is not \"international carriage\" as defined by the applicable Conventions.",
  "2.2 To the extent not in conflict with the foregoing, carriage and other related services performed by each Carrier are subject to: 2.2.1 applicable laws and government regulations; 2.2.2 provisions contained in the air waybill, Carrier's conditions of carriage and related rules, regulations, and timetables (but not the times of departure and arrival stated therein) and applicable tariffs of such Carrier, which are made part hereof, and which may be inspected at any airports or other cargo sales offices from which it operates regular services. When carriage is to/from the USA, the shipper and the consignee are entitled, upon request, to receive a free copy of the Carrier's conditions of carriage. The Carrier's conditions of carriage include, but are not limited to: 2.2.2.1 limits on the Carrier's liability for loss, damage or delay of goods, including fragile or perishable goods; 2.2.2.2 claims restrictions, including time periods within which shippers or consignees must file a claim or bring an action against the Carrier for its acts or omissions, or those of its agents; 2.2.2.3 rights, if any, of the Carrier to change the terms of the contract; 2.2.2.4 rules about Carrier's right to refuse to carry; 2.2.2.5 rights of the Carrier and limitations concerning delay or failure to perform service, including schedule changes, substitution of alternate Carrier or aircraft and rerouting.",
  "3. The agreed stopping places (which may be altered by Carrier in case of necessity) are those places, except the place of departure and place of destination, set forth on the face hereof or shown in Carrier's timetables as scheduled stopping places for the route. Carriage to be performed hereunder by several successive Carriers is regarded as a single operation.",
  "6.2 In carriage to which neither the Warsaw Convention nor the Montreal Convention applies Carrier shall, in accordance with the procedures set forth in its general conditions of carriage and applicable tariffs, permit shipper to increase the limitation of liability by declaring a higher value for carriage and paying a supplemental charge if so required.",
  "7. 7.1 In cases of loss of, damage or delay to part of the cargo, the weight to be taken into account in determining Carrier's limit of liability shall be only the weight of the package or packages concerned.",
  "7.2 Notwithstanding any other provisions, for \"foreign air transportation\" as defined by the U.S. Transportation Code: 7.2.1 in the case of loss of, damage or delay to a shipment, the weight to be used in determining Carrier's limit of liability shall be the weight which is used to determine the charge for carriage of such shipment; and 7.2.2 in the case of loss of, damage or delay to a part of a shipment, the shipment weight in 7.2.1 shall be prorated to the packages covered by the same air waybill whose value is affected by the loss, damage or delay. The weight applicable in the case of loss or damage to one or more articles in a package shall be the weight of the entire package.",
  "8. Any exclusion or limitation of liability applicable to Carrier shall apply to Carrier's agents, employees, and representatives and to any person whose aircraft or equipment is used by Carrier for carriage and such person's agents, employees and representatives.",
  "9. Carrier undertakes to complete the carriage with reasonable dispatch. Where permitted by applicable laws, tariffs and government regulations, Carrier may use alternative carriers, aircraft or modes of transport without notice but with due regard to the interests of the shipper. Carrier is authorized by the shipper to select the routing and all intermediate stopping places that it deems appropriate or to change or deviate from the routing shown on the face hereof.",
  "10. Receipt by the person entitled to delivery of the cargo without complaint shall be prima facie evidence that the cargo has been delivered in good condition and in accordance with the contract of carriage.",
  "10.1 In the case of loss of, damage or delay to cargo a written complaint must be made to Carrier by the person entitled to delivery. Such complaint must be made: 10.1.1 in the case of damage to the cargo, immediately after discovery of the damage and at the latest within 14 days from the date of receipt of the cargo; 10.1.2 in the case of delay, within 21 days from the date on which the cargo was placed at the disposal of the person entitled to delivery; 10.1.3 in the case of non-delivery of the cargo, within 120 days from the date of issue of the air waybill, or if an air waybill has not been issued, within 120 days from the date of receipt of the cargo for transportation by the Carrier.",
];

/** A box on the AWB form: tiny caption on top, value underneath */
function AwbCell({ label, children, className, valueClass }: { label?: React.ReactNode; children?: React.ReactNode; className?: string; valueClass?: string }) {
  return (
    <div className={cn("min-w-0 border-r border-b border-black px-1 py-0.5", className)}>
      {label && <div className="text-[0.4375rem] leading-tight text-slate-700">{label}</div>}
      {children !== undefined && <div className={cn("text-[0.625rem] leading-snug font-semibold break-words", valueClass)}>{children}</div>}
    </div>
  );
}

/** Small account-number box in the top-right corner of the shipper / consignee box */
function AccountBox({ label, value, shaded }: { label: string; value?: string; shaded?: boolean }) {
  return (
    <span className={cn("float-right -mt-3 -mr-1 ml-2 block h-6 w-[7.5rem] border-b border-l border-black px-1 text-[0.4375rem] font-normal normal-case", shaded && "bg-slate-100")}>
      {label}
      {value && <span className="block text-[0.5625rem] font-semibold">{value}</span>}
    </span>
  );
}

/** One charge band of the bottom-left block: centred caption, then Prepaid | Collect values */
function ChargeBand({ label, prepaid, collect, first }: { label: string; prepaid?: string; collect?: string; first?: boolean }) {
  return (
    <div className="col-span-2 border-r border-b border-black">
      <div className="flex text-[0.4375rem] leading-tight">
        <span className={cn("flex-1 px-1", first && "font-bold")}>{first ? "Prepaid" : ""}</span>
        <span className="border-x border-black px-2">{label}</span>
        <span className={cn("flex-1 px-1 text-right", first && "font-bold")}>{first ? "Collect" : ""}</span>
      </div>
      <div className="grid h-4 grid-cols-2 border-t border-dashed border-slate-400 text-[0.625rem] font-semibold tabular-nums">
        <span className="border-r border-black px-1 text-right">{prepaid}</span>
        <span className="px-1 text-right">{collect}</span>
      </div>
    </div>
  );
}

/**
 * Printable air waybill laid out like the IATA air waybill form. Master AWB: the airline's number in
 * both headings. House AWB: the MAWB on the left and the HAWB on the right (FRD VII.14–16).
 */
export function AwbDocument({ awb }: { awb: Awb }) {
  const { state } = useStore();
  const { job, airline, customer, portLabel } = useLookups();
  const j = job(awb.jobId);
  const al = state.airlines.find((x) => x.name === awb.finalCarrier) ?? airline(j?.airlineId);
  const carrierCode = (name: string) => state.airlines.find((x) => x.name === name)?.code || name;
  const c = state.settings.company;
  const shipperLogo = customer(awb.shipperId)?.documents.find((d) => d.title.toLowerCase().includes("logo") && d.mime.startsWith("image/"))?.dataUrl;
  const [prefix, serial] = awb.mawbNo.includes("-") ? awb.mawbNo.split("-") : [al?.prefix ?? "", awb.mawbNo];
  const t = awbTotals(awb);
  const { weight: weightCharge, wtPrepaid, otherPrepaid } = t;
  const house = awb.type === "House";
  const sameAsConsignee = !awb.notifyParty.trim() || /^SAME AS CONSIGNEE$/i.test(awb.notifyParty.trim());
  // Prepaid / collect split for a charge band: weight & valuation follow WT/VAL, other charges follow Other
  const split = (amount: number, prepaid: boolean): [string, string] => (amount ? (prepaid ? [f2(amount), ""] : ["", f2(amount)]) : ["", ""]);
  const issuerLogo = house ? c.logo : al?.logo;
  const [leg1, leg2, leg3] = awb.legs;
  const fd = (iso?: string) => (iso ? fmtDate(iso).toUpperCase() : "");
  const flight = (l?: AwbLeg) => (l ? [l.flightNo, fd(l.flightDate)].filter(Boolean).join(" / ") : "");
  const numberBox = (
    <div className="flex border border-black font-mono text-[0.6875rem] font-bold">
      <span className="border-r border-black px-1.5">{prefix}</span>
      <span className="border-r border-black px-1.5">{awb.airportCode}</span>
      <span className="px-1.5">{serial}</span>
    </div>
  );

  return (
    <div className="doc-sheet overflow-x-auto">
      <div className="mx-auto w-[48rem] bg-white font-sans text-black">
        {/* Header numbers */}
        <div className="mb-0.5 flex items-end justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.5625rem] font-bold">MAWB No.:</span>
            {numberBox}
          </div>
          <span className="text-[0.5625rem] font-semibold text-slate-500">{awb.status !== "AWB Executed" ? `${awb.status.toUpperCase()} · NOT FOR CARRIAGE` : ""}</span>
          <div className="flex items-center gap-1.5 border border-black px-1.5 font-mono text-[0.6875rem] font-bold">
            {awb.type === "House" ? `HAWB No.: ${awb.hawbNo}` : `MAWB No.: ${awb.mawbNo}`}
          </div>
        </div>

        <div className="border-t border-l border-black">
          {/* Parties | issuer and conditions */}
          <div className="grid grid-cols-2" style={{ gridTemplateRows: "5.5rem 1rem 7rem 2rem 1.6rem 1.6rem" }}>
            <AwbCell label="Shipper's Name and Address" className="relative row-span-2" valueClass="whitespace-pre-line uppercase pr-1">
              <AccountBox label="Shipper's Account Number" value={awb.shipperAccount} />
              {awb.shipper}
            </AwbCell>
            <AwbCell className="flex flex-col">
              <div className="text-[0.4375rem]">Not negotiable</div>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-sm leading-tight font-bold">Air Waybill</div>
                  <div className="text-[0.4375rem] font-bold">(Air Consignment note)</div>
                  <div className="mt-1 text-[0.4375rem] italic">issued by</div>
                  <div className="text-[0.625rem] font-bold uppercase">{house ? c.name : (al?.name ?? awb.finalCarrier)}</div>
                  <div className="text-[0.5rem] leading-tight">{house ? `${c.address}, ${c.city} – ${c.postalCode}` : `Through ${c.name}`}</div>
                </div>
                {issuerLogo && <img src={issuerLogo} alt="" className="max-h-10 max-w-16 object-contain" />}
                {shipperLogo && <img src={shipperLogo} alt="" className="max-h-10 max-w-16 object-contain" />}
              </div>
            </AwbCell>
            <AwbCell label="Copies 1, 2 and 3 of this Air Waybill are originals and have the same validity" />

            <AwbCell label="Consignee's Name and Address" className="relative" valueClass="whitespace-pre-line uppercase pr-1">
              <AccountBox label="Consignee's Account Number" value={awb.consigneeAccount} shaded />
              {awb.consignee}
            </AwbCell>
            <AwbCell>
              <p className="text-justify text-[0.40625rem] leading-[1.25] font-normal">{AWB_CONDITIONS}</p>
            </AwbCell>

            {/* A House AWB names the notify party here (as on the template); a Master AWB names the issuing carrier's agent */}
            {house ? (
              <AwbCell label="Notify Party" valueClass="whitespace-pre-line uppercase">
                {awb.notifyParty || "SAME AS CONSIGNEE"}
              </AwbCell>
            ) : (
              <AwbCell label="Issuing Carrier's Agent Name and City">{[awb.localAgent, awb.place].filter(Boolean).join(", ")}</AwbCell>
            )}
            <AwbCell label="Accounting Information" className="row-span-2" valueClass="whitespace-pre-line">
              {[awb.freightTermDetails, awb.invoiceDetails && `INV: ${awb.invoiceDetails}`].filter(Boolean).join("\n")}
            </AwbCell>
            <div className="grid grid-cols-2">
              <AwbCell label="Agent's IATA Code">{awb.agentIataCode}</AwbCell>
              <AwbCell label="Account No.">{awb.agentAccountNo}</AwbCell>
            </div>

            <AwbCell label="Airport of Departure (Addr. of First Carrier) and Requested Routing">
              {portLabel(awb.airportCode) || awb.place}
            </AwbCell>
            <div className="grid grid-cols-[1fr_1.4fr]">
              <AwbCell label="Reference Number">{j?.ref}</AwbCell>
              <AwbCell label="Optional Shipping Information">{awb.optionalShippingInfo || (house ? `MAWB ${awb.mawbNo}` : "")}</AwbCell>
            </div>
          </div>

          {/* Routing | currency and declared values */}
          <div className="grid grid-cols-2">
            <div className="grid grid-cols-[2.3rem_1fr_2.3rem_2.3rem_2.3rem_2.3rem]">
              <AwbCell label="To">{leg1?.to}</AwbCell>
              <AwbCell label={<>By First Carrier <span className="text-[0.375rem]">Routing and Destination</span></>}>{leg1?.carrier}</AwbCell>
              <AwbCell label="To">{leg2?.to}</AwbCell>
              <AwbCell label="By">{leg2 && carrierCode(leg2.carrier)}</AwbCell>
              <AwbCell label="To">{leg3?.to}</AwbCell>
              <AwbCell label="By">{leg3 && carrierCode(leg3.carrier)}</AwbCell>
            </div>
            <div className="grid grid-cols-[2.6rem_2.1rem_2.6rem_2.6rem_1fr_4.2rem]">
              <AwbCell label="Currency">{awb.currency}</AwbCell>
              <AwbCell label="CHGS Code">{awb.chgsCode}</AwbCell>
              <div className="border-r border-b border-black text-[0.4375rem]">
                <div className="border-b border-black text-center">WT/VAL</div>
                <div className="grid grid-cols-2 text-center">
                  <span className="border-r border-black">PPD</span>
                  <span>COLL</span>
                  <b className="border-r border-black text-[0.625rem]">{wtPrepaid ? "X" : ""}</b>
                  <b className="text-[0.625rem]">{wtPrepaid ? "" : "X"}</b>
                </div>
              </div>
              <div className="border-r border-b border-black text-[0.4375rem]">
                <div className="border-b border-black text-center">Other</div>
                <div className="grid grid-cols-2 text-center">
                  <span className="border-r border-black">PPD</span>
                  <span>COLL</span>
                  <b className="border-r border-black text-[0.625rem]">{otherPrepaid ? "X" : ""}</b>
                  <b className="text-[0.625rem]">{otherPrepaid ? "" : "X"}</b>
                </div>
              </div>
              <AwbCell label="Declared Value for Carriage">{awb.declaredCarriage}</AwbCell>
              <AwbCell label="Declared Value for Customs">{awb.declaredCustoms}</AwbCell>
            </div>
          </div>
          <div className="grid grid-cols-2">
            <div className="grid grid-cols-[1fr_5.5rem_3.6rem_5.5rem]">
              <AwbCell label="Airport of Destination">{portLabel(awb.portOfDestination)}</AwbCell>
              <AwbCell label="Flight/Date">{flight(leg1)}</AwbCell>
              <AwbCell label="For Carrier Use Only" className="bg-slate-100" />
              <AwbCell label="Flight/Date">{flight(leg2)}</AwbCell>
            </div>
            <div className="grid grid-cols-[6rem_1fr]">
              <AwbCell label="Amount of Insurance">{awb.insurance > 0 ? f2(awb.insurance) : "NIL"}</AwbCell>
              <AwbCell>
                <p className="text-[0.375rem] leading-tight font-normal">
                  INSURANCE – If carrier offers insurance, and such insurance is requested in accordance with the conditions thereof, indicate amount to be insured in figures in box marked
                  &quot;Amount of Insurance&quot;.
                </p>
              </AwbCell>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_4rem]">
            <AwbCell label="Handling Information" className="min-h-10" valueClass="uppercase whitespace-pre-line">
              {[awb.handlingInfo, !house && !sameAsConsignee && `NOTIFY: ${awb.notifyParty}`].filter(Boolean).join("\n")}
            </AwbCell>
            <AwbCell label="SCI" className="self-stretch">
              {awb.sci}
            </AwbCell>
          </div>
          <AwbCell label="(For U.S.A. use only) These commodities, technology or software were exported from the United States in accordance with the Export Administration Regulations. Diversion contrary to U.S.A. law prohibited." />

          {/* Cargo */}
          <div className="grid grid-cols-[3rem_4.2rem_1.3rem_1.3rem_3.6rem_4.2rem_4.6rem_5.6rem_1fr] text-center text-[0.4375rem] leading-tight">
            {["No. of Pieces RCP", "Gross Weight", "kg lb", "", "Rate Class Commodity Item No.", "Chargeable Weight", "Rate / Charge", "Total", ""].map((h, i) => (
              <div key={i} className="border-r border-b border-black px-0.5 py-0.5">
                {h}
                {i === 8 && <span className="text-[0.5625rem]">Nature and Quantity of Goods (incl. Dimensions or Volume)</span>}
              </div>
            ))}
            {[
              String(awb.pieces || ""),
              awb.grossWeight ? f2(awb.grossWeight) : "",
              awb.weightUnit,
              awb.rateClass,
              awb.commodityItemNo,
              awb.chargeableWeight ? f2(awb.chargeableWeight) : "",
              awb.rate ? f2(awb.rate) : "",
              weightCharge ? f2(weightCharge) : "",
            ].map((v, i) => (
              <div key={i} className="h-44 border-r border-b border-black px-1 py-1 text-right text-[0.625rem] font-semibold tabular-nums">
                {v}
              </div>
            ))}
            <div className="h-44 border-r border-b border-black px-1.5 py-1 text-left text-[0.625rem] font-semibold uppercase">
              <div className="whitespace-pre-line">{awb.natureOfGoods || awb.commodity}</div>
              {awb.volume > 0 && <div className="mt-1">VOL: {awb.volume} CBM</div>}
              {awb.netWeight > 0 && <div>NET WT: {f2(awb.netWeight)} KG</div>}
              {awb.packageType && <div>{awb.pieces} {awb.packageType}</div>}
            </div>
            <div className="border-r border-b border-black px-1 text-right text-[0.625rem] font-bold tabular-nums">{awb.pieces || ""}</div>
            <div className="border-r border-b border-black px-1 text-right text-[0.625rem] font-bold tabular-nums">{awb.grossWeight ? f2(awb.grossWeight) : ""}</div>
            <div className="col-span-5 border-r border-b border-black" />
            <div className="border-r border-b border-black px-1 text-right text-[0.625rem] font-bold tabular-nums">{weightCharge ? f2(weightCharge) : ""}</div>
            <div className="border-r border-b border-black" />
          </div>

          {/* Charges | certifications */}
          <div className="grid grid-cols-[9.5rem_9.5rem_1fr]">
            <ChargeBand first label="Weight Charge" prepaid={split(weightCharge, wtPrepaid)[0]} collect={split(weightCharge, wtPrepaid)[1]} />
            <AwbCell label="Other Charges" className="row-span-3">
              <div className="grid grid-cols-2 gap-x-4 text-[0.5625rem] tabular-nums">
                {awb.otherCharges
                  .filter((x) => x.amount)
                  .map((x) => (
                    <span key={x.id}>
                      {x.code}: {f2(x.amount)}
                    </span>
                  ))}
              </div>
            </AwbCell>
            <ChargeBand label="Valuation Charge" prepaid={split(awb.valuationCharge, wtPrepaid)[0]} collect={split(awb.valuationCharge, wtPrepaid)[1]} />
            <ChargeBand label="Tax" prepaid={split(awb.tax, wtPrepaid)[0]} collect={split(awb.tax, wtPrepaid)[1]} />
            <ChargeBand label="Total Other Charges Due Agent" prepaid={split(t.dueAgent, otherPrepaid)[0]} collect={split(t.dueAgent, otherPrepaid)[1]} />
            <AwbCell className="row-span-3 flex flex-col justify-between">
              <p className="text-[0.4375rem] leading-tight font-normal">
                Shipper certifies that the particulars on the face hereof are correct and that insofar as any part of the consignment contains dangerous goods, such part is properly described
                by name and is in proper condition for carriage by air according to the applicable Dangerous Goods Regulations.
              </p>
              <div className="mt-2 text-center">
                <div className="text-[0.625rem] font-semibold">{awb.agentSign || " "}</div>
                <div className="border-t border-dotted border-black text-[0.4375rem] font-normal">Signature of Shipper or his Agent</div>
              </div>
            </AwbCell>
            <ChargeBand label="Total Other Charges Due Carrier" prepaid={split(t.dueCarrier, otherPrepaid)[0]} collect={split(t.dueCarrier, otherPrepaid)[1]} />
            <div className="col-span-2 h-5 border-r border-b border-black bg-slate-100" />
            <div className="col-span-2 grid grid-cols-2">
              <AwbCell label="Total Prepaid" valueClass="text-right tabular-nums">{t.prepaid ? f2(t.prepaid) : " "}</AwbCell>
              <AwbCell label="Total Collect" valueClass="text-right tabular-nums">{t.collect ? f2(t.collect) : " "}</AwbCell>
            </div>
            <AwbCell className="row-span-2 flex flex-col justify-end">
              <div className="grid grid-cols-3 items-end gap-2 text-[0.625rem] font-semibold">
                <span>{fd(awb.issuedAt)}</span>
                <span className="text-center">{awb.place}</span>
                <span className="text-right">{awb.carrierSign}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-dotted border-black text-[0.4375rem] font-normal">
                <span>Executed on (date)</span>
                <span className="text-center">at (place)</span>
                <span className="text-right">Signature of Issuing Carrier or its Agent</span>
              </div>
            </AwbCell>
            <div className="col-span-2 grid grid-cols-2">
              <AwbCell label="Currency Conversion Rates" className="h-8" valueClass="tabular-nums">
                {awb.conversionRate ? `${awb.conversionRate} ${awb.destCurrency}` : ""}
              </AwbCell>
              <AwbCell label="CC Charges in Dest. Currency" className="h-8" valueClass="text-right tabular-nums">
                {t.ccDest ? f2(t.ccDest) : ""}
              </AwbCell>
            </div>
            <AwbCell label="For Carrier's Use only at Destination" className="h-8 text-center" />
            <AwbCell label="Charges at Destination" className="h-8" valueClass="text-right tabular-nums">
              {awb.chargesAtDestination ? f2(awb.chargesAtDestination) : ""}
            </AwbCell>
            <div className="grid grid-cols-[9.5rem_1fr]">
              <AwbCell label="Total Collect Charges" className="h-8" valueClass="text-right tabular-nums">
                {t.totalCollect ? f2(t.totalCollect) : ""}
              </AwbCell>
              <div />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Print preview with Send (to the customer for confirmation) and Print */
export function AwbPreviewModal({ awb, onClose, onBack, onEdit, unsaved }: { awb: Awb; onClose: () => void; onBack?: () => void; onEdit?: () => void; unsaved?: boolean }) {
  const [sending, setSending] = useState(false);
  const [reverse, setReverse] = useState(false);
  if (sending) return <SendAwbFlow awb={awb} onClose={() => setSending(false)} />;
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Preview · ${awbLabel(awb)}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Badge className={AWB_TONE[awb.status]}>{awb.status}</Badge>
          <div className="flex flex-wrap gap-2">
            {onBack && (
              <Button variant="secondary" onClick={onBack}>
                Back to form
              </Button>
            )}
            {onEdit && (
              <Button variant="secondary" onClick={onEdit}>
                Edit
              </Button>
            )}
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={14} aria-hidden /> Print
            </Button>
            <Button onClick={() => setSending(true)} disabled={unsaved || awb.status === "Cancelled"} title={unsaved ? "Save the AWB first" : undefined}>
              <Send size={14} aria-hidden /> Send
            </Button>
          </div>
        </div>
      }
    >
      <label className="no-print mb-3 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" className="accent-brand-600" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
        Include the reverse side (notice of liability and conditions of contract) when printing
      </label>
      <AwbDocument awb={awb} />
      {reverse && <AwbReverse />}
    </Modal>
  );
}

/** Reverse side of the air waybill: the liability notice and conditions of contract (from the AWB template) */
export function AwbReverse() {
  return (
    <div className="doc-sheet mx-auto mt-6 w-[48rem] max-w-full break-before-page bg-white font-mono text-[0.5rem] leading-[1.35] text-black">
      <div className="text-center text-[0.625rem] font-bold">NOTICE CONCERNING CARRIER&apos;S LIMITATION OF LIABILITY</div>
      <p className="mt-1">{AWB_LIABILITY_NOTICE}</p>
      <div className="mt-2 text-center text-[0.625rem] font-bold">CONDITIONS OF CONTRACT</div>
      <div className="mt-1 columns-2 gap-6 text-justify">
        {AWB_CONTRACT_CLAUSES.map((c, i) => (
          <p key={i} className="mb-1 break-inside-avoid-column">
            {c}
          </p>
        ))}
      </div>
    </div>
  );
}

/** Draft AWB to the customer for confirmation → status Draft AWB Send */
export function SendAwbFlow({ awb, onClose }: { awb: Awb; onClose: () => void }) {
  const { state, actions } = useStore();
  const { job, customer, portLabel } = useLookups();
  const j = job(awb.jobId);
  const cust = customer(j?.customerId);
  return (
    <ComposeEmail
      title={`Send AWB · ${awbLabel(awb)}`}
      initial={{
        to: cust?.email ? [cust.email] : [],
        cc: state.settings.company.email,
        subject: `${awb.type === "House" ? "House" : "Master"} Airway Bill ${awbNumber(awb)} – ${j?.ref ?? ""}`,
        body: [
          `Dear ${cust?.contact || "Sir / Madam"},`,
          "",
          "Please find the draft airway bill for your confirmation.",
          "",
          `${awb.type === "House" ? "HAWB No" : "MAWB No"}: ${awbNumber(awb)}`,
          `${awb.type === "House" ? "HAWB" : "MAWB"} Date: ${fmtDate(awb.type === "House" ? awb.hawbDate : awb.mawbDate)}`,
          `Shipper Name: ${awb.shipper.split("\n")[0]}`,
          `Consignee Name: ${awb.consignee.split("\n")[0]}`,
          `POL: ${portLabel(awb.airportCode)}`,
          `POD: ${portLabel(awb.legs[0]?.to)}`,
          ...(awb.legs.length > 1 ? [`FPOD: ${portLabel(awb.portOfDestination)}`] : []),
          `Commodity: ${awb.commodity}`,
          "",
          "Kindly confirm or let us know any corrections.",
        ].join("\n"),
      }}
      attachments={[`${awb.type === "House" ? "HAWB" : "MAWB"}-${awbNumber(awb)}.pdf`]}
      onClose={onClose}
      onSend={(mail) => {
        actions.sendAwb(awb.id, mail);
        onClose();
      }}
    />
  );
}

/** Status Change: Draft / Draft AWB Send / AWB Executed / Cancelled */
export function AwbStatusModal({ awb, onClose }: { awb: Awb; onClose: () => void }) {
  const { actions } = useStore();
  const [status, setStatus] = useState<AwbStatus>(awb.status);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Status Change · ${awbLabel(awb)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={status === awb.status}
            onClick={() => {
              if (actions.setAwbStatus(awb.id, status)) onClose();
            }}
          >
            Update Status
          </Button>
        </>
      }
    >
      <Field label="Status" hint="AWB Executed: no corrections needed after the customer's confirmation. The job moves on to the documents.">
        <Select value={status} onChange={(e) => setStatus(e.target.value as AwbStatus)}>
          {AWB_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}
