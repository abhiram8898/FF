"use client";

import { useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import type { MailDraft } from "@/lib/types";
import { Button, Field, Input, Modal, Textarea } from "./ui";

const splitEmails = (v: string) =>
  v
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Compose Email box (FRD p.6 / p.13). Sending records the mail in Email Logs;
 * no external email is sent in this POC.
 */
export function ComposeEmail({
  title = "Compose Email",
  initial,
  attachments = [],
  note,
  sendLabel = "Send",
  onSend,
  onClose,
}: {
  title?: string;
  initial: Partial<MailDraft> & Pick<MailDraft, "to" | "subject" | "body">;
  attachments?: string[];
  note?: React.ReactNode;
  sendLabel?: string;
  onSend: (mail: MailDraft) => void;
  onClose: () => void;
}) {
  const { state } = useStore();
  const [to, setTo] = useState(initial.to.join("; "));
  const [cc, setCc] = useState(initial.cc ?? "");
  const [bcc, setBcc] = useState(initial.bcc ?? "");
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const invalid = splitEmails(to).filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const valid = splitEmails(to).length > 0 && !invalid.length && subject.trim() && body.trim();

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={() => onSend({ to: splitEmails(to), cc, bcc, subject, body })}>
            <Send size={14} /> {sendLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Demo mode: Send records this email action in Email Logs. No external email will be sent.
        </div>
        {note}
        <Field label="To *" hint={invalid.length > 0 && <span className="text-red-600">Check these addresses: {invalid.join(", ")}</span>}>
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Separate addresses with ;" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="CC">
            <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Optional CC email addresses" />
          </Field>
          <Field label="BCC">
            <Input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="Optional BCC email addresses" />
          </Field>
        </div>
        <Field label="Subject *">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Email Body *">
          <Textarea rows={11} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                <Paperclip size={12} /> {a}
              </span>
            ))}
          </div>
        )}
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-3 text-xs">
          <div className="mb-1 font-semibold text-slate-700">Company Signature</div>
          <pre className="font-sans whitespace-pre-wrap text-slate-600">{state.settings.company.signature}</pre>
        </div>
      </div>
    </Modal>
  );
}
