"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useLookups, useStore } from "@/lib/store";
import type { Enquiry } from "@/lib/types";
import { STAGES, type StageKey, cn, fmtDate, laps } from "@/lib/utils";
import { Card, Empty, Input, LinkButton, PageHeader, RowMenu, StatusBadge, Table, linkCls } from "@/components/ui";
import { ChangeStatusModal, RouteCell } from "@/components/workflow";

function Enquiries() {
  const { state } = useStore();
  const { customer } = useLookups();
  const params = useSearchParams();
  const initialStage = params.get("stage") as StageKey | null;
  const [stage, setStage] = useState<StageKey | "all">(initialStage && STAGES.some((s) => s.key === initialStage) ? initialStage : "all");
  const [q, setQ] = useState("");
  const [statusFor, setStatusFor] = useState<Enquiry | null>(null);

  const stageDef = STAGES.find((s) => s.key === stage);
  const term = q.trim().toLowerCase();
  const rows = state.enquiries.filter((e) => {
    if (stageDef && !(stageDef.statuses as readonly string[]).includes(e.status)) return false;
    if (!term) return true;
    return [e.ref, customer(e.customerId)?.name, e.pol, e.pod, e.commodity, e.status].some((v) => v?.toLowerCase().includes(term));
  });
  const count = (statuses: readonly string[]) => state.enquiries.filter((e) => statuses.includes(e.status)).length;

  return (
    <>
      <PageHeader
        title="Enquiries"
        subtitle="Enquiries added from the Mail Box or entered manually"
        actions={
          <LinkButton href="/enquiries/new">
            <Plus size={16} aria-hidden /> Add Enquiry
          </LinkButton>
        }
      />
      <div className="mb-4 flex flex-col-reverse gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by stage">
          {[{ key: "all", label: "All", n: state.enquiries.length } as const, ...STAGES.map((s) => ({ ...s, n: count(s.statuses) }))].map((s) => (
            <button
              key={s.key}
              onClick={() => setStage(s.key)}
              aria-pressed={stage === s.key}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500",
                stage === s.key ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {s.label} <span className={stage === s.key ? "text-brand-100" : "text-slate-400"}>{s.n}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-80">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input placeholder="Search enquiry, customer, port…" aria-label="Search enquiries" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card bodyClassName="p-0">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Enquiry No · Date · Type</th>
                <th>Customer Name</th>
                <th>Route (POL → POD)</th>
                <th>Status</th>
                <th>Status Date / Laps</th>
                <th className="w-10">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap">
                    <Link href={`/enquiries/${e.id}`} className={linkCls}>
                      {e.ref}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {fmtDate(e.enquiryDate)} · {e.shipmentMode} · {e.cargoMode}
                    </div>
                  </td>
                  <td className="max-w-44 truncate" title={customer(e.customerId)?.name}>
                    {customer(e.customerId)?.name}
                  </td>
                  <td>
                    <RouteCell pol={e.pol} pod={e.pod} route={e.route} />
                  </td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="whitespace-nowrap text-slate-600">
                    {fmtDate(e.statusAt)}
                    <div className="text-xs text-slate-500">{laps(e.statusAt)}</div>
                  </td>
                  <td className="text-right">
                    <RowMenu
                      label={`Actions for ${e.ref}`}
                      items={[
                        { label: "View", href: `/enquiries/${e.id}` },
                        { label: "Edit", href: `/enquiries/${e.id}/edit` },
                        { label: "Change Status", onSelect: () => setStatusFor(e) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="p-4">
            <Empty
              action={
                (term || stage !== "all") && (
                  <button
                    className={cn(linkCls, "text-sm")}
                    onClick={() => {
                      setQ("");
                      setStage("all");
                    }}
                  >
                    Clear filters
                  </button>
                )
              }
            >
              {term || stage !== "all" ? "No enquiries match these filters." : "No enquiries yet. Add one from the Mail Box or with Add Enquiry."}
            </Empty>
          </div>
        )}
      </Card>
      {statusFor && <ChangeStatusModal enq={statusFor} onClose={() => setStatusFor(null)} />}
    </>
  );
}

export default function EnquiriesPage() {
  return (
    <Suspense>
      <Enquiries />
    </Suspense>
  );
}
