"use client";

import { useState } from "react";
import { Landmark, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { BankAccount, BankDetails, Branch, Settings } from "@/lib/types";
import { bankLabel, cn, isEmail, uid } from "@/lib/utils";
import { Badge, Button, Card, Field, Input, PageHeader, SectionTitle, Table, Tabs, Textarea } from "@/components/ui";
import { ImageUpload } from "@/components/inputs";

const TABS = ["General Set up", "Branch Management", "Bank Account"] as const;

const BANK_REQUIRED = ["beneficiaryName", "accountNo", "swift", "country", "state", "city", "bankName", "bankBranch", "bankCity", "bankPostalCode"] as const;

const emptyBank = (isDefault: boolean): BankAccount => ({
  id: uid(),
  isDefault,
  beneficiaryName: "",
  accountTitle: "",
  accountNo: "",
  ifsc: "",
  swift: "",
  paymentRef: "",
  fedwire: "",
  aba: "",
  address: "",
  country: "",
  state: "",
  city: "",
  postalCode: "",
  bankName: "",
  bankBranch: "",
  bankAddress: "",
  bankCity: "",
  bankPostalCode: "",
});

export default function CompanySetupPage() {
  const { state, actions } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("General Set up");
  const [company, setCompany] = useState<Settings["company"]>(state.settings.company);
  const [branches, setBranches] = useState<Branch[]>(state.settings.branches);
  const [banks, setBanks] = useState<BankAccount[]>(state.settings.banks);
  const [bankId, setBankId] = useState(state.settings.banks.find((x) => x.isDefault)?.id ?? state.settings.banks[0]?.id);
  const bank = banks.find((x) => x.id === bankId);
  const c = (patch: Partial<Settings["company"]>) => setCompany({ ...company, ...patch });
  const setBank = (patch: Partial<BankAccount>) => setBanks(banks.map((x) => (x.id === bankId ? { ...x, ...patch } : x)));
  const b = (k: keyof BankDetails) => (e: React.ChangeEvent<HTMLInputElement>) => setBank({ [k]: e.target.value });
  const addBank = () => {
    const nb = emptyBank(!banks.length);
    setBanks([...banks, nb]);
    setBankId(nb.id);
  };
  const removeBank = (id: string) => {
    const rest = banks.filter((x) => x.id !== id);
    // Removing the default makes the first remaining account the default
    const next = rest.length && !rest.some((x) => x.isDefault) ? rest.map((x, i) => ({ ...x, isDefault: i === 0 })) : rest;
    setBanks(next);
    if (bankId === id) setBankId(next[0]?.id);
  };
  const makeDefault = (id: string) => setBanks(banks.map((x) => ({ ...x, isDefault: x.id === id })));

  const companyMissing = (["address", "country", "state", "city", "phone", "postalCode"] as const).filter((k) => !company[k].trim());
  const incomplete = banks.find((x) => BANK_REQUIRED.some((k) => !x[k].trim()));
  const bankProblem = !banks.length ? "Add at least one bank account." : incomplete ? `Fill in the fields marked * for ${incomplete.bankName.trim() || "the new account"}.` : "";
  const codes = branches.map((x) => x.code.trim().toUpperCase()).filter(Boolean);
  const branchProblem = !branches.some((x) => x.name.trim())
    ? "Keep at least one branch."
    : branches.some((x) => x.name.trim() && !x.code.trim())
      ? "Every branch needs a code (used in reference numbers)."
      : codes.some((x, i) => codes.indexOf(x) !== i)
        ? "Branch codes must be unique."
        : branches.some((x) => x.email && !isEmail(x.email))
          ? "Check the branch email addresses."
          : "";

  const bar = (dirty: boolean, problem: string, onSave: () => void) => (
    <div className="mt-3 flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
      {problem ? <span className="text-xs text-red-600">{problem}</span> : dirty && <span className="text-xs text-amber-700">You have unsaved changes</span>}
      <Button onClick={onSave} disabled={!dirty || !!problem}>
        Save changes
      </Button>
    </div>
  );

  return (
    <>
      <PageHeader title="Company Set up" subtitle="Company details, logos and banners for documents, branches and the bank accounts printed on invoices" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "General Set up" && (
        <div className="space-y-3">
          <Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Field label="Company Name" className="sm:col-span-2">
                <Input value={company.name} onChange={(e) => c({ name: e.target.value })} />
              </Field>
              <Field label="Company Code">
                <Input value={company.code} onChange={(e) => c({ code: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="IATA Code">
                <Input value={company.iataCode} onChange={(e) => c({ iataCode: e.target.value })} />
              </Field>
              <Field label="Address 1 & 2 *" className="sm:col-span-4">
                <Textarea rows={2} value={company.address} onChange={(e) => c({ address: e.target.value })} />
              </Field>
              <Field label="Country *">
                <Input value={company.country} onChange={(e) => c({ country: e.target.value })} />
              </Field>
              <Field label="State/Province *" hint="Same state as the customer → CGST + SGST; otherwise IGST">
                <Input value={company.state} onChange={(e) => c({ state: e.target.value })} />
              </Field>
              <Field label="City *">
                <Input value={company.city} onChange={(e) => c({ city: e.target.value })} />
              </Field>
              <Field label="Postal Code *">
                <Input value={company.postalCode} onChange={(e) => c({ postalCode: e.target.value })} />
              </Field>
              <Field label="Contact Number *">
                <Input value={company.phone} onChange={(e) => c({ phone: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={company.email} onChange={(e) => c({ email: e.target.value })} />
              </Field>
              <Field label="Website">
                <Input value={company.website} onChange={(e) => c({ website: e.target.value })} />
              </Field>
              <Field label="GSTIN">
                <Input value={company.gstin} onChange={(e) => c({ gstin: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="PAN">
                <Input value={company.pan} onChange={(e) => c({ pan: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Email signature" className="sm:col-span-3">
                <Textarea rows={3} value={company.signature} onChange={(e) => c({ signature: e.target.value })} />
              </Field>
            </div>
          </Card>
          <Card title="Logos & banners">
            <p className="mb-3 text-xs text-slate-500">Used on quotations, AWBs, invoices and customer invoices. A letterhead banner replaces the generated header.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ImageUpload label="Company logo" hint="Left of the letterhead. PNG with a transparent background works best." value={company.logo} onChange={(v) => c({ logo: v })} />
              <ImageUpload label="Second logo (e.g. IATA)" hint="Right of the letterhead." value={company.accreditationLogo} onChange={(v) => c({ accreditationLogo: v })} />
              <ImageUpload label="Letterhead banner" hint="Full-width image, about 2000 × 300 px." value={company.letterhead} onChange={(v) => c({ letterhead: v })} wide />
              <ImageUpload label="Footer banner" hint="Full-width image, about 2000 × 200 px." value={company.footer} onChange={(v) => c({ footer: v })} wide />
            </div>
            {bar(
              JSON.stringify(company) !== JSON.stringify(state.settings.company),
              companyMissing.length ? "Fill in the address, country, state, city, postal code and contact number." : "",
              () => actions.updateSettings({ company }, "Company set up"),
            )}
          </Card>
        </div>
      )}

      {tab === "Branch Management" && (
        <Card
          title="Branches"
          bodyClassName="p-0"
          actions={
            <Button size="sm" variant="secondary" onClick={() => setBranches([...branches, { name: "", code: "", iataCode: "", address: "", contactPerson: "", email: "", phone: "" }])}>
              <Plus size={13} aria-hidden /> Add Branch
            </Button>
          }
        >
          <Table>
            <thead>
              <tr>
                <th>Branch Name</th>
                <th>Branch Code</th>
                <th>IATA Code</th>
                <th>Branch Address</th>
                <th>Contact Person</th>
                <th>Email</th>
                <th>Mob Number</th>
                <th>
                <span className="sr-only">Remove</span>
              </th>
              </tr>
            </thead>
            <tbody>
              {branches.map((x, i) => {
                const set = (patch: Partial<Branch>) => setBranches(branches.map((y, j) => (j === i ? { ...y, ...patch } : y)));
                return (
                  <tr key={i}>
                    <td>
                      <Input aria-label="Branch name" className="w-32" value={x.name} onChange={(e) => set({ name: e.target.value })} />
                    </td>
                    <td>
                      <Input aria-label="Branch code" className="w-20 font-mono" value={x.code} maxLength={5} onChange={(e) => set({ code: e.target.value.toUpperCase() })} />
                    </td>
                    <td>
                      <Input aria-label="IATA code" className="w-32" value={x.iataCode} onChange={(e) => set({ iataCode: e.target.value })} />
                    </td>
                    <td className="min-w-64">
                      <Input aria-label="Branch address" value={x.address} onChange={(e) => set({ address: e.target.value })} />
                    </td>
                    <td>
                      <Input aria-label="Contact person" className="w-36" value={x.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} />
                    </td>
                    <td>
                      <Input aria-label="Email" type="email" className="w-48" value={x.email} onChange={(e) => set({ email: e.target.value })} />
                    </td>
                    <td>
                      <Input aria-label="Mobile number" className="w-36" value={x.phone} onChange={(e) => set({ phone: e.target.value })} />
                    </td>
                    <td className="w-10">
                      <button onClick={() => setBranches(branches.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${x.name || "branch"}`}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <div className="px-3 pb-3">
            {bar(JSON.stringify(branches) !== JSON.stringify(state.settings.branches), branchProblem, () =>
              actions.updateSettings({ branches: branches.filter((x) => x.name.trim()).map((x) => ({ ...x, code: x.code.trim().toUpperCase() })) }, "Branches"),
            )}
          </div>
        </Card>
      )}

      {tab === "Bank Account" && (
        <div className="space-y-3">
          <Card
            title="Bank accounts"
            bodyClassName="p-0"
            actions={
              <Button size="sm" variant="secondary" onClick={addBank}>
                <Plus size={13} aria-hidden /> Add Account
              </Button>
            }
          >
            {banks.length ? (
              <ul className="divide-y divide-slate-100">
                {banks.map((x) => {
                  const selected = x.id === bankId;
                  const missing = BANK_REQUIRED.some((k) => !x[k].trim());
                  return (
                    <li key={x.id} className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5", selected && "bg-brand-50/60")}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                        <Landmark size={17} aria-hidden />
                      </span>
                      <button type="button" onClick={() => setBankId(x.id)} className="min-w-0 flex-1 text-left">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                          {bankLabel(x)}
                          {x.isDefault && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Default</Badge>}
                          {missing && <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Incomplete</Badge>}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{x.beneficiaryName || "Beneficiary not set"}</span>
                      </button>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant={selected ? "secondary" : "ghost"} onClick={() => setBankId(x.id)}>
                          <Pencil size={13} aria-hidden /> {selected ? "Editing" : "Edit"}
                        </Button>
                        {!x.isDefault && (
                          <Button size="sm" variant="ghost" onClick={() => makeDefault(x.id)} title="Print this account on bills by default">
                            <Star size={13} aria-hidden /> Set as default
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => window.confirm(`Remove ${bankLabel(x)}? Bills that picked it will print the default account.`) && removeBank(x.id)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${bankLabel(x)}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-3 py-4 text-sm text-slate-500">No bank accounts yet. Add the account printed on invoices.</p>
            )}
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">The default account prints on new bills. Each bill can pick another account in its editor.</p>
          </Card>

          {bank && (
            <Card title={`Account details · ${bank.bankName.trim() || "New account"}`}>
              <SectionTitle>Beneficiary details</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Field label="Beneficiary Name *" className="sm:col-span-2">
                  <Input value={bank.beneficiaryName} onChange={b("beneficiaryName")} />
                </Field>
                <Field label="Account Title (currency)">
                  <Input value={bank.accountTitle} onChange={b("accountTitle")} />
                </Field>
                <Field label="Bank A/C Number *">
                  <Input value={bank.accountNo} onChange={b("accountNo")} />
                </Field>
                <Field label="IFSC">
                  <Input value={bank.ifsc} onChange={(e) => setBank({ ifsc: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="SWIFT/BIC Code *">
                  <Input value={bank.swift} onChange={(e) => setBank({ swift: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="Bank Payment Ref">
                  <Input value={bank.paymentRef} onChange={b("paymentRef")} />
                </Field>
                <Field label="Fedwire Routing Number">
                  <Input value={bank.fedwire} onChange={b("fedwire")} />
                </Field>
                <Field label="ABA Routing Number">
                  <Input value={bank.aba} onChange={b("aba")} />
                </Field>
                <Field label="Address" className="sm:col-span-3">
                  <Input value={bank.address} onChange={b("address")} />
                </Field>
                <Field label="Country *">
                  <Input value={bank.country} onChange={b("country")} />
                </Field>
                <Field label="State/Province *">
                  <Input value={bank.state} onChange={b("state")} />
                </Field>
                <Field label="City *">
                  <Input value={bank.city} onChange={b("city")} />
                </Field>
                <Field label="Postal Code">
                  <Input value={bank.postalCode} onChange={b("postalCode")} />
                </Field>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <SectionTitle>Bank address</SectionTitle>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                  <Field label="Beneficiary Bank Name *">
                    <Input value={bank.bankName} onChange={b("bankName")} />
                  </Field>
                  <Field label="Branch *">
                    <Input value={bank.bankBranch} onChange={b("bankBranch")} />
                  </Field>
                  <Field label="Address">
                    <Input value={bank.bankAddress} onChange={b("bankAddress")} />
                  </Field>
                  <Field label="City *">
                    <Input value={bank.bankCity} onChange={b("bankCity")} />
                  </Field>
                  <Field label="Postal Code *">
                    <Input value={bank.bankPostalCode} onChange={b("bankPostalCode")} />
                  </Field>
                </div>
              </div>
            </Card>
          )}
          {bar(JSON.stringify(banks) !== JSON.stringify(state.settings.banks), bankProblem, () => actions.updateSettings({ banks }, "Bank accounts"))}
        </div>
      )}
    </>
  );
}
