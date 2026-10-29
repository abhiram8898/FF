"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, UserPlus } from "lucide-react";
import { type EnquiryInput, useStore } from "@/lib/store";
import { INCOTERMS, PRODUCT_TYPES, type Enquiry, type InboxEmail, type Port } from "@/lib/types";
import { airlinesForRoute, buildRef, fmtPort, isEnquiryLocked, ratesForRoute, today, volumeCbm, volumetricWeight } from "@/lib/utils";
import { Button, Card, Empty, Field, Fog, Input, LinkButton, PageHeader, Select, Textarea, buttonCls } from "./ui";
import { RouteInsights } from "./workflow";

/** Best-effort extraction of enquiry fields from a customer's email */
function parseEmail(email: InboxEmail, ports: Port[], packageTypes: string[]): Partial<EnquiryInput> {
  const text = email.body;
  // Ports in the order they are first mentioned (by code or by city name)
  const found = ports
    .map((p) => {
      const hits = [text.search(new RegExp(`\\b${p.code}\\b`)), text.toLowerCase().indexOf(p.name.toLowerCase())].filter((i) => i >= 0);
      return { code: p.code, at: hits.length ? Math.min(...hits) : -1 };
    })
    .filter((p) => p.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((p) => p.code);
  const weight = text.match(/(\d+(?:\.\d+)?)\s*kg/i);
  const pkgs = text.match(/(\d+)\s*(cartons|boxes|bags|pallets|crates|cases)/i);
  const dims = text.match(/(\d+)\s*x\s*(\d+)\s*x\s*(\d+)\s*cm/i);
  const commodity = text.match(/Commodity:\s*(.+)/i);
  const pkgType = pkgs && packageTypes.find((t) => t.toLowerCase().startsWith(pkgs[2].toLowerCase().slice(0, 4)));
  return {
    pol: found[0] ?? "",
    pod: found[1] ?? "",
    grossWeight: weight ? Number(weight[1]) : 0,
    chargeableWeight: weight ? Number(weight[1]) : 0,
    packages: pkgs ? Number(pkgs[1]) : 1,
    ...(pkgType && { packageType: pkgType }),
    ...(dims && { length: Number(dims[1]), width: Number(dims[2]), height: Number(dims[3]) }),
    commodity: commodity?.[1].trim() ?? "",
    remarks: `From email: ${email.subject}`,
    sourceEmailId: email.id,
  };
}

type SaveMode = "save" | "rates" | "forward";

export function EnquiryForm({ existing, email }: { existing?: Enquiry; email?: InboxEmail }) {
  const router = useRouter();
  const { state, actions } = useStore();
  const { settings } = state;
  const emailCustomer = state.customers.find((c) => c.email.toLowerCase() === email?.fromEmail.toLowerCase());
  const users = settings.users.map((u) => u.name);

  const [f, setF] = useState<EnquiryInput>(() => {
    if (existing) {
      // Strip the fields the form doesn't edit
      const rest: Partial<Enquiry> = { ...existing };
      for (const k of ["id", "no", "ref", "createdAt", "status", "statusAt", "rateRequests"] as const) delete rest[k];
      return rest as EnquiryInput;
    }
    return {
      branch: settings.branches[0]?.name ?? "",
      financialYear: settings.financialYears.at(-1)!,
      enquiryDate: today(),
      customerId: emailCustomer?.id ?? "",
      cargoMode: "Air",
      shipmentMode: "Export",
      incoterm: "FOB",
      jobType: "Forwarding",
      pol: "",
      pod: "",
      route: "Direct",
      commodity: "",
      productType: "Non-Perishable",
      packageType: settings.packageTypes[0],
      unitType: settings.unitTypes[0],
      packages: 1,
      grossWeight: 0,
      chargeableWeight: 0,
      length: 0,
      width: 0,
      height: 0,
      requestedDate: "",
      clearancePlace: settings.clearancePlaces[0],
      transitTime: "",
      airlineIds: [],
      salesPerson: users[0],
      pricingPerson: users[0],
      remarks: "",
      ...(email && parseEmail(email, state.ports, settings.packageTypes)),
    };
  });
  // Chargeable weight follows gross weight until the user edits it
  const [cwTouched, setCwTouched] = useState(!!existing);
  const [fog, setFog] = useState("");

  const set = <K extends keyof EnquiryInput>(k: K, v: EnquiryInput[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const num = (k: keyof EnquiryInput) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);

  const missing = [
    !f.customerId && "Customer",
    !f.pol && "Origin (POL)",
    !f.pod && "Destination (POD)",
    f.pol && f.pol === f.pod && "a POD different from the POL",
    !f.commodity.trim() && "Commodity",
    !(f.grossWeight > 0) && "Gross Weight",
    !(f.chargeableWeight > 0) && "Chargeable Weight",
  ].filter(Boolean) as string[];
  const valid = missing.length === 0;
  const nextRef =
    existing?.ref ??
    buildRef(settings.enquiryRef, { company: settings.refPrefix, pol: f.pol || "POL", pod: f.pod || "POD", year: f.enquiryDate.slice(0, 4), seq: state.counters.enquiry + 1 });
  const routeAirlines = f.pol && f.pod ? airlinesForRoute(state.airlines, f.pol, f.pod) : state.airlines;

  const submit = (mode: SaveMode) => {
    if (!valid) return;
    // FRD IV: with no rates in the masters, show a message and keep the user on the screen
    if (mode === "rates" && !ratesForRoute(state.rates, f.pol, f.pod, existing?.id).length) {
      setFog(`No rates updated in the masters for ${f.pol} → ${f.pod}. Use "Get Rate from Airline" to request rates, or add a rate manually from the enquiry.`);
      return;
    }
    const enq = actions.saveEnquiry(f, existing?.id);
    if (mode === "save") router.push(existing ? `/enquiries/${enq.id}` : "/enquiries");
    else router.push(`/enquiries/${enq.id}?open=${mode}`);
  };

  if (existing && isEnquiryLocked(existing)) {
    return (
      <>
        <PageHeader back={{ href: `/enquiries/${existing.id}`, label: existing.ref }} title={`Edit Enquiry · ${existing.ref}`} />
        <Empty action={<LinkButton href={`/enquiries/${existing.id}`}>Back to {existing.ref}</LinkButton>}>
          The quotation for this enquiry has been confirmed by the client ({existing.status}), so the enquiry can no longer be edited.
        </Empty>
      </>
    );
  }

  const portOptions = state.ports.map((p) => (
    <option key={p.code} value={p.code}>
      {fmtPort(p)}
    </option>
  ));
  const userOptions = users.map((u) => <option key={u}>{u}</option>);

  return (
    <>
      <PageHeader
        back={existing ? { href: `/enquiries/${existing.id}`, label: existing.ref } : { href: "/enquiries", label: "Enquiries" }}
        title={existing ? `Edit Enquiry · ${existing.ref}` : "Add Enquiry"}
        subtitle="Previous shipments and available rates are checked as you type."
      />

      {email && (
        <div className="mb-3 flex flex-wrap items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
          <Mail size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-slate-800">
              From email: {email.subject} <span className="font-normal text-slate-500">({email.fromEmail})</span>
            </div>
            <div className="text-xs text-slate-500">Fields read from the email have been pre-filled. Please review.</div>
          </div>
          {!emailCustomer && !f.customerId && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const c = actions.saveCustomer({
                  type: "Shipper/Receiver",
                  code: "",
                  name: email.body.trim().split("\n").at(-1) || email.fromName,
                  contact: email.fromName,
                  email: email.fromEmail,
                  address: "",
                  phone: "",
                  altEmails: [],
                  altPhones: [],
                  documents: [],
                });
                set("customerId", c.id);
              }}
            >
              <UserPlus size={14} /> Add sender as customer
            </Button>
          )}
        </div>
      )}

      <form
        className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]"
        onSubmit={(e) => {
          e.preventDefault();
          submit("save");
        }}
      >
        <div className="min-w-0 space-y-3">
          <Card title="Section 1 · Office selection">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Branch">
                <Select value={f.branch} onChange={(e) => set("branch", e.target.value)}>
                  {settings.branches.map((b) => (
                    <option key={b.name}>{b.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Financial Year">
                <Select value={f.financialYear} onChange={(e) => set("financialYear", e.target.value)}>
                  {settings.financialYears.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Section 2 · Customer and routing">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Enquiry ID" hint="System-generated">
                <Input value={nextRef} readOnly disabled />
              </Field>
              <Field label="Enquiry Date">
                <Input type="date" value={f.enquiryDate} onChange={(e) => set("enquiryDate", e.target.value)} required />
              </Field>
              <Field label="Customer *" className="col-span-2">
                <Select value={f.customerId} onChange={(e) => set("customerId", e.target.value)} required>
                  <option value="">Select customer</option>
                  {state.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.type}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cargo Mode">
                <Select value={f.cargoMode} onChange={(e) => set("cargoMode", e.target.value as EnquiryInput["cargoMode"])}>
                  <option>Air</option>
                  <option>Sea</option>
                </Select>
              </Field>
              <Field label="Shipment Mode">
                <Select value={f.shipmentMode} onChange={(e) => set("shipmentMode", e.target.value as EnquiryInput["shipmentMode"])}>
                  <option>Export</option>
                  <option>Import</option>
                </Select>
              </Field>
              <Field label="INCO Terms">
                <Select value={f.incoterm} onChange={(e) => set("incoterm", e.target.value as EnquiryInput["incoterm"])}>
                  {INCOTERMS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Job Type">
                <Select value={f.jobType} onChange={(e) => set("jobType", e.target.value as EnquiryInput["jobType"])}>
                  <option>Forwarding</option>
                  <option>Clearing</option>
                  <option>Both</option>
                </Select>
              </Field>
              <Field label="Origin (POL) *" className="col-span-2">
                <Select value={f.pol} onChange={(e) => set("pol", e.target.value)} required>
                  <option value="">Select origin</option>
                  {portOptions}
                </Select>
              </Field>
              <Field
                label="Destination (POD) *"
                className="col-span-2"
                hint={f.pol && f.pol === f.pod ? <span className="text-red-500">POL and POD must differ</span> : undefined}
              >
                <Select value={f.pod} onChange={(e) => set("pod", e.target.value)} required>
                  <option value="">Select destination</option>
                  {portOptions}
                </Select>
              </Field>
              <Field label="Route">
                <Input value={f.route} onChange={(e) => set("route", e.target.value)} placeholder="Direct / via DXB" />
              </Field>
            </div>
          </Card>

          <Card title="Section 3 · Cargo details">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Commodity *" className="col-span-2">
                <Input value={f.commodity} onChange={(e) => set("commodity", e.target.value)} placeholder="Cargo description" required />
              </Field>
              <Field label="Product Type">
                <Select value={f.productType} onChange={(e) => set("productType", e.target.value as EnquiryInput["productType"])}>
                  {PRODUCT_TYPES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Package Type">
                <Select value={f.packageType} onChange={(e) => set("packageType", e.target.value)}>
                  {settings.packageTypes.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Gross Weight (kg) *">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={f.grossWeight || ""}
                  onChange={(e) => {
                    const g = Number(e.target.value);
                    setF((prev) => ({ ...prev, grossWeight: g, chargeableWeight: cwTouched ? prev.chargeableWeight : g }));
                  }}
                  required
                />
              </Field>
              <Field
                label="Chargeable Weight (kg) *"
                hint={
                  volumetricWeight(f) > f.chargeableWeight ? (
                    <button type="button" className="text-brand-700 hover:underline" onClick={() => { setCwTouched(true); set("chargeableWeight", volumetricWeight(f)); }}>
                      Volumetric is {volumetricWeight(f)} kg. Use it.
                    </button>
                  ) : (
                    "Pre-populated from gross weight"
                  )
                }
              >
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={f.chargeableWeight || ""}
                  onChange={(e) => {
                    setCwTouched(true);
                    set("chargeableWeight", Number(e.target.value));
                  }}
                  required
                />
              </Field>
              <Field label="Unit Type">
                <Select value={f.unitType} onChange={(e) => set("unitType", e.target.value)}>
                  {settings.unitTypes.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Number of Packages">
                <Input type="number" min="1" value={f.packages} onChange={num("packages")} />
              </Field>
              <Field label="Length (cm)">
                <Input type="number" min="0" value={f.length || ""} onChange={num("length")} />
              </Field>
              <Field label="Width (cm)">
                <Input type="number" min="0" value={f.width || ""} onChange={num("width")} />
              </Field>
              <Field label="Height (cm)">
                <Input type="number" min="0" value={f.height || ""} onChange={num("height")} />
              </Field>
              <Field label="Volume (CBM)" hint="Packages × L × W × H">
                <Input value={volumeCbm(f).toFixed(4)} readOnly disabled />
              </Field>
              <Field label="Requested / Cargo-ready Date">
                <Input type="date" value={f.requestedDate} onChange={(e) => set("requestedDate", e.target.value)} />
              </Field>
              <Field label="Clearance Place">
                <Select value={f.clearancePlace} onChange={(e) => set("clearancePlace", e.target.value)}>
                  {settings.clearancePlaces.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Transit Time">
                <Input value={f.transitTime} onChange={(e) => set("transitTime", e.target.value)} placeholder="e.g. 1 day" />
              </Field>
              <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
                <span className="text-xs font-medium text-slate-600">Airline Name(s)</span>
                <div className="flex flex-wrap gap-x-3 gap-y-2 rounded-lg border border-slate-200 px-3 py-2.5">
                  {routeAirlines.length ? (
                    routeAirlines.map((a) => (
                      <label key={a.id} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          className="accent-brand-600"
                          checked={f.airlineIds.includes(a.id)}
                          onChange={() => set("airlineIds", f.airlineIds.includes(a.id) ? f.airlineIds.filter((x) => x !== a.id) : [...f.airlineIds, a.id])}
                        />
                        {a.name}
                      </label>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">No airline serves this route.</span>
                  )}
                </div>
                <span className="text-xs text-slate-400">Selected airlines are pre-ticked when you use Get Rate from Airline.</span>
              </div>
              <Field label="Sales Person">
                <Select value={f.salesPerson} onChange={(e) => set("salesPerson", e.target.value)}>
                  {userOptions}
                </Select>
              </Field>
              <Field label="Assigned / Pricing Person">
                <Select value={f.pricingPerson} onChange={(e) => set("pricingPerson", e.target.value)}>
                  {userOptions}
                </Select>
              </Field>
              <Field label="Remarks" className="col-span-2">
                <Textarea rows={2} value={f.remarks} onChange={(e) => set("remarks", e.target.value)} />
              </Field>
            </div>
          </Card>

          {fog && <Fog onClose={() => setFog("")}>{fog}</Fog>}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-500" aria-live="polite">
              {!valid ? (
                <span className="text-amber-700">To save, fill in: {missing.join(", ")}.</span>
              ) : existing ? (
                <>Current status: <b>{existing.status}</b></>
              ) : (
                <>
                  Status on save: <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700">New Enquiry</span>
                </>
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <Link href={existing ? `/enquiries/${existing.id}` : "/enquiries"} className={buttonCls("secondary", "md")}>
                Cancel
              </Link>
              <Button type="submit" disabled={!valid}>
                {existing ? "Save Changes" : "Save Enquiry"}
              </Button>
              <Button variant="secondary" disabled={!valid} onClick={() => submit("rates")} title="Save, then compare the rates available in the masters">
                Compare Available Rates
              </Button>
              <Button variant="secondary" disabled={!valid} onClick={() => submit("forward")} title="Save, then request a rate from airlines by email">
                Get Rate from Airline
              </Button>
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card title="Route insights">
            <RouteInsights enquiry={{ ...f, id: existing?.id }} />
          </Card>
        </aside>
      </form>
    </>
  );
}
