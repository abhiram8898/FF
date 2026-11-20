/** AWB copy types and print options, shared by the AWB document and the print dialog */

/** The eight AWB copies, as printed at the bottom of each */
export const AWB_COPIES = [
  "Original 1 - (For Issuing Carrier)",
  "Original 2 - (For Consignee)",
  "Original 3 - (For Shipper)",
  "Copy 4 - (Delivery Receipt)",
  "Copy 5 - (Destination Copy)",
  "Copy 6 - (Extra Copy)",
  "Copy 7 - (Extra Copy)",
  "Copy 8 - (For Agent)",
] as const;
export type AwbCopy = (typeof AWB_COPIES)[number];

/** How a copy prints: label, signature, data-only for pre-printed stationery, and rates (normal / AS AGREED / none) */
export interface AwbPrintOptions {
  copy?: AwbCopy;
  withSign?: boolean;
  dataOnly?: boolean;
  rateMode?: "normal" | "agreed" | "norate";
}
