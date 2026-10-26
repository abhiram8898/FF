"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Printer } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Awb, Job } from "@/lib/types";
import { fmtDate, money, quoteTotals } from "@/lib/utils";
import { Button, Card, Empty, Field, Input, KeyValue, PageHeader, Select, Textarea, linkCls } from "@/components/ui";

export default function ShipmentPage() {
  const { id } = useParams<{ id: string }>();
  const { job } = useLookups();
  const j = job(id);
  if (!j) {
    return (
      <Empty action={<Link href="/shipments" className={linkCls}>Back to Shipments</Link>}>
        This shipment doesn&apos;t exist. It may have been removed when the demo data was reset.
      </Empty>
    );
  }
  return <ShipmentView key={j.id} job={j} />;
}

function ShipmentView({ job }: { job: Job }) {
  const { enquiry, customer, quotation, airline, portLabel } = useLookups();
  const enq = enquiry(job.enquiryId)!;
  const q = quotation(job.quotationId);

  return (
    <>
      <PageHeader
        back={{ href: "/shipments", label: "Shipments" }}
        title={job.ref}
        subtitle={
          <>
            From{" "}
            <Link href={`/enquiries/${enq.id}`} className={linkCls}>
              {enq.ref}
            </Link>{" "}
            /{" "}
            <Link href={`/quotations/${q?.id}`} className={linkCls}>
              {q?.ref}
            </Link>{" "}
            · created {fmtDate(job.createdAt)}
          </>
        }
        actions={
          job.awb && (
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={15} /> Print AWB
            </Button>
          )
        }
      />
      <Card title="Shipment summary" className="no-print mb-6">
        <KeyValue
          items={[
            ["Customer", customer(enq.customerId)?.name],
            ["Carrier", airline(q?.airlineId)?.name],
            ["POL", portLabel(enq.pol)],
            ["POD", portLabel(enq.pod)],
            ["Shipment date", fmtDate(enq.shipmentDate)],
            ["Booking ref", enq.booking?.ref],
            ["Flight", enq.booking ? `${enq.booking.flightNo} · ${fmtDate(enq.booking.flightDate)}` : ""],
            ["Invoice", enq.docs?.invoiceNo],
            ["Packages", `${enq.packages} ${enq.packageType}`],
            ["Chargeable weight", `${enq.chargeableWeight} kg`],
            ["Quoted total", q ? money(quoteTotals(q).grand) : ""],
          ]}
        />
      </Card>
      {job.awb ? <AwbDocument job={job} /> : <AwbForm job={job} />}
    </>
  );
}

function AwbForm({ job }: { job: Job }) {
  const { actions } = useStore();
  const { enquiry, customer, quotation, airline } = useLookups();
  const enq = enquiry(job.enquiryId)!;
  const cust = customer(enq.customerId);
  const al = airline(quotation(job.quotationId)?.airlineId);

  const [a, setA] = useState<Awb>(() => ({
    type: "Master",
    // MAWB numbers are the airline's 3-digit prefix + 8-digit serial
    number: `${al?.prefix ?? "000"}-${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
    issuedAt: new Date().toISOString().slice(0, 10),
    shipper: [cust?.name, cust?.address].filter(Boolean).join("\n"),
    consignee: "",
    flightNo: enq.booking?.flightNo ?? "",
    flightDate: enq.booking?.flightDate ?? "",
    pieces: enq.packages,
    grossWeight: enq.grossWeight,
    chargeableWeight: enq.chargeableWeight,
    rateClass: "Q",
    natureOfGoods: `${enq.commodity}\n${enq.packages} ${enq.packageType}${enq.length ? ` · DIMS ${enq.length}x${enq.width}x${enq.height} CM` : ""}`,
    handlingInfo: enq.productType === "Perishable" ? "PERISHABLE – KEEP FROZEN" : enq.productType === "Dangerous Cargo" ? "DANGEROUS GOODS – SEE SHIPPER'S DECLARATION" : "",
  }));
  const str = (k: keyof Awb) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setA({ ...a, [k]: e.target.value });
  const num = (k: keyof Awb) => (e: React.ChangeEvent<HTMLInputElement>) => setA({ ...a, [k]: Number(e.target.value) });

  return (
    <Card title="Create Air Waybill (AWB)">
      <form
        className="grid grid-cols-2 gap-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          actions.createAwb(job.id, a);
        }}
      >
        <Field label="AWB type" hint={a.type === "Master" ? "Issued by the airline" : "Issued by the agent for shared cargo"}>
          <Select value={a.type} onChange={(e) => setA({ ...a, type: e.target.value as Awb["type"] })}>
            <option value="Master">Master AWB (MAWB)</option>
            <option value="House">House AWB (HAWB)</option>
          </Select>
        </Field>
        <Field label={a.type === "Master" ? "MAWB number" : "HAWB number"} hint={a.type === "Master" ? `${al?.name ?? "Airline"} prefix ${al?.prefix ?? ""}` : "Your own house serial"}>
          <Input
            value={a.number}
            onChange={str("number")}
            required
            pattern={a.type === "Master" ? "\\d{3}-\\d{8}" : undefined}
            title={a.type === "Master" ? "Format: 3-digit airline prefix, a hyphen, then 8 digits (e.g. 176-12345678)" : undefined}
          />
        </Field>
        <Field label="Flight no.">
          <Input value={a.flightNo} onChange={str("flightNo")} required />
        </Field>
        <Field label="Flight date">
          <Input type="date" value={a.flightDate} onChange={str("flightDate")} required />
        </Field>
        <Field label="Shipper" className="col-span-2">
          <Textarea rows={3} value={a.shipper} onChange={str("shipper")} required />
        </Field>
        <Field label="Consignee *" className="col-span-2">
          <Textarea rows={3} value={a.consignee} onChange={str("consignee")} placeholder="Name and address" required />
        </Field>
        <Field label="Pieces">
          <Input type="number" value={a.pieces} onChange={num("pieces")} />
        </Field>
        <Field label="Gross weight (kg)">
          <Input type="number" value={a.grossWeight} onChange={num("grossWeight")} />
        </Field>
        <Field label="Chargeable weight (kg)">
          <Input type="number" value={a.chargeableWeight} onChange={num("chargeableWeight")} />
        </Field>
        <Field label="Rate class">
          <Input value={a.rateClass} onChange={str("rateClass")} />
        </Field>
        <Field label="Nature & quantity of goods" className="col-span-2">
          <Textarea rows={3} value={a.natureOfGoods} onChange={str("natureOfGoods")} />
        </Field>
        <Field label="Handling information" className="col-span-2">
          <Textarea rows={3} value={a.handlingInfo} onChange={str("handlingInfo")} />
        </Field>
        <Field label="Issue date">
          <Input type="date" value={a.issuedAt} onChange={str("issuedAt")} />
        </Field>
        <div className="col-span-2 flex items-end justify-end sm:col-span-3">
          <Button type="submit">Create AWB</Button>
        </div>
      </form>
    </Card>
  );
}

function AwbDocument({ job }: { job: Job }) {
  const { state } = useStore();
  const { enquiry, quotation, airline } = useLookups();
  const awb = job.awb!;
  const enq = enquiry(job.enquiryId)!;
  const al = airline(quotation(job.quotationId)?.airlineId);
  const box = "border border-slate-400 p-2";
  const label = "block text-[10px] text-slate-500 uppercase";

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 font-mono text-xs text-slate-900 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-bold">{awb.number}</span>
        <span className="font-sans text-sm font-semibold">
          {awb.type === "Master" ? "Master Air Waybill" : "House Air Waybill"} · {al?.name}
        </span>
      </div>
      <div className="grid grid-cols-2">
        <div className={box}>
          <span className={label}>Shipper</span>
          <pre className="whitespace-pre-wrap">{awb.shipper}</pre>
        </div>
        <div className={box}>
          <span className={label}>Issued by</span>
          {awb.type === "Master" ? `${al?.name}, through ${state.settings.company.name}` : state.settings.company.name}
        </div>
        <div className={box}>
          <span className={label}>Consignee</span>
          <pre className="whitespace-pre-wrap">{awb.consignee}</pre>
        </div>
        <div className={box}>
          <span className={label}>Accounting information</span>
          {job.ref} · Booking {enq.booking?.ref ?? "—"}
        </div>
        <div className={box}>
          <span className={label}>Airport of departure</span>
          {enq.pol}
        </div>
        <div className={box}>
          <span className={label}>Airport of destination</span>
          {enq.pod}
        </div>
        <div className={box}>
          <span className={label}>Flight / Date</span>
          {awb.flightNo} / {fmtDate(awb.flightDate)}
        </div>
        <div className={box}>
          <span className={label}>Handling information</span>
          {awb.handlingInfo || "—"}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr className="[&>th]:border [&>th]:border-slate-400 [&>th]:p-1.5 [&>th]:text-left [&>th]:text-[10px] [&>th]:font-normal [&>th]:text-slate-500 [&>th]:uppercase">
              <th>Pieces</th>
              <th>Gross wt (kg)</th>
              <th>Rate class</th>
              <th>Chargeable wt</th>
              <th>Nature &amp; quantity of goods</th>
            </tr>
          </thead>
          <tbody>
            <tr className="[&>td]:border [&>td]:border-slate-400 [&>td]:p-1.5 [&>td]:align-top">
              <td>{awb.pieces}</td>
              <td>{awb.grossWeight}</td>
              <td>{awb.rateClass}</td>
              <td>{awb.chargeableWeight}</td>
              <td>
                <pre className="whitespace-pre-wrap">{awb.natureOfGoods}</pre>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-between text-[10px] text-slate-500">
        <span>Executed on {fmtDate(awb.issuedAt)}</span>
        <span>Signature of issuing carrier or its agent</span>
      </div>
    </div>
  );
}
