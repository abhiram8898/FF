"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { AGENT_TYPES, CUSTOMER_TYPES, type Agent, type AgentType, type Customer, type CustomerType, type StoredDoc } from "@/lib/types";
import { cn, isEmail } from "@/lib/utils";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";
import { DocumentsInput, MultiValueInput, splitPrimary } from "./inputs";

const TYPE_HINT: Record<CustomerType, string> = {
  "Shipper/Receiver": "Exporters and importers who own the cargo",
  "Forwarder/Logistics": "Other forwarders and logistics companies who book with you",
};

function useContacts(initial?: { email: string; phone: string; altEmails: string[]; altPhones: string[] }) {
  const [emails, setEmails] = useState<string[]>(initial ? [initial.email, ...initial.altEmails] : [""]);
  const [phones, setPhones] = useState<string[]>(initial ? [initial.phone, ...initial.altPhones] : [""]);
  const e = splitPrimary(emails);
  const p = splitPrimary(phones);
  const emailsValid = emails.every((v) => !v.trim() || isEmail(v));
  return { emails, setEmails, phones, setPhones, emailsValid, contact: { email: e.primary, altEmails: e.others, phone: p.primary, altPhones: p.others } };
}

/** Add / edit customer: type first, then multiple emails, phones and documents */
export function CustomerFormModal({ existing, onClose, onSaved }: { existing?: Customer; onClose: () => void; onSaved?: (c: Customer) => void }) {
  const { actions } = useStore();
  const [type, setType] = useState<CustomerType | "">(existing?.type ?? "");
  const [f, setF] = useState({ name: existing?.name ?? "", code: existing?.code ?? "", address: existing?.address ?? "", contact: existing?.contact ?? "" });
  const [documents, setDocuments] = useState<StoredDoc[]>(existing?.documents ?? []);
  const c = useContacts(existing);
  const valid = type && f.name.trim() && c.contact.email && c.emailsValid;

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? `Edit customer · ${existing.name}` : "Add customer"}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            title={!type ? "Choose the customer type" : !c.contact.email ? "Enter at least one email" : undefined}
            onClick={() => {
              const saved = actions.saveCustomer({ ...f, type: type as CustomerType, code: f.code.trim().toUpperCase(), ...c.contact, documents }, existing?.id);
              onSaved?.(saved);
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <fieldset className="mb-3">
        <legend className="mb-2 text-xs font-medium text-slate-700">Customer type *</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CUSTOMER_TYPES.map((t) => (
            <label
              key={t}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors",
                type === t ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <input type="radio" name="customer-type" checked={type === t} onChange={() => setType(t)} className="mt-0.5 accent-brand-600" />
              <span>
                <span className="block font-medium text-slate-900">{t}</span>
                <span className="text-xs text-slate-500">{TYPE_HINT[t]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", !type && "pointer-events-none opacity-50")} aria-disabled={!type}>
        <Field label="Company name *">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Client code" hint="Used in Booking/Job numbers, e.g. ABC">
          <Input value={f.code} maxLength={8} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
        <Field label="Kindly attention (contact person)" className="sm:col-span-2">
          <Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
        </Field>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-700">Email addresses *</div>
          <MultiValueInput label="Email" type="email" values={c.emails} onChange={c.setEmails} addLabel="Add email" />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-700">Phone / WhatsApp numbers</div>
          <MultiValueInput label="Phone" type="tel" values={c.phones} onChange={c.setPhones} addLabel="Add number" />
        </div>
        <div className="sm:col-span-2">
          <div className="mb-1 text-xs font-medium text-slate-700">Documents</div>
          <DocumentsInput value={documents} onChange={setDocuments} />
        </div>
      </div>
    </Modal>
  );
}

/** Add / edit agent with multiple emails, phones and documents */
export function AgentFormModal({ existing, defaultType, onClose }: { existing?: Agent; defaultType?: AgentType; onClose: () => void }) {
  const { actions } = useStore();
  const [f, setF] = useState({
    type: existing?.type ?? defaultType ?? AGENT_TYPES[0],
    name: existing?.name ?? "",
    contact: existing?.contact ?? "",
    city: existing?.city ?? "",
    country: existing?.country ?? "",
  });
  const [documents, setDocuments] = useState<StoredDoc[]>(existing?.documents ?? []);
  const c = useContacts(existing);
  const valid = f.name.trim() && c.emailsValid;

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? `Edit agent · ${existing.name}` : "Add agent"}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              actions.saveAgent({ ...f, ...c.contact, documents }, existing?.id);
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Type">
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as AgentType })}>
            {AGENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Name *">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Contact person">
          <Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          </Field>
          <Field label="Country">
            <Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
          </Field>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-700">Email addresses</div>
          <MultiValueInput label="Email" type="email" values={c.emails} onChange={c.setEmails} addLabel="Add email" />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-700">Phone numbers</div>
          <MultiValueInput label="Phone" type="tel" values={c.phones} onChange={c.setPhones} addLabel="Add number" />
        </div>
        <div className="sm:col-span-2">
          <div className="mb-1 text-xs font-medium text-slate-700">Documents</div>
          <DocumentsInput value={documents} onChange={setDocuments} />
        </div>
      </div>
    </Modal>
  );
}
