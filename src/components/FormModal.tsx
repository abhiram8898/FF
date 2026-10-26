"use client";

import { useState } from "react";
import { Button, Field, Input, Modal, Select } from "./ui";

export type FormField<T> = { key: keyof T & string; label: string; required?: boolean; email?: boolean; options?: readonly string[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Small add-record dialog used by the master screens */
export function FormModal<T extends Record<string, string>>({
  title,
  fields,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  fields: FormField<T>[];
  initial: T;
  onSave: (values: T) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<T>(initial);
  const errorFor = (f: FormField<T>) => (f.email && v[f.key].trim() && !EMAIL_RE.test(v[f.key].trim()) ? "Enter a valid email address" : "");
  const valid = fields.every((f) => (!f.required || v[f.key].trim()) && !errorFor(f));
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
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
        {fields.map((f) => (
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
        ))}
      </div>
    </Modal>
  );
}
