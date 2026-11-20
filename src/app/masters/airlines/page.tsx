"use client";

import { useState } from "react";
import { Globe, Plane, Plus, Scale, Send, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Airline, AirlineBranchContact } from "@/lib/types";
import { isEmail, matches, uid } from "@/lib/utils";
import { Badge, Button, Card, FilterBar, FilterSelect, Input, type KpiDef, KpiFilters, kpiTest, NoResults, PageHeader, ResetFilters, RowActions, SearchField, Select, Table } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { AirlineTabs } from "@/components/AirlineTabs";

export default function AirlinesPage() {
  const { state, actions } = useStore();
  const [editing, setEditing] = useState<Airline | "new" | null>(null);
  const [contacts, setContacts] = useState<AirlineBranchContact[]>([]);
  const edit = (a: Airline | "new") => {
    setContacts(a === "new" ? [] : (a.branchContacts ?? []));
    setEditing(a);
  };
  const branches = state.settings.branches.map((b) => b.name).filter(Boolean);
  const setContact = (id: string, patch: Partial<AirlineBranchContact>) => setContacts((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  // Empty rows are dropped on save, so only filled ones are checked; one contact per branch, since only one is used
  const filled = contacts.filter((c) => c.name.trim() || c.email.trim() || c.phone.trim());
  const twice = filled.map((c) => c.branch).find((b, i, all) => b && all.indexOf(b) !== i);
  const contactProblem = filled.some((c) => c.email.trim() && !isEmail(c.email))
    ? "Check the contact email addresses."
    : filled.some((c) => !c.branch)
      ? "Pick the branch for each contact."
      : twice
        ? `${twice} has two contacts. Keep one per branch (it is the one rate requests go to).`
        : "";
  const [q, setQ] = useState("");
  const [port, setPort] = useState("all");

  const served = [...new Set(state.airlines.flatMap((a) => a.ports))].sort();
  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<Airline>[] = [
    { id: "all", icon: Plane, label: "Airlines" },
    { id: "rates", icon: Scale, tone: "violet", label: "With Master Rates", test: (a) => state.rates.some((r) => r.source === "Master" && r.airlineId === a.id) },
    { id: "asked", icon: Send, tone: "indigo", label: "Asked for Rates", test: (a) => state.enquiries.some((e) => e.rateRequests.some((r) => r.airlineId === a.id)) },
    { id: "portal", icon: Globe, tone: "sky", label: "With Booking Portal", test: (a) => !!a.portalUrl },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || port !== "all" || kpi !== null;
  const rows = state.airlines.filter(kpiOk).filter((a) => (port === "all" || a.ports.includes(port)) && matches(q, [a.name, a.code, a.prefix, a.email]));
  const reset = () => {
    setQ("");
    setPort("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader
        title="Airline & Rates"
        subtitle="Rate requests go to the email below. The airports served decide which airlines are offered for a route."
        actions={
          <Button onClick={() => edit("new")}>
            <Plus size={16} aria-hidden /> Add airline
          </Button>
        }
      />
      <AirlineTabs />

      <KpiFilters rows={state.airlines} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search airlines" value={q} onChange={setQ} />
        <FilterSelect label="Airport served" value={port} onChange={(e) => setPort(e.target.value)}>
          <option value="all">All Airports</option>
          {served.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Airline Name</th>
                <th>Code</th>
                <th>AWB Prefix</th>
                <th>Rate Request Email</th>
                <th>Airports Served</th>
                <th className="w-px whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap">
                    <div className="font-medium">{a.name}</div>
                    {(a.contactPerson || a.mobile) && <div className="text-xs text-slate-500">{[a.contactPerson, a.mobile].filter(Boolean).join(" · ")}</div>}
                    {!!a.branchContacts?.length && (
                      <div className="text-xs text-slate-500" title={a.branchContacts.map((c) => `${c.branch}: ${c.name} ${c.email}`).join("\n")}>
                        Branch contacts: {a.branchContacts.map((c) => c.branch).join(", ")}
                      </div>
                    )}
                  </td>
                  <td>{a.code}</td>
                  <td className="font-mono">{a.prefix}</td>
                  <td className="text-slate-600">{a.email}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {a.ports.map((p) => (
                        <Badge key={p}>{p}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    <RowActions
                      label={`Actions for ${a.name}`}
                      items={[
                        { label: "Edit", onSelect: () => edit(a) },
                        ...(a.portalUrl ? [{ label: "Open booking portal", onSelect: () => window.open(a.portalUrl, "_blank", "noopener,noreferrer") }] : []),
                        { label: "Email rate desk", href: `mailto:${a.email}` },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No airlines yet. Add one with Add Airline.
          </NoResults>
        )}
      </Card>
      {editing && (
        <FormModal
          title={editing === "new" ? "Add airline" : `Edit airline · ${editing.name}`}
          initial={
            editing === "new"
              ? { name: "", code: "", prefix: "", contactPerson: "", email: "", mobile: "", portalUrl: "", ports: "", logo: "" }
              : { name: editing.name, code: editing.code, prefix: editing.prefix, contactPerson: editing.contactPerson, email: editing.email, mobile: editing.mobile, portalUrl: editing.portalUrl, ports: editing.ports.join(", "), logo: editing.logo ?? "" }
          }
          fields={[
            { key: "name", label: "Airline name", required: true },
            { key: "code", label: "Airline Code" },
            { key: "prefix", label: "AWB prefix (3 digits)", pattern: /^\d{3}$/, patternHint: "Three digits, e.g. 098" },
            { key: "contactPerson", label: "Contact Person" },
            { key: "email", label: "Email ID (rate requests)", email: true },
            { key: "mobile", label: "Mobile Number" },
            { key: "portalUrl", label: "Booking portal URL", pattern: /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?([/?#]\S*)?$/i, patternHint: "A web address, e.g. https://www.airline.com" },
            { key: "ports", label: "Airports served (comma separated codes, e.g. COK, DXB, LHR)" },
            { key: "logo", label: "Airline logo (printed as the issuer on Master AWBs)", image: true },
          ]}
          wide
          extraValid={!contactProblem}
          extra={
            <section className="mt-4 border-t border-slate-100 pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Contacts by branch</h3>
                  <p className="text-xs text-slate-500">Rate requests from a branch go to its contact&apos;s email; without one, the email above is used.</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setContacts((list) => [...list, { id: uid(), branch: branches[0] ?? "", name: "", email: "", phone: "" }])}>
                  <Plus size={13} aria-hidden /> Add contact
                </Button>
              </div>
              {contacts.length ? (
                <div className="space-y-2">
                  {contacts.map((c) => (
                    <div key={c.id} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.3fr)_9rem_2rem]">
                      <Select aria-label="Branch" value={c.branch} onChange={(e) => setContact(c.id, { branch: e.target.value })}>
                        <option value="">Branch</option>
                        {branches.map((b) => (
                          <option key={b}>{b}</option>
                        ))}
                      </Select>
                      <Input aria-label="Contact name" placeholder="Name" value={c.name} onChange={(e) => setContact(c.id, { name: e.target.value })} />
                      <Input aria-label="Contact email" type="email" placeholder="Email" value={c.email} aria-invalid={!!c.email && !isEmail(c.email)} onChange={(e) => setContact(c.id, { email: e.target.value.trim() })} />
                      <Input aria-label="Contact phone" placeholder="Phone" value={c.phone} onChange={(e) => setContact(c.id, { phone: e.target.value })} />
                      <button type="button" onClick={() => setContacts((list) => list.filter((x) => x.id !== c.id))} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${c.name || "contact"}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {contactProblem && <p className="text-xs text-red-600">{contactProblem}</p>}
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">No branch contacts yet.</p>
              )}
            </section>
          }
          onSave={(v) =>
            actions.saveAirline(
              {
                ...v,
                logo: v.logo || undefined,
                branchContacts: filled,
                code: v.code.toUpperCase(),
                ports: [
                  ...new Set(
                    v.ports
                      .split(",")
                      .map((p) => p.trim().toUpperCase())
                      .filter(Boolean),
                  ),
                ],
              },
              editing === "new" ? undefined : editing.id,
            )
          }
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
