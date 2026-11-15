"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarClock,
  CircleCheck,
  ClipboardList,
  Eye,
  FilePlus2,
  FileStack,
  FileText,
  Inbox,
  Package,
  Plane,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { EnquiryStatus } from "@/lib/types";
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
  RowActions,
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
  awb: { icon: Plane, tone: "red" },
  docs: { icon: FileStack, tone: "slate" },
};

export default function DashboardPage() {
  const { state } = useStore();
  const { customer } = useLookups();
  const unlinked = state.inbox.filter((m) => !m.enquiryId);
  // The expanded slide: its enquiries show below, with the slides still visible on top
  const [open, setOpen] = useState<StageKey | null>(null);
  const openStage = STAGES.find((s) => s.key === open);
  // Enquiries, plus jobs that came from a reservation (they have no enquiry but go through the same job stages)
  type Row = { key: string; ref: string; href: string; customerId: string; pol: string; pod: string; status: EnquiryStatus; statusAt: string; createdAt: string; jobId?: string; editHref?: string };
  const allRows: Row[] = [
    ...state.enquiries.map((e) => ({
      key: e.id,
      ref: e.ref,
      href: `/enquiries/${e.id}`,
      customerId: e.customerId,
      pol: e.pol,
      pod: e.pod,
      status: e.status,
      statusAt: e.statusAt,
      createdAt: e.createdAt,
      jobId: e.jobId,
      editHref: isEnquiryLocked(e) ? undefined : `/enquiries/${e.id}/edit`,
    })),
    ...state.jobs
      .filter((j) => !j.enquiryId)
      .map((j) => ({ key: j.id, ref: j.ref, href: `/shipments/${j.id}`, customerId: j.customerId, pol: j.pol, pod: j.pod, status: j.status, statusAt: j.statusAt, createdAt: j.createdAt, jobId: j.id })),
  ];
  const inStage = (statuses: readonly string[]) => allRows.filter((r) => statuses.includes(r.status));
  const rows = [...(openStage ? inStage(openStage.statuses) : allRows)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, openStage ? undefined : 7);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Where every enquiry and job stands. Select a slide to expand its entries below."
        actions={
          <LinkButton href="/enquiries/new">
            <Plus size={16} aria-hidden /> New Enquiry
          </LinkButton>
        }
      />

      <KpiGrid cols={4}>
        {STAGES.map((s) => (
          <Kpi
            key={s.key}
            {...STAGE_LOOK[s.key]}
            value={inStage(s.statuses).length}
            label={s.label}
            hint={s.hint}
            active={open === s.key}
            onClick={() => setOpen(open === s.key ? null : s.key)}
          />
        ))}
      </KpiGrid>

      <div className="stagger-in grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
                  <th>Enquiry / Job</th>
                  <th>Customer</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th className="w-px whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.key} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap">
                      <Link href={e.href} className={linkCls}>
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
                      <div className="mt-0.5 text-xs text-slate-500">
                        {laps(e.statusAt)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <RowActions
                        label={`Actions for ${e.ref}`}
                        items={[
                          // The row's own record (enquiry, or a job that came from a reservation) is the eye
                          { label: e.href.startsWith("/enquiries/") ? "View enquiry" : "View job", href: e.href, icon: Eye, tone: "view" },
                          ...(e.jobId && e.href !== `/shipments/${e.jobId}` ? [{ label: "Open its job", href: `/shipments/${e.jobId}` }] : []),
                          ...(openStage?.key === "docs" && e.jobId ? [{ label: "Manage documents", href: `/documents?job=${e.jobId}` }] : []),
                          ...(e.editHref ? [{ label: "Edit enquiry", href: e.editHref }] : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="p-3">
              <Empty>Nothing in this slide right now.</Empty>
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
