"use client";

import { useStore } from "@/lib/store";
import { LinkTabs } from "./ui";

/** Master Data → Airline & Rates: Airline Master | Airline Rate Master */
export function AirlineTabs() {
  const { state } = useStore();
  return (
    <LinkTabs
      label="Airline & Rates"
      tabs={[
        {
          href: "/masters/airlines",
          label: "Airline Master",
          count: state.airlines.length,
        },
        {
          href: "/masters/rates",
          label: "Airline Rate Master",
          count: state.rates.filter((r) => r.source === "Master").length,
        },
      ]}
    />
  );
}
