"use client";

/* eslint-disable @next/next/no-img-element -- logos and banners are user-uploaded data URLs */
import { useStore } from "@/lib/store";

/**
 * Document header from Settings → General Setup: the uploaded letterhead banner, or
 * logo · company details · second logo (as on the sample quotation).
 */
export function Letterhead() {
  const { state } = useStore();
  const c = state.settings.company;
  if (c.letterhead) return <img src={c.letterhead} alt={c.name} className="mb-3 w-full" />;
  return (
    <div className="mb-3 grid grid-cols-[6rem_minmax(0,1fr)_6rem] items-center gap-3 border-b-2 border-navy-700 pb-3 sm:grid-cols-[8rem_minmax(0,1fr)_8rem]">
      <div>{c.logo && <img src={c.logo} alt="" className="max-h-16 max-w-full object-contain" />}</div>
      <div className="text-center">
        <div className="text-base font-bold tracking-wide text-navy-700 uppercase sm:text-lg">{c.name}</div>
        <div className="text-[11px] font-semibold text-navy-700 uppercase">{c.address}</div>
        <div className="text-[11px] font-semibold text-navy-700">
          Ph: {c.phone} · Email: {c.email}
        </div>
        <div className="text-[11px] font-semibold text-navy-700">
          GSTIN: {c.gstin} / PAN NO: {c.pan}
        </div>
      </div>
      <div className="flex justify-end">{c.accreditationLogo && <img src={c.accreditationLogo} alt="" className="max-h-16 max-w-full object-contain" />}</div>
    </div>
  );
}

export function FooterBanner() {
  const { state } = useStore();
  const footer = state.settings.company.footer;
  return footer ? <img src={footer} alt="" className="mt-3 w-full" /> : null;
}
