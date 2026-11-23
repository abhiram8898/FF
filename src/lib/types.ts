export type CargoMode = "Air" | "Sea";
export type ShipmentMode = "Export" | "Import";
export type JobType = "Forwarding" | "Clearing" | "Both";
export type RouteType = "Direct" | "Connection";

export const INCOTERMS = ["FCA", "FAS", "FOB", "CFR", "CIF"] as const;
export type Incoterm = (typeof INCOTERMS)[number];

export const PRODUCT_TYPES = ["Perishable", "Non-Perishable", "Dangerous Cargo"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

/** Up to four connection legs when the route type is Connection */
export const MAX_CONNECTIONS = 4;

export interface ConnectionLeg {
  id: string;
  airlineId: string;
  /** Transit airport code */
  transit: string;
  flightNo: string;
  date: string;
}

/**
 * Operational stage of a Booking/Job, from job creation to departure.
 * The enquiry (or reservation) the job came from mirrors these.
 */
export const JOB_STATUSES = [
  "AWB In Progress",
  "AWB Executed, Pending Documents",
  "Documents Uploaded",
  "Pre-alert Pending",
  "Booking Completed",
  "Departed",
  "Cargo In Transit",
  "On Hold",
  "Cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Statuses a user picks by hand after the pre-alert is sent (FRD VIII.16) */
export const JOB_FINAL_STATUSES = ["Departed", "Cargo In Transit", "On Hold", "Cancelled"] as const satisfies readonly JobStatus[];

export const ENQUIRY_STATUSES = [
  "New Enquiry",
  "Rate Requested",
  "Rate Received",
  "Quote Confirmation Pending",
  "Waiting for Shipment Date",
  "Booking in Progress",
  "Booking Confirmed",
  ...JOB_STATUSES.filter((s) => s !== "Cancelled"),
  "Cancelled",
  "Lost",
] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const QUOTATION_STATUSES = [
  "Draft",
  "Quote Confirmation Pending",
  "Waiting for Shipment Date",
  "Booking in Progress",
  "Booking Confirmed",
  "Cancelled",
  "Lost",
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const PORT_STATUSES = ["Active", "Inactive"] as const;

/** Geographical data: a port with its country */
export interface Port {
  code: string;
  name: string;
  country: string;
  countryCode: string;
  region: string;
  isd: string;
  status: (typeof PORT_STATUSES)[number];
}

/** An uploaded file. Small files keep their content so they can be opened again. */
export interface StoredDoc {
  id: string;
  title: string;
  fileName: string;
  mime: string;
  size: number;
  /** File content as a data URL; left out when the file is too large to keep in this demo */
  dataUrl?: string;
  uploadedAt: string;
}

/** Stakeholder types (Master Data → Stakeholders) */
export const STAKEHOLDER_TYPES = ["Logistics", "Freight Forwarders", "Shipper", "Consignee", "Vendors", "Agents", "CHA"] as const;
export type StakeholderType = (typeof STAKEHOLDER_TYPES)[number];
/** Types that can place enquiries and be billed */
export const CUSTOMER_TYPES = ["Logistics", "Freight Forwarders", "Shipper", "Consignee"] as const satisfies readonly StakeholderType[];
export type CustomerType = StakeholderType;

export const STAKEHOLDER_STATUSES = ["Active", "Inactive", "Draft"] as const;
export type StakeholderStatus = (typeof STAKEHOLDER_STATUSES)[number];

/** A company in the stakeholder master: customers, shippers, consignees, vendors, agents and CHAs */
export interface Customer {
  id: string;
  type: StakeholderType;
  status: StakeholderStatus;
  /** Customer code used in reference numbers */
  code: string;
  name: string;
  address1: string;
  address2: string;
  country: string;
  state: string;
  city: string;
  postalCode: string;
  /** Full printable address, built from the parts above */
  address: string;
  firstName: string;
  middleName: string;
  lastName: string;
  /** Contact person's full name ("Kindly attention" on quotations) */
  contact: string;
  /** Primary email and phone; the extra ones follow */
  email: string;
  phone: string;
  altEmails: string[];
  altPhones: string[];
  pan: string;
  gstin: string;
  bankAccount: string;
  /** KYC documents */
  documents: StoredDoc[];
  createdAt: string;
}

export interface Airline {
  id: string;
  name: string;
  code: string;
  /** 3-digit AWB prefix, e.g. 176 for Emirates */
  prefix: string;
  /** Printed as the issuer on a Master AWB (data URL) */
  logo?: string;
  contactPerson: string;
  email: string;
  mobile: string;
  portalUrl: string;
  /** Airport codes this airline serves */
  ports: string[];
  /** Contacts per branch (Airline master); a branch's email is used for its rate requests */
  branchContacts?: AirlineBranchContact[];
}

export interface AirlineBranchContact {
  id: string;
  branch: string;
  name: string;
  email: string;
  phone: string;
}

/** A weight break on a rate sheet, e.g. "+45" → 220 per kg from 45 kg */
export interface RateSlab {
  id: string;
  label: string;
  minKg: number;
  rate: number;
}

export interface AirlineRate {
  id: string;
  airlineId: string;
  /** Charge name, e.g. "Air Freight" */
  name: string;
  code: string;
  /** Rate type, e.g. GEN or All Perishables */
  rateType: string;
  commodity: string;
  region: string;
  pol: string;
  pod: string;
  currency: string;
  /** N rate: per kg below the first weight break */
  ratePerKg: number;
  slabs: RateSlab[];
  minCharge: number;
  awbFee: number;
  /** Other airline charges per shipment (FRD Update Rate: 3 · Other charges) */
  otherCharges: number;
  transitDays: number;
  validFrom: string;
  validUntil: string;
  remarks: string;
  contact: string;
  /** Master rate sheet, a rate quoted by the airline for one enquiry, or one entered by hand */
  source: "Master" | "Airline Reply" | "Manual";
  enquiryId?: string;
  createdAt: string;
}

export interface RateRequest {
  airlineId: string;
  sentAt: string;
  reminders: string[];
  repliedAt?: string;
  replyEmailId?: string;
}

export interface Booking {
  ref: string;
  flightNo: string;
  flightDate: string;
  confirmedAt: string;
}

export interface Enquiry {
  id: string;
  no: number;
  ref: string;
  branch: string;
  financialYear: string;
  enquiryDate: string;
  createdAt: string;
  status: EnquiryStatus;
  statusAt: string;
  customerId: string;
  cargoMode: CargoMode;
  shipmentMode: ShipmentMode;
  incoterm: Incoterm;
  jobType: JobType;
  pol: string;
  pod: string;
  route: RouteType;
  connections: ConnectionLeg[];
  commodity: string;
  productType: ProductType;
  packageType: string;
  unitType: string;
  packages: number;
  grossWeight: number;
  chargeableWeight: number;
  /** Dimensions per package, in cm */
  length: number;
  width: number;
  height: number;
  requestedDate: string;
  clearancePlace: string;
  transitTime: string;
  /** Preferred airlines picked on the enquiry */
  airlineIds: string[];
  salesPerson: string;
  pricingPerson: string;
  remarks: string;
  sourceEmailId?: string;
  rateRequests: RateRequest[];
  quotationId?: string;
  shipmentDate?: string;
  booking?: Booking;
  /** Titled documents uploaded while the booking is in progress */
  documents?: StoredDoc[];
  jobId?: string;
}

export type ChargeGroup = "Airline" | "Agency";
export type ChargeUnit = "Per kg" | "Per shipment";

export interface QuoteLine {
  id: string;
  group: ChargeGroup;
  particulars: string;
  /** Rate in the quotation's (foreign) currency */
  rate: number;
  markup: number;
  unit: ChargeUnit;
  qty: number;
  gstPercent: number;
  /** e.g. "AT ACTUALS", "IF REQUIRED" */
  remarks?: string;
}

export interface Quotation {
  id: string;
  ref: string;
  enquiryId: string;
  rateId?: string;
  createdAt: string;
  status: QuotationStatus;
  statusAt: string;
  airlineId: string;
  currency: string;
  /** Rate of exchange to INR */
  roe: number;
  clearancePlace: string;
  cargoDimension: string;
  kindlyAttention: string;
  lines: QuoteLine[];
  terms: string;
  sentAt?: string;
  reminders: string[];
}

/** A Booking/Job: one row of the booking register, from a confirmed quotation or a reservation */
export interface Job {
  id: string;
  ref: string;
  enquiryId?: string;
  quotationId?: string;
  reservationId?: string;
  createdAt: string;
  status: JobStatus;
  statusAt: string;
  /** Booking date */
  date: string;
  branch: string;
  customerId: string;
  /** Shipper from the stakeholder master, or a temporary name typed in */
  shipperId?: string;
  shipperName: string;
  pol: string;
  pod: string;
  /** Booking reference from the airline; becomes the House AWB number */
  bookingRef: string;
  awbNo: string;
  flightDate: string;
  flightNo: string;
  stock: string;
  weight: number;
  boxes: number;
  commodity: string;
  offload: string;
  /** CHA from the stakeholder master, or a temporary name and email typed in */
  chaId?: string;
  chaName: string;
  chaEmail: string;
  /** Free text: rates are often written like "280+10+6" */
  rate: string;
  invoiceNo: string;
  tsp: string;
  loading: string;
  month: string;
  iataCode: string;
  airlineId: string;
  years: string;
  duty: string;
  tspAdditional: string;
  loadingAdditional: string;
  bookingInfo: string;
  additional1: string;
  additional2: string;
  documents: StoredDoc[];
  /** Documents Handling: when the user marked "Uploading Completed" */
  uploadCompletedAt?: string;
  /** The merged shipment document set */
  merged?: MergedDocs;
  dispatchedAt?: string;
}

export interface MergedDocs {
  at: string;
  /** Merge order: uploaded doc ids, or "awb" / "invoice:<id>" for documents made in the application */
  order: string[];
  fileName: string;
  /** Merged PDF as a data URL; left out when it is too large to keep */
  dataUrl?: string;
  size: number;
  /** Files that could not be included (too large to keep, or unreadable); other formats are attached inside the PDF */
  skipped: string[];
}

export const AWB_STATUSES = ["Draft", "Draft AWB Send", "AWB Executed", "Cancelled"] as const;
export type AwbStatus = (typeof AWB_STATUSES)[number];
export const FREIGHT_TERMS = ["Prepaid", "Collect", "EXW (Ex Works)"] as const;
/** M minimum, N normal (under 45 kg), Q quantity (weight break), C specific commodity, U ULD */
export const RATE_CLASSES = ["M", "N", "Q", "C", "U"] as const;
export const CHGS_CODES = ["PP", "PC", "CC", "CP"] as const;

/** One routing leg on the AWB: to an airport, by a carrier, on a flight */
/**
 * An AWB "Other Charges" line, e.g. AWC (AWB fee), FSC (fuel), SCC (security). By IATA convention the
 * code's last letter says who the charge is due to: A = agent, C = carrier.
 */
export interface AwbOtherCharge {
  id: string;
  code: string;
  description: string;
  amount: number;
}

export interface AwbLeg {
  id: string;
  to: string;
  carrier: string;
  flightNo: string;
  flightDate: string;
}

/** Air Waybill (FRD VII). Master AWB from the airline, or a House AWB issued by the company. */
export interface Awb {
  id: string;
  jobId: string;
  type: "Master" | "House";
  status: AwbStatus;
  statusAt: string;
  createdAt: string;
  // Section I – General
  /** House AWB number from the company sequence (Settings → Ref Number Format) or typed by hand */
  hawbSource?: HawbSource;
  hawbNo: string;
  hawbDate: string;
  mawbNo: string;
  mawbDate: string;
  shipperId?: string;
  shipper: string;
  shipperAccount: string;
  consigneeId?: string;
  consignee: string;
  consigneeAccount: string;
  /** Informed on arrival; "SAME AS CONSIGNEE" when it is */
  notifyParty: string;
  localAgentId?: string;
  localAgent: string;
  agentIataCode: string;
  /** Agent's settlement (CASS) account */
  agentAccountNo: string;
  optionalShippingInfo: string;
  /** Special Customs Information */
  sci: string;
  freightTerms: (typeof FREIGHT_TERMS)[number];
  freightTermDetails: string;
  // Section II – Airline
  airportCode: string;
  place: string;
  legs: AwbLeg[];
  portOfDestination: string;
  finalCarrier: string;
  agentSign: string;
  carrierSign: string;
  // Section III – Cargo & freight
  issuedAt: string;
  currency: string;
  rateClass: (typeof RATE_CLASSES)[number];
  weightUnit: "K" | "L";
  commodityItemNo: string;
  chgsCode: (typeof CHGS_CODES)[number];
  declaredCarriage: string;
  declaredCustoms: string;
  insurance: number;
  commodity: string;
  pieces: number;
  packageType: string;
  volume: number;
  grossWeight: number;
  netWeight: number;
  chargeableWeight: number;
  /** Rate per kg; the total charge is rate × chargeable weight (rate class M: the rate is the flat minimum charge) */
  rate: number;
  valuationCharge: number;
  tax: number;
  otherCharges: AwbOtherCharge[];
  /** Rate to convert collect charges into the destination currency */
  conversionRate: number;
  destCurrency: string;
  /** Filled by the carrier at destination */
  chargesAtDestination: number;
  /** Older free-text invoice field; new AWBs use invoiceNo and invoiceDate */
  invoiceDetails: string;
  invoiceNo?: string;
  invoiceDate?: string;
  natureOfGoods: string;
  handlingInfo: string;
  sentAt?: string;
}

export const HAWB_SOURCES = ["Own", "Others"] as const;
export type HawbSource = (typeof HAWB_SOURCES)[number];

export const RESERVATION_STATUSES = [
  "Draft",
  "Reserved",
  "Ready for Booking",
  "Booking In Progress",
  "Booking Confirmed",
  "On Hold",
  "Rescheduled",
  "Cancelled",
  "Departed",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
export const CARRIER_BOOKING_STATUSES = ["Booking Pending", "In Progress", "Confirmed", "Rejected", "Cancelled"] as const;
export type CarrierBookingStatus = (typeof CARRIER_BOOKING_STATUSES)[number];

export interface Recurrence {
  type: "Daily" | "Weekly" | "Monthly";
  /** Weekly: weekdays 0 (Sun) – 6 (Sat). Monthly: days of the month 1–31. */
  repeatOn: number[];
  startDate: string;
  endDate: string;
  /** Optional limit; whichever of end date and count comes first ends the series */
  occurrences: number;
  generation: "Automatic" | "Manual";
}

/** Chargeable weight changed by hand: the calculated value is kept with who changed it and why */
export interface WeightOverride {
  calculated: number;
  revised: number;
  by: string;
  reason: string;
  at: string;
}

export interface HistoryEntry {
  at: string;
  by: string;
  action: string;
  detail?: string;
}

/** A fixed (planned) shipment booked ahead, shown on the Shipment Planner */
export interface Reservation {
  id: string;
  ref: string;
  createdAt: string;
  status: ReservationStatus;
  statusAt: string;
  // Section 1 – Office
  branch: string;
  financialYear: string;
  // Section 2 – General
  customerId: string;
  shipperId?: string;
  shipperName: string;
  cargoMode: CargoMode;
  shipmentMode: ShipmentMode;
  incoterm: Incoterm;
  // Section 3 – Routing & carrier
  awbNo: string;
  pol: string;
  pod: string;
  airlineId: string;
  flightNo: string;
  flightDate: string;
  bookingStatus: CarrierBookingStatus;
  routeType: RouteType;
  /** Planned shipment date: the day it shows on the planner */
  shipmentDate: string;
  transitTime: string;
  connections: ConnectionLeg[];
  // Section 4 – Cargo
  commodity: string;
  productType: ProductType;
  packageType: string;
  grossWeight: number;
  chargeableWeight: number;
  weightOverride?: WeightOverride;
  unitType: string;
  packages: number;
  length: number;
  width: number;
  height: number;
  // Section 5 – Planning & assignment
  clearancePlace: string;
  salesPerson: string;
  operationsPerson: string;
  pricingPerson: string;
  remarks: string;
  preferredAirlineIds: string[];
  // Section 6 – Recurring
  recurring: boolean;
  recurrence?: Recurrence;
  /** Occurrences generated from one recurring reservation share a series id */
  seriesId?: string;
  booking?: { ref: string; confirmedAt: string; flightNo: string; flightDate: string; documents: StoredDoc[] };
  previousDates: { date: string; reason: string; at: string }[];
  holdReason?: string;
  /** Status to go back to when resumed */
  heldFrom?: ReservationStatus;
  cancelReason?: string;
  notifiedAt?: string;
  jobId?: string;
  /** The job this reservation was converted from ("Convert to Reservation" on a job) */
  fromJobId?: string;
  history: HistoryEntry[];
}

export const INVOICE_STATUSES = ["Draft", "Awaiting Confirmation", "Generated", "Completed", "Cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface InvoiceItem {
  id: string;
  description: string;
  hsn: string;
  packages: number;
  /** Net quantity in kg */
  quantity: number;
  rate: number;
}

/** Invoice cum packing list prepared on behalf of a customer (FRD IX) */
export interface CustomerInvoice {
  id: string;
  /** Typed by the user */
  no: string;
  date: string;
  createdAt: string;
  status: InvoiceStatus;
  statusAt: string;
  stakeholderType: StakeholderType;
  customerId: string;
  /** Exporter name and address as printed */
  exporter: string;
  exporterRef: string;
  iecNo: string;
  buyerOrder: string;
  consignee: string;
  buyer: string;
  preCarriage: string;
  placeOfReceipt: string;
  flightNo: string;
  portOfLoading: string;
  portOfDischarge: string;
  finalDestination: string;
  countryOfOrigin: string;
  countryOfDestination: string;
  terms: string;
  currency: string;
  marks: string;
  packageRange: string;
  items: InvoiceItem[];
  grossWeight: number;
  declaration: string;
  enquiryId?: string;
  jobId?: string;
  sentAt?: string;
}

/** Finance / Billing */
export const PROFORMA_STATUSES = ["Draft", "Proforma INV Send", "Approved", "Cancelled"] as const;
export const BILL_STATUSES = ["Sent / Issued", "Overdue", "Partially Paid", "Paid", "Cancelled"] as const;
export const CREDIT_NOTE_STATUSES = ["Draft", "Issued"] as const;
export type BillKind = "Proforma" | "Invoice" | "Credit Note";
export type BillStatus = (typeof PROFORMA_STATUSES)[number] | (typeof BILL_STATUSES)[number] | (typeof CREDIT_NOTE_STATUSES)[number];
export type TaxMode = "IGST" | "CGST+SGST";

export interface BillLine {
  id: string;
  particulars: string;
  sac: string;
  qty: number;
  rate: number;
  currency: string;
  exRate: number;
  /** Non-taxable lines carry no GST */
  taxable: boolean;
  /** GST rate of this line (e.g. 5 or 18), from the quotation; older bills use the bill's rate */
  gstPercent?: number;
}

/** A proforma, the tax invoice it is approved into, or the credit note for a cancelled invoice */
export interface Bill {
  id: string;
  kind: BillKind;
  no: string;
  date: string;
  createdAt: string;
  status: BillStatus;
  statusAt: string;
  jobId: string;
  customerId: string;
  branch: string;
  /** Company bank account printed on this bill; the default account when not set */
  bankId?: string;
  /** Header details, filled from the job and editable */
  to: string;
  exporter: string;
  consignee: string;
  mawbNo: string;
  mawbDate: string;
  hawbNo: string;
  hawbDate: string;
  pol: string;
  pod: string;
  shipmentType: string;
  airlineFlight: string;
  etd: string;
  eta: string;
  commodity: string;
  /** Botanical / scientific name of the commodity, e.g. for perishables */
  scientificName?: string;
  jobNo: string;
  jobDate: string;
  sbNo: string;
  sbDate: string;
  invoiceNo: string;
  invoiceDate: string;
  grossWeight: number;
  chWeight: number;
  packages: number;
  lines: BillLine[];
  taxMode: TaxMode;
  /** Total GST rate: IGST 18%, or 9% CGST + 9% SGST */
  gstPercent: number;
  notes: string;
  dueDate: string;
  payments: { id: string; at: string; amount: number; note: string }[];
  sentAt?: string;
  /** Invoice: the proforma it was approved from. Credit note: the cancelled invoice. */
  sourceId?: string;
}

export interface InboxEmail {
  id: string;
  from: "Customer" | "Airline";
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  receivedAt: string;
  read: boolean;
  enquiryId?: string;
  airlineId?: string;
}

export type EmailKind =
  | "Rate Request"
  | "Rate Reminder"
  | "Quotation"
  | "Quotation Reminder"
  | "Booking Confirmation"
  | "AWB"
  | "CHA Dispatch"
  | "Pre-alert"
  | "Customer Invoice"
  | "Proforma"
  | "Invoice"
  | "Shipment Update"
  | "Team Alert"
  | "General";

export interface EmailLog {
  id: string;
  at: string;
  kind: EmailKind;
  to: string[];
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments: string[];
  /** Files attached in Mail Box → Compose */
  files?: StoredDoc[];
  enquiryId?: string;
  jobId?: string;
  reservationId?: string;
}

/** A mail composed in the Mail Box and saved without sending */
export interface Draft {
  id: string;
  savedAt: string;
  enquiryId?: string;
  to: string[];
  cc: string;
  bcc: string;
  subject: string;
  /** Plain text, or HTML when written in the rich-text editor */
  body: string;
  files?: StoredDoc[];
}

export interface MailDraft {
  to: string[];
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  files?: StoredDoc[];
}

export type Channel = "Email" | "WhatsApp";

export interface Notification {
  id: string;
  at: string;
  enquiryId?: string;
  to: string;
  channel: Channel;
  message: string;
}

/** Parts a reference number can be built from (Settings → Ref Number Format) */
export const REF_PARTS = {
  company: "Company Code",
  client: "Customer Code",
  branch: "Branch Code",
  pol: "POL Code",
  pod: "POD Code",
  seq: "Sequence Number",
  year: "Year",
} as const;
export type RefPart = keyof typeof REF_PARTS;

export interface RefPattern {
  /** Prefix shown before the number, e.g. "QUO" */
  label: string;
  /** Off: the user types the number */
  auto: boolean;
  parts: RefPart[];
  separator: "" | "-" | "/";
  digits: number;
}

export interface Branch {
  name: string;
  code: string;
  iataCode: string;
  address: string;
  contactPerson: string;
  email: string;
  phone: string;
}

export interface FinancialYear {
  name: string;
  code: string;
  start: string;
  end: string;
  status: "Upcoming" | "Active" | "Closed";
  isDefault: boolean;
  remarks: string;
}

/** A short form and its description, e.g. CTN · Cartons */
export interface CodedItem {
  short: string;
  description: string;
}

/** HSN (goods) or SAC (services) classification code */
export interface TaxCode {
  id: string;
  commodity: string;
  code: string;
  description: string;
  short: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  active: boolean;
  /** Rate of exchange to INR */
  roe: number;
}

/** Screens a role can be given access to (Settings → User Management) */
export const SCREENS = [
  "Dashboard",
  "Mail Box",
  "Reserved Shipments",
  "Jobs",
  "Airway Bills",
  "Documents",
  "Customer Invoice",
  "Debit Note",
  "Credit Note",
  "Agency Service Charges",
  "Stakeholders",
  "Geographical Data",
  "Airline & Rates",
  "Company Set up",
  "User Management",
  "Settings",
] as const;
export type Screen = (typeof SCREENS)[number];
export interface ScreenAccess {
  view: boolean;
  actions: boolean;
  edit: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  /** Branches the role works in; empty means every branch */
  branches: string[];
  access: Partial<Record<Screen, ScreenAccess>>;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  branch: string;
  email: string;
  phone: string;
  startDate: string;
  endDate: string;
  active: boolean;
  roleIds: string[];
}

export const NOTIFICATION_EVENTS = {
  shipmentDate: "Shipment Date Pending",
  booking: "Booking Pending",
  awb: "AWB Execution Pending",
  completed: "Shipment Completed",
  proforma: "Proforma Pending",
} as const;
export type NotificationEvent = keyof typeof NOTIFICATION_EVENTS;

export interface AgencyCharge {
  particulars: string;
  sac: string;
  unit: ChargeUnit;
  rate: number;
  remarks: string;
}

export interface BankDetails {
  beneficiaryName: string;
  accountTitle: string;
  accountNo: string;
  ifsc: string;
  swift: string;
  paymentRef: string;
  fedwire: string;
  aba: string;
  address: string;
  country: string;
  state: string;
  city: string;
  postalCode: string;
  bankName: string;
  bankBranch: string;
  bankAddress: string;
  bankCity: string;
  bankPostalCode: string;
}

/** A company bank account (Company Set up → Bank Account). The default one prints on bills unless a bill picks another. */
export interface BankAccount extends BankDetails {
  id: string;
  isDefault: boolean;
}

export interface Settings {
  company: {
    name: string;
    code: string;
    address: string;
    country: string;
    state: string;
    city: string;
    postalCode: string;
    phone: string;
    email: string;
    website: string;
    iataCode: string;
    gstin: string;
    pan: string;
    signature: string;
    /** Images as data URLs (Settings → Company Set up) */
    logo?: string;
    /** Second logo on the right of the letterhead, e.g. IATA */
    accreditationLogo?: string;
    letterhead?: string;
    footer?: string;
    /** Authorised signature printed on AWB copies when "With Sign" is ticked */
    signatureImage?: string;
  };
  banks: BankAccount[];
  /** Company Code used in reference numbers */
  refPrefix: string;
  enquiryRef: RefPattern;
  quoteRef: RefPattern;
  reservationRef: RefPattern;
  jobRef: RefPattern;
  invoiceRef: RefPattern;
  /** House AWB numbers given by the company ("HAWB by Own") */
  hawbRef: RefPattern;
  branches: Branch[];
  financialYears: FinancialYear[];
  gstPercent: number;
  /** Air freight volumetric divisor (cm³ per kg), usually 6000 */
  volumetricDivisor: number;
  /** Chargeable weight is rounded up to this step in kg (0 = no rounding) */
  weightRounding: number;
  packageTypes: CodedItem[];
  unitTypes: CodedItem[];
  clearancePlaces: { country: string; name: string }[];
  hsnCodes: TaxCode[];
  sacCodes: TaxCode[];
  roles: Role[];
  users: User[];
  agencyCharges: AgencyCharge[];
  quotationTerms: string;
  invoiceNotes: string;
  notifications: {
    enabled: boolean;
    events: Record<NotificationEvent, { enabled: boolean; to: string; cc: string }>;
  };
  branchEmails: { enabled: boolean; rows: { branch: string; emails: string[] }[] };
  alerts: {
    notifyOnQuote: boolean;
    notifyOnBooking: boolean;
    notifyOnAwb: boolean;
    rateReminderHours: number;
    quoteReminderDays: number;
  };
}

export interface State {
  settings: Settings;
  currencies: Currency[];
  ports: Port[];
  customers: Customer[];
  airlines: Airline[];
  rates: AirlineRate[];
  reservations: Reservation[];
  enquiries: Enquiry[];
  quotations: Quotation[];
  jobs: Job[];
  awbs: Awb[];
  invoices: CustomerInvoice[];
  bills: Bill[];
  inbox: InboxEmail[];
  emailLogs: EmailLog[];
  drafts: Draft[];
  notifications: Notification[];
  /** Audit trail of master and reservation changes */
  audit: HistoryEntry[];
  counters: { enquiry: number; quote: number; reservation: number; job: number; invoice: number; proforma: number; hawb: number; creditNote: number };
}
