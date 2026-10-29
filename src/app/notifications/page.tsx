"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, CalendarDays, Mail, MessageCircle } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Channel, Notification } from "@/lib/types";
import { DATE_RANGES, type DateRange, fmtDateTime, inRange, matches } from "@/lib/utils";
import { Badge, Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, NoResults, PageHeader, ResetFilters, RowMenu, SearchField, Table, linkCls } from "@/components/ui";

export default function NotificationsPage() {
  const { state } = useStore();
  const { enquiry } = useLookups();
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<"all" | Channel>("all");
  const [range, setRange] = useState<DateRange>("all");

  const all = state.notifications;
  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<Notification>[] = [
    { id: "all", icon: Bell, label: "Notifications Sent" },
    { id: "email", icon: Mail, tone: "sky", label: "By Email", test: (n) => n.channel === "Email" },
    { id: "whatsapp", icon: MessageCircle, tone: "green", label: "By WhatsApp", test: (n) => n.channel === "WhatsApp" },
    { id: "week", icon: CalendarDays, tone: "violet", label: "Last 7 Days", test: (n) => inRange(n.at, "7") },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || channel !== "all" || range !== "all" || kpi !== null;
  const rows = all.filter(kpiOk).filter((n) => (channel === "all" || n.channel === channel) && inRange(n.at, range) && matches(q, [n.to, n.message, enquiry(n.enquiryId)?.ref]));
  const reset = () => {
    setQ("");
    setChannel("all");
    setRange("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader title="Client Notifications" subtitle="Every instant update sent to customers by email or WhatsApp" />

      <KpiFilters rows={all} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search notifications" value={q} onChange={setQ} />
        <FilterSelect label="Channel" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
          <option value="all">All Channels</option>
          <option value="Email">Email</option>
          <option value="WhatsApp">WhatsApp</option>
        </FilterSelect>
        <FilterSelect label="Sent date" value={range} onChange={(e) => setRange(e.target.value as DateRange)}>
          {DATE_RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Sent</th>
                <th>Channel</th>
                <th>To</th>
                <th>Enquiry ID</th>
                <th>Message</th>
                <th className="w-14 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => {
                const e = enquiry(n.enquiryId);
                return (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap text-slate-600">{fmtDateTime(n.at)}</td>
                    <td>
                      <Badge className={n.channel === "WhatsApp" ? "bg-green-50 text-green-700 ring-green-200" : "bg-sky-50 text-sky-800 ring-sky-200"}>{n.channel}</Badge>
                    </td>
                    <td className="whitespace-nowrap">{n.to}</td>
                    <td className="whitespace-nowrap">
                      {e ? (
                        <Link href={`/enquiries/${e.id}`} className={linkCls}>
                          {e.ref}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="min-w-64 text-slate-700">{n.message}</td>
                    <td className="text-center">{e && <RowMenu label={`Actions for notification to ${n.to}`} items={[{ label: "View enquiry", href: `/enquiries/${e.id}` }]} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No notifications sent yet.
          </NoResults>
        )}
      </Card>
    </>
  );
}
