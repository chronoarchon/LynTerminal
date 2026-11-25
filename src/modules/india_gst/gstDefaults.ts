import type { Settings } from "../../types";
import type { GstSettings } from "./gstTypes";

const DEMO_GSTINS = new Set(["27AABCU9603R1ZN", "27AABCU9603R1ZM"]);
const DEMO_LEGAL_NAMES = new Set([
  "LynTerminal India Enterprises Pvt Ltd",
  "LynTerminal Infotech Pvt Ltd",
]);
const DEMO_TRADE_NAMES = new Set(["LynTerminal Store", "LynStore India"]);
const DEMO_PANS = new Set(["AABCU9603R"]);
const DEMO_BANK_ACCOUNTS = new Set(["50200012345678"]);
const DEMO_BANK_IFSCS = new Set(["HDFC0000123", "HDFC0000128"]);
const DEMO_UPI_IDS = new Set([
  "lynterminal@okhdfcbank",
  "lynstore@okhdfcbank",
]);
const DEMO_TAX_IDS = new Set([
  "27AABCU9603R1ZN",
  "27AABCU9603R1ZM",
  "TAX-102938",
  "TAX-998822",
  "US-TAX-8829104",
]);

export function isDemoGstin(val?: string | null): boolean {
  if (!val) return true;
  return DEMO_GSTINS.has(val.trim().toUpperCase());
}

export function isDemoTaxId(val?: string | null): boolean {
  if (!val) return true;
  return DEMO_TAX_IDS.has(val.trim().toUpperCase());
}

/**
 * Strips factory-seeded placeholder supplier & bank strings from GstSettings
 * so new or upgraded stores never accidentally print hardcoded Mumbai demo details.
 */
export function sanitizeGstSettings(
  gst: Partial<GstSettings> | null | undefined,
  settings?: Partial<Settings>
): GstSettings {
  const safeGstin = (gst?.gstin ?? "").trim();
  const safeLegal = (gst?.legal_name ?? "").trim();
  const safeTrade = (gst?.trade_name ?? "").trim();
  const safePan = (gst?.pan ?? "").trim();
  const safeBankAcc = (gst?.bank_account_no ?? "").trim();
  const safeBankIfsc = (gst?.bank_ifsc ?? "").trim();
  const safeUpi = (gst?.upi_id ?? "").trim();
  const safeBankName = (gst?.bank_name ?? "").trim();
  const safeBankBranch = (gst?.bank_branch ?? "").trim();

  const isPlaceholderRow =
    DEMO_GSTINS.has(safeGstin.toUpperCase()) ||
    DEMO_LEGAL_NAMES.has(safeLegal);

  const cleanGstin = isDemoGstin(safeGstin) ? "" : safeGstin;
  const cleanLegal = DEMO_LEGAL_NAMES.has(safeLegal) || !safeLegal
    ? (settings?.business_name ?? "").trim()
    : safeLegal;
  const cleanTrade = DEMO_TRADE_NAMES.has(safeTrade) ? "" : safeTrade;
  const cleanPan = DEMO_PANS.has(safePan.toUpperCase()) ? "" : safePan;

  const cleanBankAcc = DEMO_BANK_ACCOUNTS.has(safeBankAcc) ? "" : safeBankAcc;
  const cleanBankIfsc = DEMO_BANK_IFSCS.has(safeBankIfsc.toUpperCase())
    ? ""
    : safeBankIfsc;
  const cleanUpi = DEMO_UPI_IDS.has(safeUpi.toLowerCase()) ? "" : safeUpi;

  const hasCustomBank = Boolean(cleanBankAcc || cleanBankIfsc || cleanUpi);
  const cleanBankName =
    hasCustomBank || (!isPlaceholderRow && safeBankName !== "HDFC Bank")
      ? safeBankName
      : "";
  const cleanBankBranch =
    hasCustomBank || (!isPlaceholderRow && safeBankBranch !== "Fort, Mumbai")
      ? safeBankBranch
      : "";

  return {
    is_enabled: Boolean(gst?.is_enabled ?? true),
    gstin: cleanGstin,
    legal_name: cleanLegal,
    trade_name: cleanTrade,
    state_code: (gst?.state_code ?? "27").trim() || "27",
    state_name: (gst?.state_name ?? "Maharashtra").trim() || "Maharashtra",
    pan: cleanPan,
    gst_composition: Boolean(gst?.gst_composition ?? false),
    einvoice_enabled: Boolean(gst?.einvoice_enabled ?? false),
    eway_bill_threshold: Number(gst?.eway_bill_threshold ?? 50000) || 50000,
    lut_number: (gst?.lut_number ?? "").trim(),
    bank_name: cleanBankName,
    bank_account_no: cleanBankAcc,
    bank_ifsc: cleanBankIfsc,
    bank_branch: cleanBankBranch,
    upi_id: cleanUpi,
  };
}
