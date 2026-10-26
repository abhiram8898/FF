"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Eye, Plane, Plus, ReceiptText, Settings2, Trash2 } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { ChargeGroup, Quotation, QuoteLine } from "@/lib/types";
import { fmtDate, lineGst, lineNet, lineTotal, money, quoteTotals, uid, volumeCbm } from "@/lib/utils";
import { Button, Card, Empty, Field, Input, KeyValue, LinkButton, PageHeader, Select, StatusBadge, Textarea, linkCls } from "@/components/ui";
import { PreviewModal, QuotationActionsModal, SendQuotationFlow } from "@/components/quotation";

export default function QuotationPage() {
  const { id } = useParams<{ id: string }>();
  const { quotation } = useLookups();
  const q = quotation(id);
  if (!q) {
    return (
      <Empty action={<Link href="/quotations" className={linkCls}>Back to Quotations</Link>}>
        This quotation doesn&apos;t exist. It may have been removed when the demo data was reset.
      </Empty>
    );
  }
  return <QuotationEditor key={q.id} q={q} />;
}

// Only these fields are edited on this screen; status is owned by the store actions
const editable = (x: Quotation) => ({
  airlineId: x.airlineId,
  currency: x.currency,
  roe: x.roe,
  clearancePlace: x.clearancePlace,
  cargoDimension: x.cargoDimension,
  kindlyAttention: x.kindlyAttention,
  lines: x.lines,
  terms: x.terms,
});

function QuotationEditor({ q }: { q: Quotation }) {
  const { state, actions } = useStore();
  const { enquiry, customer, portLabel } = useLookups();
  const enq = enquiry(q.enquiryId)!;
  const cust = customer(enq.customerId);

  const [draft, setDraft] = useState(editable(q));
  const [dialog, setDialog] = useState<"preview" | "send" | "actions" | null>(null);
  const locked = !["Draft", "Quote Confirmation Pending"].includes(q.status);
  const dirty = JSON.stringify(draft) !== JSON.stringify(editable(q));
  const current: Quotation = { ...q, ...draft };
  const totals = quoteTotals(current);
  const blankLines = draft.lines.filter((l) => !l.particulars.trim()).length;
  const gstOptions = [...new Set([0, 5, 12, 18, 28, state.settings.gstPercent])].sort((a, b) => a - b);

  const save = () => actions.updateQuotation(q.id, draft);
  const setLine = (id: string, patch: Partial<QuoteLine>) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const addLine = (group: ChargeGroup) =>
    setDraft((d) => ({
      ...d,
      lines: [...d.lines, { id: uid(), group, particulars: "", rate: 0, markup: 0, unit: "Per shipment", qty: 1, gstPercent: state.settings.gstPercent }],
    }));
  const removeLine = (id: string) => setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== id) }));

  const banner: [string, React.ReactNode][] = [
    ["Ref No", q.ref],
    ["Shipment Mode", enq.cargoMode],
    ["Type of Load", enq.shipmentMode],
    ["INCO Terms", enq.incoterm],
    ["Customer Name", cust?.name],
    ["Address Line", cust?.address],
    ["Kindly Attention", draft.kindlyAttention],
    ["POL", portLabel(enq.pol)],
    ["POD", portLabel(enq.pod)],
    ["Cargo Description", enq.commodity],
    ["Gross Weight", `${enq.grossWeight} kg`],
    ["CBM", volumeCbm(enq).toFixed(4)],
    ["Product", enq.productType],
    ["Package Box Type", enq.packageType],
    ["Transit Time", enq.transitTime],
    ["Route", enq.route],
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/quotations", label: "Quotations" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Create Job Quotation · {q.ref} <StatusBadge status={q.status} />
          </span>
        }
        subtitle={
          <>
            From enquiry{" "}
            <Link href={`/enquiries/${enq.id}`} className={linkCls}>
              {enq.ref}
            </Link>
            {q.sentAt && ` · sent ${fmtDate(q.sentAt)}`}
          </>
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => setDialog("actions")}>
            <Settings2 size={14} /> Quotation Actions
          </Button>
        }
      />

      <div className="space-y-6">
        <Card title="Enquiry Details" actions={<span className="text-xs text-slate-400">Auto-populated from enquiry</span>}>
          <KeyValue cols={4} items={banner} />
        </Card>

        <Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Field label="Cargo Dimension" className="col-span-2">
              <Input value={draft.cargoDimension} disabled={locked} onChange={(e) => setDraft({ ...draft, cargoDimension: e.target.value })} />
            </Field>
            <Field label="Clearance Place">
              <Select value={draft.clearancePlace} disabled={locked} onChange={(e) => setDraft({ ...draft, clearancePlace: e.target.value })}>
                {state.settings.clearancePlaces.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Currency">
              <Select
                value={draft.currency}
                disabled={locked}
                onChange={(e) =>
                  setDraft({ ...draft, currency: e.target.value, roe: state.settings.currencies.find((c) => c.code === e.target.value)?.roe ?? 1 })
                }
              >
                {state.settings.currencies.map((c) => (
                  <option key={c.code}>{c.code}</option>
                ))}
              </Select>
            </Field>
            <Field label="ROE" hint="Rate of exchange to INR">
              <Input type="number" step="0.0001" min="0" value={draft.roe} disabled={locked} onChange={(e) => setDraft({ ...draft, roe: Number(e.target.value) })} />
            </Field>
            <Field label="Carrier Name">
              <Select value={draft.airlineId} disabled={locked} onChange={(e) => setDraft({ ...draft, airlineId: e.target.value })}>
                {state.airlines.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kindly Attention" className="col-span-2">
              <Input value={draft.kindlyAttention} disabled={locked} onChange={(e) => setDraft({ ...draft, kindlyAttention: e.target.value })} />
            </Field>
          </div>
        </Card>

        {(["Airline", "Agency"] as ChargeGroup[]).map((group) => (
          <section key={group} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between bg-brand-700 px-4 py-2.5 text-white">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                {group === "Airline" ? <Plane size={15} /> : <ReceiptText size={15} />}
                {group === "Airline" ? "Airline Charges" : "Clearance / Agency Charges"}
              </h2>
              {!locked && (
                <button onClick={() => addLine(group)} className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                  <Plus size={13} /> Add
                </button>
              )}
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[60rem] text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                    <th className="w-8">#</th>
                    <th className="w-[22%]">Particulars</th>
                    <th>Rate (FC)</th>
                    <th>Mark Up</th>
                    <th>Unit</th>
                    <th>Qty</th>
                    <th className="text-right">Net Amount</th>
                    <th>GST%</th>
                    <th className="text-right">Total GST</th>
                    <th className="text-right">Total Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.lines
                    .filter((l) => l.group === group)
                    .map((l, i) => (
                      <tr key={l.id} className="border-t border-slate-100 [&>td]:px-2 [&>td]:py-1.5">
                        <td className="text-slate-400">{i + 1}</td>
                        <td>
                          <Input value={l.particulars} aria-label="Particulars" placeholder="Charge name" disabled={locked} onChange={(e) => setLine(l.id, { particulars: e.target.value })} />
                        </td>
                        <td>
                          <Input type="number" min="0" step="0.01" aria-label="Rate" className="w-24" value={l.rate} disabled={locked} onChange={(e) => setLine(l.id, { rate: Number(e.target.value) })} />
                        </td>
                        <td>
                          <Input type="number" min="0" step="0.01" aria-label="Mark up" className="w-20" value={l.markup} disabled={locked} onChange={(e) => setLine(l.id, { markup: Number(e.target.value) })} />
                        </td>
                        <td>
                          <Select value={l.unit} aria-label="Unit" disabled={locked} className="w-36" onChange={(e) => setLine(l.id, { unit: e.target.value as QuoteLine["unit"] })}>
                            <option>Per kg</option>
                            <option>Per shipment</option>
                          </Select>
                        </td>
                        <td>
                          <Input type="number" min="0" step="0.01" aria-label="Quantity" className="w-20" value={l.qty} disabled={locked} onChange={(e) => setLine(l.id, { qty: Number(e.target.value) })} />
                        </td>
                        <td className="text-right tabular-nums">{lineNet(l, draft.roe).toFixed(2)}</td>
                        <td>
                          <Select value={l.gstPercent} aria-label="GST %" disabled={locked} className="w-24" onChange={(e) => setLine(l.id, { gstPercent: Number(e.target.value) })}>
                            {gstOptions.map((g) => (
                              <option key={g} value={g}>
                                {g}%
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="text-right tabular-nums">{lineGst(l, draft.roe).toFixed(2)}</td>
                        <td className="text-right font-medium tabular-nums">{lineTotal(l, draft.roe).toFixed(2)}</td>
                        <td>
                          {!locked && (
                            <button onClick={() => removeLine(l.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="text-xs text-emerald-800">
            Airline {money(totals.airline)} · Agency {money(totals.agency)} · GST {money(totals.gst)} · Expected profit {money(totals.profit)}
          </div>
          <div className="text-lg font-semibold text-emerald-900">Grand Total {money(totals.grand)}</div>
        </div>

        <Card title="Notes / Terms & Conditions">
          <Textarea rows={3} value={draft.terms} disabled={locked} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} />
          <p className="mt-2 text-xs text-slate-400">GST auto-picks the configured default ({state.settings.gstPercent}%). Net Amount = (Rate + Mark Up) × Qty × ROE.</p>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!locked && blankLines > 0 && (
            <span className="mr-auto text-xs text-amber-700">
              {blankLines} charge line{blankLines > 1 && "s"} without a name. Name or remove {blankLines > 1 ? "them" : "it"} before sending.
            </span>
          )}
          <LinkButton href={`/enquiries/${enq.id}`} variant="secondary">
            {dirty ? "Discard changes" : "Back to enquiry"}
          </LinkButton>
          <Button variant="secondary" onClick={() => setDialog("preview")}>
            <Eye size={15} /> Preview
          </Button>
          {!locked && (
            <>
              <Button
                variant="secondary"
                disabled={!dirty}
                onClick={() => {
                  save();
                  actions.toast("Quotation saved");
                }}
              >
                Save
              </Button>
              <Button
                disabled={blankLines > 0}
                onClick={() => {
                  if (dirty) save();
                  setDialog("send");
                }}
              >
                {q.status === "Draft" ? "Save & Send" : "Save & Resend"}
              </Button>
            </>
          )}
        </div>
      </div>

      {dialog === "preview" && (
        <PreviewModal
          q={current}
          onClose={() => setDialog(null)}
          onSend={
            locked || blankLines > 0
              ? undefined
              : () => {
                  if (dirty) save();
                  setDialog("send");
                }
          }
        />
      )}
      {dialog === "send" && <SendQuotationFlow q={current} onClose={() => setDialog(null)} />}
      {dialog === "actions" && <QuotationActionsModal q={q} onClose={() => setDialog(null)} />}
    </>
  );
}
