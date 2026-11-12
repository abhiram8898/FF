"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import { ReservationForm, blankReservation, reservationFromJob } from "@/components/reservation";

function NewReservation() {
  const router = useRouter();
  const params = useSearchParams();
  const { state } = useStore();
  const fromJob = state.jobs.find((j) => j.id === params.get("fromJob") && j.status !== "Cancelled");
  return (
    <>
      <PageHeader
        back={fromJob ? { href: `/shipments/${fromJob.id}`, label: fromJob.ref } : { href: "/reservations", label: "Shipment Planner" }}
        title="New Reservation"
        subtitle={
          fromJob
            ? `Pre-filled from job ${fromJob.ref}. Pick the shipment date, check the details and create. The job itself is not changed.`
            : "A fixed shipment booked ahead. Recurring shipments create one reservation per occurrence."
        }
      />
      <ReservationForm
        key={fromJob?.id ?? "blank"}
        initial={fromJob ? reservationFromJob(state, fromJob) : blankReservation(state, params.get("date") ?? undefined, params.get("customer") ?? "")}
        onDone={(ids) => router.push(ids.length === 1 ? `/reservations/${ids[0]}` : "/reservations")}
      />
    </>
  );
}

export default function NewReservationPage() {
  return (
    <Suspense>
      <NewReservation />
    </Suspense>
  );
}
