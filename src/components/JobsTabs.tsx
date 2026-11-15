"use client";

import { useStore } from "@/lib/store";
import { LinkTabs } from "./ui";

/** Jobs: Enquiries → Quotations → Job/Booking as tabs of one screen (FRD VI) */
export function JobsTabs() {
  const { state } = useStore();
  return (
    <LinkTabs
      label="Jobs"
      tabs={[
        { href: "/enquiries", label: "Enquiries", count: state.enquiries.length },
        { href: "/quotations", label: "Quotations", count: state.quotations.length },
        { href: "/shipments", label: "Job/Booking", count: state.jobs.length },
      ]}
    />
  );
}
