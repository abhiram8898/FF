"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, Copy } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Job } from "@/lib/types";
import { AWB_TONE, fmtDate, fmtDateTime, omit } from "@/lib/utils";
import { Badge, Button, Card, Empty, KeyValue, LinkButton, PageHeader, StatusBadge, linkCls } from "@/components/ui";
import { BookingJobForm } from "@/components/BookingJobForm";
import { JobNextAction, docsLineStatus } from "@/components/jobflow";
import { awbLabel } from "@/components/awb";
import { DocList } from "@/components/inputs";

function ShipmentPageInner() {
  const { id } = useParams<{ id: string }>();
  const open = useSearchParams().get("open");
  const { job } = useLookups();
  const j = job(id);
  if (!j) {
    return (
      <Empty action={<Link href="/shipments" className={linkCls}>Back to Job/Booking</Link>}>
        This booking doesn&apos;t exist. It may have been removed when the demo data was reset.
      </Empty>
    );
  }
  return <ShipmentView key={j.id} job={j} openAwb={open === "awb"} />;
}

export default function ShipmentPage() {
  return (
    <Suspense>
      <ShipmentPageInner />
    </Suspense>
  );
}

function ShipmentView({ job, openAwb }: { job: Job; openAwb: boolean }) {
  const router = useRouter();
  const { state, actions } = useStore();
  const { enquiry, quotation, reservation, awbsOf } = useLookups();
  const enq = enquiry(job.enquiryId);
  const q = quotation(job.quotationId);
  const res = reservation(job.reservationId);
  const awbs = awbsOf(job.id);
  const awb = awbs[0];
  const bills = state.bills.filter((b) => b.jobId === job.id);
  // Everything except identity and the documents workflow is edited in the form
  const editable = omit(job, ["id", "ref", "createdAt", "statusAt", "uploadCompletedAt", "merged", "dispatchedAt"]);

  return (
    <>
      <PageHeader
        back={{ href: "/shipments", label: "Job/Booking" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{job.ref}</span> <StatusBadge status={job.status} />
          </span>
        }
        subtitle={
          <>
            {enq && (
              <>
                From{" "}
                <Link href={`/enquiries/${enq.id}`} className={linkCls}>
                  {enq.ref}
                </Link>
              </>
            )}
            {q && (
              <>
                {" "}
                /{" "}
                <Link href={`/quotations/${q.id}`} className={linkCls}>
                  {q.ref}
                </Link>
              </>
            )}
            {res && (
              <>
                From reservation{" "}
                <Link href={`/reservations/${res.id}`} className={linkCls}>
                  {res.ref}
                </Link>
              </>
            )}{" "}
            · booked {fmtDate(job.date)}
          </>
        }
        actions={
          <>
            {job.status !== "Cancelled" && (
              <LinkButton href={`/reservations/new?fromJob=${job.id}`} variant="secondary" size="sm" title="Plan a new reservation with this job's details">
                <CalendarPlus size={14} aria-hidden /> Convert to Reservation
              </LinkButton>
            )}
            <Button variant="secondary" size="sm" onClick={() => router.push(`/shipments/${actions.duplicateJob(job.id).id}`)}>
              <Copy size={14} aria-hidden /> Duplicate
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          <Card title="Next action" className="border-brand-200 ring-1 ring-brand-100">
            <JobNextAction job={job} initial={openAwb && !awb ? "awb" : undefined} />
          </Card>
          {/* Re-key whenever the job changes elsewhere (AWB, documents, stage), so a save never writes back stale values */}
          <BookingJobForm key={JSON.stringify(editable)} initial={editable} jobRef={job.ref} submitLabel="Save changes" requireChanges onSubmit={(data) => actions.updateJob(job.id, data)} />
        </div>
        <aside className="min-w-0 space-y-3">
          <Card title={awbs.length > 1 ? `Airway Bills (${awbs.length})` : "Airway Bill"}>
            {awb ? (
              <div className="space-y-2 text-sm">
                {awb.mawbNo && awbs.some((a) => a.type === "House") && <div className="font-mono text-xs text-slate-500">MAWB {awb.mawbNo}</div>}
                {awbs.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium">{awbLabel(a)}</span>
                    <Badge className={AWB_TONE[a.status]}>{a.status}</Badge>
                  </div>
                ))}
                <div>
                  <Link href="/awbs" className={`${linkCls} text-xs`}>
                    All airway bills
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Not executed yet.</p>
            )}
          </Card>
          <Card title="Documents" actions={<Link href={`/documents?job=${job.id}`} className={`${linkCls} text-xs`}>Manage</Link>}>
            <KeyValue
              compact
              cols={2}
              items={[
                ["Status", docsLineStatus(job)],
                ["Uploaded", String(job.documents.length)],
                ["Merged", job.merged ? fmtDateTime(job.merged.at) : ""],
                ["Pre-alert sent", job.dispatchedAt ? fmtDateTime(job.dispatchedAt) : ""],
              ]}
            />
            {job.merged?.dataUrl && (
              <a href={job.merged.dataUrl} download={job.merged.fileName} className={`${linkCls} mt-2 block text-xs`}>
                Download {job.merged.fileName}
              </a>
            )}
            {job.documents.length > 0 && (
              <div className="mt-3">
                <DocList docs={job.documents} />
              </div>
            )}
          </Card>
          {bills.length > 0 && (
            <Card title="Billing">
              <ul className="space-y-1.5 text-sm">
                {bills.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2">
                    <Link href={`/billing/${b.id}`} className={`${linkCls} font-mono text-xs`}>
                      {b.no}
                    </Link>
                    <span className="text-xs text-slate-500">
                      {b.kind} · {b.status}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
