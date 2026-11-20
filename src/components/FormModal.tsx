"use client";

import { useState } from "react";
import { isEmail } from "@/lib/utils";
import { Button, Field, Input, Modal, Select } from "./ui";
import { ImageUpload } from "./inputs";

export type FormField<T> = { key: keyof T & string; label: string; required?: boolean; email?: boolean; options?: readonly string[]; pattern?: RegExp; patternHint?: string; /** Image upload stored as a data URL */ image?: boolean };

/** Small add-record dialog used by the master screens */
export function FormModal<T extends Record<string, string>>({
  title,
  fields,
  initial,
  onSave,
  onClose,
  extra,
  extraValid = true,
  wide,
}: {
  title: string;
  fields: FormField<T>[];
  initial: T;
  onSave: (values: T) => void;
  onClose: () => void;
  /** More inputs under the fields (e.g. a list), kept by the caller */
  extra?: React.ReactNode;
  /** False while the extra inputs have a problem */
  extraValid?: boolean;
  wide?: boolean;
}) {
  const [v, setV] = useState<T>(initial);
  const errorFor = (f: FormField<T>) =>
    f.email && v[f.key].trim() && !isEmail(v[f.key]) ? "Enter a valid email address" : f.pattern && v[f.key].trim() && !f.pattern.test(v[f.key].trim()) ? (f.patternHint ?? "Check the format") : "";
  const valid = fields.every((f) => (!f.required || v[f.key].trim()) && !errorFor(f)) && extraValid;
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      wide={wide}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              onSave(v);
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {fields.map((f) =>
          f.image ? (
            <ImageUpload key={f.key} label={f.label} hint="PNG or JPG" value={v[f.key] || undefined} onChange={(img) => setV({ ...v, [f.key]: img ?? "" })} />
          ) : (
          <Field key={f.key} label={f.label + (f.required ? " *" : "")} hint={errorFor(f) && <span className="text-red-600">{errorFor(f)}</span>}>
            {f.options ? (
              <Select value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            ) : (
              <Input type={f.email ? "email" : "text"} value={v[f.key]} aria-invalid={!!errorFor(f)} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            )}
          </Field>
          ),
        )}
      </div>
      {extra}
    </Modal>
  );
}
