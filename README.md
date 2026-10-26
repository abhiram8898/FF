# Airsteam FF – Freight Forwarding (POC)

Next.js 15 (App Router) + TypeScript + Tailwind v4 proof of concept implementing **Airsteam FF – FRD – POC, Phase 01**:
Enquiry → Rates (masters or airline request) → Quotation → Shipment date → Booking → Invoice & Packing List → Job → AWB.

📘 **[User Guide](docs/USER_GUIDE.md)**: every screen, the full flow step by step, statuses, calculations, demo walkthroughs and FRD coverage.

## Run

```bash
npm install
npm run dev   # http://localhost:3000
```

Data is seeded on first load and persisted in the browser's localStorage (no backend yet).
Use **Reset demo data** in the sidebar to start over.

> Don't run `npm run build` while `npm run dev` is running: both write to `.next/`.
> If the dev server shows `Cannot find module './NNN.js'`, stop it, `rm -rf .next`, and start it again.

## Where things live

| Path | Purpose |
| --- | --- |
| `src/lib/types.ts` | Domain model and status lists (enquiry, rate, quotation, job, AWB, mail, settings) |
| `src/lib/store.tsx` | Client store and every workflow action (swap for API calls later) |
| `src/lib/seed.ts` | Demo settings, masters, rates, enquiries, mails |
| `src/lib/utils.ts` | Refs, CBM / weight / rate / GST calculations, dashboard stages, progress steps |
| `src/components/workflow.tsx` | Progress bar, route insights, Get Rates · Compare, Save & Forward, reminders, Change Status |
| `src/components/EnquiryForm.tsx` | Add / Edit Enquiry (FRD sections 1–3) |
| `src/components/quotation.tsx` | Quotation preview/PDF, Send to Customer, Quotation Actions |
| `src/components/ComposeEmail.tsx` | Compose Email box used for all outgoing mail |
| `src/app/enquiries/[id]` | Enquiry workspace: drives every step of the flow |
| `src/app/quotations/[id]` | Create Job Quotation |
| `src/app/mailbox` | Inbox / Sent, Add to Enquiry for customer mails and airline replies |
| `src/app/masters/*`, `src/app/settings` | Masters and Settings |
