"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { Badge, Button, Card, PageHeader, Table } from "@/components/ui";
import { FormModal } from "@/components/FormModal";

export default function AirlinesPage() {
  const { state, actions } = useStore();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        title="Airlines"
        subtitle="Rate requests go to the email below. The airports served decide which airlines are offered for a route."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} /> Add airline
          </Button>
        }
      />
      <Card bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <th>Airline</th>
              <th>Code</th>
              <th>AWB prefix</th>
              <th>Rate request email</th>
              <th>Booking portal</th>
              <th>Airports served</th>
            </tr>
          </thead>
          <tbody>
            {state.airlines.map((a) => (
              <tr key={a.id}>
                <td className="font-medium whitespace-nowrap">{a.name}</td>
                <td>{a.code}</td>
                <td className="font-mono">{a.prefix}</td>
                <td className="text-slate-600">{a.email}</td>
                <td>
                  {a.portalUrl && (
                    <a href={a.portalUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand-700 hover:underline">
                      Open
                    </a>
                  )}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {a.ports.map((p) => (
                      <Badge key={p}>{p}</Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {adding && (
        <FormModal
          title="Add airline"
          initial={{ name: "", code: "", prefix: "", email: "", portalUrl: "", ports: "" }}
          fields={[
            { key: "name", label: "Airline name", required: true },
            { key: "code", label: "IATA code", required: true },
            { key: "prefix", label: "AWB prefix (3 digits)" },
            { key: "email", label: "Rate request email", required: true, email: true },
            { key: "portalUrl", label: "Booking portal URL" },
            { key: "ports", label: "Airports served (comma separated codes, e.g. COK, DXB, LHR)" },
          ]}
          onSave={(v) =>
            actions.addAirline({
              ...v,
              code: v.code.toUpperCase(),
              ports: v.ports
                .split(",")
                .map((p) => p.trim().toUpperCase())
                .filter(Boolean),
            })
          }
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}
