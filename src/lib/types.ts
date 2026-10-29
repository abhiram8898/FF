export type CargoMode = "Air" | "Sea";
export type ShipmentMode = "Export" | "Import";
export type JobType = "Forwarding" | "Clearing" | "Both";

export const INCOTERMS = ["FCA", "FAS", "FOB", "CFR", "CIF"] as const;
export type Incoterm = (typeof INCOTERMS)[number];

export const PRODUCT_TYPES = ["Perishable", "Non-Perishable", "Dangerous Cargo"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const ENQUIRY_STATUSES = [
  "New Enquiry",
  "Rate Requested",
  "Rate Received",
  "Quote Confirmation Pending",
  "Waiting for Shipment Date",
  "Booking in Progress",
  "Booking Confirmed",
  "Docs Received",
  "Job Created",
  "AWB Created",
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

export interface Port {
  code: string;
  name: string;
  country: string;
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

export const CUSTOMER_TYPES = ["Shipper/Receiver", "Forwarder/Logistics"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export interface Customer {
  id: string;
  type: CustomerType;
  /** Client code used in Booking/Job numbers */
  code: string;
  name: string;
  address: string;
  /** "Kindly attention" on quotations */
  contact: string;
  /** Primary email and phone; the extra ones follow */
  email: string;
  phone: string;
  altEmails: string[];
  altPhones: string[];
  documents: StoredDoc[];
}

export const AGENT_TYPES = ["Overseas Agent", "CHA", "Transporter"] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  contact: string;
  email: string;
  phone: string;
  altEmails: string[];
  altPhones: string[];
  city: string;
  country: string;
  documents: StoredDoc[];
}

export interface Airline {
  id: string;
  name: string;
  code: string;
  /** 3-digit AWB prefix, e.g. 176 for Emirates */
  prefix: string;
  email: string;
  portalUrl: string;
  /** Airport codes this airline serves */
  ports: string[];
}

export interface AirlineRate {
  id: string;
  airlineId: string;
  pol: string;
  pod: string;
  currency: string;
  ratePerKg: number;
  awbFee: number;
  minCharge: number;
  transitDays: number;
  validUntil: string;
  /** Master rate sheet, a rate quoted by the airline for one enquiry, or one entered by hand (e.g. from an open source) */
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

export interface ShipmentDocs {
  invoiceNo: string;
  invoiceValue: number;
  packingList: boolean;
  receivedAt: string;
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
  route: string;
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
  docs?: ShipmentDocs;
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

export interface Awb {
  type: "Master" | "House";
  number: string;
  issuedAt: string;
  shipper: string;
  consignee: string;
  flightNo: string;
  flightDate: string;
  pieces: number;
  grossWeight: number;
  chargeableWeight: number;
  rateClass: string;
  natureOfGoods: string;
  handlingInfo: string;
}

export const JOB_STATUSES = ["BOOKED", "ON HOLD", "DEPARTED", "CANCELLED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** A Booking/Job: one row of the booking register, created from a confirmed quotation */
export interface Job {
  id: string;
  ref: string;
  enquiryId: string;
  quotationId: string;
  createdAt: string;
  /** Booking date */
  date: string;
  customerId: string;
  /** Shipper from the customer master, or a temporary name typed in */
  shipperId?: string;
  shipperName: string;
  pol: string;
  pod: string;
  awbNo: string;
  flightDate: string;
  flightNo: string;
  status: JobStatus;
  stock: string;
  weight: number;
  boxes: number;
  commodity: string;
  offload: string;
  /** CHA from the agent master, or a temporary name typed in */
  chaId?: string;
  chaName: string;
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
  awb?: Awb;
}

export interface InvoiceItem {
  id: string;
  description: string;
  packages: number;
  /** Net quantity in kg */
  quantity: number;
  rate: number;
}

/** Invoice cum packing list prepared for a customer's cargo */
export interface CustomerInvoice {
  id: string;
  no: string;
  date: string;
  createdAt: string;
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

export type EmailKind = "Rate Request" | "Rate Reminder" | "Quotation" | "Quotation Reminder" | "General";

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
  enquiryId?: string;
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
  body: string;
}

export interface MailDraft {
  to: string[];
  cc: string;
  bcc: string;
  subject: string;
  body: string;
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

/** Parts a reference number can be built from (Settings → Ref Number) */
export const REF_PARTS = {
  company: "Company Code",
  client: "Client Code",
  pol: "POL Code",
  pod: "POD Code",
  year: "Year",
  seq: "Sequence Number",
} as const;
export type RefPart = keyof typeof REF_PARTS;

export interface RefPattern {
  /** Prefix shown before the number, e.g. "EQ: " */
  label: string;
  parts: RefPart[];
  separator: "" | "-" | "/";
  digits: number;
}

export interface Branch {
  name: string;
  address: string;
  phone: string;
}

export interface Settings {
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    gstin: string;
    pan: string;
    signature: string;
    /** Images as data URLs (Settings → General Setup) */
    logo?: string;
    /** Second logo on the right of the letterhead, e.g. IATA */
    accreditationLogo?: string;
    letterhead?: string;
    footer?: string;
  };
  /** Company Code used in reference numbers */
  refPrefix: string;
  enquiryRef: RefPattern;
  jobRef: RefPattern;
  branches: Branch[];
  financialYears: string[];
  gstPercent: number;
  currencies: { code: string; roe: number }[];
  packageTypes: string[];
  unitTypes: string[];
  clearancePlaces: string[];
  roles: string[];
  users: { name: string; role: string }[];
  agencyCharges: { particulars: string; unit: ChargeUnit; rate: number; remarks: string }[];
  quotationTerms: string;
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
  ports: Port[];
  customers: Customer[];
  agents: Agent[];
  airlines: Airline[];
  rates: AirlineRate[];
  enquiries: Enquiry[];
  quotations: Quotation[];
  jobs: Job[];
  invoices: CustomerInvoice[];
  inbox: InboxEmail[];
  emailLogs: EmailLog[];
  drafts: Draft[];
  notifications: Notification[];
  counters: { enquiry: number; job: number; invoice: number };
}
