"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Check, CheckCircle2, History, Plane, XCircle } from "lucide-react";
import { type RateInput, useLookups, useStore } from "@/lib/store";
import { ENQUIRY_STATUSES, type AirlineRate, type Enquiry, type EnquiryStatus, type MailDraft } from "@/lib/types";
import { STEPS, addDays, airlinesForRoute, cn, currentStep, estimatedTotal, fmtDate, money, previousShipments, ratesForRoute, volumeCbm } from "@/lib/utils";
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
        <XCircle size={16} /> This enquiry is marked <b>{status}</b>. Use Change Status to reopen it.
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
              className={cn("mt-1.5 px-1 text-[11px] leading-tight", current ? "font-semibold text-brand-700" : done ? "text-slate-700" : "text-slate-400")}
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
    <div className="space-y-4">
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
              : "No rates updated in the masters for this POL & POD. Use Save & Forward to request rates from airlines."}
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

export function RateForm({
  initial,
  airlineIds,
  lockRoute,
  onSubmit,
  submitLabel = "Save rate",
  extra,
}: {
  initial: Partial<RateInput>;
  /** Restrict the airline dropdown to these ids */
  airlineIds?: string[];
  lockRoute?: boolean;
  onSubmit: (rate: RateInput) => void;
  submitLabel?: string;
  extra?: React.ReactNode;
}) {
  const { state } = useStore();
  const airlines = airlineIds ? state.airlines.filter((a) => airlineIds.includes(a.id)) : state.airlines;
  const [r, setR] = useState<RateInput>({
    airlineId: airlines[0]?.id ?? "",
    pol: "",
    pod: "",
    currency: "INR",
    ratePerKg: 0,
    awbFee: 0,
    minCharge: 0,
    transitDays: 1,
    validUntil: addDays(30),
    source: "Master",
    ...initial,
  });
  const num = (k: keyof RateInput) => (e: React.ChangeEvent<HTMLInputElement>) => setR({ ...r, [k]: Number(e.target.value) });
  const portOptions = state.ports.map((p) => (
    <option key={p.code} value={p.code}>
      {p.code} – {p.name}
    </option>
  ));

  return (
    <form
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(r);
      }}
    >
      <Field label="Airline" className="col-span-2">
        <Select value={r.airlineId} onChange={(e) => setR({ ...r, airlineId: e.target.value })} required>
          {airlines.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="POL">
        <Select value={r.pol} onChange={(e) => setR({ ...r, pol: e.target.value })} disabled={lockRoute} required>
          <option value="">Select</option>
          {portOptions}
        </Select>
      </Field>
      <Field label="POD">
        <Select value={r.pod} onChange={(e) => setR({ ...r, pod: e.target.value })} disabled={lockRoute} required>
          <option value="">Select</option>
          {portOptions}
        </Select>
      </Field>
      <Field label="Currency">
        <Select value={r.currency} onChange={(e) => setR({ ...r, currency: e.target.value })}>
          {state.settings.currencies.map((c) => (
            <option key={c.code}>{c.code}</option>
          ))}
        </Select>
      </Field>
      <Field label="Rate / kg">
        <Input type="number" step="0.01" min="0" value={r.ratePerKg} onChange={num("ratePerKg")} required />
      </Field>
      <Field label="AWB fee">
        <Input type="number" step="0.01" min="0" value={r.awbFee} onChange={num("awbFee")} />
      </Field>
      <Field label="Minimum charge">
        <Input type="number" step="0.01" min="0" value={r.minCharge} onChange={num("minCharge")} />
      </Field>
      <Field label="Transit (days)">
        <Input type="number" min="0" value={r.transitDays} onChange={num("transitDays")} />
      </Field>
      <Field label="Valid until">
        <Input type="date" value={r.validUntil} onChange={(e) => setR({ ...r, validUntil: e.target.value })} required />
      </Field>
      {extra && <div className="col-span-2 flex items-end sm:col-span-2">{extra}</div>}
      <div className="col-span-2 flex justify-end sm:col-span-4">
        <Button type="submit" disabled={!r.airlineId || !r.pol || !r.pod || r.pol === r.pod || r.ratePerKg <= 0} title={r.ratePerKg <= 0 ? "Enter the rate per kg" : undefined}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** FRD XIX/XX: "Get Rates · Compare Airline Rate Sheets" */
export function GetRatesModal({ enq, onClose, onForward }: { enq: Enquiry; onClose: () => void; onForward: () => void }) {
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
      title="Get Rates · Compare Airline Rate Sheets"
      wide
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
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
      <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50/60 p-3">
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
                    <td className="text-right tabular-nums">{r.ratePerKg.toFixed(2)}</td>
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
            *Indicative total = higher of (chargeable weight × rate/kg) or minimum charge, plus AWB fee. Other charges and taxes may apply.
          </p>
        </>
      ) : (
        <Fog>
          <div className="font-medium">No rates updated in the masters for this POL & POD.</div>
          <div className="mt-1">Forward the enquiry to airlines to request rates.</div>
          <Button size="sm" className="mt-2" onClick={onForward}>
            Save & Forward to airlines
          </Button>
        </Fog>
      )}
    </Modal>
  );
}

function rateRequestMail(enq: Enquiry, customerName: string, polLabel: string, podLabel: string, reminder = false): Omit<MailDraft, "to"> {
  return {
    cc: "",
    bcc: "",
    subject: `${reminder ? "Reminder: " : ""}Request for Air Freight Rate – ${polLabel} to ${podLabel} [${enq.ref}]`,
    body: [
      "Dear Airline / Cargo Sales Team,",
      "",
      reminder
        ? "This is a gentle reminder on our rate request below. We would appreciate your rates at the earliest."
        : "Please provide your best air freight rate for the shipment below.",
      "",
      `Enquiry Reference: ${enq.ref}`,
      `Customer: ${customerName}`,
      `Shipment Type: ${enq.shipmentMode}`,
      `Mode: ${enq.cargoMode}`,
      `POL: ${polLabel}`,
      `POD: ${podLabel}`,
      `Commodity: ${enq.commodity} (${enq.productType})`,
      `Packages: ${enq.packages} ${enq.packageType}`,
      `Gross Weight: ${enq.grossWeight} kg · Chargeable Weight: ${enq.chargeableWeight} kg`,
      `Dimensions: ${enq.length} × ${enq.width} × ${enq.height} cm · Volume: ${volumeCbm(enq)} CBM`,
      `Requested Date: ${enq.requestedDate ? fmtDate(enq.requestedDate) : "To be confirmed"}`,
      "",
      "Kindly quote the rate per kg, AWB fee, minimum charge, transit time and validity.",
    ].join("\n"),
  };
}

/** FRD VI–VIII: "Save & Forward" → Select Airlines to Request Rates → Rate Request email */
export function ForwardFlow({ enq, onClose }: { enq: Enquiry; onClose: () => void }) {
  const { state, actions } = useStore();
  const { customer, portLabel } = useLookups();
  const routeAirlines = airlinesForRoute(state.airlines, enq.pol, enq.pod);
  const airlines = routeAirlines.length ? routeAirlines : state.airlines;
  const alreadySent = enq.rateRequests.map((r) => r.airlineId);
  const [selected, setSelected] = useState<string[]>(enq.airlineIds.filter((id) => !alreadySent.includes(id)));
  const [step, setStep] = useState<"select" | "compose">("select");
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  if (step === "compose") {
    const emails = selected.map((id) => state.airlines.find((a) => a.id === id)!.email);
    return (
      <ComposeEmail
        title="Rate Request"
        initial={{ to: emails, ...rateRequestMail(enq, customer(enq.customerId)?.name ?? "", portLabel(enq.pol), portLabel(enq.pod)) }}
        note={
          selected.length > 1 && (
            <p className="text-xs text-slate-500">One rate per mail: a separate email is sent to each of the {selected.length} airlines.</p>
          )
        }
        onClose={onClose}
        onSend={(mail) => {
          actions.sendRateRequest(enq.id, selected, mail);
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
          ? `${selected.length} airline${selected.length > 1 ? "s" : ""} selected.`
          : "No airline selected. Choose the airline(s) to receive this enquiry."}
      </p>
      <h3 className="mb-2 text-xs font-semibold text-slate-500 uppercase">Airlines {routeAirlines.length ? `serving ${enq.pol} → ${enq.pod}` : ""}</h3>
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
        <Empty>No airlines in the master.</Empty>
      )}
    </Modal>
  );
}

/** FRD XII–XIII: Send Reminder to one or more airlines, through the same mail box pop-up */
export function ReminderFlow({ enq, airlineIds, onClose }: { enq: Enquiry; airlineIds: string[]; onClose: () => void }) {
  const { state, actions } = useStore();
  const { customer, portLabel } = useLookups();
  const [selected, setSelected] = useState(airlineIds);
  const [step, setStep] = useState<"select" | "compose">(airlineIds.length === 1 ? "compose" : "select");
  const pending = enq.rateRequests.filter((r) => !r.repliedAt);

  if (step === "compose") {
    return (
      <ComposeEmail
        title="Send Reminder"
        initial={{
          to: selected.map((id) => state.airlines.find((a) => a.id === id)!.email),
          ...rateRequestMail(enq, customer(enq.customerId)?.name ?? "", portLabel(enq.pol), portLabel(enq.pod), true),
        }}
        onClose={onClose}
        onSend={(mail) => {
          actions.sendRateReminder(enq.id, selected, mail);
          onClose();
        }}
      />
    );
  }

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
