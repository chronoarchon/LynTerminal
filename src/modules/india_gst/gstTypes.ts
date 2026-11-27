import type { Invoice, InvoiceItem } from "../../types";

export interface IndianState {
  code: string; // 2-digit code: "01", "07", "27", etc.
  name: string;
  isUnionTerritory: boolean;
}

export interface GstSettings {
  is_enabled: boolean;
  gstin: string;
  legal_name: string;
  trade_name: string;
  state_code: string;
  state_name: string;
  pan: string;
  gst_composition: boolean;
  einvoice_enabled: boolean;
  eway_bill_threshold: number;
  lut_number: string;
  bank_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  bank_branch: string;
  upi_id: string;
}

export interface GstPartyProfile {
  party_id: string;
  gstin: string;
  state_code: string;
  state_name: string;
  pan: string;
  gst_type: "REGULAR" | "COMPOSITION" | "UNREGISTERED" | "CONSUMER" | "OVERSEAS";
  credit_limit: number;
  credit_period_days: number;
  tally_ledger_group: "Sundry Debtors" | "Sundry Creditors";
}

export interface GstItemProfile {
  item_id: string;
  hsn_code: string;
  description: string;
  is_service: boolean;
  cess_rate: number;
}

export interface GstInvoiceRecord {
  invoice_id: string;
  place_of_supply: string;
  pos_state_code: string;
  pos_state_name: string;
  supplier_gstin: string;
  customer_gstin: string;
  is_interstate: boolean;
  is_reverse_charge: boolean;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  round_off: number;
  eway_bill_no?: string | null;
  vehicle_no?: string | null;
  transporter_name?: string | null;
  bill_reference_type: "New Ref" | "Agst Ref" | "Advance" | "On Account";
}

export interface GstInvoiceItemRecord {
  id: string;
  invoice_id: string;
  item_id?: string | null;
  hsn_code: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_amount: number;
  taxable_amount: number;
  tax_rate: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  cess_rate: number;
  cess_amount: number;
  line_total: number;
}

export interface CompleteGstInvoice {
  invoice: Invoice;
  items: InvoiceItem[];
  gst_info: GstInvoiceRecord;
  gst_items: GstInvoiceItemRecord[];
}

export interface CreateGstItemPayload {
  item_id?: string | null;
  item_name: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_amount: number;
  taxable_amount: number;
  tax_rate: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  cess_rate: number;
  cess_amount: number;
  line_total: number;
}

export interface CreateGstInvoicePayload {
  invoice_type: "SALE" | "PURCHASE" | "RETURN";
  party_id?: string | null;
  party_name: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  discount_amount: number;
  total_tax: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  round_off: number;
  total_amount: number;
  paid_amount: number;
  payment_method: string;
  notes: string;
  reference?: string | null;
  place_of_supply: string;
  pos_state_code: string;
  pos_state_name: string;
  customer_gstin: string;
  is_interstate: boolean;
  is_reverse_charge: boolean;
  eway_bill_no?: string | null;
  vehicle_no?: string | null;
  transporter_name?: string | null;
  bill_reference_type: string;
  items: CreateGstItemPayload[];
}

export interface PendingBill {
  invoice_id: string;
  invoice_number: string;
  invoice_type: string;
  party_id: string;
  party_name: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  overdue_days: number;
  status: string;
  bill_ref: string;
}

export interface PartyCreditAging {
  party_id: string;
  party_name: string;
  party_type: "CUSTOMER" | "VENDOR";
  tally_ledger_group: string;
  phone: string;
  email: string;
  gstin: string;
  state_name: string;
  total_outstanding: number;
  credit_limit: number;
  credit_period_days: number;
  is_over_limit: boolean;
  current_30: number;
  days_60: number;
  days_90: number;
  over_90: number;
  overdue_count: number;
  pending_bills_count: number;
}

export interface BillAllocationPayload {
  invoice_id: string;
  amount: number;
}

export interface BillSettlementPayload {
  party_id: string;
  party_name: string;
  total_amount: number;
  payment_type: "IN" | "OUT";
  payment_method: string;
  payment_date: string;
  reference: string;
  notes: string;
  bank_account_id?: string | null;
  allocations: BillAllocationPayload[];
}

export interface Gstr1B2bInvoice {
  customer_gstin: string;
  customer_name: string;
  invoice_number: string;
  invoice_date: string;
  invoice_value: number;
  place_of_supply: string;
  reverse_charge: string;
  invoice_type: string;
  taxable_value: number;
  igst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  cess_amount: number;
}

export interface Gstr1B2csSummary {
  place_of_supply: string;
  tax_rate: number;
  taxable_value: number;
  igst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  cess_amount: number;
}

export interface Gstr1HsnSummary {
  hsn_code: string;
  description: string;
  uqc: string;
  tax_rate: number;
  total_quantity: number;
  total_value: number;
  taxable_value: number;
  igst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  cess_amount: number;
}

export interface Gstr1DocSummary {
  doc_type: string;
  from_serial: string;
  to_serial: string;
  total_count: number;
  cancelled_count: number;
  net_count: number;
}

export interface Gstr1ReportData {
  gstin: string;
  legal_name: string;
  fp: string;
  start_date: string;
  end_date: string;
  total_turnover: number;
  total_taxable: number;
  total_igst: number;
  total_cgst: number;
  total_sgst: number;
  total_cess: number;
  b2b: Gstr1B2bInvoice[];
  b2cl: Gstr1B2bInvoice[];
  b2cs: Gstr1B2csSummary[];
  hsn_summary: Gstr1HsnSummary[];
  doc_summary: Gstr1DocSummary[];
}

export interface Gstr3bTable31 {
  outward_taxable_value: number;
  outward_igst: number;
  outward_cgst: number;
  outward_sgst: number;
  outward_cess: number;
  zero_rated_taxable: number;
  nil_exempt_taxable: number;
  reverse_charge_taxable: number;
}

export interface Gstr3bTable4Itc {
  itc_igst: number;
  itc_cgst: number;
  itc_sgst: number;
  itc_cess: number;
  itc_ineligible: number;
}

export interface Gstr3bReportData {
  gstin: string;
  legal_name: string;
  fp: string;
  start_date: string;
  end_date: string;
  table31: Gstr3bTable31;
  table4_itc: Gstr3bTable4Itc;
  net_igst_payable: number;
  net_cgst_payable: number;
  net_sgst_payable: number;
  net_cess_payable: number;
  itc_utilized_igst: number;
  itc_utilized_cgst: number;
  itc_utilized_sgst: number;
  itc_utilized_cess: number;
  total_itc_utilized: number;
  total_tax_payable: number;
  total_itc_available: number;
  net_cash_payable: number;
}
