"use client";

/* eslint-disable @next/next/no-img-element -- logos are user-uploaded data URLs */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Eye, Plus, Send, Stamp, Trash2, XCircle } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import { BILL_STATUSES, type Bill, type BillLine, type BillStatus } from "@/lib/types";
import { BILL_TONE, amountInWordsIndian, bankLabel, billBank, billLineRate, billLineTax, billLineValue, billTotals, f2, fmtDate, isBillLocked, omit, round2, today, uid } from "@/lib/utils";
import { ComposeEmail } from "./ComposeEmail";
import { FooterBanner } from "./letterhead";
import { Badge, Button, Card, Field, Input, LinkButton, Modal, SectionTitle, Select, Textarea, useUnsavedChanges } from "./ui";

const fmtDmy = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

export const BILL_HEADING: Record<Bill["kind"], string> = {
  Proforma: "PROFORMA INVOICE",
  Invoice: "TAX INVOICE",
  "Credit Note": "CREDIT NOTE",
};

/** "Rupees Three Lakhs … Only" for the printed bill */
export const billInWords = (total: number) => `${amountInWordsIndian(total)} Only`;

/** Overdue: the due date has passed with money still to receive */
export const isOverdue = (b: Bill) => b.kind === "Invoice" && !!b.dueDate && b.dueDate < today() && billTotals(b).balance > 0 && !["Paid", "Cancelled"].includes(b.status);

/** Printable proforma / tax invoice / credit note, laid out like the company's samples */
export function BillDocument({ bill: b }: { bill: Bill }) {
  const { state } = useStore();
  const c = state.settings.company;
  const bank = billBank(state.settings, b.bankId);
  const t = billTotals(b);
  const igst = b.taxMode === "IGST";
  const box = "rounded-lg border border-slate-500 p-2";
  const kv = (rows: [string, React.ReactNode][]) => (
    <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5">
      {rows.map(([k, v]) => [
        <dt key={`${k}k`} className="font-bold">
          {k}
        </dt>,
        <dd key={`${k}v`}>: {v}</dd>,
      ])}
    </dl>
  );
  const th = "border border-slate-500 px-1.5 py-1 text-center font-bold";
  const td = "border-x border-slate-500 px-1.5 py-0.5";

  return (
    <div className="doc-sheet bg-white font-serif text-[0.6875rem] text-slate-900">
      <div className="mb-2 grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3">
        <div>{c.logo && <img src={c.logo} alt="" className="max-h-16 max-w-full object-contain" />}</div>
        <div className="text-center">
          <div className="text-base font-bold uppercase">{c.name}</div>
          <div>
            {c.address}, {c.city} – {c.postalCode}
          </div>
          <div>
            Ph: {c.phone} Email: {c.email}
          </div>
          <div>
            STATE: {c.state.toUpperCase()} / GSTIN: {c.gstin} / PAN NO: {c.pan}
          </div>
        </div>
      </div>
      <div className="mb-2 bg-navy-800 py-1 text-center text-sm font-bold text-white">{BILL_HEADING[b.kind]}</div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-2">
          <div className={box}>
            <span className="font-bold">To M/s. </span>
            <pre className="inline font-serif whitespace-pre-wrap">{b.to}</pre>
          </div>
          <div className={box}>
            {kv([
              ["Exporter", b.exporter.split("\n")[0]],
              ["Consignee", b.consignee],
            ])}
          </div>
        </div>
        <div className="space-y-2">
          <div className={box}>
            {kv([
              [b.kind === "Proforma" ? "Proforma No" : b.kind === "Credit Note" ? "Credit Note No" : "Invoice No", <b key="no">{b.no}</b>],
              [b.kind === "Proforma" ? "Proforma Date" : "Date", fmtDmy(b.date)],
            ])}
          </div>
          <div className={box}>
            {kv([
              ["MAWBL No/Date", [b.mawbNo, fmtDmy(b.mawbDate)].filter(Boolean).join(" / ")],
              ["HAWBL No/Date", [b.hawbNo, fmtDmy(b.hawbDate)].filter(Boolean).join(" / ")],
              ["POL", b.pol],
              ["POD", b.pod],
              ["Shipment Type", b.shipmentType],
              ["Airline & Flight No", b.airlineFlight],
              ["ETD / ETA", [fmtDmy(b.etd), fmtDmy(b.eta)].filter(Boolean).join(" / ")],
              ["Description", b.commodity],
              ...(b.scientificName ? ([["Scientific Name", b.scientificName]] as [string, string][]) : []),
            ])}
          </div>
        </div>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-center">
          <thead>
            <tr>
              {["Job No", "Job Date", "SB No", "SB Date", "Invoice No", "Invoice Date", "Gross Weight", "CH.WT", "Packages"].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="[&>td]:border [&>td]:border-slate-500 [&>td]:px-1.5 [&>td]:py-1">
              <td>{b.jobNo}</td>
              <td>{fmtDmy(b.jobDate)}</td>
              <td>{b.sbNo}</td>
              <td>{fmtDmy(b.sbDate)}</td>
              <td>{b.invoiceNo}</td>
              <td>{fmtDmy(b.invoiceDate)}</td>
              <td>{f2(b.grossWeight)}</td>
              <td>{f2(b.chWeight)}</td>
              <td>{b.packages}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse">
          <thead>
            <tr>
              <th rowSpan={2} className={th}>
                S.No
              </th>
              <th rowSpan={2} className={th}>
                Particulars
              </th>
              <th rowSpan={2} className={th}>
                SAC
              </th>
              <th rowSpan={2} className={th}>
                Qty
              </th>
              <th rowSpan={2} className={th}>
                Rate
              </th>
              <th rowSpan={2} className={th}>
                Cur
              </th>
              <th rowSpan={2} className={th}>
                Ex. Rate
              </th>
              <th rowSpan={2} className={th}>
                Taxable Value
              </th>
              <th rowSpan={2} className={th}>
                Non Taxable Value
              </th>
              {igst ? (
                <th colSpan={2} className={th}>
                  IGST
                </th>
              ) : (
                <>
                  <th colSpan={2} className={th}>
                    SGST
                  </th>
                  <th colSpan={2} className={th}>
                    CGST
                  </th>
                </>
              )}
              <th rowSpan={2} className={th}>
                Total
              </th>
            </tr>
            <tr>
              {(igst ? [1] : [1, 2]).flatMap((k) => [
                <th key={`r${k}`} className={th}>
                  Rate (%)
                </th>,
                <th key={`a${k}`} className={th}>
                  Amount
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {b.lines.map((l, i) => {
              const v = billLineValue(l);
              const tax = billLineTax(l, b.gstPercent);
              return (
                <tr key={l.id} className="tabular-nums">
                  <td className={`${td} text-center`}>{i + 1}</td>
                  <td className={td}>{l.particulars}</td>
                  <td className={`${td} text-center`}>{l.sac}</td>
                  <td className={`${td} text-right`}>{l.qty.toFixed(3)}</td>
                  <td className={`${td} text-right`}>{f2(l.rate)}</td>
                  <td className={`${td} text-center`}>{l.currency}</td>
                  <td className={`${td} text-right`}>{f2(l.exRate)}</td>
                  <td className={`${td} text-right`}>{l.taxable ? f2(v) : "0.00"}</td>
                  <td className={`${td} text-right`}>{l.taxable ? "0.00" : f2(v)}</td>
                  {igst ? (
                    <>
                      <td className={`${td} text-right`}>{f2(billLineRate(l, b.gstPercent))}</td>
                      <td className={`${td} text-right`}>{f2(tax)}</td>
                    </>
                  ) : (
                    <>
                      <td className={`${td} text-right`}>{f2(billLineRate(l, b.gstPercent) / 2)}</td>
                      <td className={`${td} text-right`}>{f2(round2(tax / 2))}</td>
                      <td className={`${td} text-right`}>{f2(billLineRate(l, b.gstPercent) / 2)}</td>
                      <td className={`${td} text-right`}>{f2(round2(tax - round2(tax / 2)))}</td>
                    </>
                  )}
                  <td className={`${td} text-right`}>{f2(round2(v + tax))}</td>
                </tr>
              );
            })}
            <tr className="h-8">
              <td colSpan={igst ? 12 : 14} className="border-x border-b border-slate-500" />
            </tr>
            <tr className="font-bold tabular-nums [&>td]:border [&>td]:border-slate-500 [&>td]:px-1.5 [&>td]:py-1">
              <td colSpan={7} className="text-right">
                Total
              </td>
              <td className="text-right">{f2(t.taxable)}</td>
              <td className="text-right">{f2(t.nonTaxable)}</td>
              {igst ? (
                <td colSpan={2} className="text-right">
                  {f2(t.igst)}
                </td>
              ) : (
                <>
                  <td colSpan={2} className="text-right">
                    {f2(t.sgst)}
                  </td>
                  <td colSpan={2} className="text-right">
                    {f2(t.cgst)}
                  </td>
                </>
              )}
              <td className="text-right">{f2(t.exact)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_14rem] gap-2">
        <div className={box}>
          <b>Amount in Words :</b> {billInWords(t.total)}
        </div>
        <div className={`${box} tabular-nums`}>
          <div className="flex justify-between font-bold">
            <span>Round Off</span>
            <span>{f2(t.roundOff)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-400 pt-1 font-bold">
            <span>Total Amount</span>
            <span>{f2(t.total)}</span>
          </div>
        </div>
      </div>
      {b.notes && (
        <div className={`${box} mt-2`}>
          <b>Notes:</b>
          <pre className="font-serif whitespace-pre-wrap">{b.notes}</pre>
        </div>
      )}
      {bank && (
        <div className={`${box} mt-2 w-fit min-w-72`}>
          <b className="underline">Bank Details :</b>
          {kv([
            ["BANK NAME", `${bank.bankName} ${bank.bankCity}`.toUpperCase()],
            ["BRANCH NAME", bank.bankBranch.toUpperCase()],
            ["A/C No", bank.accountNo],
            ["IFS Code", bank.ifsc],
            ...(bank.swift ? ([["SWIFT", bank.swift]] as [string, string][]) : []),
          ])}
        </div>
      )}
      <p className="mt-2 text-center font-bold">This invoice is system generated and does not require any stamp or signature</p>
      <FooterBanner />
    </div>
  );
}

/** Email the bill: a proforma goes for the customer's confirmation (→ Proforma INV Send) */
export function SendBillFlow({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const { state, actions } = useStore();
  const { customer } = useLookups();
  const c = customer(bill.customerId);
  const t = billTotals(bill);
  const what = bill.kind === "Proforma" ? "proforma invoice" : bill.kind === "Credit Note" ? "credit note" : "invoice";
  return (
    <ComposeEmail
      title={`Send ${BILL_HEADING[bill.kind].toLowerCase()} · ${bill.no}`}
      initial={{
        to: c ? [c.email, ...c.altEmails].filter(Boolean) : [],
        cc: state.settings.company.email,
        subject: `${BILL_HEADING[bill.kind]} ${bill.no} – Job ${bill.jobNo}`,
        body: `Dear ${c?.contact || "Sir / Madam"},\n\nPlease find attached our ${what} ${bill.no} for job ${bill.jobNo} (${bill.pol} → ${bill.pod}, MAWB ${bill.mawbNo || "—"}).\n\nTotal Amount: INR ${f2(t.total)}${bill.kind === "Proforma" ? "\n\nKindly confirm so that we can raise the final invoice." : bill.dueDate && bill.kind === "Invoice" ? `\nDue date: ${fmtDate(bill.dueDate)}` : ""}`,
      }}
      attachments={[`${bill.no}.pdf`]}
      onClose={onClose}
      onSend={(mail) => {
        actions.sendBill(bill.id, mail);
        onClose();
      }}
    />
  );
}

/** Preview with Back (to the invoice or credit note) & Send, plus Approve (proforma) or Issue (credit note) */
export function BillPreviewModal({ bill, onClose, unsaved }: { bill: Bill; onClose: () => void; unsaved?: boolean }) {
  const router = useRouter();
  const { actions } = useStore();
  const [sending, setSending] = useState(false);
  if (sending) return <SendBillFlow bill={bill} onClose={() => setSending(false)} />;
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`${BILL_HEADING[bill.kind]} · ${bill.no}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Badge className={BILL_TONE[bill.status]}>{bill.status}</Badge>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onClose}>
              Back to {bill.kind === "Credit Note" ? "Credit Note" : "Invoice"}
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print / Save PDF
            </Button>
            {bill.status !== "Cancelled" && (
              <Button variant={bill.kind === "Proforma" && bill.status === "Proforma INV Send" ? "secondary" : "primary"} disabled={unsaved} title={unsaved ? "Save your changes first" : undefined} onClick={() => setSending(true)}>
                <Send size={14} aria-hidden /> Send
              </Button>
            )}
            {bill.kind === "Proforma" && (bill.status === "Draft" || bill.status === "Proforma INV Send") && (
              <Button
                disabled={unsaved}
                onClick={() => {
                  const inv = actions.approveProforma(bill.id);
                  onClose();
                  router.push(`/billing/${inv.id}`);
                }}
              >
                <CheckCircle2 size={14} aria-hidden /> Approve
              </Button>
            )}
            {bill.kind === "Credit Note" && bill.status === "Draft" && (
              <Button
                disabled={unsaved}
                onClick={() => {
                  actions.issueCreditNote(bill.id);
                  onClose();
                }}
              >
                <Stamp size={14} aria-hidden /> Issue
              </Button>
            )}
          </div>
        </div>
      }
    >
      <BillDocument bill={bill} />
    </Modal>
  );
}

/** Invoice status change; Partially Paid / Paid record the amount received */
export function BillStatusModal({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const { actions } = useStore();
  const t = billTotals(bill);
  const [status, setStatus] = useState<BillStatus>(bill.status);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const paying = status === "Partially Paid" || status === "Paid";
  // Paid needs the whole balance received; Partially Paid needs some of it
  const short = status === "Paid" && t.received + amount < t.total - 0.005;
  const over = amount > t.balance + 0.005;
  const problem = over
    ? `More than the balance of INR ${f2(t.balance)}`
    : short
      ? `Enter the remaining INR ${f2(t.balance)} to mark it Paid`
      : status === "Partially Paid" && !(amount > 0)
        ? "Enter the amount received"
        : "";
  return (
    <Modal
      open
      onClose={onClose}
      title={`Change status · ${bill.no}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={(status === bill.status && !(paying && amount > 0)) || (paying && !!problem)}
            onClick={() => {
              if (status === "Cancelled") {
                if (!window.confirm(`Cancel ${bill.no}? A credit note will be created.`)) return;
                actions.cancelBill(bill.id);
              } else if (!actions.setBillStatus(bill.id, status, paying ? { amount, note } : undefined)) return;
              onClose();
            }}
          >
            Update
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Total INR {f2(t.total)} · received INR {f2(t.received)} · balance <b>INR {f2(t.balance)}</b>
        </p>
        <Field label="Status">
          <Select
            value={status}
            onChange={(e) => {
              const next = e.target.value as BillStatus;
              setStatus(next);
              // Paid: suggest the outstanding balance
              if (next === "Paid" && !amount) setAmount(t.balance);
            }}
          >
            {BILL_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        {paying && (
          <div className="grid grid-cols-1 max-xs:*:col-span-full xs:grid-cols-2 gap-3">
            <Field label="Amount received (INR)">
              <Input type="number" min="0" step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} aria-invalid={!!problem} />
            </Field>
            <Field label="Reference / note">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. NEFT ref" />
            </Field>
            {problem && <p className="col-span-2 text-xs text-red-600">{problem}</p>}
          </div>
        )}
        {bill.payments.length > 0 && (
          <ul className="space-y-1 text-xs text-slate-600">
            {bill.payments.map((p) => (
              <li key={p.id}>
                {fmtDate(p.at)} · INR {f2(p.amount)} {p.note && `· ${p.note}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/** Edit screen for a proforma, invoice or credit note (FRD X.6 a–ll) */
export function BillEditor({ bill }: { bill: Bill }) {
  const router = useRouter();
  const { state, actions } = useStore();
  const [b, setB] = useState<Bill>(bill);
  const [dialog, setDialog] = useState<"preview" | "status" | null>(null);
  const set = <K extends keyof Bill>(k: K, v: Bill[K]) => setB((x) => ({ ...x, [k]: v }));
  const str = (k: keyof Bill) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);
  const num = (k: keyof Bill) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);
  const setLine = (id: string, patch: Partial<BillLine>) => set("lines", b.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const t = billTotals(b);
  // Status, sending and payments are changed by actions, not by this form, so they don't count as edits
  const fields = (x: Bill) => omit(x, ["status", "statusAt", "sentAt", "payments"]);
  const dirty = JSON.stringify(fields(b)) !== JSON.stringify(fields(bill));
  useUnsavedChanges(dirty);
  const locked = isBillLocked(bill);
  // An issued invoice is final except for its due date
  const dueDateEditable = bill.kind === "Invoice" && bill.status !== "Cancelled";
  const sign = bill.kind === "Credit Note" ? -1 : 1;
  const grid = "grid grid-cols-1 max-xs:*:col-span-full xs:grid-cols-2 gap-3 sm:grid-cols-4";
  const save = () => actions.saveBill(b.id, fields(b));
  // Settings → Ref Number Format: with automatic generation off the number can be typed while it's a draft
  const manualNo = !state.settings.invoiceRef.auto && b.status === "Draft" && b.kind !== "Credit Note";

  return (
    <div className="space-y-3">
      <datalist id="bill-particulars">
        {state.settings.agencyCharges.map((c) => (
          <option key={c.particulars} value={c.particulars} />
        ))}
        <option value="AIR FREIGHT CHARGES" />
        <option value="AIRWAY BILL FEES- AWA" />
        <option value="DOCUMENTATION CHARGES" />
        <option value="AGENCY CHARGES" />
      </datalist>
      <datalist id="bill-sac">
        {state.settings.sacCodes.map((c) => (
          <option key={c.id} value={c.code}>
            {c.short}
          </option>
        ))}
      </datalist>

      <Card>
        <SectionTitle>{BILL_HEADING[b.kind]}</SectionTitle>
        <fieldset disabled={locked} className={grid}>
          <Field label={b.kind === "Proforma" ? "Proforma INV Number" : b.kind === "Credit Note" ? "CN Number" : "Invoice Number"}>
            <Input value={b.no} readOnly={!manualNo} disabled={!manualNo} onChange={(e) => set("no", e.target.value.toUpperCase())} className="font-mono" />
          </Field>
          <Field label="Date">
            <Input type="date" value={b.date} onChange={str("date")} />
          </Field>
          <Field label="Job Number">
            <Input value={b.jobNo} readOnly disabled className="font-mono" />
          </Field>
          <Field label="Job Date">
            <Input type="date" value={b.jobDate} onChange={str("jobDate")} />
          </Field>
          <Field label="MAWBL No">
            <Input value={b.mawbNo} onChange={str("mawbNo")} />
          </Field>
          <Field label="MAWBL Date">
            <Input type="date" value={b.mawbDate} onChange={str("mawbDate")} />
          </Field>
          <Field label="HAWBL No">
            <Input value={b.hawbNo} onChange={str("hawbNo")} />
          </Field>
          <Field label="HAWBL Date">
            <Input type="date" value={b.hawbDate} onChange={str("hawbDate")} />
          </Field>
          <Field label="POL">
            <Input value={b.pol} onChange={str("pol")} />
          </Field>
          <Field label="POD">
            <Input value={b.pod} onChange={str("pod")} />
          </Field>
          <Field label="Shipment Type">
            <Input value={b.shipmentType} onChange={str("shipmentType")} />
          </Field>
          <Field label="Airline / Flight No">
            <Input value={b.airlineFlight} onChange={str("airlineFlight")} />
          </Field>
          <Field label="ETD">
            <Input type="date" value={b.etd} onChange={str("etd")} />
          </Field>
          <Field label="ETA">
            <Input type="date" value={b.eta} onChange={str("eta")} />
          </Field>
          <Field label="Commodity">
            <Input value={b.commodity} onChange={str("commodity")} />
          </Field>
          <Field label="Scientific Name" hint="Botanical name, e.g. for fresh produce">
            <Input value={b.scientificName ?? ""} onChange={str("scientificName")} />
          </Field>
          <Field label="To (customer name & address)" className="col-span-2">
            <Textarea rows={4} value={b.to} onChange={str("to")} />
          </Field>
          <Field label="Exporter (shipper name & address)" className="col-span-2">
            <Textarea rows={4} value={b.exporter} onChange={str("exporter")} />
          </Field>
          <Field label="Consignee" className="col-span-2">
            <Input value={b.consignee} onChange={str("consignee")} />
          </Field>
          <Field label="SB No" hint="Shipping bill number">
            <Input value={b.sbNo} onChange={str("sbNo")} />
          </Field>
          <Field label="SB Date">
            <Input type="date" value={b.sbDate} onChange={str("sbDate")} />
          </Field>
          <Field label="Invoice No" hint="Customer invoice number">
            <Input value={b.invoiceNo} onChange={str("invoiceNo")} />
          </Field>
          <Field label="Invoice Date">
            <Input type="date" value={b.invoiceDate} onChange={str("invoiceDate")} />
          </Field>
          <Field label="Gross Weight">
            <Input type="number" min="0" step="0.01" value={b.grossWeight} onChange={num("grossWeight")} />
          </Field>
          <Field label="CH. WT">
            <Input type="number" min="0" step="0.01" value={b.chWeight} onChange={num("chWeight")} />
          </Field>
          <Field label="Packages">
            <Input type="number" min="0" value={b.packages} onChange={num("packages")} />
          </Field>
        </fieldset>
        {b.kind === "Invoice" && (
          <div className={`${grid} mt-3`}>
            <Field label="Due date" hint="Can still be changed on an issued invoice">
              <Input type="date" value={b.dueDate} disabled={!dueDateEditable} onChange={str("dueDate")} />
            </Field>
          </div>
        )}
      </Card>

      <Card
        title="Particulars"
        actions={
          !locked && (
            <Button size="sm" variant="secondary" onClick={() => set("lines", [...b.lines, { id: uid(), particulars: "", sac: "996712", qty: 1, rate: 0, currency: "INR", exRate: 1, taxable: true, gstPercent: b.gstPercent }])}>
              <Plus size={13} aria-hidden /> Add from Agency Service Charges
            </Button>
          )
        }
      >
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field label="GST" className="w-72" hint="IGST 18% only, or SGST 9% + CGST 9%">
            <Select
              value={b.taxMode}
              disabled={locked}
              onChange={(e) => set("taxMode", e.target.value as Bill["taxMode"])}
            >
              <option value="IGST">IGST (the full rate of each line)</option>
              <option value="CGST+SGST">
                SGST + CGST (each half of the line rate)
              </option>
            </Select>
          </Field>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                <th>#</th>
                <th className="w-[26%]">Particulars</th>
                <th>SAC</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Currency</th>
                <th>Ex. Rate</th>
                <th>GST %</th>
                <th className="text-right">Value (INR)</th>
                <th className="text-right">GST</th>
                <th>
                <span className="sr-only">Remove</span>
              </th>
              </tr>
            </thead>
            <tbody>
              {b.lines.map((l, i) => (
                <tr key={l.id} className="border-t border-slate-100 [&>td]:px-2 [&>td]:py-1.5">
                  <td className="text-slate-500">{i + 1}</td>
                  <td>
                    <Input
                      aria-label="Particulars"
                      list="bill-particulars"
                      value={l.particulars}
                      disabled={locked}
                      onChange={(e) => {
                        const particulars = e.target.value.toUpperCase();
                        const charge = state.settings.agencyCharges.find((c) => c.particulars === particulars);
                        setLine(l.id, { particulars, ...(charge && { sac: charge.sac, rate: sign * charge.rate }) });
                      }}
                    />
                  </td>
                  <td>
                    <Input aria-label="SAC" list="bill-sac" className="w-24" value={l.sac} disabled={locked} onChange={(e) => setLine(l.id, { sac: e.target.value })} />
                  </td>
                  <td>
                    <Input aria-label="Quantity" type="number" step="0.001" className="w-24" value={l.qty} disabled={locked} onChange={(e) => setLine(l.id, { qty: Number(e.target.value) })} />
                  </td>
                  <td>
                    <Input aria-label="Rate" type="number" step="0.01" className="w-28" value={l.rate} disabled={locked} onChange={(e) => setLine(l.id, { rate: Number(e.target.value) })} />
                  </td>
                  <td>
                    <Select
                      aria-label="Currency"
                      className="w-24"
                      value={l.currency}
                      disabled={locked}
                      onChange={(e) => setLine(l.id, { currency: e.target.value, exRate: state.currencies.find((c) => c.code === e.target.value)?.roe ?? 1 })}
                    >
                      {[...new Set([l.currency, ...state.currencies.filter((c) => c.active).map((c) => c.code)])].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <Input aria-label="Exchange rate" type="number" step="0.0001" className="w-24" value={l.exRate} disabled={locked} onChange={(e) => setLine(l.id, { exRate: Number(e.target.value) })} />
                  </td>
                  <td>
                    <Select
                      aria-label="GST rate"
                      className="w-24"
                      value={billLineRate(l, b.gstPercent)}
                      disabled={locked}
                      onChange={(e) => {
                        const rate = Number(e.target.value);
                        setLine(l.id, { gstPercent: rate, taxable: rate > 0 });
                      }}
                    >
                      {[...new Set([0, 5, 12, 18, 28, billLineRate(l, b.gstPercent)])]
                        .sort((x, y) => x - y)
                        .map((g) => (
                          <option key={g} value={g}>
                            {g ? `${g}%` : "Non-taxable"}
                          </option>
                        ))}
                    </Select>
                  </td>
                  <td className="text-right tabular-nums">{f2(billLineValue(l))}</td>
                  <td className="text-right tabular-nums">{f2(billLineTax(l, b.gstPercent))}</td>
                  <td>
                    {!locked && (
                      <button onClick={() => set("lines", b.lines.filter((x) => x.id !== l.id))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove line">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_18rem]">
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <b>Amount in words:</b> {billInWords(t.total)}
          </p>
          <dl className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 p-3 text-sm tabular-nums">
            <dt>Taxable value</dt>
            <dd className="text-right">{f2(t.taxable)}</dd>
            <dt>Non-taxable value</dt>
            <dd className="text-right">{f2(t.nonTaxable)}</dd>
            {b.taxMode === "IGST" ? (
              <>
                <dt>IGST</dt>
                <dd className="text-right">{f2(t.igst)}</dd>
              </>
            ) : (
              <>
                <dt>SGST</dt>
                <dd className="text-right">{f2(t.sgst)}</dd>
                <dt>CGST</dt>
                <dd className="text-right">{f2(t.cgst)}</dd>
              </>
            )}
            <dt>Round off</dt>
            <dd className="text-right">{f2(t.roundOff)}</dd>
            <dt className="font-semibold">Total</dt>
            <dd className="text-right font-semibold">INR {f2(t.total)}</dd>
            {b.kind === "Invoice" && (
              <>
                <dt>Received</dt>
                <dd className="text-right">{f2(t.received)}</dd>
              </>
            )}
          </dl>
        </div>
      </Card>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Notes">
            <Textarea rows={5} value={b.notes} disabled={locked} onChange={str("notes")} />
          </Field>
          <div>
            <Field label="Bank account printed on this bill" hint="Accounts are managed in Company Set up → Bank Account">
              <Select value={billBank(state.settings, b.bankId)?.id ?? ""} disabled={locked || !state.settings.banks.length} onChange={(e) => set("bankId", e.target.value)}>
                {!state.settings.banks.length && <option value="">No bank account set up</option>}
                {state.settings.banks.map((x) => (
                  <option key={x.id} value={x.id}>
                    {bankLabel(x)}
                    {x.isDefault ? " · default" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {(() => {
              const x = billBank(state.settings, b.bankId);
              return x ? (
                <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  {x.bankName}, {x.bankBranch} · A/C {x.accountNo} · IFSC {x.ifsc}
                  {x.swift && ` · SWIFT ${x.swift}`}
                </div>
              ) : null;
            })()}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {locked && (
          <span className="mr-auto text-xs text-slate-500">
            {bill.kind === "Invoice" && bill.status !== "Cancelled"
              ? "An issued tax invoice can't be edited. To correct it, cancel it (a credit note is raised) and approve a new proforma."
              : `This ${b.kind.toLowerCase()} is ${bill.status.toLowerCase()} and can no longer be edited.`}
          </span>
        )}
        <LinkButton variant="secondary" href={bill.kind === "Credit Note" ? "/billing/credit-notes" : "/billing"}>
          {dirty ? "Cancel" : "Back"}
        </LinkButton>
        {bill.kind === "Invoice" && bill.status !== "Cancelled" && (
          <Button variant="secondary" onClick={() => setDialog("status")}>
            Change status
          </Button>
        )}
        {bill.kind !== "Credit Note" && bill.status !== "Cancelled" && bill.status !== "Approved" && (
          <Button
            variant="danger"
            onClick={() => {
              if (!window.confirm(`Cancel ${bill.no}?${bill.kind === "Invoice" ? " A credit note will be created." : ""}`)) return;
              const cn = actions.cancelBill(bill.id);
              if (cn) router.push(`/billing/${cn.id}`);
            }}
          >
            <XCircle size={14} aria-hidden /> Cancel {bill.kind === "Proforma" ? "proforma" : "invoice"}
          </Button>
        )}
        {(!locked || dueDateEditable) && (
          <Button variant="secondary" disabled={!dirty} onClick={save}>
            {locked ? "Save due date" : "Save"}
          </Button>
        )}
        <Button onClick={() => setDialog("preview")}>
          <Eye size={14} aria-hidden /> Preview
        </Button>
      </div>
      {dialog === "preview" && <BillPreviewModal bill={b} unsaved={dirty} onClose={() => setDialog(null)} />}
      {dialog === "status" && <BillStatusModal bill={bill} onClose={() => setDialog(null)} />}
    </div>
  );
}
