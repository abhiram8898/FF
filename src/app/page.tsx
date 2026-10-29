"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarClock,
  CircleCheck,
  ClipboardList,
  FilePlus2,
  FileText,
  Inbox,
  Package,
  Plus,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import {
  MAIL_TAG,
  STAGES,
  type StageKey,
  fmtDateTime,
  isEnquiryLocked,
  laps,
} from "@/lib/utils";
import {
  Badge,
  Card,
  Empty,
  Kpi,
  KpiGrid,
  LinkButton,
  PageHeader,
  RowMenu,
  StatusBadge,
  Table,
  linkCls,
} from "@/components/ui";
import { RouteCell } from "@/components/workflow";

const STAGE_LOOK: Record<
  StageKey,
  { icon: LucideIcon; tone: React.ComponentProps<typeof Kpi>["tone"] }
> = {
  pending: { icon: FilePlus2, tone: "blue" },
  rates: { icon: ClipboardList, tone: "indigo" },
  quoted: { icon: FileText, tone: "sky" },
  date: { icon: CalendarClock, tone: "amber" },
  booking: { icon: Package, tone: "violet" },
  booked: { icon: CircleCheck, tone: "green" },
};

export default function DashboardPage() {
  const { state } = useStore();
  const { customer } = useLookups();
  const unlinked = state.inbox.filter((m) => !m.enquiryId);
  // The expanded slide: its enquiries show below, with the slides still visible on top
  const [open, setOpen] = useState<StageKey | null>(null);
  const openStage = STAGES.find((s) => s.key === open);
  const inStage = (statuses: readonly string[]) =>
    state.enquiries.filter((e) => statuses.includes(e.status));
  const rows = [...(openStage ? inStage(openStage.statuses) : state.enquiries)]
    .sort((a, b) => b.no - a.no)
    .slice(0, openStage ? undefined : 7);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Where every enquiry stands. Select a slide to expand its enquiries below."
        actions={
          <LinkButton href="/enquiries/new">
            <Plus size={16} aria-hidden /> New Enquiry
          </LinkButton>
        }
      />

      <KpiGrid cols={3}>
        {STAGES.map((s) => (
          <Kpi
            key={s.key}
            {...STAGE_LOOK[s.key]}
            value={inStage(s.statuses).length}
            label={s.label}
            active={open === s.key}
            onClick={() => setOpen(open === s.key ? null : s.key)}
          />
        ))}
      </KpiGrid>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card
          title={
            openStage ? (
              <span className="flex items-center gap-2">
                {openStage.label}
                <span className="rounded-full bg-brand-50 px-2 text-xs font-medium text-brand-700">
                  {rows.length}
                </span>
              </span>
            ) : (
              "Recent enquiries"
            )
          }
          actions={
            openStage ? (
              <>
                <button
                  onClick={() => setOpen(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Collapse slide"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <Link href="/enquiries" className={`${linkCls} text-xs`}>
                View all
              </Link>
            )
          }
          bodyClassName="p-0"
        >
          {rows.length ? (
            <Table>
              <thead>
                <tr>
                  <th>Enquiry ID</th>
                  <th>Customer</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th className="w-14 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap">
                      <Link href={`/enquiries/${e.id}`} className={linkCls}>
                        {e.ref}
                      </Link>
                    </td>
                    <td className="max-w-44 truncate">
                      {customer(e.customerId)?.name}
                    </td>
                    <td>
                      <RouteCell pol={e.pol} pod={e.pod} />
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusBadge status={e.status} />
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {laps(e.statusAt)}
                      </div>
                    </td>
                    <td className="text-center">
                      <RowMenu
                        label={`Actions for ${e.ref}`}
                        items={[
                          { label: "View", href: `/enquiries/${e.id}` },
                          ...(isEnquiryLocked(e)
                            ? []
                            : [{ label: "Edit", href: `/enquiries/${e.id}/edit` }]),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="p-3">
              <Empty>No enquiries in this slide right now.</Empty>
            </div>
          )}
        </Card>

        <div className="space-y-3">
          <Card
            title={
              <span className="flex items-center gap-2">
                <Inbox size={15} aria-hidden /> Mail Box: needs action
              </span>
            }
            actions={
              <Link href="/mailbox" className={`${linkCls} text-xs`}>
                Open
              </Link>
            }
          >
            {unlinked.length ? (
              <ul className="space-y-2">
                {unlinked.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/mailbox?id=${m.id}`}
                      className="block rounded-lg border border-slate-100 p-2.5 hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-slate-800">
                          {m.fromName}
                        </span>
                        <Badge className={MAIL_TAG[m.from].className}>
                          {MAIL_TAG[m.from].label}
                        </Badge>
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {m.subject}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                Nothing waiting. Every email is linked to an enquiry.
              </p>
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
