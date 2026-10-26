"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { AGENT_TYPES, type AgentType } from "@/lib/types";
import { Badge, Button, Card, Empty, PageHeader, Table, Tabs } from "@/components/ui";
import { FormModal } from "@/components/FormModal";

const TABS = ["All", ...AGENT_TYPES] as const;

export default function AgentsPage() {
  const { state, actions } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [adding, setAdding] = useState(false);
  const rows = state.agents.filter((a) => tab === "All" || a.type === tab);

  return (
    <>
      <PageHeader
        title="Agents"
        subtitle="Forwarders, overseas agents, CHA (customs house agents) and transporters"
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} /> Add agent
          </Button>
        }
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th>City / Country</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Badge>{a.type}</Badge>
                  </td>
                  <td className="font-medium">{a.name}</td>
                  <td>{a.contact}</td>
                  <td className="text-slate-600">{a.email}</td>
                  <td className="whitespace-nowrap">{a.phone}</td>
                  <td>
                    {a.city}, {a.country}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="p-4">
            <Empty>No {tab.toLowerCase()} records yet.</Empty>
          </div>
        )}
      </Card>
      {adding && (
        <FormModal
          title="Add agent"
          initial={{ type: tab === "All" ? AGENT_TYPES[0] : tab, name: "", contact: "", email: "", phone: "", city: "", country: "" }}
          fields={[
            { key: "type", label: "Type", options: AGENT_TYPES },
            { key: "name", label: "Name", required: true },
            { key: "contact", label: "Contact person" },
            { key: "email", label: "Email", email: true },
            { key: "phone", label: "Phone" },
            { key: "city", label: "City" },
            { key: "country", label: "Country" },
          ]}
          onSave={(v) => actions.addAgent({ ...v, type: v.type as AgentType })}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}
