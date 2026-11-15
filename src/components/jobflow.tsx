"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowUp, BellRing, Download, FileCheck2, Merge, Send } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import { JOB_FINAL_STATUSES, type Awb, type CustomerInvoice, type Job, type MailDraft, type MergedDocs, type StoredDoc } from "@/lib/types";
import { MAX_KEPT_FILE, fmtDate, fmtDateTime, fmtSize, readFileAsDataUrl } from "@/lib/utils";
import { ComposeEmail } from "./ComposeEmail";
import { AwbFormModal, AwbPreviewModal, AwbStatusModal, awbLabel } from "./awb";
import { invoiceTotals } from "./invoice";
import { DocumentsInput } from "./inputs";
import { Button, Fog, LinkButton, Modal } from "./ui";

/** Line status shown on the Documents screen */
export function docsLineStatus(job: Job) {
  if (job.dispatchedAt) return "Booking Completed";
  if (job.merged) return "CHA Dispatch Pending";
  if (job.uploadCompletedAt) return "Uploading Completed";
  return "Pending Documents";
}

/** Upload documents for the job, then mark "Uploading Completed" (more can still be added later) */
export function DocsUploadModal({ job, onClose, onMerge }: { job: Job; onClose: () => void; onMerge: () => void }) {
  const { state, actions } = useStore();
  const invoices = state.invoices.filter((i) => i.jobId === job.id && (i.status === "Generated" || i.status === "Completed"));
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`Upload Documents · ${job.ref}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {job.uploadCompletedAt ? (
            <Button
              onClick={() => {
                onClose();
                onMerge();
              }}
            >
              <Merge size={14} aria-hidden /> Merge Documents
            </Button>
          ) : (
            <Button disabled={!job.documents.length && !invoices.length} onClick={() => actions.completeUpload(job.id)}>
              <FileCheck2 size={14} aria-hidden /> Uploading Completed
            </Button>
          )}
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        Upload the shipment documents one by one with a title, e.g. Invoice, Packing List, PQ (plant quarantine), Shipping Bill. The executed AWB and customer invoices made in
        the application are added at merge time.
      </p>
      {job.uploadCompletedAt && (
        <p className="mb-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800">
          Uploading marked completed on {fmtDateTime(job.uploadCompletedAt)}. You can still add more documents.
        </p>
      )}
      <DocumentsInput titled value={job.documents} onChange={(docs) => actions.setJobDocs(job.id, docs)} />
      {invoices.length > 0 && (
        <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50/60 p-3 text-sm">
          <div className="mb-1 font-medium text-slate-800">Linked from Customer Invoice</div>
          {invoices.map((i) => (
            <div key={i.id} className="text-xs text-slate-600">
              Invoice {i.no} · {i.currency} {invoiceTotals(i).amount.toFixed(2)} · {i.status}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

type MergeItem = { key: string; title: string; detail: string; doc?: StoredDoc; awb?: Awb; invoice?: CustomerInvoice };

/** pdf-lib's standard fonts only cover Latin-1 */
const latin = (s: string) =>
  s
    .replace(/[–—]/g, "-")
    .replace(/[→]/g, "->")
    .replace(/[·•]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");

/** Any image the browser can display (GIF, WebP, BMP, SVG…) re-drawn as PNG, so pdf-lib can embed it */
async function imageToPng(dataUrl: string): Promise<ArrayBuffer | null> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 1200;
    canvas.height = img.naturalHeight || 1200;
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    return blob ? await blob.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * One merged PDF. PDFs are added page by page and images as pages; any other format (Word, Excel,
 * text…) is embedded in the PDF as an attachment, listed on a summary page, so every file reaches the CHA.
 */
async function mergeToPdf(items: MergeItem[], heading: string) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const skipped: string[] = [];
  const attached: string[] = [];

  const textPage = (title: string, rows: [string, string][]) => {
    const page = out.addPage([595, 842]);
    let y = 790;
    page.drawText(latin(heading), { x: 40, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 28;
    page.drawText(latin(title), { x: 40, y, size: 16, font: bold });
    y -= 30;
    for (const [k, v] of rows) {
      for (const [i, line] of latin(v || "-").split("\n").entries()) {
        if (y < 50) break;
        if (i === 0) page.drawText(latin(k), { x: 40, y, size: 10, font: bold });
        page.drawText(line.slice(0, 80), { x: 200, y, size: 10, font });
        y -= 15;
      }
      y -= 4;
    }
  };

  for (const it of items) {
    if (it.awb) {
      const a = it.awb;
      textPage(`${a.type === "House" ? "HOUSE" : "MASTER"} AIR WAYBILL`, [
        ["MAWB No", a.mawbNo],
        ...(a.type === "House" ? ([["HAWB No", a.hawbNo]] as [string, string][]) : []),
        ["Date", fmtDate(a.issuedAt)],
        ["Shipper", a.shipper],
        ["Consignee", a.consignee],
        ["Departure", `${a.airportCode} ${a.place}`],
        ["Routing", a.legs.map((l) => `${l.to} by ${l.carrier} ${l.flightNo} ${fmtDate(l.flightDate)}`).join("\n")],
        ["Destination", a.portOfDestination],
        ["Pieces / Gross", `${a.pieces} ${a.packageType} / ${a.grossWeight} kg`],
        ["Chargeable", `${a.chargeableWeight} kg @ ${a.rate} ${a.currency}`],
        ["Nature of goods", a.natureOfGoods],
        ["Handling", a.handlingInfo],
      ]);
      continue;
    }
    if (it.invoice) {
      const inv = it.invoice;
      const t = invoiceTotals(inv);
      textPage("INVOICE CUM PACKING LIST", [
        ["Invoice No", inv.no],
        ["Date", fmtDate(inv.date)],
        ["Exporter", inv.exporter],
        ["Consignee", inv.consignee],
        ["Port of loading", inv.portOfLoading],
        ["Port of discharge", inv.portOfDischarge],
        ["Goods", inv.items.map((i) => `${i.description} (HSN ${i.hsn || "-"}) ${i.packages} pkgs ${i.quantity} kg @ ${i.rate}`).join("\n")],
        ["Total", `${inv.currency} ${t.amount.toFixed(2)} · ${t.packages} packages · ${t.quantity} kg net`],
        ["Gross weight", `${inv.grossWeight} kg`],
      ]);
      continue;
    }
    const d = it.doc!;
    if (!d.dataUrl) {
      skipped.push(`${d.title} (too large to keep in the demo)`);
      continue;
    }
    const bytes = await (await fetch(d.dataUrl)).arrayBuffer();
    try {
      if (d.mime === "application/pdf" || d.fileName.toLowerCase().endsWith(".pdf")) {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);
      } else if (d.mime.startsWith("image/")) {
        const png = d.mime === "image/png" || d.mime === "image/jpeg" ? null : await imageToPng(d.dataUrl);
        if (d.mime !== "image/png" && d.mime !== "image/jpeg" && !png) throw new Error("unreadable image");
        const img = d.mime === "image/jpeg" ? await out.embedJpg(bytes) : await out.embedPng(png ?? bytes);
        const page = out.addPage([595, 842]);
        const scale = Math.min(515 / img.width, 762 / img.height, 1);
        page.drawImage(img, { x: 40, y: 802 - img.height * scale, width: img.width * scale, height: img.height * scale });
      } else {
        // Word, Excel, text and other formats can't become pages in the browser: carry the original file inside the PDF
        await out.attach(bytes, d.fileName, { mimeType: d.mime || "application/octet-stream", description: d.title, creationDate: new Date(d.uploadedAt), modificationDate: new Date(d.uploadedAt) });
        attached.push(d.fileName);
      }
    } catch {
      skipped.push(`${d.title} (the file could not be read)`);
    }
  }
  if (attached.length)
    textPage("ATTACHED FILES", [
      ["Files", attached.join("\n")],
      ["How to open", "These files are attached inside this PDF.\nOpen the attachments panel (paperclip) in your PDF reader."],
    ]);
  if (!out.getPageCount()) textPage("No pages", [["Note", "None of the selected documents could be merged."]]);
  const bytes = await out.save();
  return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), skipped, attached };
}

/** "Merge Documents": pick the documents and their order; they become one PDF on the job */
export function MergeModal({ job, onClose, onDispatch }: { job: Job; onClose: () => void; onDispatch: () => void }) {
  const { state, actions } = useStore();
  const { awbOf } = useLookups();
  const awb = awbOf(job.id);
  const invoices = state.invoices.filter((i) => i.jobId === job.id && (i.status === "Generated" || i.status === "Completed"));
  const all: MergeItem[] = [
    ...(awb ? [{ key: "awb", title: "AWB", detail: `${awbLabel(awb)} · made in the application`, awb }] : []),
    ...invoices.map((i) => ({ key: `invoice:${i.id}`, title: "Invoice", detail: `${i.no} · from Customer Invoice`, invoice: i })),
    ...job.documents.map((d) => ({ key: d.id, title: d.title, detail: `${d.fileName} · ${fmtSize(d.size)}${d.dataUrl ? "" : " · not kept, will be skipped"}`, doc: d })),
  ];
  const [order, setOrder] = useState<string[]>(() => (job.merged?.order.filter((k) => all.some((x) => x.key === k)) ?? all.map((x) => x.key)));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; skipped: string[]; attached: string[] } | null>(null);
  const chosen = order.map((k) => all.find((x) => x.key === k)!).filter(Boolean);
  const rest = all.filter((x) => !order.includes(x.key));
  const move = (key: string, by: -1 | 1) => {
    const i = order.indexOf(key);
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const fileName = `${job.ref.replace(/[^A-Za-z0-9-]+/g, "-")}-documents.pdf`;

  const [error, setError] = useState("");
  const merge = async () => {
    setBusy(true);
    setError("");
    try {
      const { blob, skipped, attached } = await mergeToPdf(chosen, `${state.settings.company.name} · ${job.ref}`);
      const keep = blob.size <= MAX_KEPT_FILE * 1.5;
      const merged: MergedDocs = { at: new Date().toISOString(), order, fileName, size: blob.size, skipped, dataUrl: keep ? await readFileAsDataUrl(new File([blob], fileName)) : undefined };
      actions.saveMerge(job.id, merged);
      setResult({ url: URL.createObjectURL(blob), skipped, attached });
    } catch (e) {
      setError(`The documents could not be merged (${(e as Error).message || "unknown error"}). Untick the file that may be damaged and try again.`);
    } finally {
      setBusy(false);
    }
  };

  const row = (it: MergeItem, i?: number) => (
    <li key={it.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-brand-600"
        checked={i !== undefined}
        onChange={() => setOrder(i !== undefined ? order.filter((k) => k !== it.key) : [...order, it.key])}
        aria-label={`Include ${it.title}`}
      />
      {i !== undefined && <span className="w-4 text-xs font-semibold text-brand-700">{i + 1}</span>}
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-800">{it.title}</div>
        <div className="truncate text-xs text-slate-500">{it.detail}</div>
      </div>
      {i !== undefined && (
        <span className="flex">
          <button onClick={() => move(it.key, -1)} disabled={i === 0} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${it.title} up`}>
            <ArrowUp size={14} />
          </button>
          <button onClick={() => move(it.key, 1)} disabled={i === order.length - 1} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${it.title} down`}>
            <ArrowDown size={14} />
          </button>
        </span>
      )}
    </li>
  );

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`Merge Documents · ${job.ref}`}
      footer={
        result ? (
          <>
            <a href={result.url} download={fileName} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-brand-700 sm:h-8 hover:bg-brand-50">
              <Download size={14} aria-hidden /> Download merged PDF
            </a>
            <Button
              onClick={() => {
                onClose();
                onDispatch();
              }}
            >
              <Send size={14} aria-hidden /> Dispatch To CHA
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!chosen.length || busy} onClick={merge}>
              <Merge size={14} aria-hidden /> {busy ? "Merging…" : `Merge ${chosen.length} into one PDF`}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">
            Merged into <b>{fileName}</b>. Next action: <b>Dispatch To CHA</b>.
          </p>
          {result.attached.length > 0 && (
            <p className="rounded-lg bg-brand-50 p-3 text-brand-800">
              Attached inside the PDF (open them from your PDF reader&apos;s attachments panel): <b>{result.attached.join(", ")}</b>.
            </p>
          )}
          {result.skipped.length > 0 && (
            <Fog>
              Not merged: {result.skipped.join("; ")}.
            </Fog>
          )}
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600">Tick the documents to merge and set their order, e.g. AWB, Invoice, Packing List, PQ.</p>
          {error && (
            <div className="mb-3">
              <Fog onClose={() => setError("")}>{error}</Fog>
            </div>
          )}
          {all.length ? (
            <>
              <ol className="space-y-1.5">{chosen.map((it, i) => row(it, i))}</ol>
              {rest.length > 0 && (
                <>
                  <h3 className="mt-3 mb-1.5 text-xs font-semibold text-slate-500 uppercase">Not included</h3>
                  <ul className="space-y-1.5">{rest.map((it) => row(it))}</ul>
                </>
              )}
            </>
          ) : (
            <Fog>No documents yet. Upload them first.</Fog>
          )}
        </>
      )}
    </Modal>
  );
}

/** "Dispatch To CHA": mail to the CHA chosen on the job, with the merged documents */
export function DispatchChaFlow({ job, onClose }: { job: Job; onClose: () => void }) {
  const { state, actions } = useStore();
  const { customer, portLabel, awbOf } = useLookups();
  const awb = awbOf(job.id);
  const cha = customer(job.chaId);
  const email = cha?.email || job.chaEmail;
  return (
    <ComposeEmail
      title={`Dispatch To CHA · ${job.chaName || "CHA"}`}
      note={!email && <Fog>No CHA email on this job. Pick the CHA on the job (Charges & billing) or type the address below.</Fog>}
      initial={{
        to: email ? [email] : [],
        cc: state.settings.company.email,
        subject: `Shipment documents – ${job.ref}${awb ? ` / ${awbLabel(awb)}` : ""}`,
        body: [
          `Dear ${cha?.contact || job.chaName || "Sir / Madam"},`,
          "",
          "Please find attached the merged shipment documents for customs clearance.",
          "",
          `Job No: ${job.ref}`,
          `Customer: ${customer(job.customerId)?.name ?? ""}`,
          `Shipper: ${job.shipperName}`,
          `AWB: ${awb ? awbLabel(awb) : job.awbNo}`,
          `Route: ${portLabel(job.pol)} → ${portLabel(job.pod)}`,
          `Flight: ${job.flightNo} · ${fmtDate(job.flightDate)}`,
          `Packages / Weight: ${job.boxes} / ${job.weight} kg`,
          `Commodity: ${job.commodity}`,
          `Invoice No: ${job.invoiceNo || "—"}`,
        ].join("\n"),
      }}
      attachments={job.merged ? [job.merged.fileName] : []}
      onClose={onClose}
      onSend={(mail) => {
        actions.dispatchToCha(job.id, mail);
        onClose();
      }}
    />
  );
}

/** "Notify Customer": a mail box with the customer's email in To */
export function NotifyCustomerFlow({
  customerId,
  subject,
  body,
  refs,
  onClose,
}: {
  customerId: string;
  subject: string;
  body: string;
  refs: { enquiryId?: string; jobId?: string; reservationId?: string };
  onClose: () => void;
}) {
  const { actions } = useStore();
  const { customer } = useLookups();
  const c = customer(customerId);
  return (
    <ComposeEmail
      title="Notify Customer"
      initial={{ to: c ? [c.email, ...c.altEmails].filter(Boolean) : [], subject, body: `Dear ${c?.contact || "Sir / Madam"},\n\n${body}` }}
      onClose={onClose}
      onSend={(mail: MailDraft) => {
        actions.notifyCustomer(mail, refs);
        onClose();
      }}
    />
  );
}

type JobDialog = "awb" | "editAwb" | "previewAwb" | "awbStatus" | "upload" | "merge" | "dispatch" | "notify" | null;

/** The job's "Next action" from job creation to departure (FRD VI.10 → VIII.19) */
export function JobNextAction({ job, initial }: { job: Job; initial?: JobDialog }) {
  const { state, actions } = useStore();
  const { awbOf, portLabel } = useLookups();
  const [dialog, setDialog] = useState<JobDialog>(initial ?? null);
  const awb = awbOf(job.id);
  const proforma = state.bills.find((b) => b.jobId === job.id && b.kind === "Proforma" && b.status !== "Cancelled");
  const close = () => setDialog(null);

  const row = (text: React.ReactNode, action: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
      <p className="min-w-0 flex-1">{text}</p>
      <div className="flex flex-wrap gap-2">{action}</div>
    </div>
  );
  const finalButtons = JOB_FINAL_STATUSES.filter((s) => s !== job.status).map((s) => (
    <Button key={s} size="sm" variant={s === "Departed" ? "primary" : s === "Cancelled" ? "danger" : "secondary"} onClick={() => (s !== "Cancelled" || window.confirm(`Cancel ${job.ref}?`)) && actions.setJobStatus(job.id, s)}>
      {s}
    </Button>
  ));
  const notifyBtn = (
    <Button size="sm" variant="secondary" onClick={() => setDialog("notify")}>
      <BellRing size={14} aria-hidden /> Notify Customer
    </Button>
  );

  let body: React.ReactNode;
  switch (job.status) {
    case "AWB In Progress":
      body = awb
        ? row(
            <>
              AWB <b className="font-mono">{awbLabel(awb)}</b> is <b>{awb.status}</b>.{" "}
              {awb.status === "Draft" ? "Preview and send it to the customer for confirmation." : "Once the customer confirms (and any corrections are made), mark it executed."}
            </>,
            <>
              <Button size="sm" variant="secondary" onClick={() => setDialog("editAwb")}>
                Edit AWB
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDialog("previewAwb")}>
                Preview / Send
              </Button>
              <Button size="sm" onClick={() => actions.setAwbStatus(awb.id, "AWB Executed")}>
                AWB Executed
              </Button>
            </>,
          )
        : row(
            <>
              Job <b className="font-mono">{job.ref}</b> is created. Next action: <b>Execute AWB</b>.
            </>,
            <Button onClick={() => setDialog("awb")}>Execute AWB</Button>,
          );
      break;
    case "Pending Documents":
      body = row(
        <>
          AWB executed. Next action: <b>Manage Documents</b>. Upload the documents, then mark uploading completed.
        </>,
        <Button onClick={() => setDialog("upload")}>Manage Documents</Button>,
      );
      break;
    case "Documents Uploaded":
      body = row(
        <>
          Uploading completed ({job.documents.length} document{job.documents.length !== 1 && "s"}). Next action: <b>Merge Documents</b> and forward to the CHA.
        </>,
        <>
          <Button size="sm" variant="secondary" onClick={() => setDialog("upload")}>
            Add documents
          </Button>
          <Button onClick={() => setDialog("merge")}>Merge Documents</Button>
        </>,
      );
      break;
    case "CHA Dispatch Pending":
      body = row(
        <>
          Documents merged into <b>{job.merged?.fileName}</b>. Next action: <b>Dispatch To CHA</b> ({job.chaName || "no CHA chosen yet"}).
        </>,
        <>
          <Button size="sm" variant="secondary" onClick={() => setDialog("merge")}>
            Merge again
          </Button>
          <Button onClick={() => setDialog("dispatch")}>Dispatch To CHA</Button>
        </>,
      );
      break;
    case "Booking Completed":
      body = (
        <>
          {row(
            <>
              Documents dispatched to the CHA on {fmtDateTime(job.dispatchedAt)}. Booking completed. Update the shipment status once the flight leaves.
            </>,
            notifyBtn,
          )}
          <div className="mt-3 flex flex-wrap gap-2">{finalButtons}</div>
        </>
      );
      break;
    case "Departed":
    case "Cargo In Transit":
      body = (
        <>
          {row(
            <>
              Shipment <b>{job.status.toLowerCase()}</b> ({job.flightNo} · {portLabel(job.pol)} → {portLabel(job.pod)}).{" "}
              {proforma ? (
                <>
                  Proforma{" "}
                  <Link href={`/billing/${proforma.id}`} className="font-medium text-brand-700 hover:underline">
                    {proforma.no}
                  </Link>{" "}
                  is in Billing ({proforma.status}).
                </>
              ) : (
                "Billing starts from the proforma invoice."
              )}
            </>,
            <>
              {notifyBtn}
              {proforma ? (
                <LinkButton size="sm" href={`/billing/${proforma.id}`}>
                  Open proforma
                </LinkButton>
              ) : (
                <Button size="sm" onClick={() => actions.createProforma(job.id)}>
                  Create proforma
                </Button>
              )}
            </>,
          )}
          <div className="mt-3 flex flex-wrap gap-2">{finalButtons}</div>
        </>
      );
      break;
    case "On Hold":
      body = (
        <>
          {row(<>This job is <b>on hold</b>. Pick the status to continue.</>, notifyBtn)}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => actions.setJobStatus(job.id, job.dispatchedAt ? "Booking Completed" : job.merged ? "CHA Dispatch Pending" : awb?.status === "AWB Executed" ? "Pending Documents" : "AWB In Progress")}>
              Resume
            </Button>
            {finalButtons}
          </div>
        </>
      );
      break;
    default:
      body = row(<>This job is <b>cancelled</b>.</>, <Button size="sm" variant="secondary" onClick={() => actions.setJobStatus(job.id, "On Hold")}>Reopen (On Hold)</Button>);
  }

  const departed = job.status === "Departed" || job.status === "Cargo In Transit";
  return (
    <>
      {body}
      {dialog === "awb" && <AwbFormModal job={job} onClose={close} />}
      {dialog === "editAwb" && awb && <AwbFormModal job={job} existing={awb} onClose={close} />}
      {dialog === "previewAwb" && awb && <AwbPreviewModal awb={awb} onClose={close} onEdit={() => setDialog("editAwb")} />}
      {dialog === "awbStatus" && awb && <AwbStatusModal awb={awb} onClose={close} />}
      {dialog === "upload" && <DocsUploadModal job={job} onClose={close} onMerge={() => setDialog("merge")} />}
      {dialog === "merge" && <MergeModal job={job} onClose={close} onDispatch={() => setDialog("dispatch")} />}
      {dialog === "dispatch" && <DispatchChaFlow job={job} onClose={close} />}
      {dialog === "notify" && (
        <NotifyCustomerFlow
          customerId={job.customerId}
          refs={{ jobId: job.id, enquiryId: job.enquiryId }}
          subject={`Shipment update – ${job.ref}${awb ? ` / ${awbLabel(awb)}` : ""}`}
          body={
            departed
              ? `We are pleased to inform you that your shipment ${job.ref} (${job.commodity}, ${job.boxes} packages) has ${job.status === "Departed" ? "departed" : "is in transit"} on ${job.flightNo} from ${portLabel(job.pol)} to ${portLabel(job.pod)}.${awb ? `\n\nAWB: ${awbLabel(awb)}` : ""}`
              : `Update on your shipment ${job.ref} (${portLabel(job.pol)} → ${portLabel(job.pod)}): status is now "${job.status}".`
          }
          onClose={close}
        />
      )}
    </>
  );
}
