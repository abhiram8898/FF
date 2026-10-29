"use client";

import { useState } from "react";
import { Building2, Package, Plus, Truck, UserCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { CUSTOMER_TYPES, type Customer, type CustomerType } from "@/lib/types";
import { CONVERTED_STATUSES, CUSTOMER_TYPE_TONE, matches } from "@/lib/utils";
import { Badge, Button, Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, NoResults, PageHeader, ResetFilters, RowMenu, SearchField, Table } from "@/components/ui";
import { CustomerFormModal } from "@/components/PartyForm";

const CLOSED = ["Lost", "Cancelled", ...CONVERTED_STATUSES] as readonly string[];

export default function CustomersPage() {
  const { state } = useStore();
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | CustomerType>("all");
  const [activity, setActivity] = useState<"all" | "open" | "none">("all");

  const enquiriesOf = (id: string) => state.enquiries.filter((e) => e.customerId === id);
  const hasOpen = (id: string) => enquiriesOf(id).some((e) => !CLOSED.includes(e.status));
  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<Customer>[] = [
    { id: "all", icon: Building2, label: "Customers" },
    { id: "shipper", icon: Package, tone: "sky", label: "Shippers / Receivers", test: (c) => c.type === "Shipper/Receiver" },
    { id: "forwarder", icon: Truck, tone: "violet", label: "Forwarders / Logistics", test: (c) => c.type === "Forwarder/Logistics" },
    { id: "open", icon: UserCheck, tone: "green", label: "With Open Enquiries", test: (c) => hasOpen(c.id) },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || type !== "all" || activity !== "all" || kpi !== null;
  const rows = state.customers.filter(kpiOk).filter(
    (c) =>
      (type === "all" || c.type === type) &&
      (activity === "all" || (activity === "open" ? hasOpen(c.id) : !enquiriesOf(c.id).length)) &&
      matches(q, [c.name, c.code, c.contact, c.email, c.phone, c.address, ...c.altEmails, ...c.altPhones]),
  );
  const reset = () => {
    setQ("");
    setType("all");
    setActivity("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Shippers / receivers and forwarders / logistics companies. The primary email is used when sending quotations."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden /> Add Customer
          </Button>
        }
      />

      <KpiFilters rows={state.customers} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search customers" value={q} onChange={setQ} />
        <FilterSelect label="Customer type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="all">All Types</option>
          {CUSTOMER_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Activity" value={activity} onChange={(e) => setActivity(e.target.value as typeof activity)}>
          <option value="all">All Activity</option>
          <option value="open">With open enquiries</option>
          <option value="none">No enquiries yet</option>
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Customer Type</th>
                <th>Code</th>
                <th>Kindly Attention</th>
                <th>Email</th>
                <th>Phone / WhatsApp</th>
                <th className="text-right">Docs</th>
                <th className="text-right">Enquiries</th>
                <th className="w-14 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap">
                    <div className="font-medium">{c.name}</div>
                    <div className="max-w-64 truncate text-xs text-slate-500" title={c.address}>
                      {c.address}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    <Badge className={CUSTOMER_TYPE_TONE[c.type]}>{c.type}</Badge>
                  </td>
                  <td className="font-mono text-xs">{c.code || "—"}</td>
                  <td>{c.contact}</td>
                  <td className="text-slate-600" title={[c.email, ...c.altEmails].join("\n")}>
                    {c.email}
                    {c.altEmails.length > 0 && <span className="ml-1 text-xs text-slate-400">+{c.altEmails.length}</span>}
                  </td>
                  <td className="whitespace-nowrap" title={[c.phone, ...c.altPhones].join("\n")}>
                    {c.phone}
                    {c.altPhones.length > 0 && <span className="ml-1 text-xs text-slate-400">+{c.altPhones.length}</span>}
                  </td>
                  <td className="text-right text-slate-600 tabular-nums">{c.documents.length || "—"}</td>
                  <td className="text-right tabular-nums">{enquiriesOf(c.id).length}</td>
                  <td className="text-center">
                    <RowMenu
                      label={`Actions for ${c.name}`}
                      items={[
                        { label: "Edit", onSelect: () => setEditing(c) },
                        { label: "View enquiries", href: `/enquiries?q=${encodeURIComponent(c.name)}` },
                        { label: "New enquiry", href: "/enquiries/new" },
                        ...(c.email ? [{ label: "Send email", href: `mailto:${[c.email, ...c.altEmails].join(",")}` }] : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No customers yet. Add one with Add Customer.
          </NoResults>
        )}
      </Card>
      {editing && <CustomerFormModal existing={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
