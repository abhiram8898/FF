"use client";

import Link from "next/link";
import { useState } from "react";
import { BellRing, Hourglass, MailCheck, Send } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import { DATE_RANGES, type DateRange, fmtDateTime, inRange, matches } from "@/lib/utils";
import { Badge, Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, NoResults, PageHeader, ResetFilters, RowMenu, SearchField, Table, linkCls } from "@/components/ui";
import { RouteCell } from "@/components/workflow";

export default function RateRequestsPage() {
  const { state } = useStore();
  const { customer, airline } = useLookups();
  const [q, setQ] = useState("");
  const [reply, setReply] = useState<"all" | "awaiting" | "received">("all");
  const [carrier, setCarrier] = useState("all");
  const [range, setRange] = useState<DateRange>("all");

  // One row per airline asked, newest first
  const all = state.enquiries.flatMap((e) => e.rateRequests.map((r) => ({ e, r }))).sort((a, b) => b.r.sentAt.localeCompare(a.r.sentAt));

  const [kpi, setKpi] = useState<string | null>(null);
  type Row = (typeof all)[number];
  const KPIS: KpiDef<Row>[] = [
    { id: "all", icon: Send, label: "Requests Sent" },
    { id: "awaiting", icon: Hourglass, tone: "amber", label: "Awaiting Reply", test: ({ r }) => !r.repliedAt },
    { id: "received", icon: MailCheck, tone: "green", label: "Rates Received", test: ({ r }) => !!r.repliedAt },
    { id: "reminded", icon: BellRing, tone: "violet", label: "Reminded", test: ({ r }) => r.reminders.length > 0 },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || reply !== "all" || carrier !== "all" || range !== "all" || kpi !== null;
  const rows = all.filter(kpiOk).filter(
    ({ e, r }) =>
      (reply === "all" || (reply === "received") === !!r.repliedAt) &&
      (carrier === "all" || r.airlineId === carrier) &&
      inRange(r.sentAt, range) &&
      matches(q, [e.ref, customer(e.customerId)?.name, e.pol, e.pod, airline(r.airlineId)?.name]),
  );
  const reset = () => {
    setQ("");
    setReply("all");
    setCarrier("all");
    setRange("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader title="Rate Requests" subtitle="Rates requested from airlines for each enquiry, and whether they have replied" />

      <KpiFilters rows={all} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search rate requests" value={q} onChange={setQ} />
        <FilterSelect label="Reply" value={reply} onChange={(e) => setReply(e.target.value as typeof reply)}>
          <option value="all">All Replies</option>
          <option value="awaiting">Awaiting reply</option>
          <option value="received">Received</option>
        </FilterSelect>
        <FilterSelect label="Airline" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
          <option value="all">All Airlines</option>
          {state.airlines.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Requested date" value={range} onChange={(e) => setRange(e.target.value as DateRange)}>
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
                <th>Enquiry ID</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Airline</th>
                <th>Requested</th>
                <th>Reminders</th>
                <th>Reply</th>
                <th className="w-14 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, r }) => (
                <tr key={`${e.id}-${r.airlineId}`} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap">
                    <Link href={`/enquiries/${e.id}`} className={linkCls}>
                      {e.ref}
                    </Link>
                  </td>
                  <td className="max-w-44 truncate">{customer(e.customerId)?.name}</td>
                  <td>
                    <RouteCell pol={e.pol} pod={e.pod} />
                  </td>
                  <td>{airline(r.airlineId)?.name}</td>
                  <td className="whitespace-nowrap text-slate-600">{fmtDateTime(r.sentAt)}</td>
                  <td className="text-slate-600 tabular-nums">{r.reminders.length || "—"}</td>
                  <td className="whitespace-nowrap">
                    {r.repliedAt ? (
                      <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">Received {fmtDateTime(r.repliedAt)}</Badge>
                    ) : (
                      <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Awaiting reply</Badge>
                    )}
                  </td>
                  <td className="text-center">
                    <RowMenu label={`Actions for ${e.ref}`} items={[{ label: "View enquiry", href: `/enquiries/${e.id}` }]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No rate requests yet. Use Get Rate from Airline on an enquiry to request rates.
          </NoResults>
        )}
      </Card>
    </>
  );
}
