"use client";

import Link from "next/link";
import { useState } from "react";
import { AlarmClock, CalendarClock, FileText, Send } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import { type FollowUp, cn, fmtDateTime, followUps, isDue, matches } from "@/lib/utils";
import { Badge, Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, NoResults, PageHeader, ResetFilters, RowMenu, SearchField, Table, linkCls } from "@/components/ui";

export default function FollowUpsPage() {
  const { state } = useStore();
  const { customer, airline } = useLookups();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | FollowUp["kind"]>("all");
  const [when, setWhen] = useState<"all" | "due" | "upcoming">("all");
  const { rateReminderHours, quoteReminderDays } = state.settings.alerts;

  const all = followUps(state.enquiries, state.quotations, state.settings.alerts);
  const party = (f: FollowUp) => (f.airlineId ? airline(f.airlineId)?.name : customer(f.enquiry.customerId)?.name);
  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<FollowUp>[] = [
    { id: "due", icon: AlarmClock, tone: "red", label: "Due Now", test: isDue },
    { id: "upcoming", icon: CalendarClock, tone: "slate", label: "Upcoming", test: (f) => !isDue(f) },
    { id: "rates", icon: Send, tone: "indigo", label: "Rate Requests", test: (f) => f.kind === "Rate request" },
    { id: "quotes", icon: FileText, tone: "sky", label: "Quotations", test: (f) => f.kind === "Quotation" },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || kind !== "all" || when !== "all" || kpi !== null;
  const rows = all.filter(kpiOk).filter(
    (f) =>
      (kind === "all" || f.kind === kind) &&
      (when === "all" || (when === "due") === isDue(f)) &&
      matches(q, [f.enquiry.ref, f.quotation?.ref, party(f)]),
  );
  const reset = () => {
    setQ("");
    setKind("all");
    setWhen("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader
        title="Follow-ups"
        subtitle={`Rate requests and quotations still waiting on a reply. Reminders fall due ${rateReminderHours} hours after a rate request and ${quoteReminderDays} days after a quotation.`}
      />

      <KpiFilters rows={all} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search follow-ups" value={q} onChange={setQ} />
        <FilterSelect label="Type" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="all">All Types</option>
          <option value="Rate request">Rate requests</option>
          <option value="Quotation">Quotations</option>
        </FilterSelect>
        <FilterSelect label="Due" value={when} onChange={(e) => setWhen(e.target.value as typeof when)}>
          <option value="all">All Reminders</option>
          <option value="due">Due now</option>
          <option value="upcoming">Upcoming</option>
        </FilterSelect>
        <ResetFilters onClick={reset} disabled={!filtered} />
      </FilterBar>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Type</th>
                <th>Waiting On</th>
                <th>Sent</th>
                <th>Reminders</th>
                <th>Next Reminder</th>
                <th className="w-14 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const due = isDue(f);
                const href = f.quotation ? `/quotations/${f.quotation.id}` : `/enquiries/${f.enquiry.id}`;
                return (
                  <tr key={`${f.kind}-${f.enquiry.id}-${f.airlineId ?? ""}`} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap">
                      <Link href={href} className={linkCls}>
                        {f.quotation?.ref ?? f.enquiry.ref}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{f.kind}</td>
                    <td className="max-w-52 truncate">
                      {party(f)}
                      <div className="text-xs text-slate-500">{f.airlineId ? "Airline" : "Customer"}</div>
                    </td>
                    <td className="whitespace-nowrap text-slate-600">{fmtDateTime(f.sentAt)}</td>
                    <td className="text-slate-600 tabular-nums">{f.reminders || "—"}</td>
                    <td className="whitespace-nowrap">
                      <Badge className={cn(due ? "bg-red-50 text-red-700 ring-red-200" : "bg-slate-100 text-slate-700 ring-slate-200")}>
                        {due ? "Due" : "Upcoming"} · {fmtDateTime(f.dueAt)}
                      </Badge>
                    </td>
                    <td className="text-center">
                      <RowMenu
                        label={`Actions for ${f.quotation?.ref ?? f.enquiry.ref}`}
                        items={[{ label: f.quotation ? "Open quotation" : "Open enquiry", href }, ...(f.quotation ? [{ label: "Open enquiry", href: `/enquiries/${f.enquiry.id}` }] : [])]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            Nothing to follow up. Every rate request and quotation has a reply.
          </NoResults>
        )}
      </Card>
    </>
  );
}
