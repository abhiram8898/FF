"use client";

import Link from "next/link";
import { useState } from "react";
import { useLookups, useStore } from "@/lib/store";
import type { EmailLog } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";
import { Badge, Card, Empty, Modal, PageHeader, Table, linkCls } from "@/components/ui";

export default function EmailLogsPage() {
  const { state } = useStore();
  const { enquiry } = useLookups();
  const [open, setOpen] = useState<EmailLog | null>(null);

  return (
    <>
      <PageHeader title="Email Logs" subtitle="Every email sent from the application: rate requests, reminders and quotations. Select a subject to read it." />
      <Card bodyClassName="p-0">
        {state.emailLogs.length ? (
          <Table>
            <thead>
              <tr>
                <th>Sent</th>
                <th>Type</th>
                <th>To</th>
                <th>Subject</th>
                <th>Enquiry</th>
              </tr>
            </thead>
            <tbody>
              {state.emailLogs.map((l) => {
                const e = enquiry(l.enquiryId);
                return (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap text-slate-500">{fmtDateTime(l.at)}</td>
                    <td>
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
                      {e && (
                        <Link href={`/enquiries/${e.id}`} className={linkCls}>
                          {e.ref}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="p-4">
            <Empty>No emails sent yet.</Empty>
          </div>
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
