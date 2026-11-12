# Airsteam FF – Freight Forwarding (POC)

Next.js 15 (App Router) + TypeScript + Tailwind v4 proof of concept implementing **Airsteam FF – FRD – POC, Phase 01 (v0.2)**:
Reserved Shipments → Enquiry → Rates → Quotation → Shipment date → Booking → Job → AWB → Documents (upload, merge, dispatch to CHA) → Departed → Proforma → Invoice / Credit Note.

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
| `src/lib/types.ts` | Domain model and status lists (reservation, enquiry, quotation, job, AWB, customer invoice, bills, masters, settings) |
| `src/lib/store.tsx` | Client store and every workflow action, incl. job stages, auto-proforma on Departed, credit notes, recurring reservations, audit trail and team alerts |
| `src/lib/seed.ts` | Demo data covering every module |
| `src/lib/utils.ts` | Refs, chargeable weight, slab rates, quote and bill totals (IGST / CGST+SGST), workflow steps, dashboard slides, status tones |
| `src/components/AppShell.tsx` | Left-hand menu as in the FRD: Dashboard, Mail Box, Transactions, Finance / Billing, Master Data, Settings |
| `src/app/reservations`, `components/reservation.tsx` | Shipment Planner (customers × calendar, month / week / list), reservation form (sections 1–6, recurring series), reschedule / hold / cancel, carrier booking, Activate Job |
| `src/app/enquiries`, `quotations`, `shipments` | Jobs: Tab 1 Enquiries, Tab 2 Quotations, Tab 3 Job/Booking (`components/JobsTabs.tsx`) |
| `src/components/EnquiryForm.tsx`, `workflow.tsx` | Add Enquiry (connections, chargeable weight), Compare Available Rate, Save & Forward / Send Rate Request, Update Rate |
| `src/components/BookingJobForm.tsx`, `jobflow.tsx` | Job fields A–FF; job Next action (Execute AWB → Manage Documents → Merge → Dispatch To CHA → Departed), document upload / merge (pdf-lib) / dispatch, Notify Customer |
| `src/app/awbs`, `components/awb.tsx` | Airway Bills: Execute AWB (3 sections), print preview with MAWB / HAWB headings, Send, status change |
| `src/app/documents` | Documents handling for executed AWBs |
| `src/app/invoices`, `components/invoice.tsx` | Customer Invoice: stakeholder type / name, HSN, Draft → Awaiting Confirmation → Generated → Completed |
| `src/app/billing`, `components/billing.tsx` | Debit Note (Proforma / Invoice tabs), Credit Note, Agency Service Charges; printable bills as in the samples |
| `src/app/masters/*` | Stakeholders, Geographical Data (ports, currencies), Airline & Rates (airline master, rate master with weight slabs) |
| `src/app/settings`, `settings/company`, `settings/users` | Notifications, branch emails, ref number formats, dropdown lists (FY, clearance places, package / unit types, HSN, SAC), audit trail; company / branches / bank; roles and users |
| `src/app/mailbox` | Inbox / Drafts / Sent (`?folder=`), Add to Enquiry for airline responses |

Uploaded files and images are kept in the browser's localStorage as data URLs (files up to 1 MB; larger ones keep only their name). Merged document PDFs up to 1.5 MB are kept; larger ones can be downloaded right after merging. Reference numbers follow Settings → Ref Number Format.
