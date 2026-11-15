"use client";

import { useState } from "react";
import {
  BookUser,
  CircleCheck,
  FilePen,
  Landmark,
  Package,
  Plus,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  STAKEHOLDER_STATUSES,
  STAKEHOLDER_TYPES,
  type Customer,
  type StakeholderStatus,
  type StakeholderType,
} from "@/lib/types";
import { CUSTOMER_TYPE_TONE, fmtDate, matches } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  Field,
  FilterBar,
  FilterSelect,
  KeyValue,
  type KpiDef,
  KpiFilters,
  kpiTest,
  Modal,
  NoResults,
  PageHeader,
  ResetFilters,
  RowActions,
  SearchField,
  Select,
  Table,
} from "@/components/ui";
import { StakeholderFormModal } from "@/components/PartyForm";
import { DocList } from "@/components/inputs";

const STATUS_TONE: Record<StakeholderStatus, string> = {
  Active: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  Inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  Draft: "bg-amber-50 text-amber-800 ring-amber-200",
};

export default function StakeholdersPage() {
  const { state, actions } = useStore();
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [statusFor, setStatusFor] = useState<Customer | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | StakeholderType>("all");
  const [status, setStatus] = useState<"all" | StakeholderStatus>("all");

  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<Customer>[] = [
    { id: "all", icon: BookUser, label: "Stakeholders" },
    {
      id: "customers",
      icon: Package,
      tone: "sky",
      label: "Shippers / Consignees",
      test: (c) => c.type === "Shipper" || c.type === "Consignee",
    },
    {
      id: "cha",
      icon: Landmark,
      tone: "violet",
      label: "CHA / Agents",
      test: (c) => c.type === "CHA" || c.type === "Agents",
    },
    {
      id: "active",
      icon: CircleCheck,
      tone: "green",
      label: "Active",
      test: (c) => c.status === "Active",
    },
    {
      id: "draft",
      icon: FilePen,
      tone: "amber",
      label: "Draft",
      test: (c) => c.status === "Draft",
    },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered =
    !!q.trim() || type !== "all" || status !== "all" || kpi !== null;
  const rows = state.customers
    .filter(kpiOk)
    .filter(
      (c) =>
        (type === "all" || c.type === type) &&
        (status === "all" || c.status === status) &&
        matches(q, [
          c.name,
          c.code,
          c.contact,
          c.email,
          c.phone,
          c.country,
          c.city,
          c.gstin,
        ]),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const reset = () => {
    setQ("");
    setType("all");
    setStatus("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader
        title="Stakeholders"
        subtitle="Every company you work with: logistics, freight forwarders, shippers, consignees, vendors, agents and CHAs. "
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden /> Add Customer
          </Button>
        }
      />

      <KpiFilters
        cols={5}
        rows={state.customers}
        kpis={KPIS}
        active={kpi}
        onChange={setKpi}
      />

      <FilterBar>
        <SearchField label="Search stakeholders" value={q} onChange={setQ} />
        <FilterSelect
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          <option value="all">All Types</option>
          {STAKEHOLDER_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="all">All Status</option>
          {STAKEHOLDER_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Type</th>
                <th>Country</th>
                <th>Contact Person</th>
                <th>Contact Number</th>
                <th>Added Date</th>
                <th>Status</th>
                <th className="w-px whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap">
                    <button
                      className="text-left font-medium text-slate-900 hover:text-brand-700 hover:underline"
                      onClick={() => setViewing(c)}
                    >
                      {c.name}
                    </button>
                    <div className="text-xs text-slate-500">
                      {c.code && <span className="font-mono">{c.code} · </span>}
                      {c.email}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    <Badge className={CUSTOMER_TYPE_TONE[c.type]}>
                      {c.type}
                    </Badge>
                  </td>
                  <td>{c.country}</td>
                  <td className="whitespace-nowrap">{c.contact}</td>
                  <td className="whitespace-nowrap">{c.phone}</td>
                  <td className="whitespace-nowrap text-slate-600">
                    {fmtDate(c.createdAt)}
                  </td>
                  <td>
                    <Badge className={STATUS_TONE[c.status]}>{c.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap">
                    <RowActions
                      label={`Actions for ${c.name}`}
                      items={[
                        { label: "View", onSelect: () => setViewing(c) },
                        { label: "Edit", onSelect: () => setEditing(c) },
                        {
                          label: "Status Change",
                          onSelect: () => setStatusFor(c),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No stakeholders yet. Add one with Add Customer.
          </NoResults>
        )}
      </Card>

      {editing && (
        <StakeholderFormModal
          existing={editing === "new" ? undefined : editing}
          defaultType={type === "all" ? "Shipper" : type}
          onClose={() => setEditing(null)}
        />
      )}
      {viewing && (
        <Modal
          open
          wide
          onClose={() => setViewing(null)}
          title={viewing.name}
          footer={
            <Button
              onClick={() => {
                setEditing(viewing);
                setViewing(null);
              }}
            >
              Edit
            </Button>
          }
        >
          <KeyValue
            cols={3}
            items={[
              ["Type", viewing.type],
              ["Status", viewing.status],
              ["Company Code", viewing.code],
              ["Address", viewing.address],
              ["Contact Person", viewing.contact],
              ["Email", [viewing.email, ...viewing.altEmails].join(", ")],
              [
                "Contact Number",
                [viewing.phone, ...viewing.altPhones].join(", "),
              ],
              ["PAN", viewing.pan],
              ["GSTIN", viewing.gstin],
              ["Bank Account", viewing.bankAccount],
              ["Added", fmtDate(viewing.createdAt)],
              [
                "Enquiries",
                String(
                  state.enquiries.filter((e) => e.customerId === viewing.id)
                    .length,
                ),
              ],
            ]}
          />
          {viewing.documents.length > 0 && (
            <div className="mt-3">
              <h3 className="mb-2 text-xs font-semibold text-slate-500 uppercase">
                KYC documents
              </h3>
              <DocList docs={viewing.documents} />
            </div>
          )}
        </Modal>
      )}
      {statusFor && (
        <StatusModal
          c={statusFor}
          onClose={() => setStatusFor(null)}
          onSave={(s) => {
            actions.setCustomerStatus(statusFor.id, s);
            setStatusFor(null);
          }}
        />
      )}
    </>
  );
}

function StatusModal({
  c,
  onClose,
  onSave,
}: {
  c: Customer;
  onClose: () => void;
  onSave: (s: StakeholderStatus) => void;
}) {
  const [s, setS] = useState(c.status);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Status Change · ${c.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button disabled={s === c.status} onClick={() => onSave(s)}>
            Update
          </Button>
        </>
      }
    >
      <Field
        label="Status"
        hint="Inactive stakeholders are hidden from the dropdowns on new records"
      >
        <Select
          value={s}
          onChange={(e) => setS(e.target.value as StakeholderStatus)}
        >
          {STAKEHOLDER_STATUSES.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}
