"use client";

import Link from "next/link";
import { Plane, Ship } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Planned } from "@/lib/planned";
import { cn, fmtDate } from "@/lib/utils";
import { Badge, Modal, Table, linkCls } from "./ui";

const SOURCE_DOT: Record<Planned["source"], string> = { Job: "bg-brand-600", Reservation: "bg-emerald-600", Enquiry: "bg-amber-500" };

/**
 * Every shipment on one day, in full, from a calendar (Shipment Planner, Planned Shipments): however many
 * bookings fall on the date, and for however many customers, they are all listed here.
 */
export function DayShipmentsModal({ date, items, onClose }: { date: string; items: Planned[]; onClose: () => void }) {
  const { state } = useStore();
  const { customer, portLabel } = useLookups();
  const airline = (id?: string) => state.airlines.find((a) => a.id === id);
  const customers = new Set(items.map((p) => p.customerId)).size;
  const rows = [...items].sort((a, b) => (customer(a.customerId)?.name ?? "").localeCompare(customer(b.customerId)?.name ?? "") || a.ref.localeCompare(b.ref));
  return (
    <Modal open onClose={onClose} wide title={`Shipments on ${fmtDate(date)}`}>
      <p className="mb-3 text-sm text-slate-600">
        {items.length} shipment{items.length === 1 ? "" : "s"} for {customers} customer{customers === 1 ? "" : "s"}
      </p>
      {rows.length ? (
        <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
          <Table compact>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer / Shipper</th>
                <th>Route</th>
                <th>Airline / Flight</th>
                <th className="text-right">Pieces / Weight</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.key} className={cn(p.cancelled && "text-slate-500 line-through")}>
                  <td className="whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("size-2 shrink-0 rounded-full", SOURCE_DOT[p.source])} title={p.source} aria-hidden />
                      {p.mode === "Sea" ? <Ship size={12} aria-label="Sea" /> : <Plane size={12} aria-label="Air" />}
                      <Link href={p.href} prefetch className={`${linkCls} font-mono text-xs`}>
                        {p.ref}
                      </Link>
                    </span>
                    <span className="block text-[0.6875rem] text-slate-500">{p.source}</span>
                  </td>
                  <td className="max-w-52">
                    <span className="block truncate font-medium">{customer(p.customerId)?.name ?? "—"}</span>
                    {p.shipper && <span className="block truncate text-xs text-slate-500">Shipper: {p.shipper}</span>}
                  </td>
                  <td className="whitespace-nowrap" title={`${portLabel(p.pol)} → ${portLabel(p.pod)}`}>
                    {p.pol} → {p.pod}
                  </td>
                  <td className="whitespace-nowrap">{[airline(p.airlineId)?.name, p.flightNo].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {p.pieces} / {p.weight} kg
                  </td>
                  <td>
                    <Badge className={p.tone}>{p.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Nothing planned on this day with the current filters.</p>
      )}
    </Modal>
  );
}
