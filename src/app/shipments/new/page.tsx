"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { jobDraft, jobFromReservation, useLookups, useStore } from "@/lib/store";
import { Empty, PageHeader, linkCls } from "@/components/ui";
import { BookingJobForm } from "@/components/BookingJobForm";

function NewBooking() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, actions } = useStore();
  const { quotation, enquiry, reservation } = useLookups();
  const q = quotation(params.get("quotation") ?? "");
  const enq = enquiry(q?.enquiryId);
  const res = reservation(params.get("reservation") ?? "");
  const existing = enq?.jobId ?? res?.jobId;

  if (existing) {
    return (
      <Empty action={<Link href={`/shipments/${existing}`} className={linkCls}>Open the job</Link>}>
        {q?.ref ?? res?.ref} already has a job.
      </Empty>
    );
  }
  if (res) {
    return (
      <>
        <PageHeader back={{ href: `/reservations/${res.id}`, label: res.ref }} title="Activate Job" subtitle={`From reservation ${res.ref}. The reservation is linked, not copied.`} />
        <BookingJobForm initial={jobFromReservation(state, res)} submitLabel="Create Job" onSubmit={(data, ref) => router.push(`/shipments/${actions.createJob(data, ref).id}`)} />
      </>
    );
  }
  if (!q || !enq) {
    return <Empty action={<Link href="/shipments" className={linkCls}>Back to Job/Booking</Link>}>Select a confirmed quotation from Job/Booking → Add Booking.</Empty>;
  }

  return (
    <>
      <PageHeader back={{ href: "/shipments", label: "Job/Booking" }} title="Add Booking" subtitle={`From confirmed quotation ${q.ref}. Fields from the quotation can still be edited.`} />
      <BookingJobForm initial={jobDraft(state, enq, q)} submitLabel="Create Job" onSubmit={(data, ref) => router.push(`/shipments/${actions.createJob(data, ref).id}`)} />
    </>
  );
}

export default function NewBookingPage() {
  return (
    <Suspense>
      <NewBooking />
    </Suspense>
  );
}
