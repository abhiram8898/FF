import type { Agent, AirlineRate, Customer, CustomerInvoice, EmailLog, Enquiry, InboxEmail, Job, Quotation, Settings, State } from "./types";
import { addDays, ago, buildQuoteLines, buildRef, quotationRef } from "./utils";

const DEFAULT_SETTINGS: Settings = {
  company: {
    name: "Airsteam Logistics Private Limited",
    address: "9/456, Araparambu Church Road, Vappalassery, Ernakulam – 683111, Kerala, India",
    phone: "+91 98765 43210",
    email: "ops@airsteam.example",
    website: "www.airsteamlogistics.example",
    gstin: "32AAVCA8825F1ZF",
    pan: "AAVCA8825F",
    signature: "Regards,\nAirsteam Logistics Operations Team\n+91 98765 43210 | ops@airsteam.example",
  },
  refPrefix: "AIS",
  enquiryRef: { label: "EQ: ", parts: ["company", "seq", "year"], separator: "-", digits: 4 },
  jobRef: { label: "", parts: ["company", "pol", "seq"], separator: "", digits: 4 },
  branches: [
    { name: "Kochi", address: "9/456, Araparambu Church Road, Vappalassery, Ernakulam – 683111", phone: "+91 98765 43210" },
    { name: "Chennai", address: "Cargo Complex, Meenambakkam, Chennai – 600027", phone: "+91 44 4000 1200" },
    { name: "Mumbai", address: "Sahar Cargo Complex, Andheri East, Mumbai – 400099", phone: "+91 22 2682 0000" },
  ],
  financialYears: ["2025-26", "2026-27"],
  gstPercent: 18,
  currencies: [
    { code: "INR", roe: 1 },
    { code: "USD", roe: 84.5 },
    { code: "EUR", roe: 91.2 },
    { code: "AED", roe: 23 },
  ],
  packageTypes: [
    "Cartons",
    "Fiber board Boxes",
    "Boxes",
    "Wooden Cases",
    "Wooden Crates",
    "Steel",
    "Plastic Drums",
    "Bales",
    "Reels",
    "Spools",
    "Bagged Cargo",
    "Sacks",
    "Pallet",
    "Bulk",
  ],
  unitTypes: ["PCS: Pieces", "NOS: Numbers", "SET: Sets", "DOZ: Dozen", "PRS: Pairs", "PAC: Packs", "ROL: Rolls"],
  clearancePlaces: ["Kochi", "Kolkata", "Mumbai"],
  roles: ["Admin", "Sales", "Pricing", "Operations"],
  users: [
    { name: "Admin User", role: "Admin" },
    { name: "Arjun", role: "Sales" },
    { name: "Divya", role: "Sales" },
    { name: "Nikhil", role: "Pricing" },
    { name: "Meera", role: "Operations" },
  ],
  agencyCharges: [
    { particulars: "CLEARANCE CHARGES", unit: "Per shipment", rate: 1500, remarks: "" },
    { particulars: "TERMINAL CHARGES-TSP", unit: "Per kg", rate: 1.5, remarks: "AT ACTUALS" },
    { particulars: "LOADING/UNLOADING CHARGES", unit: "Per kg", rate: 1, remarks: "AT ACTUALS" },
    { particulars: "OVERTIME CHARGES", unit: "Per shipment", rate: 1500, remarks: "IF REQUIRED" },
    { particulars: "CERTIFICATE OF ORIGIN", unit: "Per shipment", rate: 350, remarks: "IF REQUIRED" },
  ],
  quotationTerms: [
    "1) STICKERING WILL BE SCOPE OF SHIPPER. IF NEED TO BE ARRANGED WILL BE CHARGED INR 2 /STICKER AND INR 2 FOR LABELING",
    "2) SPACE SUBJECT TO AIRLINES CONFIRMATION",
    "3) OVERTIME CHARGES AFTER 4:30 PM AND ON PUBLIC HOLIDAY HANDOVER WILL BE APPLICABLE WHICH WILL BE BILLED @ RS 1500/-",
    "4) ANY OTHER INCIDENTAL CHARGES WILL BE BILLED AT ACTUALS",
    "5) GST CHARGES APPLICABLE FOR APPROPRIATE HEADS",
  ].join("\n"),
  alerts: {
    notifyOnQuote: true,
    notifyOnBooking: true,
    notifyOnAwb: true,
    rateReminderHours: 24,
    quoteReminderDays: 2,
  },
};

export function createSeed(): State {
  const settings = structuredClone(DEFAULT_SETTINGS);
  const year = new Date().getFullYear();
  const eqRef = (no: number) => buildRef(settings.enquiryRef, { company: settings.refPrefix, year, seq: no });
  const ref = (kind: "EQ" | "QT", no: number) => (kind === "EQ" ? eqRef(no) : quotationRef(eqRef(no), settings.enquiryRef.label));

  const rate = (r: Omit<AirlineRate, "currency" | "source" | "createdAt" | "transitDays"> & Partial<AirlineRate>): AirlineRate => ({
    currency: "INR",
    source: "Master",
    createdAt: ago(10),
    transitDays: 1,
    ...r,
  });

  const rates: AirlineRate[] = [
    rate({ id: "rt-1", airlineId: "al-ek", pol: "COK", pod: "DXB", ratePerKg: 145, awbFee: 950, minCharge: 4200, validUntil: addDays(25) }),
    rate({ id: "rt-2", airlineId: "al-ai", pol: "COK", pod: "DXB", ratePerKg: 130, awbFee: 1250, minCharge: 3800, validUntil: addDays(15) }),
    rate({ id: "rt-3", airlineId: "al-qr", pol: "COK", pod: "LHR", ratePerKg: 320, awbFee: 1000, minCharge: 9000, transitDays: 2, validUntil: addDays(30) }),
    rate({ id: "rt-4", airlineId: "al-ek", pol: "COK", pod: "LHR", ratePerKg: 335, awbFee: 950, minCharge: 9500, transitDays: 2, validUntil: addDays(22) }),
  ];

  const base = {
    branch: "Kochi",
    financialYear: "2026-27",
    cargoMode: "Air",
    shipmentMode: "Export",
    jobType: "Forwarding",
    route: "Direct",
    unitType: "PCS: Pieces",
    clearancePlace: "Kochi",
    transitTime: "",
    remarks: "",
    pricingPerson: "Nikhil",
    rateRequests: [],
    airlineIds: [],
  } satisfies Partial<Enquiry>;

  const enquiry = (no: number, daysAgo: number, e: Omit<Enquiry, keyof typeof base | "id" | "no" | "ref" | "enquiryDate" | "createdAt" | "statusAt"> & Partial<Enquiry>): Enquiry => ({
    ...base,
    id: `en-${no}`,
    no,
    ref: ref("EQ", no),
    enquiryDate: ago(daysAgo).slice(0, 10),
    createdAt: ago(daysAgo),
    statusAt: ago(Math.max(0, daysAgo - 1)),
    ...e,
  });

  const enquiries: Enquiry[] = [
    enquiry(1, 9, {
      status: "Job Created",
      customerId: "cu-abc",
      salesPerson: "Arjun",
      incoterm: "FOB",
      pol: "COK",
      pod: "DXB",
      commodity: "Cotton Garments",
      productType: "Non-Perishable",
      packageType: "Cartons",
      packages: 12,
      grossWeight: 210,
      chargeableWeight: 210,
      length: 60,
      width: 40,
      height: 40,
      requestedDate: addDays(-4),
      airlineIds: ["al-ai"],
      quotationId: "qt-1",
      shipmentDate: addDays(2),
      booking: { ref: "AIB-558201", flightNo: "AI 933", flightDate: addDays(2), confirmedAt: ago(5) },
      docs: { invoiceNo: "ABC/EXP/0912", invoiceValue: 845000, packingList: true, receivedAt: ago(3) },
      jobId: "jb-1",
    }),
    enquiry(2, 0, {
      status: "New Enquiry",
      statusAt: ago(0, 5),
      customerId: "cu-csf",
      salesPerson: "Divya",
      incoterm: "CIF",
      pol: "COK",
      pod: "DXB",
      commodity: "Frozen Seafood",
      productType: "Perishable",
      packageType: "Boxes",
      packages: 40,
      grossWeight: 800,
      chargeableWeight: 800,
      length: 50,
      width: 35,
      height: 25,
      requestedDate: addDays(3),
      remarks: "Temperature controlled: -18°C. Needs perishable handling.",
      sourceEmailId: "em-2",
    }),
  ];

  const quotation = (id: string, enq: Enquiry, rateId: string, airlineId: string, extra: Partial<Quotation>): Quotation => ({
    id,
    ref: ref("QT", enq.no),
    enquiryId: enq.id,
    rateId,
    airlineId,
    createdAt: enq.createdAt,
    status: "Draft",
    statusAt: enq.statusAt,
    currency: "INR",
    roe: 1,
    clearancePlace: "Kochi",
    cargoDimension: `${enq.packages} packages / ${enq.grossWeight} kgs (${enq.length} x ${enq.width} x ${enq.height} cm)`,
    kindlyAttention: "Logistics Team",
    lines: buildQuoteLines(enq.chargeableWeight, rates.find((r) => r.id === rateId), settings).map((l) =>
      l.group === "Airline" ? { ...l, markup: l.unit === "Per kg" ? 15 : 250 } : { ...l, markup: l.rate ? Math.round(l.rate * 0.1) : 0 },
    ),
    terms: settings.quotationTerms,
    reminders: [],
    ...extra,
  });

  const quotations: Quotation[] = [quotation("qt-1", enquiries[0], "rt-2", "al-ai", { status: "Booking Confirmed", sentAt: ago(8) })];

  const inbox: InboxEmail[] = [
    {
      id: "em-4",
      from: "Customer",
      fromName: "Vikram Shah",
      fromEmail: "vikram@sunrisetextiles.example",
      subject: "Enquiry: textiles to New York",
      body: "Hello,\n\nWe are looking to ship 30 cartons of home textiles (approx. 600 kg) from Mumbai to New York JFK. Please quote.\n\nThanks,\nVikram Shah\nSunrise Textiles",
      receivedAt: ago(0, 3),
      read: false,
    },
    {
      id: "em-2",
      from: "Customer",
      fromName: "Joseph Thomas",
      fromEmail: "logistics@coastalseafoods.example",
      subject: "Frozen seafood shipment to Dubai",
      body: "Dear Sir,\n\nWe have 40 boxes of frozen seafood (800 kg) ready to move to Dubai this week. Temperature -18°C. Please quote.\n\nJoseph",
      receivedAt: ago(0, 6),
      read: true,
      enquiryId: "en-2",
    },
  ];

  const log = (l: Omit<EmailLog, "id" | "cc" | "bcc" | "attachments"> & Partial<EmailLog>): EmailLog => ({
    id: Math.random().toString(36).slice(2, 10),
    cc: "",
    bcc: "",
    attachments: [],
    ...l,
  });

  const emailLogs: EmailLog[] = [
    log({ at: ago(8), kind: "Quotation", to: ["rahul@abcexporters.example"], subject: `Quotation ${ref("QT", 1)} – KOCHI-COK-INDIA to DUBAI-DXB-UAE`, body: "Please find attached our quotation.", attachments: [`${ref("QT", 1)}.pdf`], enquiryId: "en-1" }),
  ];

  const party = { altEmails: [], altPhones: [], documents: [] };
  const customers: Customer[] = [
    { ...party, id: "cu-abc", type: "Shipper/Receiver", code: "ABC", name: "ABC Exporters", address: "Kochi, Kerala, India", contact: "Rahul Menon", email: "rahul@abcexporters.example", phone: "+91 98470 11223", altEmails: ["accounts@abcexporters.example"] },
    { ...party, id: "cu-csf", type: "Shipper/Receiver", code: "CSF", name: "Coastal Seafoods Pvt Ltd", address: "Aroor, Alappuzha, Kerala, India", contact: "Joseph Thomas", email: "logistics@coastalseafoods.example", phone: "+91 98950 77881", altPhones: ["+91 484 270 1100"] },
    { ...party, id: "cu-sky", type: "Forwarder/Logistics", code: "SKY", name: "Sky Logistics", address: "Chennai, Tamil Nadu, India", contact: "Priya", email: "agent@skylogistics.example", phone: "+91 44 4000 1200" },
  ];

  const agents: Agent[] = [
    { ...party, id: "ag-1", type: "Overseas Agent", name: "Gulf Link Cargo LLC", contact: "Ahmed Rashid", email: "ops@gulflink.example", phone: "+971 4 555 0101", city: "Dubai", country: "UAE" },
    { ...party, id: "ag-2", type: "CHA", name: "Kairali Customs Brokers", contact: "Suresh P", email: "cha@kairali.example", phone: "+91 484 266 1100", city: "Kochi", country: "India" },
    { ...party, id: "ag-3", type: "Transporter", name: "Kerala Road Movers", contact: "Biju", email: "dispatch@krmovers.example", phone: "+91 98460 12345", city: "Kochi", country: "India" },
  ];

  const e1 = enquiries[0];
  const jobs: Job[] = [
    {
      id: "jb-1",
      ref: buildRef(settings.jobRef, { company: settings.refPrefix, client: "ABC", pol: e1.pol, pod: e1.pod, year, seq: 1 }),
      enquiryId: e1.id,
      quotationId: "qt-1",
      createdAt: ago(2),
      date: ago(2).slice(0, 10),
      customerId: e1.customerId,
      shipperId: e1.customerId,
      shipperName: "ABC Exporters",
      pol: e1.pol,
      pod: e1.pod,
      awbNo: "",
      flightDate: e1.booking!.flightDate,
      flightNo: e1.booking!.flightNo,
      status: "BOOKED",
      stock: "ASL",
      weight: e1.chargeableWeight,
      boxes: e1.packages,
      commodity: "GARMENTS",
      offload: "",
      chaId: "ag-2",
      chaName: "Kairali Customs Brokers",
      rate: "130+15",
      invoiceNo: "AIS/INV/0001/26-27",
      tsp: "",
      loading: "",
      month: e1.booking!.flightDate,
      iataCode: "AI",
      airlineId: "al-ai",
      years: String(year),
      duty: "",
      tspAdditional: "",
      loadingAdditional: "",
      bookingInfo: "Booking INFO",
      additional1: "",
      additional2: "",
      documents: [],
    },
  ];

  const invoices: CustomerInvoice[] = [
    {
      id: "iv-1",
      no: "AIS/INV/0001/26-27",
      date: ago(3).slice(0, 10),
      createdAt: ago(3),
      customerId: "cu-abc",
      exporter: "ABC EXPORTERS\nKOCHI, KERALA, INDIA",
      exporterRef: "",
      iecNo: "",
      buyerOrder: "",
      consignee: "AL NOOR GARMENTS TRADING LLC\nP.O. BOX 12345, DEIRA\nDUBAI, UAE",
      buyer: "",
      preCarriage: "BY ROAD",
      placeOfReceipt: "KOCHI",
      flightNo: "BY AIR",
      portOfLoading: "KOCHI",
      portOfDischarge: "DUBAI",
      finalDestination: "DUBAI",
      countryOfOrigin: "INDIA",
      countryOfDestination: "UAE",
      terms: "FOB",
      currency: "USD",
      marks: "ABC/DXB",
      packageRange: "01 TO 12 CARTONS",
      items: [
        { id: "it-1", description: "COTTON SHIRTS", packages: 6, quantity: 98, rate: 4.5 },
        { id: "it-2", description: "COTTON TROUSERS", packages: 4, quantity: 72, rate: 5 },
        { id: "it-3", description: "COTTON T-SHIRTS", packages: 2, quantity: 30, rate: 3.75 },
      ],
      grossWeight: 210,
      declaration: "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
      enquiryId: "en-1",
      jobId: "jb-1",
    },
  ];

  return {
    settings,
    ports: [
      { code: "COK", name: "Kochi", country: "India" },
      { code: "TRV", name: "Thiruvananthapuram", country: "India" },
      { code: "MAA", name: "Chennai", country: "India" },
      { code: "BOM", name: "Mumbai", country: "India" },
      { code: "CCU", name: "Kolkata", country: "India" },
      { code: "DEL", name: "Delhi", country: "India" },
      { code: "BLR", name: "Bengaluru", country: "India" },
      { code: "CMB", name: "Colombo", country: "Sri Lanka" },
      { code: "DXB", name: "Dubai", country: "UAE" },
      { code: "DOH", name: "Doha", country: "Qatar" },
      { code: "SIN", name: "Singapore", country: "Singapore" },
      { code: "LHR", name: "London Heathrow", country: "United Kingdom" },
      { code: "FRA", name: "Frankfurt", country: "Germany" },
      { code: "JFK", name: "New York JFK", country: "USA" },
      { code: "YYZ", name: "Toronto", country: "Canada" },
    ],
    customers,
    agents,
    airlines: [
      { id: "al-ai", name: "Air India", code: "AI", prefix: "098", email: "cargo@airindia.example", portalUrl: "https://www.airindia.com", ports: ["COK", "TRV", "MAA", "BOM", "CCU", "DEL", "BLR", "CMB", "DXB", "SIN", "LHR", "FRA", "JFK", "YYZ"] },
      { id: "al-ek", name: "Emirates SkyCargo", code: "EK", prefix: "176", email: "sales@emirates.example", portalUrl: "https://www.skychain.emirates.com", ports: ["COK", "TRV", "MAA", "BOM", "CCU", "DEL", "BLR", "CMB", "DXB", "SIN", "LHR", "FRA", "JFK", "YYZ"] },
      { id: "al-qr", name: "Qatar Airways Cargo", code: "QR", prefix: "157", email: "cargo@qatarairways.example", portalUrl: "https://www.qrcargo.com", ports: ["COK", "TRV", "MAA", "BOM", "CCU", "DEL", "BLR", "CMB", "DOH", "LHR", "FRA", "JFK", "YYZ"] },
    ],
    rates,
    enquiries,
    quotations,
    jobs,
    invoices,
    inbox,
    emailLogs,
    drafts: [],
    notifications: [
      { id: "nt-1", at: ago(5), enquiryId: "en-1", to: "+91 98470 11223", channel: "WhatsApp", message: "Booking confirmed on AI 933. Booking ref AIB-558201. Please share the invoice & packing list." },
    ],
    counters: { enquiry: 2, job: 1, invoice: 1 },
  };
}

