# Airsteam FF – Freight Forwarding (POC)

Next.js 15 (App Router) + TypeScript + Tailwind v4 proof of concept implementing **Airsteam FF – FRD – POC, Phase 01**:
Enquiry → Rates (masters or airline request) → Quotation → Shipment date → Booking → Invoice & Packing List → Job → AWB.

📘 **[User Guide](docs/USER_GUIDE.md)**: every screen, the full flow step by step, statuses, calculations, demo walkthroughs and FRD coverage.

## Run

```bash
npm install
npm run dev   # http://localhost:3000
```

Sign in at `/login` with the demo account: **admin@freighttask.com** / **Freight@123** (defined in `src/lib/auth.tsx`).

Data is seeded on first load and persisted in the browser's localStorage (no backend yet).
Use **Reset demo data** in the sidebar to start over.

> Don't run `npm run build` while `npm run dev` is running: both write to `.next/`.
> If the dev server shows `Cannot find module './NNN.js'`, stop it, `rm -rf .next`, and start it again.

## Where things live

| Path | Purpose |
| --- | --- |
| `src/lib/auth.tsx` | Demo login / session (swap for a real auth API later) |
| `src/app/login` | Login page |
| `public/brand` | FreightTask logo variants (`logo.png` for light backgrounds, `logo-light.png` for navy) |
| `src/lib/types.ts` | Domain model and status lists (enquiry, rate, quotation, job, AWB, mail, settings) |
| `src/lib/store.tsx` | Client store and every workflow action (swap for API calls later) |
| `src/lib/seed.ts` | Demo settings, masters, rates, enquiries, mails |
| `src/lib/utils.ts` | Refs, CBM / weight / rate / GST calculations, dashboard stages, progress steps |
| `src/components/workflow.tsx` | Progress bar, route insights, Compare Available Rates, Get Rate from Airline (one email per airline), Add Rate Manually, reminders, Change Status |
| `src/components/EnquiryForm.tsx` | Add / Edit Enquiry (FRD sections 1–3) |
| `src/components/quotation.tsx` | Quotation preview/PDF, Send to Customer, Quotation Actions |
| `src/components/ComposeEmail.tsx` | Compose Email box used for all outgoing mail |
| `src/app/enquiries/[id]` | Enquiry workspace: drives every step of the flow |
| `src/app/quotations/[id]` | Create Job Quotation |
| `src/app/mailbox` | Inbox / Compose / Drafts / Sent, Add to Enquiry for new mails and airline responses, View Enquiry / View Booking |
| `src/app/masters/*`, `src/app/settings` | Masters and Settings (Locations and Charges are read-only views of Settings) |
| `src/app/rate-requests`, `follow-ups`, `documents`, `reports` | Read-only lists built from the store; follow-up due dates use Settings → Alerts |
| `src/app/shipments` | Booking/Job register (all booking-sheet columns), Add Booking from a confirmed quotation, job + AWB page |
| `src/components/BookingJobForm.tsx` | Booking/Job fields; shipper / CHA from the masters or typed in as temporary |
| `src/app/invoices`, `src/components/invoice.tsx` | Customer Invoice (invoice cum packing list) form and printable document |
| `src/components/PartyForm.tsx`, `inputs.tsx` | Customer / agent forms; multiple emails, phones and document uploads; logo / banner upload |
| `src/components/letterhead.tsx` | Letterhead and footer from Settings → General Setup, used on quotations |

Uploaded files and images are kept in the browser's localStorage as data URLs (files up to 1 MB; larger ones keep only their name). Reference numbers follow the patterns in Settings → Ref Number.
