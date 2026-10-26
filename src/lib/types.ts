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

export interface Customer {
  id: string;
  name: string;
  address: string;
  /** "Kindly attention" on quotations */
  contact: string;
  email: string;
  phone: string;
}

export const AGENT_TYPES = ["Forwarder", "Overseas Agent", "CHA", "Transporter"] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  contact: string;
  email: string;
  phone: string;
  city: string;
  country: string;
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
  /** Master rate sheet, or a rate quoted by the airline for one enquiry */
  source: "Master" | "Airline Reply";
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

export interface Job {
  id: string;
  ref: string;
  enquiryId: string;
  quotationId: string;
  createdAt: string;
  awb?: Awb;
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

export type EmailKind = "Rate Request" | "Rate Reminder" | "Quotation" | "Quotation Reminder";

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

export type UserRole = "Admin" | "Sales" | "Pricing" | "Operations";

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
  };
  refPrefix: string;
  branches: string[];
  financialYears: string[];
  gstPercent: number;
  currencies: { code: string; roe: number }[];
  packageTypes: string[];
  unitTypes: string[];
  clearancePlaces: string[];
  users: { name: string; role: UserRole }[];
  agencyCharges: { particulars: string; unit: ChargeUnit; rate: number }[];
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
  inbox: InboxEmail[];
  emailLogs: EmailLog[];
  notifications: Notification[];
  counters: { enquiry: number };
}
