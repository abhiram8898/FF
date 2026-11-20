"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileImage, FileSpreadsheet, FileText, FileType2, Printer } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Awb } from "@/lib/types";
import { cn, downloadBlob, f2, fileSafe, fmtDate } from "@/lib/utils";
import { AwbDocument, AwbReverse, awbLabel, awbTotals } from "./awb";
import { AWB_COPIES, type AwbCopy, type AwbPrintOptions } from "./awbCopies";
import { Button, Fog, Modal, Spinner } from "./ui";

export type RateMode = NonNullable<AwbPrintOptions["rateMode"]>;
export type Stationery = "with" | "without";

export const RATE_MODES: { id: RateMode; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "agreed", label: "Agreed" },
  { id: "norate", label: "No Rate" },
];

/** Settings carried from the preview's quick options into the print dialog */
export interface PrintChoice {
  copies: AwbCopy[];
  withSign: boolean;
  stationery: Stationery;
  rateMode: RateMode;
  /** Reverse side (liability notice, conditions of contract) after each copy */
  reverse: boolean;
}

export const DEFAULT_PRINT: PrintChoice = { copies: [AWB_COPIES[0]], withSign: false, stationery: "without", rateMode: "normal", reverse: false };

// Largest canvas browsers reliably make (Safari and older Chrome refuse bigger ones)
const MAX_CANVAS_SIDE = 32_000;
const MAX_CANVAS_AREA = 250_000_000;

/** Short copy name for file and sheet names: "Original 1", "Copy 4" */
const copyShort = (c: AwbCopy) => c.split(" - ")[0];

/** One page to render: an AWB copy, or the reverse side that follows it */
type Item = { key: string; awb: Awb; copy: AwbCopy; back?: boolean };

/**
 * AWB Print (FRD change list 15-11-2026, items 8–13): pick the AWBs and copy types (several at once),
 * With Sign, stationery (with = data only for pre-printed forms) and rate mode (Normal / Agreed / No Rate),
 * then Print, or save as PDF, Word, Excel or PNG, merged into one file or one file per copy.
 */
export function AwbPrintDialog({ awbs, initialAwbId, initial = DEFAULT_PRINT, onClose }: { awbs: Awb[]; initialAwbId?: string; initial?: PrintChoice; onClose: () => void }) {
  const { state } = useStore();
  const { job } = useLookups();
  const signature = state.settings.company.signatureImage;
  // The AWB opened from may not be in the list (e.g. a cancelled one): start from the first instead
  const [awbIds, setAwbIds] = useState<string[]>(() => [awbs.some((a) => a.id === initialAwbId) ? initialAwbId : awbs[0]?.id].filter(Boolean) as string[]);
  const [copies, setCopies] = useState<AwbCopy[]>(initial.copies);
  const [withSign, setWithSign] = useState(initial.withSign && !!signature);
  const [reverse, setReverse] = useState(initial.reverse);
  const [stationery, setStationery] = useState<Stationery>(initial.stationery);
  const [rateMode, setRateMode] = useState<RateMode>(initial.rateMode);
  const [output, setOutput] = useState<"merged" | "separate">("merged");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const chosen = awbs.filter((a) => awbIds.includes(a.id));
  // Copies in the standard order, for each chosen AWB
  const items: Item[] = chosen.flatMap((awb) =>
    AWB_COPIES.filter((c) => copies.includes(c)).flatMap((copy): Item[] => [{ key: `${awb.id}|${copy}`, awb, copy }, ...(reverse ? [{ key: `${awb.id}|${copy}|back`, awb, copy, back: true }] : [])]),
  );
  const copyCount = items.filter((it) => !it.back).length;
  const ready = items.length > 0;
  const jobRef = job(chosen[0]?.jobId)?.ref ?? "AWB";
  const baseName = (it: Item) => fileSafe(`${awbLabel(it.awb)}-${copyShort(it.copy)}${it.back ? "-reverse" : ""}`);
  const mergedName = fileSafe(chosen.length === 1 ? `${awbLabel(chosen[0])}-copies` : `${jobRef}-AWB-copies`);
  const options: AwbPrintOptions = { withSign, dataOnly: stationery === "with", rateMode };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // Print: show only the rendered copies, one per sheet
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  /** Each rendered copy as a PNG (2× for sharp print), in order */
  const capture = async () => {
    const { domToPng } = await import("modern-screenshot");
    // The front's sheet content, or the whole reverse sheet
    const nodes = [...(rootRef.current?.querySelectorAll<HTMLElement>("[data-print-item]") ?? [])].map((el) => el.querySelector<HTMLElement>(el.dataset.side === "back" ? ".doc-sheet" : ".doc-sheet > div")).filter((n): n is HTMLElement => !!n);
    if (nodes.length !== items.length) throw new Error("the copies are still rendering");
    return Promise.all(
      nodes.map(async (node) => ({ dataUrl: await domToPng(node, { scale: 2, backgroundColor: "#ffffff" }), width: node.offsetWidth, height: node.offsetHeight })),
    );
  };
  const bytesOf = async (dataUrl: string) => new Uint8Array(await (await fetch(dataUrl)).arrayBuffer());

  const run = async (kind: string, fn: () => Promise<void>) => {
    setBusy(kind);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(`The ${kind} file could not be made (${(e as Error).message || "unknown error"}). Try again, or use Print.`);
    } finally {
      setBusy(null);
    }
  };

  const toPdf = () =>
    run("PDF", async () => {
      const shots = await capture();
      const { PDFDocument } = await import("pdf-lib");
      const page = async (doc: Awaited<ReturnType<typeof PDFDocument.create>>, shot: (typeof shots)[number]) => {
        const img = await doc.embedPng(await bytesOf(shot.dataUrl));
        const p = doc.addPage([595.28, 841.89]);
        const scale = Math.min(559 / shot.width, 806 / shot.height);
        p.drawImage(img, { x: (595.28 - shot.width * scale) / 2, y: 841.89 - 18 - shot.height * scale, width: shot.width * scale, height: shot.height * scale });
      };
      if (output === "merged") {
        const doc = await PDFDocument.create();
        for (const s of shots) await page(doc, s);
        downloadBlob(new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" }), `${mergedName}.pdf`);
      } else {
        for (const [i, s] of shots.entries()) {
          const doc = await PDFDocument.create();
          await page(doc, s);
          downloadBlob(new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" }), `${baseName(items[i])}.pdf`);
        }
      }
    });

  const toPng = () =>
    run("PNG", async () => {
      const shots = await capture();
      if (output === "separate") {
        for (const [i, s] of shots.entries()) downloadBlob(await (await fetch(s.dataUrl)).blob(), `${baseName(items[i])}.png`);
        return;
      }
      // Merged: the copies stacked into one image
      const imgs = await Promise.all(shots.map((s) => new Promise<HTMLImageElement>((res, rej) => Object.assign(new Image(), { onload: function (this: HTMLImageElement) { res(this); }, onerror: rej, src: s.dataUrl }))));
      const gap = 40;
      const width = Math.max(...imgs.map((i) => i.width));
      const height = imgs.reduce((h, i) => h + i.height, 0) + gap * (imgs.length - 1);
      if (height > MAX_CANVAS_SIDE || width * height > MAX_CANVAS_AREA) throw new Error(`${items.length} pages are too many for one image. Choose Separate, or save as PDF`);
      const canvas = Object.assign(document.createElement("canvas"), { width, height });
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("the browser could not make the image");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      let y = 0;
      for (const img of imgs) {
        ctx.drawImage(img, 0, y);
        y += img.height + gap;
      }
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("the image is too large for this browser. Choose Separate, or save as PDF");
      downloadBlob(blob, `${mergedName}.png`);
    });

  const toWord = () =>
    run("Word", async () => {
      const shots = await capture();
      const { Document, ImageRun, Packer, Paragraph } = await import("docx");
      // A4 with 0.4" margins: about 717 × 1045 px of usable space
      const section = async (s: (typeof shots)[number]) => {
        const scale = Math.min(717 / s.width, 1045 / s.height);
        return {
          properties: { page: { margin: { top: 576, right: 576, bottom: 576, left: 576 }, size: { width: 11906, height: 16838 } } },
          children: [new Paragraph({ children: [new ImageRun({ type: "png", data: await bytesOf(s.dataUrl), transformation: { width: Math.round(s.width * scale), height: Math.round(s.height * scale) } })] })],
        };
      };
      const save = async (list: typeof shots, name: string) => downloadBlob(await Packer.toBlob(new Document({ sections: await Promise.all(list.map(section)) })), `${name}.docx`);
      if (output === "merged") await save(shots, mergedName);
      else for (const [i, s] of shots.entries()) await save([s], baseName(items[i]));
    });

  const toExcel = () =>
    run("Excel", async () => {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const amount = (v: number) => (!v || rateMode === "norate" ? "" : rateMode === "agreed" ? "AS AGREED" : f2(v));
      const sheetFor = (it: Item) => {
        const a = it.awb;
        const t = awbTotals(a);
        const rows: [string, string | number][] = [
          ["Copy", it.copy],
          ["AWB type", a.type === "House" ? "House AWB" : "Master AWB"],
          ["MAWB No", a.mawbNo],
          ["MAWB Date", fmtDate(a.mawbDate)],
          ["HAWB No", a.hawbNo],
          ["HAWB Date", fmtDate(a.hawbDate)],
          ["Job No", job(a.jobId)?.ref ?? ""],
          ["Shipper", a.shipper],
          ["Consignee", a.consignee],
          ["Notify Party", a.notifyParty],
          ["Agent", a.localAgent],
          ["Agent IATA Code", a.agentIataCode],
          ["Airport of Departure", a.airportCode],
          ["Routing", a.legs.map((l) => `${l.to} by ${l.carrier} ${l.flightNo} ${fmtDate(l.flightDate)}`).join("  |  ")],
          ["Airport of Destination", a.portOfDestination],
          ["Currency", a.currency],
          ["CHGS Code", a.chgsCode],
          ["Declared Value for Carriage", a.declaredCarriage],
          ["Declared Value for Customs", a.declaredCustoms],
          ["No. of Pieces", a.pieces],
          ["Gross Weight", `${f2(a.grossWeight)} ${a.weightUnit === "K" ? "kg" : "lb"}`],
          ["Chargeable Weight", f2(a.chargeableWeight)],
          ["Rate Class", a.rateClass],
          ["Rate / Charge", amount(a.rate)],
          ["Total", amount(t.weight)],
          ["Nature & Quantity of Goods", a.natureOfGoods],
          ["Handling Information", a.handlingInfo],
          ["Invoice No", a.invoiceNo || a.invoiceDetails],
          ["Invoice Date", fmtDate(a.invoiceDate)],
          ["Other Charges", rateMode === "norate" ? a.otherCharges.map((c) => c.code).join(", ") : a.otherCharges.map((c) => `${c.code}: ${amount(c.amount)}`).join(", ")],
          ["Total Prepaid", amount(t.prepaid)],
          ["Total Collect", amount(t.collect)],
          ["Executed On", fmtDate(a.issuedAt)],
          ["At (Place)", a.place],
          ["Signature of Issuing Carrier or its Agent", a.carrierSign],
        ];
        return [
          [{ value: `Air Waybill · ${awbLabel(a)}`, fontWeight: "bold" as const }, { value: "" }],
          ...rows.map(([k, v]) => [{ value: k, fontWeight: "bold" as const }, { value: v, wrap: true }]),
        ];
      };
      const used = new Set<string>();
      const sheetName = (it: Item) => {
        let n = `${(it.awb.type === "House" ? it.awb.hawbNo : it.awb.mawbNo) || "AWB"} ${copyShort(it.copy)}`.replace(/[[\]:*?/\\]/g, "-").slice(0, 31);
        for (let i = 2; used.has(n); i++) n = `${n.slice(0, 28)} ${i}`;
        used.add(n);
        return n;
      };
      const columns = [{ width: 34 }, { width: 70 }];
      const fronts = items.filter((it) => !it.back);
      if (output === "merged") {
        const blob = await writeXlsxFile(fronts.map((it) => ({ data: sheetFor(it), sheet: sheetName(it), columns }))).toBlob();
        downloadBlob(blob, `${mergedName}.xlsx`);
      } else {
        for (const it of fronts) downloadBlob(await writeXlsxFile(sheetFor(it), { sheet: sheetName(it), columns }).toBlob(), `${baseName(it)}.xlsx`);
      }
    });

  const radio = (st: Stationery, rm: RateMode) => {
    const on = stationery === st && rateMode === rm;
    return (
      <label key={`${st}-${rm}`} className={cn("flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ring-1 transition-colors", on ? "bg-brand-50 font-medium text-brand-700 ring-brand-300" : "text-slate-700 ring-slate-200 hover:bg-slate-50")}>
        <input type="radio" name="awb-stationery" checked={on} onChange={() => (setStationery(st), setRateMode(rm))} className="accent-brand-600" />
        {RATE_MODES.find((m) => m.id === rm)!.label}
      </label>
    );
  };

  const fileBtn = (label: string, Icon: typeof FileText, onClick: () => void) => (
    <Button variant="secondary" onClick={onClick} disabled={!ready || !!busy}>
      {busy === label ? <Spinner size="xs" /> : <Icon size={14} aria-hidden />} {label}
    </Button>
  );

  return (
    <>
      <Modal
        open
        wide
        onClose={onClose}
        title="AWB Print"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-600">
              {ready ? `${copyCount} cop${copyCount === 1 ? "y" : "ies"} selected${reverse ? " (each with its reverse side)" : ""}` : "Select at least one AWB and one copy type"}
            </span>
            <div className="flex flex-wrap gap-2">
              {fileBtn("Word", FileType2, toWord)}
              {fileBtn("Excel", FileSpreadsheet, toExcel)}
              {fileBtn("PNG", FileImage, toPng)}
              {fileBtn("PDF", FileText, toPdf)}
              <Button onClick={() => setPrinting(true)} disabled={!ready || !!busy}>
                <Printer size={14} aria-hidden /> Print
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {error && <Fog onClose={() => setError("")}>{error}</Fog>}

          {awbs.length > 1 && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">AWBs</legend>
              <div className="flex flex-wrap gap-2">
                {awbs.map((a) => (
                  <label key={a.id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ring-1", awbIds.includes(a.id) ? "bg-brand-50 ring-brand-300" : "ring-slate-200 hover:bg-slate-50")}>
                    <input type="checkbox" checked={awbIds.includes(a.id)} onChange={() => setAwbIds(toggle(awbIds, a.id))} className="accent-brand-600" />
                    <span className="font-mono font-semibold">{awbLabel(a)}</span>
                    <span className="max-w-40 truncate text-xs text-slate-500">{a.shipper.split("\n")[0]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="mb-1.5 flex w-full items-center justify-between text-xs font-semibold tracking-wide text-slate-500 uppercase">
              AWB copy type
              <span className="flex gap-3 normal-case">
                <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setCopies([...AWB_COPIES])}>
                  Select all
                </button>
                <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setCopies([])}>
                  Clear
                </button>
              </span>
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {AWB_COPIES.map((c) => (
                <label key={c} className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ring-1", copies.includes(c) ? "bg-brand-50 font-medium text-brand-800 ring-brand-300" : "text-slate-700 ring-slate-200 hover:bg-slate-50")}>
                  <input type="checkbox" checked={copies.includes(c)} onChange={() => setCopies(toggle(copies, c))} className="accent-brand-600" />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">With Stationary</legend>
              <p className="mb-1.5 text-xs text-slate-500">Data only, for pre-printed AWB forms</p>
              <div className="flex flex-wrap gap-1.5">{RATE_MODES.map((m) => radio("with", m.id))}</div>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">Without Stationary</legend>
              <p className="mb-1.5 text-xs text-slate-500">The full AWB form on plain paper</p>
              <div className="flex flex-wrap gap-1.5">{RATE_MODES.map((m) => radio("without", m.id))}</div>
            </fieldset>
          </div>
          <p className="-mt-2 text-xs text-slate-500">Agreed prints &quot;AS AGREED&quot; in place of the rates and charges; No Rate leaves them blank.</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={cn("flex items-start gap-2 text-sm", !signature && "cursor-not-allowed")}>
                <input type="checkbox" checked={withSign} disabled={!signature} onChange={(e) => setWithSign(e.target.checked)} className="mt-0.5 accent-brand-600" />
                <span>
                  <span className={cn("font-medium", signature ? "text-slate-800" : "text-slate-500")}>With Sign</span>
                  <span className="block text-xs text-slate-500">
                    {signature ? "Adds the company signature above \"Signature of Issuing Carrier or its Agent\"" : "Upload the signature in Company Set up → Logos & banners first"}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} className="mt-0.5 accent-brand-600" />
                <span>
                  <span className="font-medium text-slate-800">Reverse side</span>
                  <span className="block text-xs text-slate-500">Notice of liability and conditions of contract after each copy (not in Excel)</span>
                </span>
              </label>
            </div>
            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">Files</legend>
              <div className="flex flex-wrap gap-3 text-sm">
                {(
                  [
                    ["merged", "Merged (one file)"],
                    ["separate", "Separate (one file per copy)"],
                  ] as const
                ).map(([id, label]) => (
                  <label key={id} className="flex items-center gap-1.5">
                    <input type="radio" name="awb-output" checked={output === id} onChange={() => setOutput(id)} className="accent-brand-600" />
                    {label}
                  </label>
                ))}
              </div>
              {output === "separate" && items.length > 1 && <p className="mt-1.5 text-xs text-slate-500">{items.length} files: if the browser asks, allow this page to download several files.</p>}
            </fieldset>
          </div>
        </div>
      </Modal>

      {/* Off-screen render of every selected copy: captured for PDF / Word / PNG, and the only content when printing */}
      {typeof document !== "undefined" &&
        createPortal(
          <div ref={rootRef} className={cn("awb-print-root", printing && "is-printing")} aria-hidden>
            {items.map((it) => (
              <div key={it.key} data-print-item data-side={it.back ? "back" : "front"} className="awb-print-page bg-white py-2">
                {it.back ? <AwbReverse /> : <AwbDocument awb={it.awb} copy={it.copy} {...options} withSign={withSign && !!signature} />}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
