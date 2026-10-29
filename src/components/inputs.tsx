"use client";

import { useRef, useState } from "react";
import { Download, FileText, ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import type { StoredDoc } from "@/lib/types";
import { MAX_KEPT_FILE, cn, fmtDate, fmtSize, isEmail, readFileAsDataUrl, toStoredDocs } from "@/lib/utils";
import { Button, Input } from "./ui";

/** Several emails or phone numbers; the first one is the primary */
export function MultiValueInput({
  label,
  values,
  onChange,
  type,
  addLabel,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  type: "email" | "tel";
  addLabel: string;
}) {
  const rows = values.length ? values : [""];
  const set = (i: number, v: string) => onChange(rows.map((x, j) => (j === i ? v : x)));
  return (
    <div className="space-y-2">
      {rows.map((v, i) => {
        const bad = type === "email" && v.trim() !== "" && !isEmail(v);
        return (
          <div key={i}>
            <div className="flex items-center gap-2">
              <Input
                type={type}
                value={v}
                aria-label={`${label} ${i + 1}`}
                aria-invalid={bad}
                placeholder={i === 0 ? "Primary" : "Additional"}
                onChange={(e) => set(i, e.target.value)}
                className={cn(bad && "border-red-300")}
              />
              {rows.length > 1 && (
                <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            {bad && <p className="mt-0.5 text-xs text-red-600">Enter a valid email address</p>}
          </div>
        );
      })}
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange([...rows, ""])}>
        <Plus size={13} aria-hidden /> {addLabel}
      </Button>
    </div>
  );
}

/** Splits a primary + extras list back into the stored shape */
export const splitPrimary = (values: string[]) => {
  const clean = values.map((v) => v.trim()).filter(Boolean);
  return { primary: clean[0] ?? "", others: clean.slice(1) };
};

/** Read-only list of uploaded documents with open / remove */
export function DocList({ docs, onRemove, onRename }: { docs: StoredDoc[]; onRemove?: (id: string) => void; onRename?: (id: string, title: string) => void }) {
  if (!docs.length) return null;
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          <FileText size={16} className="shrink-0 text-slate-400" aria-hidden />
          <div className="min-w-0 flex-1">
            {onRename ? (
              <input
                value={d.title}
                onChange={(e) => onRename(d.id, e.target.value)}
                aria-label={`Title for ${d.fileName}`}
                className="w-full rounded border border-transparent px-1 font-medium text-slate-800 hover:border-slate-200 focus:border-brand-500 focus:outline-none"
              />
            ) : (
              <div className="truncate font-medium text-slate-800">{d.title}</div>
            )}
            <div className="truncate px-1 text-xs text-slate-500">
              {d.fileName} · {fmtSize(d.size)} · {fmtDate(d.uploadedAt)}
              {!d.dataUrl && <span className="text-amber-700"> · too large to keep in the demo, only the name is saved</span>}
            </div>
          </div>
          {d.dataUrl && (
            <a href={d.dataUrl} download={d.fileName} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={`Download ${d.title}`} title="Download">
              <Download size={14} />
            </a>
          )}
          {onRemove && (
            <button type="button" onClick={() => onRemove(d.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${d.title}`}>
              <Trash2 size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Upload several documents, each with a title (defaults to the file name) */
export function DocumentsInput({ value, onChange, titled }: { value: StoredDoc[]; onChange: (docs: StoredDoc[]) => void; titled?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    onChange([...value, ...(await toStoredDocs(files, title.trim()))]);
    setTitle("");
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {titled && <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title name, e.g. Shipping Bill" aria-label="Document title" className="max-w-xs flex-1" />}
        <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={busy || (titled && !title.trim())} title={titled && !title.trim() ? "Enter a title first" : undefined}>
          <Upload size={13} aria-hidden /> {busy ? "Reading…" : "Upload documents"}
        </Button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => add(e.target.files)} />
        <span className="text-xs text-slate-500">Any file type. Files up to {fmtSize(MAX_KEPT_FILE)} can be opened again later.</span>
      </div>
      <DocList docs={value} onRemove={(id) => onChange(value.filter((d) => d.id !== id))} onRename={(id, t) => onChange(value.map((d) => (d.id === id ? { ...d, title: t } : d)))} />
    </div>
  );
}

/** Logo / banner picker that stores the image as a data URL */
export function ImageUpload({ label, hint, value, onChange, wide }: { label: string; hint: string; value?: string; onChange: (v: string | undefined) => void; wide?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const pick = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file (PNG, JPG or SVG).");
    if (file.size > MAX_KEPT_FILE) return setError(`Choose an image under ${fmtSize(MAX_KEPT_FILE)}.`);
    setError("");
    onChange(await readFileAsDataUrl(file));
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-medium text-slate-700">{label}</div>
      <div className={cn("grid place-items-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50", wide ? "h-24" : "h-24 w-full max-w-56")}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URL
          <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <ImagePlus size={22} className="text-slate-300" aria-hidden />
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
          {value ? "Replace" : "Upload"}
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(undefined)}>
            Remove
          </Button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <p className={cn("mt-1 text-xs", error ? "text-red-600" : "text-slate-500")}>{error || hint}</p>
    </div>
  );
}
