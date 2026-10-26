"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import { STAGES, fmtDateTime } from "@/lib/utils";
import { Badge, Card, PageHeader, StatusBadge, Table, linkCls } from "@/components/ui";

export default function DashboardPage() {
  const { state } = useStore();
  const { customer } = useLookups();
  const unlinked = state.inbox.filter((m) => !m.enquiryId);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Where every enquiry stands. Select a card to see its entries." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((s, i) => {
          const count = state.enquiries.filter((e) => (s.statuses as readonly string[]).includes(e.status)).length;
          return (
            <Link
              key={s.key}
              href={`/enquiries?stage=${s.key}`}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-brand-300 hover:shadow-sm"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-semibold text-slate-900 tabular-nums">{count}</span>
                <span className="text-xs font-semibold text-slate-400" aria-hidden>
                  {String.fromCharCode(65 + i)}
                </span>
              </div>
              <div className="mt-1 text-sm leading-tight font-medium text-slate-800">{s.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{s.hint}</div>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card
          title="Recent enquiries"
          actions={
            <Link href="/enquiries" className={`${linkCls} text-xs`}>
              View all
            </Link>
          }
          bodyClassName="p-0"
        >
          <Table>
            <thead>
              <tr>
                <th>Enquiry No</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {state.enquiries.slice(0, 7).map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap">
                    <Link href={`/enquiries/${e.id}`} className={linkCls}>
                      {e.ref}
                    </Link>
                  </td>
                  <td>{customer(e.customerId)?.name}</td>
                  <td className="whitespace-nowrap">
                    {e.pol} → {e.pod}
                  </td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-6">
          <Card
            title={
              <span className="flex items-center gap-2">
                <Inbox size={15} aria-hidden /> Mail Box: needs action
              </span>
            }
          >
            {unlinked.length ? (
              <ul className="space-y-2">
                {unlinked.map((m) => (
                  <li key={m.id}>
                    <Link href={`/mailbox?id=${m.id}`} className="block rounded-lg border border-slate-100 p-2.5 hover:bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-slate-800">{m.fromName}</span>
                        <Badge className={m.from === "Airline" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : undefined}>{m.from}</Badge>
                      </div>
                      <div className="truncate text-xs text-slate-500">{m.subject}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Nothing waiting. Every email is linked to an enquiry.</p>
            )}
          </Card>

          <Card
            title="Recent client notifications"
            actions={
              <Link href="/notifications" className={`${linkCls} text-xs`}>
                All
              </Link>
            }
          >
            {state.notifications.length ? (
              <ul className="space-y-3">
                {state.notifications.slice(0, 4).map((n) => (
                  <li key={n.id} className="text-sm">
                    <div className="text-slate-700">{n.message}</div>
                    <div className="text-xs text-slate-500">
                      {n.channel} · {n.to} · {fmtDateTime(n.at)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No notifications sent yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
