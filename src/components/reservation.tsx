"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { type ReservationInput, type SeriesScope, nextReservationRef, occurrenceDates, useLookups, useStore } from "@/lib/store";
import { CARRIER_BOOKING_STATUSES, INCOTERMS, type Job, PRODUCT_TYPES, type Reservation, type StoredDoc } from "@/lib/types";
import { customersOnly, defaultFy, fmtDate, fmtPort, suggestedChargeable, today, userNames, volumeCbm, volumetricWeight } from "@/lib/utils";
import { Button, Card, DISCARD_CHANGES, Field, Fog, Input, Modal, Select, Textarea, buttonCls, useUnsavedChanges } from "./ui";
import { DocumentsInput } from "./inputs";
import { ConnectionsEditor } from "./EnquiryForm";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function blankReservation(s: ReturnType<typeof useStore>["state"], date = today(), customerId = ""): ReservationInput {
  const users = userNames(s.settings);
  return {
    branch: s.settings.branches[0]?.name ?? "",
    financialYear: defaultFy(s.settings),
    customerId,
    shipperName: "",
    cargoMode: "Air",
    shipmentMode: "Export",
    incoterm: "FOB",
    awbNo: "",
    pol: "",
    pod: "",
    airlineId: "",
    flightNo: "",
    flightDate: date,
    bookingStatus: "Booking Pending",
    routeType: "Direct",
    shipmentDate: date,
    transitTime: "",
    connections: [],
    commodity: "",
    productType: "Non-Perishable",
    packageType: s.settings.packageTypes[0]?.description ?? "",
    grossWeight: 0,
    chargeableWeight: 0,
    unitType: s.settings.unitTypes[0]?.short ?? "",
    packages: 1,
    length: 0,
    width: 0,
    height: 0,
    clearancePlace: s.settings.clearancePlaces[0]?.name ?? "",
    salesPerson: users[0] ?? "",
    operationsPerson: users[0] ?? "",
    pricingPerson: users[0] ?? "",
    remarks: "",
    preferredAirlineIds: [],
    recurring: false,
  };
}

/**
 * "Convert to Reservation": a new reservation pre-filled from a job, its enquiry, quotation
 * or source reservation. The job is left as it is; only the planned date is today until changed.
 */
export function reservationFromJob(s: ReturnType<typeof useStore>["state"], job: Job): ReservationInput {
  const base = blankReservation(s, undefined, job.customerId);
  const enq = s.enquiries.find((e) => e.id === job.enquiryId);
  const quote = s.quotations.find((q) => q.id === job.quotationId);
  const src = s.reservations.find((r) => r.id === job.reservationId);
  // Cargo and planning details: the source reservation, else the enquiry
  const plan = src
    ? { ...src, routeType: src.routeType, preferredAirlineIds: src.preferredAirlineIds }
    : enq && { ...enq, routeType: enq.route, operationsPerson: base.operationsPerson, preferredAirlineIds: enq.airlineIds };
  return {
    ...base,
    branch: job.branch || base.branch,
    shipperId: job.shipperId,
    shipperName: job.shipperName,
    pol: job.pol,
    pod: job.pod,
    airlineId: quote?.airlineId ?? src?.airlineId ?? "",
    flightNo: job.flightNo,
    commodity: plan?.commodity || job.commodity,
    chargeableWeight: job.weight,
    grossWeight: plan?.grossWeight || job.weight,
    packages: job.boxes || base.packages,
    ...(plan && {
      cargoMode: plan.cargoMode,
      shipmentMode: plan.shipmentMode,
      incoterm: plan.incoterm,
      routeType: plan.routeType,
      connections: plan.connections,
      transitTime: plan.transitTime,
      productType: plan.productType,
      packageType: plan.packageType,
      unitType: plan.unitType,
      length: plan.length,
      width: plan.width,
      height: plan.height,
      clearancePlace: plan.clearancePlace,
      salesPerson: plan.salesPerson,
      pricingPerson: plan.pricingPerson,
      operationsPerson: plan.operationsPerson,
      preferredAirlineIds: plan.preferredAirlineIds,
    }),
    remarks: `Converted from job ${job.ref}`,
    fromJobId: job.id,
  };
}

/** Create / edit a reservation: sections 1–6 of the FRD (office, general, routing, cargo, planning, recurring) */
export function ReservationForm({
  initial,
  existing,
  onDone,
}: {
  initial: ReservationInput;
  existing?: Reservation;
  onDone: (ids: string[]) => void;
}) {
  const { state, actions } = useStore();
  const { user } = useAuth();
  const { settings } = state;
  const [f, setF] = useState<ReservationInput>(initial);
  useUnsavedChanges(JSON.stringify(f) !== JSON.stringify(initial));
  const [scope, setScope] = useState<SeriesScope>("one");
  const [reason, setReason] = useState(existing?.weightOverride?.reason ?? "");
  // Settings → Ref Number Format: with automatic generation off a single reservation's number is typed in
  const [typedRef, setTypedRef] = useState("");
  const set = <K extends keyof ReservationInput>(k: K, v: ReservationInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const str = (k: keyof ReservationInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value as never);
  const suggested = suggestedChargeable(f, settings);
  const [cwTouched, setCwTouched] = useState(!!existing?.weightOverride);
  // Weight and dimensions re-suggest the chargeable weight unless it was overridden
  const cargo = (k: "grossWeight" | "packages" | "length" | "width" | "height") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((x) => {
      const next = { ...x, [k]: Number(e.target.value) };
      return cwTouched ? next : { ...next, chargeableWeight: suggestedChargeable(next, settings) };
    });
  const overridden = cwTouched && f.chargeableWeight !== suggested;
  const customers = customersOnly(state.customers);
  const shippers = state.customers.filter((c) => c.type === "Shipper" && c.status !== "Inactive");
  const users = userNames(settings);
  const rec = f.recurrence ?? { type: "Weekly" as const, repeatOn: [new Date(`${f.shipmentDate || today()}T00:00:00`).getDay()], startDate: f.shipmentDate || today(), endDate: "", occurrences: 4, generation: "Automatic" as const };
  const dates = f.recurring ? occurrenceDates(rec) : [f.shipmentDate];
  const manualRef = !existing && !settings.reservationRef.auto && dates.length <= 1;
  const refTaken = manualRef && state.reservations.some((r) => r.ref.toLowerCase() === typedRef.trim().toLowerCase());
  const missing = [
    !f.branch && "Branch",
    !f.customerId && "Customer",
    !f.pol && "Origin (POL)",
    !f.pod && "Destination (POD)",
    f.pol && f.pol === f.pod && "a POD different from the POL",
    !f.shipmentDate && !f.recurring && "Shipment Date",
    f.recurring && !dates.length && "a recurrence that gives at least one date",
    !f.commodity.trim() && "Commodity",
    overridden && !reason.trim() && "a reason for the chargeable weight override",
    manualRef && !typedRef.trim() && "Reservation Number",
    refTaken && "a Reservation Number that isn't used yet",
  ].filter(Boolean) as string[];
  const portOptions = state.ports
    .filter((p) => p.status === "Active" || p.code === f.pol || p.code === f.pod)
    .map((p) => (
      <option key={p.code} value={p.code}>
        {fmtPort(p)}
      </option>
    ));
  const userOptions = users.map((u) => <option key={u}>{u}</option>);
  const grid = "grid grid-cols-1 max-xs:*:col-span-full xs:grid-cols-2 gap-3 sm:grid-cols-4";

  const payload = (): ReservationInput => ({
    ...f,
    connections: f.routeType === "Connection" ? f.connections : [],
    recurrence: f.recurring ? rec : undefined,
    shipmentDate: f.recurring && !existing ? dates[0] : f.shipmentDate,
    weightOverride: overridden ? { calculated: suggested, revised: f.chargeableWeight, by: user?.name ?? "User", reason: reason.trim(), at: new Date().toISOString() } : undefined,
  });
  const submit = (draft: boolean) => {
    if (existing) {
      actions.updateReservation(existing.id, payload(), scope);
      if (!draft && existing.status === "Draft") actions.submitReservation(existing.id);
      onDone([existing.id]);
    } else onDone(actions.createReservation(payload(), draft, manualRef ? typedRef : undefined).map((r) => r.id));
  };

  return (
    <div className="space-y-3">
      <Card title="Section 1 · Office & financial information">
        <div className={grid}>
          <Field label="Branch *">
            <Select value={f.branch} onChange={str("branch")}>
              {settings.branches.map((b) => (
                <option key={b.name}>{b.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Financial Year">
            <Select value={f.financialYear} onChange={str("financialYear")}>
              {settings.financialYears
                .filter((y) => y.status !== "Closed" || y.name === f.financialYear)
                .map((y) => (
                  <option key={y.code} value={y.name}>
                    {y.name}
                  </option>
                ))}
            </Select>
          </Field>
          {manualRef ? (
            <Field label="Reservation Number *" hint={refTaken ? <span className="text-red-600">Already used</span> : "Automatic numbering is off (Settings)"}>
              <Input value={typedRef} onChange={(e) => setTypedRef(e.target.value.toUpperCase())} placeholder={nextReservationRef(state, f)} className="font-mono" />
            </Field>
          ) : (
            <Field label="Reservation Number" hint={existing ? undefined : f.recurring && dates.length > 1 ? `One number per occurrence (${dates.length})` : "Automatic sequence"}>
              <Input value={existing?.ref ?? nextReservationRef(state, f)} readOnly disabled className="font-mono" />
            </Field>
          )}
        </div>
      </Card>

      <Card title="Section 2 · General information">
        <div className={grid}>
          <Field label="Customer *" className="col-span-2">
            <Select value={f.customerId} onChange={str("customerId")}>
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Customer Type" hint="From the Stakeholders master">
            <Input value={state.customers.find((c) => c.id === f.customerId)?.type ?? ""} readOnly disabled />
          </Field>
          <Field label="Shipper" hint="Pick from the master or type a temporary shipper">
            <Input
              value={f.shipperName}
              list="reservation-shippers"
              onChange={(e) => {
                const match = shippers.find((s) => s.name === e.target.value);
                setF((x) => ({ ...x, shipperName: e.target.value, shipperId: match?.id }));
              }}
            />
            <datalist id="reservation-shippers">
              {shippers.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Cargo Mode">
            <Select value={f.cargoMode} onChange={str("cargoMode")}>
              <option>Air</option>
              <option>Sea</option>
            </Select>
          </Field>
          <Field label="Shipment Mode">
            <Select value={f.shipmentMode} onChange={str("shipmentMode")}>
              <option>Export</option>
              <option>Import</option>
            </Select>
          </Field>
          <Field label="INCO Terms">
            <Select value={f.incoterm} onChange={str("incoterm")}>
              {INCOTERMS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card title="Section 3 · Routing & carrier details">
        <div className={grid}>
          <Field label="AWB No." hint="Air AWB from the airline">
            <Input value={f.awbNo} onChange={str("awbNo")} />
          </Field>
          <Field label="Origin (POL) *" className="col-span-2 sm:col-span-1">
            <Select value={f.pol} onChange={str("pol")}>
              <option value="">Select origin</option>
              {portOptions}
            </Select>
          </Field>
          <Field label="Destination (POD) *" className="col-span-2 sm:col-span-1">
            <Select value={f.pod} onChange={str("pod")}>
              <option value="">Select destination</option>
              {portOptions}
            </Select>
          </Field>
          <Field label={f.cargoMode === "Air" ? "Airline" : "Carrier"}>
            <Select value={f.airlineId} onChange={str("airlineId")}>
              <option value="">Select</option>
              {state.airlines.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Flight No.">
            <Input value={f.flightNo} onChange={(e) => set("flightNo", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Flight Date" hint="Planned departure">
            <Input type="date" value={f.flightDate} onChange={str("flightDate")} />
          </Field>
          <Field label="Booking Status">
            <Select value={f.bookingStatus} onChange={str("bookingStatus")}>
              {CARRIER_BOOKING_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Route Type">
            <Select value={f.routeType} onChange={str("routeType")}>
              <option>Direct</option>
              <option>Connection</option>
            </Select>
          </Field>
          <Field label="Shipment Date *" hint="The day it shows on the planner">
            <Input type="date" value={f.shipmentDate} disabled={f.recurring && !existing} onChange={(e) => setF((x) => ({ ...x, shipmentDate: e.target.value, flightDate: x.flightDate === x.shipmentDate ? e.target.value : x.flightDate }))} />
          </Field>
          <Field label="Transit Time (days)">
            <Input value={f.transitTime} onChange={str("transitTime")} />
          </Field>
          {f.routeType === "Connection" && (
            <div className="col-span-2 sm:col-span-4">
              <ConnectionsEditor value={f.connections} onChange={(connections) => set("connections", connections)} />
            </div>
          )}
        </div>
      </Card>

      <Card title="Section 4 · Cargo details">
        <div className={grid}>
          <Field label="Commodity *" className="col-span-2">
            <Textarea rows={1} value={f.commodity} onChange={str("commodity")} placeholder="Cargo description" />
          </Field>
          <Field label="Product Type">
            <Select value={f.productType} onChange={str("productType")}>
              {PRODUCT_TYPES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="Package Type">
            <Select value={f.packageType} onChange={str("packageType")}>
              {settings.packageTypes.map((p) => (
                <option key={p.short} value={p.description}>
                  {p.description}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Gross Weight (kg)">
            <Input type="number" min="0" step="0.01" value={f.grossWeight || ""} onChange={cargo("grossWeight")} />
          </Field>
          <Field label="Chargeable Weight (kg)" hint={overridden ? `Calculated ${suggested} kg kept for reference` : `Higher of gross and volumetric (${volumetricWeight(f, settings.volumetricDivisor)} kg)`}>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={f.chargeableWeight || ""}
              onChange={(e) => {
                setCwTouched(true);
                set("chargeableWeight", Number(e.target.value));
              }}
            />
          </Field>
          <Field label="Unit Type">
            <Select value={f.unitType} onChange={str("unitType")}>
              {settings.unitTypes.map((u) => (
                <option key={u.short} value={u.short}>
                  {u.short}: {u.description}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Number of Packages">
            <Input type="number" min="0" value={f.packages || ""} onChange={cargo("packages")} />
          </Field>
          <Field label="Length (cm)">
            <Input type="number" min="0" value={f.length || ""} onChange={cargo("length")} />
          </Field>
          <Field label="Width (cm)">
            <Input type="number" min="0" value={f.width || ""} onChange={cargo("width")} />
          </Field>
          <Field label="Height (cm)">
            <Input type="number" min="0" value={f.height || ""} onChange={cargo("height")} />
          </Field>
          <Field label="Volume (CBM)" hint="Packages × L × W × H">
            <Input value={volumeCbm(f).toFixed(4)} readOnly disabled />
          </Field>
          {overridden && (
            <div className="col-span-2 sm:col-span-4">
              <Fog>
                <div className="mb-2">
                  Chargeable weight changed from the calculated <b>{suggested} kg</b> to <b>{f.chargeableWeight} kg</b>. The calculated value, revised value, your name and the reason are kept.
                </div>
                <Field label="Reason for override *">
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Airline agreed a flat weight" />
                </Field>
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-amber-900 underline"
                  onClick={() => {
                    setCwTouched(false);
                    set("chargeableWeight", suggested);
                  }}
                >
                  Use the calculated weight instead
                </button>
              </Fog>
            </div>
          )}
        </div>
      </Card>

      <Card title="Section 5 · Shipment planning & assignment">
        <div className={grid}>
          <Field label="Clearance Place">
            <Select value={f.clearancePlace} onChange={str("clearancePlace")}>
              {[...new Set([f.clearancePlace, ...settings.clearancePlaces.map((c) => c.name)])].filter(Boolean).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sales Person">
            <Select value={f.salesPerson} onChange={str("salesPerson")}>
              {userOptions}
            </Select>
          </Field>
          <Field label="Assigned Operations Person">
            <Select value={f.operationsPerson} onChange={str("operationsPerson")}>
              {userOptions}
            </Select>
          </Field>
          <Field label="Pricing Person">
            <Select value={f.pricingPerson} onChange={str("pricingPerson")}>
              {userOptions}
            </Select>
          </Field>
          <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
            <span className="text-xs font-medium text-slate-700">Preferred Airline / Shipping Line(s)</span>
            <div className="flex flex-wrap gap-x-3 gap-y-2 rounded-lg border border-slate-200 px-3 py-2.5">
              {state.airlines.map((a) => (
                <label key={a.id} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    checked={f.preferredAirlineIds.includes(a.id)}
                    onChange={() => set("preferredAirlineIds", f.preferredAirlineIds.includes(a.id) ? f.preferredAirlineIds.filter((x) => x !== a.id) : [...f.preferredAirlineIds, a.id])}
                  />
                  {a.name}
                </label>
              ))}
            </div>
          </div>
          <Field label="Remarks" className="col-span-2 sm:col-span-3">
            <Textarea rows={2} value={f.remarks} onChange={str("remarks")} />
          </Field>
          <Field label="Recurring Shipment">
            <Select value={f.recurring ? "Yes" : "No"} disabled={!!existing} onChange={(e) => set("recurring", e.target.value === "Yes")}>
              <option>No</option>
              <option>Yes</option>
            </Select>
          </Field>
        </div>
      </Card>

      {f.recurring && !existing && (
        <Card title="Section 6 · Recurring shipment configuration">
          <div className={grid}>
            <Field label="Recurrence Type">
              <Select value={rec.type} onChange={(e) => set("recurrence", { ...rec, type: e.target.value as typeof rec.type, repeatOn: [] })}>
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </Select>
            </Field>
            <Field label="Start Date">
              <Input type="date" value={rec.startDate} onChange={(e) => set("recurrence", { ...rec, startDate: e.target.value })} />
            </Field>
            <Field label="End Date" hint="Whichever of end date and count comes first ends the series">
              <Input type="date" value={rec.endDate} onChange={(e) => set("recurrence", { ...rec, endDate: e.target.value })} />
            </Field>
            <Field label="Number of Occurrences" hint="Optional limit">
              <Input type="number" min="0" value={rec.occurrences || ""} onChange={(e) => set("recurrence", { ...rec, occurrences: Number(e.target.value) })} />
            </Field>
            {rec.type !== "Daily" && (
              <div className="col-span-2 sm:col-span-4">
                <div className="mb-1 text-xs font-medium text-slate-700">Repeat On ({rec.type === "Weekly" ? "weekdays" : "days of the month"})</div>
                <div className="flex flex-wrap gap-1.5">
                  {(rec.type === "Weekly" ? WEEKDAYS.map((d, i) => [i, d] as const) : Array.from({ length: 31 }, (_, i) => [i + 1, String(i + 1)] as const)).map(([v, label]) => {
                    const on = rec.repeatOn.includes(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("recurrence", { ...rec, repeatOn: on ? rec.repeatOn.filter((x) => x !== v) : [...rec.repeatOn, v].sort((a, b) => a - b) })}
                        className={on ? buttonCls("primary", "sm", "min-w-10") : buttonCls("secondary", "sm", "min-w-10")}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <Field label="Generation Method" hint={rec.generation === "Automatic" ? "Creates every occurrence now" : "Creates them now as drafts to confirm one by one"}>
              <Select value={rec.generation} onChange={(e) => set("recurrence", { ...rec, generation: e.target.value as typeof rec.generation })}>
                <option>Automatic</option>
                <option>Manual</option>
              </Select>
            </Field>
            <div className="col-span-2 self-end text-sm text-slate-600 sm:col-span-3">
              {dates.length ? (
                <>
                  <b>{dates.length}</b> occurrence{dates.length > 1 && "s"}: {dates.slice(0, 6).map((d) => fmtDate(d)).join(", ")}
                  {dates.length > 6 && " …"}
                </>
              ) : (
                <span className="text-amber-700">No dates match. Check the start date, end date and repeat days.</span>
              )}
            </div>
          </div>
        </Card>
      )}

      {existing?.seriesId && (
        <Card title="Apply changes to">
          <div className="flex flex-wrap gap-3 text-sm">
            {(
              [
                ["one", "This occurrence only"],
                ["future", "This and future occurrences"],
                ["series", "The entire series"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-1.5">
                <input type="radio" name="scope" className="accent-brand-600" checked={scope === v} onChange={() => setScope(v)} />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">Dates and bookings always stay per occurrence.</p>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {missing.length > 0 && <span className="mr-auto text-xs text-amber-700">To create the reservation, fill in: {missing.join(", ")}.</span>}
        <Link href={existing ? `/reservations/${existing.id}` : "/reservations"} className={buttonCls("secondary", "md")}>
          Cancel
        </Link>
        {(!existing || existing.status === "Draft") && (
          <Button variant="secondary" disabled={!f.customerId} onClick={() => submit(true)} title="Save an incomplete reservation without making it ready for booking">
            Save Draft
          </Button>
        )}
        <Button
          disabled={missing.length > 0}
          onClick={() => {
            const manualDrafts = !existing && f.recurring && rec.generation === "Manual";
            submit(manualDrafts);
          }}
        >
          {existing ? (existing.status === "Draft" ? "Create Reservation" : "Save Booking") : f.recurring && dates.length > 1 ? `Create ${dates.length} Reservations` : "Create Reservation"}
        </Button>
      </div>
    </div>
  );
}

/** Reason prompt used by reschedule, hold and cancel */
function ReasonModal({
  title,
  label,
  children,
  confirm,
  danger,
  onClose,
  onConfirm,
  extraValid = true,
}: {
  title: string;
  label: string;
  children?: React.ReactNode;
  confirm: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  extraValid?: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant={danger ? "danger" : "primary"} disabled={!reason.trim() || !extraValid} onClick={() => onConfirm(reason.trim())}>
            {confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {children}
        <Field label={`${label} *`}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function RescheduleModal({ r, onClose }: { r: Reservation; onClose: () => void }) {
  const { actions } = useStore();
  const [date, setDate] = useState(r.shipmentDate);
  return (
    <ReasonModal
      title={`Reschedule · ${r.ref}`}
      label="Reason"
      confirm="Reschedule"
      extraValid={!!date && date !== r.shipmentDate}
      onClose={onClose}
      onConfirm={(reason) => {
        actions.rescheduleReservation(r.id, date, reason);
        onClose();
      }}
    >
      <Field label="New planned date" hint={`Currently ${fmtDate(r.shipmentDate)}; the previous date and reason are kept`}>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </ReasonModal>
  );
}

export function HoldModal({ r, onClose }: { r: Reservation; onClose: () => void }) {
  const { actions } = useStore();
  return (
    <ReasonModal
      title={`Put On Hold · ${r.ref}`}
      label="Reason"
      confirm="Put On Hold"
      onClose={onClose}
      onConfirm={(reason) => {
        actions.holdReservation(r.id, reason);
        onClose();
      }}
    />
  );
}

export function CancelModal({ r, onClose }: { r: Reservation; onClose: () => void }) {
  const { actions } = useStore();
  const [scope, setScope] = useState<SeriesScope>("one");
  return (
    <ReasonModal
      title={`Cancel Reservation · ${r.ref}`}
      label="Cancellation reason"
      confirm="Cancel Reservation"
      danger
      onClose={onClose}
      onConfirm={(reason) => {
        actions.cancelReservation(r.id, reason, scope);
        onClose();
      }}
    >
      <p className="text-sm text-slate-600">The record is kept with its history; it is not deleted.</p>
      {r.seriesId && (
        <div className="flex flex-col gap-1.5 text-sm">
          {(
            [
              ["one", "This occurrence only"],
              ["future", "This and future occurrences"],
              ["series", "The entire series"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="flex items-center gap-1.5">
              <input type="radio" name="cancel-scope" className="accent-brand-600" checked={scope === v} onChange={() => setScope(v)} />
              {label}
            </label>
          ))}
        </div>
      )}
    </ReasonModal>
  );
}

/** "Initiate Carrier Booking": the prefilled booking details and the airline portal link */
export function InitiateBookingModal({ r, onClose }: { r: Reservation; onClose: () => void }) {
  const { actions } = useStore();
  const { airline, customer, portLabel } = useLookups();
  const a = airline(r.airlineId);
  const lines = [
    ["Reservation", r.ref],
    ["Customer", customer(r.customerId)?.name ?? ""],
    ["Shipper", r.shipperName],
    ["Route", `${portLabel(r.pol)} → ${portLabel(r.pod)}${r.connections.length ? ` via ${r.connections.map((c) => c.transit).join(", ")}` : ""}`],
    ["Planned date", fmtDate(r.shipmentDate)],
    ["Flight", [r.flightNo, r.flightDate && fmtDate(r.flightDate)].filter(Boolean).join(" · ") || "To be assigned"],
    ["Cargo", `${r.packages} ${r.packageType} · ${r.grossWeight} kg gross · ${r.chargeableWeight} kg chargeable`],
    ["Commodity", `${r.commodity} (${r.productType})`],
  ];
  return (
    <Modal
      open
      onClose={onClose}
      title={`Initiate Carrier Booking · ${r.ref}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {a?.portalUrl && (
            <a href={a.portalUrl} target="_blank" rel="noopener noreferrer" className={buttonCls("secondary", "md")}>
              <ExternalLink size={14} aria-hidden /> Open {a.name} portal
            </a>
          )}
          <Button
            onClick={() => {
              actions.initiateCarrierBooking(r.id);
              onClose();
            }}
          >
            Mark Booking In Progress
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">Use these details to book in the {a?.name ?? "carrier"} portal, then record the confirmation.</p>
      <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-lg bg-slate-50 p-3 text-sm">
        {lines.map(([k, v]) => [
          <dt key={`${k}k`} className="text-slate-500">
            {k}
          </dt>,
          <dd key={`${k}v`} className="font-medium text-slate-900">
            {v}
          </dd>,
        ])}
      </dl>
      <Button size="sm" variant="ghost" className="mt-2" onClick={() => navigator.clipboard?.writeText(lines.map(([k, v]) => `${k}: ${v}`).join("\n"))}>
        Copy details
      </Button>
    </Modal>
  );
}

/** "Update Booking Confirmation": carrier booking reference, confirmed flight and supporting documents */
export function BookingConfirmModal({ r, onClose }: { r: Reservation; onClose: () => void }) {
  const { actions } = useStore();
  const { airline } = useLookups();
  const [b, setB] = useState({ ref: r.booking?.ref ?? "", flightNo: r.booking?.flightNo || r.flightNo || `${airline(r.airlineId)?.code ?? ""} `, flightDate: r.booking?.flightDate || r.flightDate || r.shipmentDate });
  const [docs, setDocs] = useState<StoredDoc[]>(r.booking?.documents ?? []);
  return (
    <Modal
      open
      wide
      onClose={onClose}
      confirmClose={(b.ref.trim() !== (r.booking?.ref ?? "") || docs.length !== (r.booking?.documents.length ?? 0)) && DISCARD_CHANGES}
      title={`Update Booking Confirmation · ${r.ref}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!b.ref.trim() || !b.flightNo.trim() || !b.flightDate}
            onClick={() => {
              actions.confirmReservationBooking(r.id, { ...b, ref: b.ref.trim(), flightNo: b.flightNo.trim(), documents: docs });
              onClose();
            }}
          >
            Booking Confirmed
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Carrier booking reference *">
          <Input value={b.ref} onChange={(e) => setB({ ...b, ref: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Confirmed flight *">
          <Input value={b.flightNo} onChange={(e) => setB({ ...b, flightNo: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Flight date *">
          <Input type="date" value={b.flightDate} onChange={(e) => setB({ ...b, flightDate: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <div className="mb-1 text-xs font-medium text-slate-700">Supporting documents</div>
        <DocumentsInput titled value={docs} onChange={setDocs} />
      </div>
    </Modal>
  );
}
