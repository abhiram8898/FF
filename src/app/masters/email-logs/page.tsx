"use client";

import Link from "next/link";
import { useState } from "react";
import { BellRing, FileText, Mail, Send } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { EmailKind, EmailLog } from "@/lib/types";
import { DATE_RANGES, type DateRange, fmtDateTime, inRange, matches } from "@/lib/utils";
import { Badge, Card, FilterBar, FilterSelect, type KpiDef, KpiFilters, kpiTest, Modal, NoResults, PageHeader, ResetFilters, RowMenu, SearchField, Table, linkCls } from "@/components/ui";

const KINDS: EmailKind[] = ["Rate Request", "Rate Reminder", "Quotation", "Quotation Reminder", "General"];

export default function EmailLogsPage() {
  const { state } = useStore();
  const { enquiry } = useLookups();
  const [open, setOpen] = useState<EmailLog | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | EmailKind>("all");
  const [range, setRange] = useState<DateRange>("all");

  const all = state.emailLogs;
  const [kpi, setKpi] = useState<string | null>(null);
  const KPIS: KpiDef<EmailLog>[] = [
    { id: "all", icon: Mail, label: "Emails Sent" },
    { id: "requests", icon: Send, tone: "indigo", label: "Rate Requests", test: (l) => l.kind === "Rate Request" },
    { id: "quotes", icon: FileText, tone: "sky", label: "Quotations", test: (l) => l.kind === "Quotation" },
    { id: "reminders", icon: BellRing, tone: "amber", label: "Reminders", test: (l) => l.kind === "Rate Reminder" || l.kind === "Quotation Reminder" },
  ];
  const kpiOk = kpiTest(KPIS, kpi);
  const filtered = !!q.trim() || kind !== "all" || range !== "all" || kpi !== null;
  const rows = all.filter(kpiOk).filter((l) => (kind === "all" || l.kind === kind) && inRange(l.at, range) && matches(q, [l.subject, ...l.to, enquiry(l.enquiryId)?.ref]));
  const reset = () => {
    setQ("");
    setKind("all");
    setRange("all");
    setKpi(null);
  };

  return (
    <>
      <PageHeader title="Email Logs" subtitle="Every email sent from the application: rate requests, reminders and quotations. Select a subject to read it." />

      <KpiFilters rows={all} kpis={KPIS} active={kpi} onChange={setKpi} />

      <FilterBar>
        <SearchField label="Search emails" value={q} onChange={setQ} />
        <FilterSelect label="Type" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="all">All Types</option>
          {KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
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
                <th>Type</th>
                <th>To</th>
                <th>Subject</th>
                <th>Enquiry ID</th>
                <th className="w-14 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const e = enquiry(l.enquiryId);
                return (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap text-slate-600">{fmtDateTime(l.at)}</td>
                    <td className="whitespace-nowrap">
                      <Badge>{l.kind}</Badge>
                    </td>
                    <td className="max-w-52 truncate text-xs" title={l.to.join("; ")}>
                      {l.to.join("; ")}
                    </td>
                    <td className="max-w-xs">
                      <button onClick={() => setOpen(l)} className={`${linkCls} block max-w-full truncate text-left`} title={l.subject}>
                        {l.subject}
                      </button>
                    </td>
                    <td className="whitespace-nowrap">
                      {e ? (
                        <Link href={`/enquiries/${e.id}`} className={linkCls}>
                          {e.ref}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-center">
                      <RowMenu
                        label={`Actions for ${l.subject}`}
                        items={[{ label: "Read email", onSelect: () => setOpen(l) }, ...(e ? [{ label: "View enquiry", href: `/enquiries/${e.id}` }] : [])]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <NoResults filtered={filtered} onClear={reset}>
            No emails sent yet.
          </NoResults>
        )}
      </Card>
      {open && (
        <Modal open onClose={() => setOpen(null)} title={open.kind} wide>
          <div className="mb-3 space-y-0.5 text-xs text-slate-500">
            <div>To: {open.to.join("; ")}</div>
            {open.cc && <div>CC: {open.cc}</div>}
            {open.bcc && <div>BCC: {open.bcc}</div>}
            <div>{fmtDateTime(open.at)}</div>
            {open.attachments.length > 0 && <div>Attachments: {open.attachments.join(", ")}</div>}
          </div>
          <div className="mb-2 text-sm font-semibold">{open.subject}</div>
          <pre className="font-sans text-sm whitespace-pre-wrap text-slate-700">{open.body}</pre>
        </Modal>
      )}
    </>
  );
}
