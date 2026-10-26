"use client";

import Link from "next/link";
import { useLookups, useStore } from "@/lib/store";
import { fmtDate } from "@/lib/utils";
import { Badge, Card, Empty, PageHeader, Table, linkCls } from "@/components/ui";
import { RouteCell } from "@/components/workflow";

export default function ShipmentsPage() {
  const { state } = useStore();
  const { enquiry, customer, quotation, airline } = useLookups();

  return (
    <>
      <PageHeader title="Shipments" subtitle="Confirmed bookings converted from quotations to jobs" />
      <Card bodyClassName="p-0">
        {state.jobs.length ? (
          <Table>
            <thead>
              <tr>
                <th>Job No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Carrier</th>
                <th>Flight</th>
                <th>AWB</th>
              </tr>
            </thead>
            <tbody>
              {state.jobs.map((j) => {
                const e = enquiry(j.enquiryId);
                return (
                  <tr key={j.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap">
                      <Link href={`/shipments/${j.id}`} className={linkCls}>
                        {j.ref}
                      </Link>
                    </td>
                    <td className="text-slate-500">{fmtDate(j.createdAt)}</td>
                    <td>{customer(e?.customerId)?.name}</td>
                    <td>
                      <RouteCell pol={e?.pol} pod={e?.pod} route={e?.route} />
                    </td>
                    <td>{airline(quotation(j.quotationId)?.airlineId)?.name}</td>
                    <td>{e?.booking ? `${e.booking.flightNo} · ${fmtDate(e.booking.flightDate)}` : "—"}</td>
                    <td>
                      {j.awb ? (
                        <span className="font-mono text-xs">
                          {j.awb.type === "Master" ? "MAWB" : "HAWB"} {j.awb.number}
                        </span>
                      ) : (
                        <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Pending</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="p-4">
            <Empty>No shipments yet. A shipment is created when a confirmed quotation is converted to a job.</Empty>
          </div>
        )}
      </Card>
    </>
  );
}
