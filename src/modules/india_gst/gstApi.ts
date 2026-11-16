import { invoke } from "@tauri-apps/api/core";
import type {
  GstSettings,
  GstPartyProfile,
  GstItemProfile,
  CompleteGstInvoice,
  CreateGstInvoicePayload,
  PendingBill,
  PartyCreditAging,
  BillSettlementPayload,
  Gstr1ReportData,
  Gstr3bReportData,
} from "./gstTypes";

export const gstApi = {
  // Settings
  getGstSettings: () => invoke<GstSettings>("get_gst_settings"),
  saveGstSettings: (settings: GstSettings) =>
    invoke<GstSettings>("save_gst_settings", { settings }),

  // Party GST Profile (Sundry Debtors & Creditors, Credit Limit, Terms)
  getPartyGstProfile: (partyId: string) =>
    invoke<GstPartyProfile | null>("get_party_gst_profile", { partyId }),
  savePartyGstProfile: (profile: GstPartyProfile) =>
    invoke<GstPartyProfile>("save_party_gst_profile", { profile }),

  // Item GST Profile (HSN / SAC, Cess, Service)
  getItemGstProfile: (itemId: string) =>
    invoke<GstItemProfile | null>("get_item_gst_profile", { itemId }),
  saveItemGstProfile: (profile: GstItemProfile) =>
    invoke<GstItemProfile>("save_item_gst_profile", { profile }),

  // Invoicing (Rule 46 CGST Compliant)
  createGstInvoice: (payload: CreateGstInvoicePayload) =>
    invoke<CompleteGstInvoice>("create_gst_invoice", { payload }),
  getGstInvoice: (invoiceId: string) =>
    invoke<CompleteGstInvoice>("get_gst_invoice", { invoiceId }),
  listGstInvoices: (invoiceType?: string, status?: string, search?: string) =>
    invoke<CompleteGstInvoice[]>("list_gst_invoices", {
      invoiceType,
      status,
      search,
    }),

  // Sundry Debtors & Creditors Credit Aging & Bill-by-Bill
  getSundryDebtorsAging: () =>
    invoke<PartyCreditAging[]>("get_sundry_debtors_aging"),
  getSundryCreditorsAging: () =>
    invoke<PartyCreditAging[]>("get_sundry_creditors_aging"),
  getPartyPendingBills: (partyId: string) =>
    invoke<PendingBill[]>("get_party_pending_bills", { partyId }),
  settleBillByBill: (payload: BillSettlementPayload) =>
    invoke<boolean>("settle_bill_by_bill", { payload }),

  // GSTR-1 & GSTR-3B Statutory Audit Reports
  getGstr1Report: (startDate: string, endDate: string) =>
    invoke<Gstr1ReportData>("get_gstr1_report", {
      startDate,
      endDate,
    }),
  getGstr3bReport: (startDate: string, endDate: string) =>
    invoke<Gstr3bReportData>("get_gstr3b_report", {
      startDate,
      endDate,
    }),
};
