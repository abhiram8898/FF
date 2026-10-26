"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Card, PageHeader, Table } from "@/components/ui";
import { FormModal } from "@/components/FormModal";

export default function CustomersPage() {
  const { state, actions } = useStore();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Shippers / consignees. The email is used automatically when sending quotations."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} /> Add customer
          </Button>
        }
      />
      <Card bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>Kindly attention</th>
              <th>Email</th>
              <th>Phone / WhatsApp</th>
              <th className="text-right">Enquiries</th>
            </tr>
          </thead>
          <tbody>
            {state.customers.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="text-slate-600">{c.address}</td>
                <td>{c.contact}</td>
                <td className="text-slate-600">{c.email}</td>
                <td className="whitespace-nowrap">{c.phone}</td>
                <td className="text-right">{state.enquiries.filter((e) => e.customerId === c.id).length}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {adding && (
        <FormModal
          title="Add customer"
          initial={{ name: "", address: "", contact: "", email: "", phone: "" }}
          fields={[
            { key: "name", label: "Company name", required: true },
            { key: "address", label: "Address" },
            { key: "contact", label: "Kindly attention (contact person)" },
            { key: "email", label: "Email", required: true, email: true },
            { key: "phone", label: "Phone / WhatsApp" },
          ]}
          onSave={actions.addCustomer}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}
