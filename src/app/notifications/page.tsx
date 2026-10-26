"use client";

import Link from "next/link";
import { useLookups, useStore } from "@/lib/store";
import { fmtDateTime } from "@/lib/utils";
import { Badge, Card, Empty, PageHeader, Table, linkCls } from "@/components/ui";

export default function NotificationsPage() {
  const { state } = useStore();
  const { enquiry } = useLookups();

  return (
    <>
      <PageHeader title="Client notifications" subtitle="Every instant update sent to customers by email or WhatsApp" />
      <Card bodyClassName="p-0">
        {state.notifications.length ? (
          <Table>
            <thead>
              <tr>
                <th>When</th>
                <th>Channel</th>
                <th>To</th>
                <th>Enquiry</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {state.notifications.map((n) => {
                const e = enquiry(n.enquiryId);
                return (
                  <tr key={n.id}>
                    <td className="whitespace-nowrap text-slate-500">{fmtDateTime(n.at)}</td>
                    <td>
                      <Badge className={n.channel === "WhatsApp" ? "bg-green-50 text-green-700 ring-green-200" : undefined}>{n.channel}</Badge>
                    </td>
                    <td className="whitespace-nowrap">{n.to}</td>
                    <td>
                      {e && (
                        <Link href={`/enquiries/${e.id}`} className={linkCls}>
                          {e.ref}
                        </Link>
                      )}
                    </td>
                    <td className="text-slate-700">{n.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="p-4">
            <Empty>No notifications sent yet.</Empty>
          </div>
        )}
      </Card>
    </>
  );
}
