"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { jobDraft, useLookups, useStore } from "@/lib/store";
import { Empty, PageHeader, linkCls } from "@/components/ui";
import { BookingJobForm } from "@/components/BookingJobForm";

function NewBooking() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, actions } = useStore();
  const { quotation, enquiry } = useLookups();
  const q = quotation(params.get("quotation") ?? "");
  const enq = enquiry(q?.enquiryId);

  if (!q || !enq) {
    return <Empty action={<Link href="/shipments" className={linkCls}>Back to Booking/Job</Link>}>Select a confirmed quotation from Booking/Job → Add Booking.</Empty>;
  }
  if (enq.jobId) {
    return (
      <Empty action={<Link href={`/shipments/${enq.jobId}`} className={linkCls}>Open the booking</Link>}>
        {q.ref} already has a booking/job.
      </Empty>
    );
  }

  return (
    <>
      <PageHeader back={{ href: "/shipments", label: "Booking/Job" }} title="Add Booking" subtitle={`From confirmed quotation ${q.ref}. Fields from the quotation can still be edited.`} />
      <BookingJobForm
        initial={jobDraft(state, enq, q)}
        submitLabel="Create Booking/Job"
        onSubmit={(data) => router.push(`/shipments/${actions.createJob(data).id}`)}
      />
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
