"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Check, CheckCircle2, History, Plane, Plus, Trash2, XCircle } from "lucide-react";
import { type RateInput, useLookups, useStore } from "@/lib/store";
import { ENQUIRY_STATUSES, type AirlineRate, type Enquiry, type EnquiryStatus, type MailDraft } from "@/lib/types";
import { STEPS, addDays, airlinesForRoute, cn, currentStep, estimatedTotal, fmtDate, money, previousShipments, rateForWeight, ratesForRoute, today, uid, volumeCbm } from "@/lib/utils";
import { ComposeEmail } from "./ComposeEmail";
import { Badge, Button, Empty, Field, Fog, Input, KeyValue, Modal, Select, StatusBadge, Table } from "./ui";

/** Compact route for tables: "COK → LHR" with full "KOCHI-COK-INDIA" labels on hover, route type underneath */
export function RouteCell({ pol, pod, route }: { pol?: string; pod?: string; route?: string }) {
  const { portLabel } = useLookups();
  return (
    <div className="whitespace-nowrap">
      <span className="font-medium text-slate-900">
        <abbr title={portLabel(pol)} className="no-underline">
          {pol}
        </abbr>{" "}
        →{" "}
        <abbr title={portLabel(pod)} className="no-underline">
          {pod}
        </abbr>
      </span>
      {route && <div className="text-xs text-slate-500">{route}</div>}
    </div>
  );
}

export function WorkflowStepper({ status }: { status: EnquiryStatus }) {
  const active = currentStep(status);
  if (active < 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <XCircle size={16} /> This enquiry is {status === "On Hold" ? "on hold" : <>marked <b>{status}</b></>}. {status === "On Hold" ? "Resume it from the next action." : "Use Change Status to reopen it."}
      </div>
    );
  }
  return (
    <ol className="flex overflow-x-auto pb-1">
      {STEPS.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li key={label} className="flex min-w-[6.5rem] flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={cn("h-0.5 flex-1", i === 0 ? "invisible" : done || current ? "bg-brand-500" : "bg-slate-200")} />
              <div
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  done && "bg-brand-600 text-white",
                  current && "bg-white text-brand-700 ring-2 ring-brand-500",
                  !done && !current && "bg-slate-100 text-slate-400",
                )}
              >
                {done ? <Check size={14} /> : i + 1}
              </div>
              <div className={cn("h-0.5 flex-1", i === STEPS.length - 1 ? "invisible" : done ? "bg-brand-500" : "bg-slate-200")} />
            </div>
            <span
              className={cn("mt-1.5 px-1 text-xs leading-tight", current ? "font-semibold text-brand-700" : done ? "text-slate-700" : "text-slate-400")}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Shown while capturing an enquiry: airlines serving the route, rate availability
 * in the masters, and previous shipments (same destination / route / customer / cargo).
 */
export function RouteInsights({ enquiry }: { enquiry: Pick<Enquiry, "customerId" | "pol" | "pod" | "commodity"> & { id?: string } }) {
  const { state } = useStore();
  const { customer, portLabel } = useLookups();
  const airlines = airlinesForRoute(state.airlines, enquiry.pol, enquiry.pod);
  const rates = enquiry.pol && enquiry.pod ? ratesForRoute(state.rates, enquiry.pol, enquiry.pod, enquiry.id) : [];
  const prev = previousShipments(state.enquiries, enquiry);

  const groups: [string, Enquiry[]][] = [
    ["Same destination", prev.sameDestination],
    ["Same POL & POD", prev.sameRoute],
    ["Same customer", prev.sameCustomer],
    ["Same cargo", prev.sameCargo],
  ];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <Plane size={13} /> Airlines serving this route
        </h3>
        {airlines.length ? (
          <div className="flex flex-wrap gap-1.5">
            {airlines.map((a) => (
              <Badge key={a.id} className="bg-brand-50 text-brand-700 ring-brand-200">
                {a.name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">{enquiry.pol && enquiry.pod ? "No airline in the master serves this route." : "Select POL and POD."}</p>
        )}
      </div>

      {enquiry.pol && enquiry.pod && (
        <div className={cn("flex items-start gap-2 rounded-lg p-3 text-sm", rates.length ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>
          {rates.length ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          <span>
            {rates.length
              ? `${rates.length} valid rate sheet${rates.length > 1 ? "s" : ""} found for ${enquiry.pol} → ${enquiry.pod}.`
              : "No rates updated in the masters for this POL & POD. Use Get Rate from Airline, or add a rate manually."}
          </span>
        </div>
      )}

      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <History size={13} /> Previous shipments
        </h3>
        <div className="space-y-3">
          {groups.map(([label, list]) => (
            <div key={label}>
              <div className="mb-1 text-xs text-slate-500">
                {label} <span className="font-semibold text-slate-700">({list.length})</span>
              </div>
              {list.slice(0, 3).map((e) => (
                <Link
                  key={e.id}
                  href={`/enquiries/${e.id}`}
                  className="mb-1 block rounded-md border border-slate-100 px-2.5 py-1.5 text-xs hover:bg-slate-50"
                  title={`${portLabel(e.pol)} → ${portLabel(e.pod)}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <b className="truncate">{e.ref}</b>
                    <StatusBadge status={e.status} />
                  </div>
                  <div className="truncate text-slate-500">
                    {customer(e.customerId)?.name} · {e.pol}→{e.pod} · {e.commodity}
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** An empty rate with sensible defaults */
export const blankRate = (initial: Partial<RateInput> = {}): RateInput => ({
  airlineId: "",
  name: "Air Freight",
  code: "AF",
  rateType: "GEN",
  commodity: "",
  region: "",
  pol: "",
  pod: "",
  currency: "INR",
  ratePerKg: 0,
  slabs: [],
  minCharge: 0,
  awbFee: 0,
  otherCharges: 0,
  transitDays: 1,
  validFrom: today(),
  validUntil: addDays(30),
  remarks: "",
  contact: "",
  source: "Master",
  ...initial,
});

/**
 * Airline rate entry. The short form (Update Rate on an enquiry) has the FRD's three parts:
 * 1 · Air Freight, 2 · Airway Bill Fees, 3 · Other charges. With `master` it adds the rate sheet
 * fields of the Airline Rate Master: rate name and type, region, weight slabs, validity and contact.
 */
export function RateForm({
  initial,
  airlineIds,
  lockRoute,
  master,
  onSubmit,
  submitLabel = "Save rate",
  useLabel,
  extra,
}: {
  initial: Partial<RateInput>;
  /** Restrict the airline dropdown to these ids */
  airlineIds?: string[];
  lockRoute?: boolean;
  master?: boolean;
  /** `use` is true when the user picked the second button (e.g. "Add & Use Rate") */
  onSubmit: (rate: RateInput, use: boolean) => void;
  submitLabel?: string;
  /** Label of an optional second button that also uses the rate */
  useLabel?: string;
  extra?: React.ReactNode;
}) {
  const { state } = useStore();
  const airlines = airlineIds ? state.airlines.filter((a) => airlineIds.includes(a.id)) : state.airlines;
  const [r, setR] = useState<RateInput>(() => blankRate({ airlineId: airlines[0]?.id ?? "", ...initial }));
  const num = (k: keyof RateInput) => (e: React.ChangeEvent<HTMLInputElement>) => setR({ ...r, [k]: Number(e.target.value) });
  const str = (k: keyof RateInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setR({ ...r, [k]: e.target.value });
  const portOptions = state.ports
    .filter((p) => p.status === "Active" || p.code === r.pol || p.code === r.pod)
    .map((p) => (
      <option key={p.code} value={p.code}>
        {p.code} – {p.name}
      </option>
    ));

  const invalid = !r.airlineId || !r.pol || !r.pod || r.pol === r.pod || r.ratePerKg <= 0 || (!!r.validFrom && r.validUntil < r.validFrom);
  const sectionTitle = "col-span-2 mt-2 border-t border-slate-100 pt-3 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:col-span-4";
  const setSlab = (id: string, patch: Partial<RateInput["slabs"][number]>) => setR({ ...r, slabs: r.slabs.map((x) => (x.id === id ? { ...x, ...patch } : x)) });

  return (
    <form
      className="grid grid-cols-1 max-xs:*:col-span-full xs:grid-cols-2 gap-3 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        // Both buttons submit (so required fields are checked); the second one carries value="use"
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        onSubmit({ ...r, slabs: r.slabs.filter((x) => x.rate > 0) }, submitter?.value === "use");
      }}
    >
      <Field label="Airline Name" className="col-span-2">
        <Select value={r.airlineId} onChange={str("airlineId")} required>
          {airlines.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="POL">
        <Select value={r.pol} onChange={str("pol")} disabled={lockRoute} required>
          <option value="">Select</option>
          {portOptions}
        </Select>
      </Field>
      <Field label="POD">
        <Select value={r.pod} onChange={str("pod")} disabled={lockRoute} required>
          <option value="">Select</option>
          {portOptions}
        </Select>
      </Field>
      {master && (
        <>
          <Field label="Rate Name">
            <Input value={r.name} onChange={str("name")} />
          </Field>
          <Field label="Charge Code">
            <Input value={r.code} onChange={(e) => setR({ ...r, code: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Rate Type" hint="e.g. GEN, All Perishables">
            <Input value={r.rateType} onChange={str("rateType")} list="rate-types" />
            <datalist id="rate-types">
              <option value="GEN" />
              <option value="All Perishables" />
              <option value="DG" />
            </datalist>
          </Field>
          <Field label="Region">
            <Input value={r.region} onChange={str("region")} />
          </Field>
          <Field label="Commodity" className="col-span-2">
            <Input value={r.commodity} onChange={str("commodity")} placeholder="e.g. General cargo" />
          </Field>
        </>
      )}

      <h3 className={sectionTitle}>1 · Air Freight</h3>
      <Field label="Currency">
        <Select value={r.currency} onChange={str("currency")}>
          {state.currencies.filter((c) => c.active || c.code === r.currency).map((c) => (
            <option key={c.code}>{c.code}</option>
          ))}
        </Select>
      </Field>
      <Field label={master ? "N Rate / kg *" : "Air freight rate / kg *"}>
        <Input type="number" step="0.01" min="0" value={r.ratePerKg} onChange={num("ratePerKg")} required />
      </Field>
      <Field label="Minimum Rate">
        <Input type="number" step="0.01" min="0" value={r.minCharge} onChange={num("minCharge")} />
      </Field>
      <Field label="Transit (days)">
        <Input type="number" min="0" value={r.transitDays} onChange={num("transitDays")} />
      </Field>
      {master && (
        <div className="col-span-2 space-y-2 sm:col-span-4">
          <div className="text-xs font-medium text-slate-700">Weight slabs (rate per kg from the given weight)</div>
          {r.slabs.map((x) => (
            <div key={x.id} className="flex flex-wrap items-end gap-2">
              <Field label="Slab description" className="w-36">
                <Input value={x.label} onChange={(e) => setSlab(x.id, { label: e.target.value })} placeholder="+45" />
              </Field>
              <Field label="From kg" className="w-28">
                <Input type="number" min="0" value={x.minKg} onChange={(e) => setSlab(x.id, { minKg: Number(e.target.value) })} />
              </Field>
              <Field label="Slab rate" className="w-28">
                <Input type="number" min="0" step="0.01" value={x.rate} onChange={(e) => setSlab(x.id, { rate: Number(e.target.value) })} />
              </Field>
              <button type="button" onClick={() => setR({ ...r, slabs: r.slabs.filter((y) => y.id !== x.id) })} className="mb-1.5 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove slab ${x.label}`}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const next = [45, 100, 300, 500, 1000].find((k) => !r.slabs.some((x) => x.minKg === k)) ?? 0;
              setR({ ...r, slabs: [...r.slabs, { id: uid(), label: next ? `+${next}` : "", minKg: next, rate: 0 }] });
            }}
          >
            <Plus size={13} aria-hidden /> Add new slab
          </Button>
        </div>
      )}
      <Field label="Valid from">
        <Input type="date" value={r.validFrom} onChange={str("validFrom")} />
      </Field>
      <Field label="Valid to" hint={r.validFrom && r.validUntil < r.validFrom ? <span className="text-red-600">Must be after Valid from</span> : undefined}>
        <Input type="date" value={r.validUntil} onChange={str("validUntil")} required />
      </Field>

      <h3 className={sectionTitle}>2 · Airway Bill Fees</h3>
      <Field label={`Airway bill fees (${r.currency}, per shipment)`} className="col-span-2">
        <Input type="number" step="0.01" min="0" value={r.awbFee} onChange={num("awbFee")} />
      </Field>

      <h3 className={sectionTitle}>3 · Other charges</h3>
      <Field label={`Other airline charges (${r.currency}, per shipment)`} className="col-span-2">
        <Input type="number" step="0.01" min="0" value={r.otherCharges} onChange={num("otherCharges")} />
      </Field>
      {master && (
        <>
          <Field label="Remarks" className="col-span-2">
            <Input value={r.remarks} onChange={str("remarks")} />
          </Field>
          <Field label="Contact Details" className="col-span-2">
            <Input value={r.contact} onChange={str("contact")} />
          </Field>
        </>
      )}
      {extra && <div className="col-span-2 flex items-end">{extra}</div>}

      <div className="col-span-2 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3 sm:col-span-4">
        <Button type="submit" variant={useLabel ? "secondary" : "primary"} disabled={invalid} title={r.ratePerKg <= 0 ? "Enter the air freight rate per kg" : undefined}>
          {submitLabel}
        </Button>
        {useLabel && (
          <Button type="submit" value="use" disabled={invalid}>
            {useLabel}
          </Button>
        )}
      </div>
    </form>
  );
}

/** "Update Rate": a rate received from the airline (or found elsewhere), entered by hand for one enquiry */
export function ManualRateModal({ enq, onClose }: { enq: Enquiry; onClose: () => void }) {
  const router = useRouter();
  const { actions } = useStore();
  const [saveToMaster, setSaveToMaster] = useState(false);
  return (
    <Modal open onClose={onClose} title={`Update Rate · ${enq.ref}`} wide>
      <p className="mb-3 text-sm text-slate-600">
        Enter the rate received from the airline: air freight, airway bill fees and other charges. It is added to this enquiry and can be used for the quotation.
      </p>
      <RateForm
        initial={{ pol: enq.pol, pod: enq.pod, source: "Manual", enquiryId: enq.id, ...(enq.airlineIds[0] ? { airlineId: enq.airlineIds[0] } : {}) }}
        lockRoute
        submitLabel="Update Rate"
        useLabel="Update & Use Rate"
        extra={
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={saveToMaster} onChange={(e) => setSaveToMaster(e.target.checked)} className="accent-brand-600" />
            Also save to the Airline Rate Master
          </label>
        }
        onSubmit={(rate, use) => {
          const rateId = actions.addManualRate(enq.id, rate, saveToMaster);
          onClose();
          if (use) router.push(`/quotations/${actions.createQuotation(enq.id, rateId).id}`);
        }}
      />
    </Modal>
  );
}

/** FRD XIX/XX: "Compare Available Rates" from the masters and this enquiry's replies */
export function GetRatesModal({ enq, onClose, onForward, onManual }: { enq: Enquiry; onClose: () => void; onForward: () => void; onManual: () => void }) {
  const router = useRouter();
  const { state, actions } = useStore();
  const { customer, airline, portLabel } = useLookups();
  const rates = ratesForRoute(state.rates, enq.pol, enq.pod, enq.id).sort(
    (a, b) => estimatedTotal(a, enq.chargeableWeight) - estimatedTotal(b, enq.chargeableWeight),
  );
  // Pre-select the cheapest rate; tick others to compare
  const [selected, setSelected] = useState<string[]>(rates.slice(0, 1).map((r) => r.id));
  const [compareOnly, setCompareOnly] = useState(false);
  const shown = compareOnly ? rates.filter((r) => selected.includes(r.id)) : rates;
  const best = shown.length ? Math.min(...shown.map((r) => estimatedTotal(r, enq.chargeableWeight))) : 0;
  const quotationLocked = state.quotations.some((q) => q.id === enq.quotationId && q.status !== "Draft");

  const use = (rate: AirlineRate) => {
    const q = actions.createQuotation(enq.id, rate.id);
    router.push(`/quotations/${q.id}`);
  };
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Modal
      open
      onClose={onClose}
      title="Compare Available Rate"
      wide
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button variant="ghost" onClick={onManual} disabled={quotationLocked}>
              Update Rate
            </Button>
          </div>
          {rates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setCompareOnly((v) => !v)} disabled={!selected.length}>
                {compareOnly ? "Show All" : "Compare Selected"}
              </Button>
              <Button
                disabled={selected.length !== 1 || quotationLocked}
                title={selected.length !== 1 ? "Select exactly one rate" : undefined}
                onClick={() => use(rates.find((r) => r.id === selected[0])!)}
              >
                Use Selected Rate & Create Quotation
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className="mb-3 rounded-lg border border-brand-100 bg-brand-50/60 p-3">
        <KeyValue
          compact
          cols={4}
          items={[
            ["Enquiry", enq.ref],
            ["Customer", customer(enq.customerId)?.name],
            ["POL", portLabel(enq.pol)],
            ["POD", portLabel(enq.pod)],
            ["Commodity", enq.commodity || "—"],
            ["Gross / Chargeable", `${enq.grossWeight} / ${enq.chargeableWeight} kg`],
            ["Packages", `${enq.packages} ${enq.unitType}`],
            ["Dimensions", `${enq.length} × ${enq.width} × ${enq.height} cm`],
          ]}
        />
      </div>

      {quotationLocked && <Fog>A quotation for this enquiry has already been sent. New rates cannot replace it.</Fog>}

      {rates.length ? (
        <>
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Matching rate sheets found for this POL and POD. Compare the rates below and select the most suitable option.
          </div>
          <Table>
            <thead>
              <tr>
                <th>Compare</th>
                <th>Airline</th>
                <th>Currency</th>
                <th className="text-right">Rate / kg</th>
                <th className="text-right">AWB Fee</th>
                <th className="text-right">Minimum Charge</th>
                <th>Transit</th>
                <th>Valid Until</th>
                <th className="text-right">Estimated Total*</th>
                {compareOnly && <th className="text-right">vs Best</th>}
                <th>Source</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const total = estimatedTotal(r, enq.chargeableWeight);
                return (
                  <tr key={r.id} className={cn(total === best && "bg-emerald-50/60")}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(r.id)}
                        onChange={() => toggle(r.id)}
                        className="size-4 accent-brand-600"
                        aria-label={`Compare ${airline(r.airlineId)?.name}`}
                      />
                    </td>
                    <td className="font-medium whitespace-nowrap">
                      {airline(r.airlineId)?.name}
                      {total === best && <Badge className="ml-1 bg-emerald-100 text-emerald-700 ring-emerald-200">Best</Badge>}
                    </td>
                    <td>{r.currency}</td>
                    <td className="text-right tabular-nums" title={r.slabs.length ? `N ${r.ratePerKg} · ${r.slabs.map((x) => `${x.label} ${x.rate}`).join(" · ")}` : undefined}>
                      {rateForWeight(r, enq.chargeableWeight).toFixed(2)}
                    </td>
                    <td className="text-right tabular-nums">{r.awbFee.toFixed(2)}</td>
                    <td className="text-right tabular-nums">{r.minCharge.toFixed(2)}</td>
                    <td className="whitespace-nowrap">
                      {r.transitDays} day{r.transitDays !== 1 && "s"}
                    </td>
                    <td className="whitespace-nowrap">{fmtDate(r.validUntil)}</td>
                    <td className="text-right font-semibold whitespace-nowrap tabular-nums">{money(total, r.currency)}</td>
                    {compareOnly && <td className="text-right text-slate-500 tabular-nums">{total === best ? "—" : `+${(total - best).toFixed(2)}`}</td>}
                    <td className="text-xs text-slate-500">{r.source}</td>
                    <td>
                      <Button size="sm" onClick={() => use(r)} disabled={quotationLocked}>
                        Use Rate
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-slate-500">
            *Indicative total = higher of (chargeable weight × slab rate/kg) or minimum rate, plus AWB fee and other airline charges. Agency charges and taxes are added on the quotation.
          </p>
        </>
      ) : (
        <Fog>
          <div className="font-medium">There is no Rates updated in the masters, please check with the respective airlines.</div>
          <div className="mt-1">Send a rate request by email, or use Update Rate when the rate comes in.</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={onForward}>
              Send Rate Request
            </Button>
            <Button size="sm" variant="secondary" onClick={onManual}>
              Update Rate
            </Button>
          </div>
        </Fog>
      )}
    </Modal>
  );
}

function rateRequestMail(enq: Enquiry, airlineName: string, customerName: string, polLabel: string, podLabel: string, reminder = false): Omit<MailDraft, "to"> {
  return {
    cc: "",
    bcc: "",
    subject: `${reminder ? "Reminder: " : ""}Request for Air Freight Rate – ${polLabel} to ${podLabel} [${enq.ref}]`,
    // Kept simple, as in the FRD sample: POL, POD, commodity, gross weight, pieces, dimensions
    body: [
      `Dear ${airlineName || "Sir / Madam"},`,
      "",
      reminder ? "Gentle reminder on our rate request below. We would appreciate your rate at the earliest." : "Please quote your best air freight rate for the shipment below.",
      "",
      `POL        : ${polLabel}`,
      `POD        : ${podLabel}`,
      `COMMODITY  : ${enq.commodity}${enq.productType !== "Non-Perishable" ? ` (${enq.productType})` : ""}`,
      `G.WEIGHT   : ${enq.grossWeight} kgs`,
      `PCS        : ${enq.packages} ${enq.unitType}`,
      `DIMENSION  : ${enq.length}x${enq.width}x${enq.height} cm${enq.packages > 1 ? ` x ${enq.packages}` : ""} (${volumeCbm(enq)} CBM)`,
      ...(enq.route === "Connection" && enq.connections.length ? [`ROUTING    : via ${enq.connections.map((c) => c.transit).join(", ")}`] : []),
      `READY DATE : ${enq.requestedDate ? fmtDate(enq.requestedDate) : "To be confirmed"}`,
      "",
      `Ref: ${enq.ref} · ${customerName}`,
    ].join("\n"),
  };
}

/**
 * Sends one email per airline, in turn, so each airline gets its own message.
 * Used for both rate requests and reminders.
 */
function PerAirlineMail({
  enq,
  airlineIds,
  reminder,
  onClose,
}: {
  enq: Enquiry;
  airlineIds: string[];
  reminder?: boolean;
  onClose: () => void;
}) {
  const { state, actions } = useStore();
  const { customer, portLabel } = useLookups();
  const [index, setIndex] = useState(0);
  const airline = state.airlines.find((a) => a.id === airlineIds[index])!;
  const next = () => (index + 1 < airlineIds.length ? setIndex(index + 1) : onClose());
  const kind = reminder ? "Reminder" : "Rate Request";

  return (
    <ComposeEmail
      key={airline.id}
      title={airlineIds.length > 1 ? `${kind} ${index + 1} of ${airlineIds.length} · ${airline.name}` : `${kind} · ${airline.name}`}
      initial={{ to: [airline.email], ...rateRequestMail(enq, airline.name, customer(enq.customerId)?.name ?? "", portLabel(enq.pol), portLabel(enq.pod), reminder) }}
      note={
        airlineIds.length > 1 && (
          <p className="text-xs text-slate-500">
            Each airline gets its own email. After this one: {airlineIds.slice(index + 1).map((id) => state.airlines.find((a) => a.id === id)?.name).join(", ") || "done"}.
          </p>
        )
      }
      sendLabel={index + 1 < airlineIds.length ? "Send & next airline" : "Send"}
      onClose={onClose}
      onSend={(mail) => {
        if (reminder) actions.sendRateReminder(enq.id, airline.id, mail);
        else actions.sendRateRequest(enq.id, airline.id, mail);
        next();
      }}
    />
  );
}

/** FRD VI–VIII: "Get Rate from Airline" → Select Airlines → one Rate Request email per airline */
export function ForwardFlow({ enq, direct, onClose }: { enq: Enquiry; /** Skip the airline selection and mail the enquiry's preferred airlines */ direct?: boolean; onClose: () => void }) {
  const { state, actions } = useStore();
  const { customer, portLabel } = useLookups();
  // Only the airlines mapped (in the Airline Master) to both airports of this route
  const airlines = airlinesForRoute(state.airlines, enq.pol, enq.pod);
  const alreadySent = enq.rateRequests.map((r) => r.airlineId);
  const [selected, setSelected] = useState<string[]>(enq.airlineIds.filter((id) => !alreadySent.includes(id) && airlines.some((a) => a.id === id)));
  const [step, setStep] = useState<"select" | "compose" | "anyway">(direct && selected.length ? "compose" : "select");
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  if (step === "compose") return <PerAirlineMail enq={enq} airlineIds={selected} onClose={onClose} />;
  // "No airlines found, send the request anyway": an empty To and CC for the user to fill in
  if (step === "anyway") {
    return (
      <ComposeEmail
        title="Rate Request"
        initial={{ to: [], ...rateRequestMail(enq, "", customer(enq.customerId)?.name ?? "", portLabel(enq.pol), portLabel(enq.pod)) }}
        onClose={onClose}
        onSend={(mail) => {
          actions.sendRateRequest(enq.id, undefined, mail);
          onClose();
        }}
      />
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Select Airlines to Request Rates"
      wide
      footer={
        <div className="flex w-full justify-between">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!selected.length} onClick={() => setStep("compose")}>
            Continue
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        {selected.length
          ? `${selected.length} airline${selected.length > 1 ? "s" : ""} selected. Each gets an individual email.`
          : "No airline selected. Choose the airline(s) to receive this enquiry."}
      </p>
      <h3 className="mb-2 text-xs font-semibold text-slate-500 uppercase">Airlines serving {enq.pol} → {enq.pod}</h3>
      {airlines.length ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {airlines.map((a) => (
            <label key={a.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="mt-0.5 accent-brand-600" />
              <span>
                <span className="font-medium">{a.name}</span> <span className="text-xs text-slate-500">{a.email}</span>
                {alreadySent.includes(a.id) && <span className="block text-xs text-amber-600">Already requested</span>}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <Empty
          action={
            <button className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setStep("anyway")}>
              No airlines found, send the request anyway
            </button>
          }
        >
          No airline in the Airline Master is mapped to {enq.pol} and {enq.pod}.
        </Empty>
      )}
      {airlines.length > 0 && (
        <button className="mt-3 text-xs font-medium text-brand-700 hover:underline" onClick={() => setStep("anyway")}>
          Send to an airline that isn&apos;t listed
        </button>
      )}
    </Modal>
  );
}

/** FRD XII–XIII: Send Reminder to one or more airlines, through the same mail box pop-up */
export function ReminderFlow({ enq, airlineIds, onClose }: { enq: Enquiry; airlineIds: string[]; onClose: () => void }) {
  const { state } = useStore();
  const [selected, setSelected] = useState(airlineIds);
  const [step, setStep] = useState<"select" | "compose">(airlineIds.length === 1 ? "compose" : "select");
  const pending = enq.rateRequests.filter((r) => !r.repliedAt);

  if (step === "compose") return <PerAirlineMail enq={enq} airlineIds={selected} reminder onClose={onClose} />;

  return (
    <Modal
      open
      onClose={onClose}
      title="Send Reminder to Airlines"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!selected.length} onClick={() => setStep("compose")}>
            Continue
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {pending.map((r) => {
          const a = state.airlines.find((x) => x.id === r.airlineId);
          return (
            <label key={r.airlineId} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-sm">
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={selected.includes(r.airlineId)}
                onChange={() => setSelected((s) => (s.includes(r.airlineId) ? s.filter((x) => x !== r.airlineId) : [...s, r.airlineId]))}
              />
              <span className="font-medium">{a?.name}</span>
              <span className="text-xs text-slate-500">{a?.email}</span>
            </label>
          );
        })}
      </div>
    </Modal>
  );
}

export function ChangeStatusModal({ enq, onClose }: { enq: Enquiry; onClose: () => void }) {
  const { actions } = useStore();
  const [status, setStatus] = useState<EnquiryStatus>(enq.status);
  return (
    <Modal
      open
      onClose={onClose}
      title="Change Status"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={status === enq.status}
            onClick={() => {
              actions.changeStatus(enq.id, status);
              onClose();
            }}
          >
            Update Status
          </Button>
        </>
      }
    >
      <div className="mb-3 flex items-center gap-2 text-sm">
        <b>{enq.ref}</b> · <StatusBadge status={enq.status} />
      </div>
      <Field label="Update Status">
        <Select value={status} onChange={(e) => setStatus(e.target.value as EnquiryStatus)}>
          {ENQUIRY_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}
