"use client";

import { useState } from "react";
import { type CustomerInput, useStore } from "@/lib/store";
import { STAKEHOLDER_TYPES, type Customer, type StakeholderType } from "@/lib/types";
import { isEmail } from "@/lib/utils";
import { Button, DISCARD_CHANGES, Field, Input, Modal, SectionTitle, Select } from "./ui";
import { DocumentsInput, MultiValueInput, splitPrimary } from "./inputs";

const blank = (type: StakeholderType): CustomerInput => ({
  type,
  status: "Active",
  code: "",
  name: "",
  address1: "",
  address2: "",
  country: "",
  state: "",
  city: "",
  postalCode: "",
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  phone: "",
  altEmails: [],
  altPhones: [],
  pan: "",
  gstin: "",
  bankAccount: "",
  documents: [],
});

/** Add / edit a stakeholder (FRD XI.4): company, address, primary contact, tax and bank details, KYC documents */
export function StakeholderFormModal({ existing, defaultType = "Shipper", onClose, onSaved }: { existing?: Customer; defaultType?: StakeholderType; onClose: () => void; onSaved?: (c: Customer) => void }) {
  const { state, actions } = useStore();
  const [f, setF] = useState<CustomerInput>(() => (existing ? { ...existing } : blank(defaultType)));
  const [start] = useState(() => JSON.stringify(f));
  const [emails, setEmails] = useState<string[]>(existing ? [existing.email, ...existing.altEmails] : [""]);
  const [phones, setPhones] = useState<string[]>(existing ? [existing.phone, ...existing.altPhones] : [""]);
  const set = <K extends keyof CustomerInput>(k: K, v: CustomerInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const text = (k: keyof CustomerInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(k, e.target.value as never);
  const e = splitPrimary(emails);
  const p = splitPrimary(phones);
  const emailsValid = emails.every((v) => !v.trim() || isEmail(v));
  const codeTaken = !!f.code && state.customers.some((c) => c.id !== existing?.id && c.code.toUpperCase() === f.code.toUpperCase());
  const missing = [
    !f.name.trim() && "Company Name",
    !f.address1.trim() && "Address 1",
    !f.country.trim() && "Country",
    !f.state.trim() && "State/Province",
    !f.city.trim() && "City",
    !f.postalCode.trim() && "Postal Code",
    !f.firstName.trim() && "First Name",
    !f.lastName.trim() && "Last Name",
    !p.primary && "Contact Number",
    !e.primary && "Email",
  ].filter(Boolean) as string[];
  const countries = [...new Set(state.ports.map((x) => x.country))].sort();

  const save = (status: Customer["status"]) => {
    const saved = actions.saveCustomer(
      { ...f, status, code: f.code.trim().toUpperCase(), email: e.primary, altEmails: e.others, phone: p.primary, altPhones: p.others },
      existing?.id,
    );
    onSaved?.(saved);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? `Edit stakeholder · ${existing.name}` : "Add Customer"}
      confirmClose={(JSON.stringify(f) !== start || emails.join() !== (existing ? [existing.email, ...existing.altEmails] : [""]).join()) && DISCARD_CHANGES}
      wide
      footer={
        <>
          {missing.length > 0 && <span className="mr-auto self-center text-xs text-amber-700">To submit, fill in: {missing.join(", ")}.</span>}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" disabled={!f.name.trim() || !emailsValid || codeTaken} onClick={() => save("Draft")} title="Save what you have; finish it later">
            Save Draft
          </Button>
          <Button disabled={missing.length > 0 || !emailsValid || codeTaken} onClick={() => save(existing && existing.status === "Inactive" ? "Inactive" : "Active")}>
            Submit
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Type *">
            <Select value={f.type} onChange={text("type")}>
              {STAKEHOLDER_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Company Name *" className="sm:col-span-2">
            <Input value={f.name} onChange={text("name")} />
          </Field>
          <Field label="Company Code" hint={codeTaken ? <span className="text-red-600">Already used by another stakeholder</span> : "Used as Customer Code in reference numbers"}>
            <Input value={f.code} maxLength={8} onChange={(ev) => set("code", ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
          </Field>
          <Field label="Address 1 *" className="sm:col-span-2">
            <Input value={f.address1} onChange={text("address1")} />
          </Field>
          <Field label="Address 2" className="sm:col-span-2">
            <Input value={f.address2} onChange={text("address2")} />
          </Field>
          <Field label="Country *">
            <Input value={f.country} onChange={text("country")} list="party-countries" />
            <datalist id="party-countries">
              {countries.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="State/Province *">
            <Input value={f.state} onChange={text("state")} />
          </Field>
          <Field label="City *">
            <Input value={f.city} onChange={text("city")} />
          </Field>
          <Field label="Postal Code *">
            <Input value={f.postalCode} onChange={text("postalCode")} />
          </Field>
        </section>

        <section className="border-t border-slate-100 pt-3">
          <SectionTitle>Primary contact details</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="First Name *">
              <Input value={f.firstName} onChange={text("firstName")} />
            </Field>
            <Field label="Middle Name">
              <Input value={f.middleName} onChange={text("middleName")} />
            </Field>
            <Field label="Last Name *">
              <Input value={f.lastName} onChange={text("lastName")} />
            </Field>
            <div className="sm:col-span-2">
              <div className="mb-1 text-xs font-medium text-slate-700">Email *</div>
              <MultiValueInput label="Email" type="email" values={emails} onChange={setEmails} addLabel="Add email" />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-700">Contact Number *</div>
              <MultiValueInput label="Contact number" type="tel" values={phones} onChange={setPhones} addLabel="Add number" />
            </div>
          </div>
        </section>

        <section className="border-t border-slate-100 pt-3">
          <SectionTitle>Other information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="PAN Number">
              <Input value={f.pan} maxLength={10} onChange={(ev) => set("pan", ev.target.value.toUpperCase())} />
            </Field>
            <Field label="GSTIN">
              <Input value={f.gstin} maxLength={15} onChange={(ev) => set("gstin", ev.target.value.toUpperCase())} />
            </Field>
            <Field label="Bank Account">
              <Input value={f.bankAccount} onChange={text("bankAccount")} />
            </Field>
          </div>
        </section>

        <section className="border-t border-slate-100 pt-3">
          <SectionTitle>KYC details</SectionTitle>
          <DocumentsInput titled value={f.documents} onChange={(documents) => set("documents", documents)} />
          <p className="mt-1 text-xs text-slate-500">A document titled &quot;Logo&quot; (PNG or JPG) is printed on the AWB for this shipper.</p>
        </section>
      </div>
    </Modal>
  );
}
