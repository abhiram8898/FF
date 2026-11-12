"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLookups } from "@/lib/store";
import { omit } from "@/lib/utils";
import { Empty, PageHeader, linkCls } from "@/components/ui";
import { ReservationForm } from "@/components/reservation";

export default function EditReservationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { reservation } = useLookups();
  const r = reservation(id);
  if (!r) return <Empty action={<Link href="/reservations" className={linkCls}>Back to Shipment Planner</Link>}>This reservation doesn&apos;t exist.</Empty>;
  if (r.status === "Cancelled") {
    return <Empty action={<Link href={`/reservations/${r.id}`} className={linkCls}>Back to {r.ref}</Link>}>Cancelled reservations can&apos;t be edited.</Empty>;
  }
  return (
    <>
      <PageHeader back={{ href: `/reservations/${r.id}`, label: r.ref }} title={`Edit Reservation · ${r.ref}`} subtitle="Changes are kept in the reservation's history." />
      <ReservationForm
        existing={r}
        initial={omit(r, ["id", "ref", "createdAt", "status", "statusAt", "history", "previousDates", "seriesId", "jobId"])}
        onDone={() => router.push(`/reservations/${r.id}`)}
      />
    </>
  );
}
