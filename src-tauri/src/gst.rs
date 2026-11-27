use chrono::{DateTime, Local, NaiveDate};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

use crate::commands::{parse_payment_liquidity, AppState};
use crate::db::DatabaseManager;
use crate::models::{Invoice, InvoiceItem};

fn parse_flexible_date(raw: &str) -> Option<NaiveDate> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%Y-%m-%d") {
        return Some(d);
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(trimmed) {
        return Some(dt.date_naive());
    }
    if trimmed.len() >= 10 {
        if let Ok(d) = NaiveDate::parse_from_str(&trimmed[..10], "%Y-%m-%d") {
            return Some(d);
        }
    }
    None
}

// ----------------------------------------------------------------------------
// GST DATA STRUCTURES
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GstSettings {
    pub is_enabled: bool,
    pub gstin: String,
    pub legal_name: String,
    pub trade_name: String,
    pub state_code: String,
    pub state_name: String,
    pub pan: String,
    pub gst_composition: bool,
    pub einvoice_enabled: bool,
    pub eway_bill_threshold: f64,
    pub lut_number: String,
    pub bank_name: String,
    pub bank_account_no: String,
    pub bank_ifsc: String,
    pub bank_branch: String,
    pub upi_id: String,
}

impl Default for GstSettings {
    fn default() -> Self {
        Self {
            is_enabled: true,
            gstin: "27AABCU9603R1ZN".into(),
            legal_name: "LynTerminal India Enterprises Pvt Ltd".into(),
            trade_name: "LynTerminal Store".into(),
            state_code: "27".into(),
            state_name: "Maharashtra".into(),
            pan: "AABCU9603R".into(),
            gst_composition: false,
            einvoice_enabled: false,
            eway_bill_threshold: 50000.0,
            lut_number: "".into(),
            bank_name: "HDFC Bank".into(),
            bank_account_no: "50200012345678".into(),
            bank_ifsc: "HDFC0000123".into(),
            bank_branch: "Fort, Mumbai".into(),
            upi_id: "lynterminal@okhdfcbank".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GstPartyProfile {
    pub party_id: String,
    pub gstin: String,
    pub state_code: String,
    pub state_name: String,
    pub pan: String,
    pub gst_type: String, // REGULAR, COMPOSITION, UNREGISTERED, CONSUMER, OVERSEAS
    pub credit_limit: f64,
    pub credit_period_days: i32,
    pub tally_ledger_group: String, // "Sundry Debtors" | "Sundry Creditors"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GstItemProfile {
    pub item_id: String,
    pub hsn_code: String,
    pub description: String,
    pub is_service: bool,
    pub cess_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GstInvoiceRecord {
    pub invoice_id: String,
    pub place_of_supply: String,
    pub pos_state_code: String,
    pub pos_state_name: String,
    pub supplier_gstin: String,
    pub customer_gstin: String,
    pub is_interstate: bool,
    pub is_reverse_charge: bool,
    pub cgst_amount: f64,
    pub sgst_amount: f64,
    pub igst_amount: f64,
    pub cess_amount: f64,
    pub round_off: f64,
    pub eway_bill_no: Option<String>,
    pub vehicle_no: Option<String>,
    pub transporter_name: Option<String>,
    pub bill_reference_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GstInvoiceItemRecord {
    pub id: String,
    pub invoice_id: String,
    pub item_id: Option<String>,
    pub hsn_code: String,
    pub quantity: f64,
    pub unit: String,
    pub rate: f64,
    pub discount_amount: f64,
    pub taxable_amount: f64,
    pub tax_rate: f64,
    pub cgst_rate: f64,
    pub cgst_amount: f64,
    pub sgst_rate: f64,
    pub sgst_amount: f64,
    pub igst_rate: f64,
    pub igst_amount: f64,
    pub cess_rate: f64,
    pub cess_amount: f64,
    pub line_total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteGstInvoice {
    pub invoice: Invoice,
    pub items: Vec<InvoiceItem>,
    pub gst_info: GstInvoiceRecord,
    pub gst_items: Vec<GstInvoiceItemRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGstItemPayload {
    pub item_id: Option<String>,
    pub item_name: String,
    pub hsn_code: String,
    pub quantity: f64,
    pub unit: String,
    pub rate: f64,
    pub discount_amount: f64,
    pub taxable_amount: f64,
    pub tax_rate: f64,
    pub cgst_rate: f64,
    pub cgst_amount: f64,
    pub sgst_rate: f64,
    pub sgst_amount: f64,
    pub igst_rate: f64,
    pub igst_amount: f64,
    pub cess_rate: f64,
    pub cess_amount: f64,
    pub line_total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGstInvoicePayload {
    pub invoice_type: String, // "SALE" | "PURCHASE" | "RETURN"
    pub party_id: Option<String>,
    pub party_name: String,
    pub invoice_date: String,
    pub due_date: String,
    pub subtotal: f64,
    pub discount_amount: f64,
    pub total_tax: f64,
    pub cgst_amount: f64,
    pub sgst_amount: f64,
    pub igst_amount: f64,
    pub cess_amount: f64,
    pub round_off: f64,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub payment_method: String,
    pub notes: String,
    pub reference: Option<String>,
    // GST metadata
    pub place_of_supply: String,
    pub pos_state_code: String,
    pub pos_state_name: String,
    pub customer_gstin: String,
    pub is_interstate: bool,
    pub is_reverse_charge: bool,
    pub eway_bill_no: Option<String>,
    pub vehicle_no: Option<String>,
    pub transporter_name: Option<String>,
    pub bill_reference_type: String, // "New Ref", "Agst Ref", "Advance", "On Account"
    pub items: Vec<CreateGstItemPayload>,
    #[serde(default)]
    pub bank_account_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingBill {
    pub invoice_id: String,
    pub invoice_number: String,
    pub invoice_type: String,
    pub party_id: String,
    pub party_name: String,
    pub invoice_date: String,
    pub due_date: String,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub balance_due: f64,
    pub overdue_days: i64,
    pub status: String,
    pub bill_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartyCreditAging {
    pub party_id: String,
    pub party_name: String,
    pub party_type: String, // "CUSTOMER" or "VENDOR"
    pub tally_ledger_group: String, // "Sundry Debtors" or "Sundry Creditors"
    pub phone: String,
    pub email: String,
    pub gstin: String,
    pub state_name: String,
    pub total_outstanding: f64,
    pub credit_limit: f64,
    pub credit_period_days: i32,
    pub is_over_limit: bool,
    pub current_30: f64,
    pub days_60: f64,
    pub days_90: f64,
    pub over_90: f64,
    pub overdue_count: usize,
    pub pending_bills_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillAllocationPayload {
    pub invoice_id: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillSettlementPayload {
    pub party_id: String,
    pub party_name: String,
    pub total_amount: f64,
    pub payment_type: String, // "IN" (Receipt from Customer) | "OUT" (Payment to Vendor)
    pub payment_method: String,
    pub payment_date: String,
    pub reference: String,
    pub notes: String,
    #[serde(default)]
    pub bank_account_id: Option<String>,
    pub allocations: Vec<BillAllocationPayload>,
}

// ----------------------------------------------------------------------------
// GSTR-1 AUDIT STRUCTS
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gstr1B2bInvoice {
    pub customer_gstin: String,
    pub customer_name: String,
    pub invoice_number: String,
    pub invoice_date: String,
    pub invoice_value: f64,
    pub place_of_supply: String,
    pub reverse_charge: String,
    pub invoice_type: String,
    pub taxable_value: f64,
    pub igst_amount: f64,
    pub cgst_amount: f64,
    pub sgst_amount: f64,
    pub cess_amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gstr1B2csSummary {
    pub place_of_supply: String,
    pub tax_rate: f64,
    pub taxable_value: f64,
    pub igst_amount: f64,
    pub cgst_amount: f64,
    pub sgst_amount: f64,
    pub cess_amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gstr1HsnSummary {
    pub hsn_code: String,
    pub description: String,
    pub uqc: String,
    pub tax_rate: f64,
    pub total_quantity: f64,
    pub total_value: f64,
    pub taxable_value: f64,
    pub igst_amount: f64,
    pub cgst_amount: f64,
    pub sgst_amount: f64,
    pub cess_amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gstr1DocSummary {
    pub doc_type: String,
    pub from_serial: String,
    pub to_serial: String,
    pub total_count: usize,
    pub cancelled_count: usize,
    pub net_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gstr1ReportData {
    pub gstin: String,
    pub legal_name: String,
    pub fp: String,
    pub start_date: String,
    pub end_date: String,
    pub total_turnover: f64,
    pub total_taxable: f64,
    pub total_igst: f64,
    pub total_cgst: f64,
    pub total_sgst: f64,
    pub total_cess: f64,
    pub b2b: Vec<Gstr1B2bInvoice>,
    pub b2cl: Vec<Gstr1B2bInvoice>,
    pub b2cs: Vec<Gstr1B2csSummary>,
    pub hsn_summary: Vec<Gstr1HsnSummary>,
    pub doc_summary: Vec<Gstr1DocSummary>,
}

// ----------------------------------------------------------------------------
// GSTR-3B AUDIT STRUCTS
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gstr3bTable31 {
    pub outward_taxable_value: f64,
    pub outward_igst: f64,
    pub outward_cgst: f64,
    pub outward_sgst: f64,
    pub outward_cess: f64,
    pub zero_rated_taxable: f64,
    pub nil_exempt_taxable: f64,
    pub reverse_charge_taxable: f64,
    pub reverse_charge_igst: f64,
    pub reverse_charge_cgst: f64,
    pub reverse_charge_sgst: f64,
    pub reverse_charge_cess: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gstr3bTable4Itc {
    pub itc_igst: f64,
    pub itc_cgst: f64,
    pub itc_sgst: f64,
    pub itc_cess: f64,
    pub itc_ineligible: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gstr3bReportData {
    pub gstin: String,
    pub legal_name: String,
    pub fp: String,
    pub start_date: String,
    pub end_date: String,
    pub table31: Gstr3bTable31,
    pub table4_itc: Gstr3bTable4Itc,
    pub net_igst_payable: f64,
    pub net_cgst_payable: f64,
    pub net_sgst_payable: f64,
    pub net_cess_payable: f64,
    pub itc_utilized_igst: f64,
    pub itc_utilized_cgst: f64,
    pub itc_utilized_sgst: f64,
    pub itc_utilized_cess: f64,
    pub total_itc_utilized: f64,
    pub total_tax_payable: f64,
    pub total_itc_available: f64,
    pub net_cash_payable: f64,
}

// ----------------------------------------------------------------------------
// INTERNAL CORE ENGINES
// ----------------------------------------------------------------------------

pub fn get_gst_settings_internal(conn: &Connection) -> Result<GstSettings, String> {
    let res = conn.query_row(
        "SELECT is_enabled, gstin, legal_name, trade_name, state_code, state_name,
                pan, gst_composition, einvoice_enabled, eway_bill_threshold,
                lut_number, bank_name, bank_account_no, bank_ifsc, bank_branch, upi_id
         FROM gst_settings WHERE id = 1",
        [],
        |row| {
            Ok(GstSettings {
                is_enabled: row.get::<_, i32>(0)? == 1,
                gstin: row.get(1)?,
                legal_name: row.get(2)?,
                trade_name: row.get(3)?,
                state_code: row.get(4)?,
                state_name: row.get(5)?,
                pan: row.get(6)?,
                gst_composition: row.get::<_, i32>(7)? == 1,
                einvoice_enabled: row.get::<_, i32>(8)? == 1,
                eway_bill_threshold: row.get(9)?,
                lut_number: row.get(10)?,
                bank_name: row.get(11)?,
                bank_account_no: row.get(12)?,
                bank_ifsc: row.get(13)?,
                bank_branch: row.get(14)?,
                upi_id: row.get(15)?,
            })
        },
    );

    Ok(res.unwrap_or_else(|_| GstSettings::default()))
}

pub fn save_gst_settings_internal(conn: &Connection, settings: GstSettings) -> Result<GstSettings, String> {
    let now = Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO gst_settings (
            id, is_enabled, gstin, legal_name, trade_name, state_code, state_name,
            pan, gst_composition, einvoice_enabled, eway_bill_threshold,
            lut_number, bank_name, bank_account_no, bank_ifsc, bank_branch, upi_id, updated_at
        ) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
        ON CONFLICT(id) DO UPDATE SET
            is_enabled = excluded.is_enabled,
            gstin = excluded.gstin,
            legal_name = excluded.legal_name,
            trade_name = excluded.trade_name,
            state_code = excluded.state_code,
            state_name = excluded.state_name,
            pan = excluded.pan,
            gst_composition = excluded.gst_composition,
            einvoice_enabled = excluded.einvoice_enabled,
            eway_bill_threshold = excluded.eway_bill_threshold,
            lut_number = excluded.lut_number,
            bank_name = excluded.bank_name,
            bank_account_no = excluded.bank_account_no,
            bank_ifsc = excluded.bank_ifsc,
            bank_branch = excluded.bank_branch,
            upi_id = excluded.upi_id,
            updated_at = excluded.updated_at",
        params![
            if settings.is_enabled { 1 } else { 0 },
            settings.gstin,
            settings.legal_name,
            settings.trade_name,
            settings.state_code,
            settings.state_name,
            settings.pan,
            if settings.gst_composition { 1 } else { 0 },
            if settings.einvoice_enabled { 1 } else { 0 },
            settings.eway_bill_threshold,
            settings.lut_number,
            settings.bank_name,
            settings.bank_account_no,
            settings.bank_ifsc,
            settings.bank_branch,
            settings.upi_id,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    if settings.is_enabled {
        let _ = conn.execute(
            "UPDATE settings SET
                tax_preset = 'INDIA_GST',
                tax_name = 'GST',
                currency_symbol = '₹',
                currency_code = 'INR',
                tax_id = ?1
             WHERE id = 1",
            params![settings.gstin],
        );
    }

    Ok(settings)
}

pub fn get_party_gst_profile_internal(conn: &Connection, party_id: &str) -> Result<Option<GstPartyProfile>, String> {
    let res = conn.query_row(
        "SELECT party_id, gstin, state_code, state_name, pan, gst_type,
                credit_limit, credit_period_days, tally_ledger_group
         FROM gst_parties WHERE party_id = ?1",
        params![party_id],
        |row| {
            Ok(GstPartyProfile {
                party_id: row.get(0)?,
                gstin: row.get(1)?,
                state_code: row.get(2)?,
                state_name: row.get(3)?,
                pan: row.get(4)?,
                gst_type: row.get(5)?,
                credit_limit: row.get(6)?,
                credit_period_days: row.get(7)?,
                tally_ledger_group: row.get(8)?,
            })
        },
    );

    match res {
        Ok(prof) => Ok(Some(prof)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn save_party_gst_profile_internal(conn: &Connection, profile: GstPartyProfile) -> Result<GstPartyProfile, String> {
    conn.execute(
        "INSERT INTO gst_parties (
            party_id, gstin, state_code, state_name, pan, gst_type,
            credit_limit, credit_period_days, tally_ledger_group
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(party_id) DO UPDATE SET
            gstin = excluded.gstin,
            state_code = excluded.state_code,
            state_name = excluded.state_name,
            pan = excluded.pan,
            gst_type = excluded.gst_type,
            credit_limit = excluded.credit_limit,
            credit_period_days = excluded.credit_period_days,
            tally_ledger_group = excluded.tally_ledger_group",
        params![
            profile.party_id,
            profile.gstin,
            profile.state_code,
            profile.state_name,
            profile.pan,
            profile.gst_type,
            profile.credit_limit,
            profile.credit_period_days,
            profile.tally_ledger_group,
        ],
    )
    .map_err(|e| e.to_string())?;

    if !profile.gstin.is_empty() {
        let _ = conn.execute(
            "UPDATE parties SET tax_number = ?1 WHERE id = ?2",
            params![profile.gstin, profile.party_id],
        );
    }

    Ok(profile)
}

pub fn get_item_gst_profile_internal(conn: &Connection, item_id: &str) -> Result<Option<GstItemProfile>, String> {
    let res = conn.query_row(
        "SELECT item_id, hsn_code, description, is_service, cess_rate
         FROM gst_items WHERE item_id = ?1",
        params![item_id],
        |row| {
            Ok(GstItemProfile {
                item_id: row.get(0)?,
                hsn_code: row.get(1)?,
                description: row.get(2)?,
                is_service: row.get::<_, i32>(3)? == 1,
                cess_rate: row.get(4)?,
            })
        },
    );

    match res {
        Ok(prof) => Ok(Some(prof)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn save_item_gst_profile_internal(conn: &Connection, profile: GstItemProfile) -> Result<GstItemProfile, String> {
    conn.execute(
        "INSERT INTO gst_items (item_id, hsn_code, description, is_service, cess_rate)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(item_id) DO UPDATE SET
            hsn_code = excluded.hsn_code,
            description = excluded.description,
            is_service = excluded.is_service,
            cess_rate = excluded.cess_rate",
        params![
            profile.item_id,
            profile.hsn_code,
            profile.description,
            if profile.is_service { 1 } else { 0 },
            profile.cess_rate,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(profile)
}

pub fn create_gst_invoice_internal(
    conn: &mut Connection,
    payload: CreateGstInvoicePayload,
) -> Result<CompleteGstInvoice, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let invoice_id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();

    let prefix: String = tx
        .query_row(
            "SELECT invoice_prefix FROM settings WHERE id = 1",
            [],
            |r| r.get(0),
        )
        .unwrap_or_else(|_| "INV-".into());

    let next_num = crate::commands::next_sequence_number(&tx, "invoices", "invoice_number", &prefix);
    let invoice_number = format!("{}{:05}", prefix, next_num);

    let supplier_gstin: String = tx
        .query_row(
            "SELECT gstin FROM gst_settings WHERE id = 1",
            [],
            |r| r.get(0),
        )
        .unwrap_or_else(|_| "27AABCU9603R1ZN".into());

    let status = if payload.paid_amount >= payload.total_amount - 0.01 {
        "PAID"
    } else if payload.paid_amount > 0.01 {
        "PARTIAL"
    } else {
        "UNPAID"
    };

    let valid_party_id: Option<String> = match payload.party_id.as_deref().map(str::trim) {
        Some(pid) if !pid.is_empty() => {
            let exists: bool = tx
                .query_row("SELECT 1 FROM parties WHERE id = ?1", params![pid], |_| Ok(true))
                .unwrap_or(false);
            if exists {
                Some(pid.to_string())
            } else {
                None
            }
        }
        _ => None,
    };

    tx.execute(
        "INSERT INTO invoices (
            id, invoice_number, invoice_type, party_id, party_name,
            invoice_date, due_date, subtotal, discount_amount, tax_amount,
            total_amount, paid_amount, status, payment_method, notes,
            created_at, reference
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            invoice_id,
            invoice_number,
            payload.invoice_type,
            valid_party_id,
            payload.party_name,
            payload.invoice_date,
            payload.due_date,
            payload.subtotal,
            payload.discount_amount,
            payload.total_tax,
            payload.total_amount,
            payload.paid_amount,
            status,
            payload.payment_method,
            payload.notes,
            now,
            payload.reference.as_deref().unwrap_or(""),
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO gst_invoices (
            invoice_id, place_of_supply, pos_state_code, pos_state_name,
            supplier_gstin, customer_gstin, is_interstate, is_reverse_charge,
            cgst_amount, sgst_amount, igst_amount, cess_amount, round_off,
            eway_bill_no, vehicle_no, transporter_name, bill_reference_type
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            invoice_id,
            payload.place_of_supply,
            payload.pos_state_code,
            payload.pos_state_name,
            supplier_gstin,
            payload.customer_gstin,
            if payload.is_interstate { 1 } else { 0 },
            if payload.is_reverse_charge { 1 } else { 0 },
            payload.cgst_amount,
            payload.sgst_amount,
            payload.igst_amount,
            payload.cess_amount,
            payload.round_off,
            payload.eway_bill_no.as_deref().unwrap_or(""),
            payload.vehicle_no.as_deref().unwrap_or(""),
            payload.transporter_name.as_deref().unwrap_or(""),
            payload.bill_reference_type,
        ],
    )
    .map_err(|e| e.to_string())?;

    let mut created_core_items = Vec::new();
    let mut created_gst_items = Vec::new();

    for item_payload in payload.items {
        let line_id = Uuid::new_v4().to_string();

        let valid_item_id: Option<String> = match item_payload.item_id.as_deref().map(str::trim) {
            Some(it_id) if !it_id.is_empty() => {
                let exists: bool = tx
                    .query_row("SELECT 1 FROM items WHERE id = ?1", params![it_id], |_| Ok(true))
                    .unwrap_or(false);
                if exists {
                    Some(it_id.to_string())
                } else {
                    None
                }
            }
            _ => None,
        };

        let gross_line = item_payload.rate * item_payload.quantity;
        let disc_pct = if gross_line > 0.0 && item_payload.discount_amount > 0.0 {
            ((item_payload.discount_amount / gross_line) * 100.0).min(100.0)
        } else {
            0.0
        };

        tx.execute(
            "INSERT INTO invoice_items (
                id, invoice_id, item_id, item_name, quantity, unit,
                unit_price, discount_percent, tax_rate, line_total
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                line_id,
                invoice_id,
                valid_item_id,
                item_payload.item_name,
                item_payload.quantity,
                item_payload.unit,
                item_payload.rate,
                disc_pct,
                item_payload.tax_rate,
                item_payload.line_total,
            ],
        )
        .map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO gst_invoice_items (
                id, invoice_id, item_id, hsn_code, quantity, unit, rate,
                discount_amount, taxable_amount, tax_rate,
                cgst_rate, cgst_amount, sgst_rate, sgst_amount,
                igst_rate, igst_amount, cess_rate, cess_amount, line_total
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
            params![
                line_id,
                invoice_id,
                valid_item_id,
                item_payload.hsn_code,
                item_payload.quantity,
                item_payload.unit,
                item_payload.rate,
                item_payload.discount_amount,
                item_payload.taxable_amount,
                item_payload.tax_rate,
                item_payload.cgst_rate,
                item_payload.cgst_amount,
                item_payload.sgst_rate,
                item_payload.sgst_amount,
                item_payload.igst_rate,
                item_payload.igst_amount,
                item_payload.cess_rate,
                item_payload.cess_amount,
                item_payload.line_total,
            ],
        )
        .map_err(|e| e.to_string())?;

        if let Some(ref it_id) = valid_item_id {
            if payload.invoice_type == "SALE" {
                tx.execute(
                    "UPDATE items SET stock_quantity = stock_quantity - ?1 WHERE id = ?2",
                    params![item_payload.quantity, it_id],
                )
                .ok();

                let current: f64 = tx
                    .query_row(
                        "SELECT stock_quantity FROM items WHERE id = ?1",
                        params![it_id],
                        |r| r.get(0),
                    )
                    .unwrap_or(0.0);

                tx.execute(
                    "INSERT INTO stock_movements (
                        id, item_id, item_name, change_quantity, quantity_after,
                        movement_type, reference_id, timestamp, notes
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        Uuid::new_v4().to_string(),
                        it_id,
                        item_payload.item_name,
                        -item_payload.quantity,
                        current,
                        "SALE",
                        invoice_number,
                        now,
                        format!("GST Tax Invoice #{}", invoice_number),
                    ],
                )
                .ok();
            } else if payload.invoice_type == "PURCHASE" || payload.invoice_type == "RETURN" {
                tx.execute(
                    "UPDATE items SET stock_quantity = stock_quantity + ?1 WHERE id = ?2",
                    params![item_payload.quantity, it_id],
                )
                .ok();

                let current: f64 = tx
                    .query_row(
                        "SELECT stock_quantity FROM items WHERE id = ?1",
                        params![it_id],
                        |r| r.get(0),
                    )
                    .unwrap_or(0.0);

                let (mov_type, mov_note) = if payload.invoice_type == "RETURN" {
                    ("RETURN", format!("GST Credit Note / Return #{}", invoice_number))
                } else {
                    ("PURCHASE", format!("GST Inward Bill #{}", invoice_number))
                };

                tx.execute(
                    "INSERT INTO stock_movements (
                        id, item_id, item_name, change_quantity, quantity_after,
                        movement_type, reference_id, timestamp, notes
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        Uuid::new_v4().to_string(),
                        it_id,
                        item_payload.item_name,
                        item_payload.quantity,
                        current,
                        mov_type,
                        invoice_number,
                        now,
                        mov_note,
                    ],
                )
                .ok();
            }
        }

        created_core_items.push(InvoiceItem {
            id: line_id.clone(),
            invoice_id: invoice_id.clone(),
            item_id: valid_item_id.clone(),
            item_name: item_payload.item_name.clone(),
            quantity: item_payload.quantity,
            unit: item_payload.unit.clone(),
            unit_price: item_payload.rate,
            discount_percent: disc_pct,
            tax_rate: item_payload.tax_rate,
            line_total: item_payload.line_total,
        });

        created_gst_items.push(GstInvoiceItemRecord {
            id: line_id,
            invoice_id: invoice_id.clone(),
            item_id: valid_item_id,
            hsn_code: item_payload.hsn_code,
            quantity: item_payload.quantity,
            unit: item_payload.unit,
            rate: item_payload.rate,
            discount_amount: item_payload.discount_amount,
            taxable_amount: item_payload.taxable_amount,
            tax_rate: item_payload.tax_rate,
            cgst_rate: item_payload.cgst_rate,
            cgst_amount: item_payload.cgst_amount,
            sgst_rate: item_payload.sgst_rate,
            sgst_amount: item_payload.sgst_amount,
            igst_rate: item_payload.igst_rate,
            igst_amount: item_payload.igst_amount,
            cess_rate: item_payload.cess_rate,
            cess_amount: item_payload.cess_amount,
            line_total: item_payload.line_total,
        });
    }

    if let Some(ref p_id) = valid_party_id {
        let unpaid = payload.total_amount - payload.paid_amount;
        if payload.invoice_type == "SALE" {
            tx.execute(
                "UPDATE parties SET current_balance = current_balance + ?1 WHERE id = ?2",
                params![unpaid, p_id],
            )
            .ok();

            if payload.paid_amount > 0.0 {
                let payment_id = Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO payments (
                        id, invoice_id, party_id, party_name, amount,
                        payment_type, payment_method, payment_date, reference, notes
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        payment_id,
                        invoice_id,
                        p_id,
                        payload.party_name,
                        payload.paid_amount,
                        "IN",
                        payload.payment_method,
                        payload.invoice_date,
                        invoice_number,
                        format!("Payment for GST Tax Invoice #{}", invoice_number),
                    ],
                )
                .ok();

                tx.execute(
                    "INSERT INTO bill_settlements (
                        id, payment_id, invoice_id, party_id, settled_amount, settlement_date, notes
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        Uuid::new_v4().to_string(),
                        payment_id,
                        invoice_id,
                        p_id,
                        payload.paid_amount,
                        payload.invoice_date,
                        "Settled at bill generation",
                    ],
                )
                .ok();
            }
        } else if payload.invoice_type == "PURCHASE" {
            tx.execute(
                "UPDATE parties SET current_balance = current_balance - ?1 WHERE id = ?2",
                params![unpaid, p_id],
            )
            .ok();

            if payload.paid_amount > 0.0 {
                let payment_id = Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO payments (
                        id, invoice_id, party_id, party_name, amount,
                        payment_type, payment_method, payment_date, reference, notes
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        payment_id,
                        invoice_id,
                        p_id,
                        payload.party_name,
                        payload.paid_amount,
                        "OUT",
                        payload.payment_method,
                        payload.invoice_date,
                        invoice_number,
                        format!("Payment for Purchase Bill #{}", invoice_number),
                    ],
                )
                .ok();

                tx.execute(
                    "INSERT INTO bill_settlements (
                        id, payment_id, invoice_id, party_id, settled_amount, settlement_date, notes
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        Uuid::new_v4().to_string(),
                        payment_id,
                        invoice_id,
                        p_id,
                        payload.paid_amount,
                        payload.invoice_date,
                        "Settled at bill entry",
                    ],
                )
                .ok();
            }
        } else if payload.invoice_type == "RETURN" {
            tx.execute(
                "UPDATE parties SET current_balance = current_balance - ?1 WHERE id = ?2",
                params![unpaid, p_id],
            )
            .ok();

            if payload.paid_amount > 0.0 {
                let payment_id = Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO payments (
                        id, invoice_id, party_id, party_name, amount,
                        payment_type, payment_method, payment_date, reference, notes
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        payment_id,
                        invoice_id,
                        p_id,
                        payload.party_name,
                        payload.paid_amount,
                        "OUT",
                        payload.payment_method,
                        payload.invoice_date,
                        invoice_number,
                        format!("Refund for GST Credit Note #{}", invoice_number),
                    ],
                )
                .ok();
            }
        }
    }

    // Update primary bank account balance when GST invoice involves bank/digital tender
    if payload.paid_amount > 0.0 {
        let (_, bank_part) = parse_payment_liquidity(&payload.payment_method, payload.paid_amount);
        if bank_part > 0.0 {
            let bank_delta = if payload.invoice_type == "SALE" {
                bank_part
            } else if payload.invoice_type == "PURCHASE" || payload.invoice_type == "RETURN" {
                -bank_part
            } else {
                0.0
            };
            if bank_delta != 0.0 {
                if let Some(ref bid) = payload.bank_account_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
                    tx.execute(
                        "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE id = ?2",
                        params![bank_delta, bid],
                    )
                    .ok();
                } else {
                    tx.execute(
                        "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                        params![bank_delta],
                    )
                    .ok();
                }
            }
        }
    }

    DatabaseManager::log_audit(
        &tx,
        "CREATE",
        "GST_INVOICE",
        &invoice_id,
        &format!(
            "Generated GST Tax Invoice {} for {} (₹{:.2})",
            invoice_number, payload.party_name, payload.total_amount
        ),
    )
    .ok();

    tx.commit().map_err(|e| e.to_string())?;

    let gst_info = GstInvoiceRecord {
        invoice_id: invoice_id.clone(),
        place_of_supply: payload.place_of_supply,
        pos_state_code: payload.pos_state_code,
        pos_state_name: payload.pos_state_name,
        supplier_gstin,
        customer_gstin: payload.customer_gstin,
        is_interstate: payload.is_interstate,
        is_reverse_charge: payload.is_reverse_charge,
        cgst_amount: payload.cgst_amount,
        sgst_amount: payload.sgst_amount,
        igst_amount: payload.igst_amount,
        cess_amount: payload.cess_amount,
        round_off: payload.round_off,
        eway_bill_no: payload.eway_bill_no,
        vehicle_no: payload.vehicle_no,
        transporter_name: payload.transporter_name,
        bill_reference_type: payload.bill_reference_type,
    };

    let core_invoice = Invoice {
        id: invoice_id,
        invoice_number,
        invoice_type: payload.invoice_type,
        party_id: valid_party_id,
        party_name: payload.party_name,
        invoice_date: payload.invoice_date,
        due_date: payload.due_date,
        subtotal: payload.subtotal,
        discount_amount: payload.discount_amount,
        tax_amount: payload.total_tax,
        total_amount: payload.total_amount,
        paid_amount: payload.paid_amount,
        status: status.to_string(),
        payment_method: payload.payment_method,
        notes: payload.notes,
        created_at: now,
        reference: payload.reference,
    };

    Ok(CompleteGstInvoice {
        invoice: core_invoice,
        items: created_core_items,
        gst_info,
        gst_items: created_gst_items,
    })
}

pub fn get_gst_invoice_internal(conn: &Connection, invoice_id: &str) -> Result<CompleteGstInvoice, String> {
    let core_invoice = conn.query_row(
        "SELECT id, invoice_number, invoice_type, party_id, party_name,
                invoice_date, due_date, subtotal, discount_amount,
                tax_amount, total_amount, paid_amount, status,
                payment_method, notes, created_at, reference
         FROM invoices WHERE id = ?1",
        params![invoice_id],
        |row| {
            Ok(Invoice {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                invoice_type: row.get(2)?,
                party_id: row.get(3)?,
                party_name: row.get(4)?,
                invoice_date: row.get(5)?,
                due_date: row.get(6)?,
                subtotal: row.get(7)?,
                discount_amount: row.get(8)?,
                tax_amount: row.get(9)?,
                total_amount: row.get(10)?,
                paid_amount: row.get(11)?,
                status: row.get(12)?,
                payment_method: row.get(13)?,
                notes: row.get(14)?,
                created_at: row.get(15)?,
                reference: row.get(16)?,
            })
        },
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, invoice_id, item_id, item_name, quantity, unit,
                    unit_price, discount_percent, tax_rate, line_total
             FROM invoice_items WHERE invoice_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let core_items = stmt
        .query_map(params![invoice_id], |row| {
            Ok(InvoiceItem {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                item_id: row.get(2)?,
                item_name: row.get(3)?,
                quantity: row.get(4)?,
                unit: row.get(5)?,
                unit_price: row.get(6)?,
                discount_percent: row.get(7)?,
                tax_rate: row.get(8)?,
                line_total: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    let gst_info = conn.query_row(
        "SELECT invoice_id, place_of_supply, pos_state_code, pos_state_name,
                supplier_gstin, customer_gstin, is_interstate, is_reverse_charge,
                cgst_amount, sgst_amount, igst_amount, cess_amount, round_off,
                eway_bill_no, vehicle_no, transporter_name, bill_reference_type
         FROM gst_invoices WHERE invoice_id = ?1",
        params![invoice_id],
        |row| {
            Ok(GstInvoiceRecord {
                invoice_id: row.get(0)?,
                place_of_supply: row.get(1)?,
                pos_state_code: row.get(2)?,
                pos_state_name: row.get(3)?,
                supplier_gstin: row.get(4)?,
                customer_gstin: row.get(5)?,
                is_interstate: row.get::<_, i32>(6)? == 1,
                is_reverse_charge: row.get::<_, i32>(7)? == 1,
                cgst_amount: row.get(8)?,
                sgst_amount: row.get(9)?,
                igst_amount: row.get(10)?,
                cess_amount: row.get(11)?,
                round_off: row.get(12)?,
                eway_bill_no: row.get(13)?,
                vehicle_no: row.get(14)?,
                transporter_name: row.get(15)?,
                bill_reference_type: row.get(16)?,
            })
        },
    ).unwrap_or_else(|_| {
        let (supp_gstin, supp_sc, supp_sn) = conn
            .query_row(
                "SELECT gstin, state_code, state_name FROM gst_settings WHERE id = 1",
                [],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)),
            )
            .unwrap_or(("27AABCU9603R1ZN".into(), "27".into(), "Maharashtra".into()));

        let (cust_gstin, mut pos_sc, pos_sn) = if let Some(ref pid) = core_invoice.party_id {
            conn.query_row(
                "SELECT COALESCE(NULLIF(TRIM(gp.gstin), ''), TRIM(p.tax_number), ''),
                        COALESCE(NULLIF(TRIM(gp.state_code), ''), ''),
                        COALESCE(NULLIF(TRIM(gp.state_name), ''), '')
                 FROM parties p
                 LEFT JOIN gst_parties gp ON p.id = gp.party_id
                 WHERE p.id = ?1",
                params![pid],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)),
            )
            .unwrap_or(("".into(), "".into(), "".into()))
        } else {
            ("".into(), "".into(), "".into())
        };

        if pos_sc.trim().is_empty() && cust_gstin.trim().len() >= 2 && cust_gstin.trim()[..2].chars().all(|c| c.is_ascii_digit()) {
            pos_sc = cust_gstin.trim()[..2].to_string();
        }
        if pos_sc.trim().is_empty() {
            pos_sc = supp_sc.clone();
        }
        let pos_sn = if pos_sn.trim().is_empty() { supp_sn.clone() } else { pos_sn };

        let is_interstate = !pos_sc.trim().is_empty() && !supp_sc.trim().is_empty() && pos_sc.trim() != supp_sc.trim();
        let (cgst_amount, sgst_amount, igst_amount) = if is_interstate {
            (0.0, 0.0, core_invoice.tax_amount)
        } else {
            (core_invoice.tax_amount / 2.0, core_invoice.tax_amount / 2.0, 0.0)
        };

        GstInvoiceRecord {
            invoice_id: invoice_id.to_string(),
            place_of_supply: format!("{}-{}", pos_sc, pos_sn),
            pos_state_code: pos_sc,
            pos_state_name: pos_sn,
            supplier_gstin: supp_gstin,
            customer_gstin: cust_gstin,
            is_interstate,
            is_reverse_charge: false,
            cgst_amount,
            sgst_amount,
            igst_amount,
            cess_amount: 0.0,
            round_off: 0.0,
            eway_bill_no: None,
            vehicle_no: None,
            transporter_name: None,
            bill_reference_type: "New Ref".into(),
        }
    });

    let mut gst_item_stmt = conn
        .prepare(
            "SELECT id, invoice_id, item_id, hsn_code, quantity, unit, rate,
                    discount_amount, taxable_amount, tax_rate,
                    cgst_rate, cgst_amount, sgst_rate, sgst_amount,
                    igst_rate, igst_amount, cess_rate, cess_amount, line_total
             FROM gst_invoice_items WHERE invoice_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut gst_items: Vec<GstInvoiceItemRecord> = gst_item_stmt
        .query_map(params![invoice_id], |row| {
            Ok(GstInvoiceItemRecord {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                item_id: row.get(2)?,
                hsn_code: row.get(3)?,
                quantity: row.get(4)?,
                unit: row.get(5)?,
                rate: row.get(6)?,
                discount_amount: row.get(7)?,
                taxable_amount: row.get(8)?,
                tax_rate: row.get(9)?,
                cgst_rate: row.get(10)?,
                cgst_amount: row.get(11)?,
                sgst_rate: row.get(12)?,
                sgst_amount: row.get(13)?,
                igst_rate: row.get(14)?,
                igst_amount: row.get(15)?,
                cess_rate: row.get(16)?,
                cess_amount: row.get(17)?,
                line_total: row.get(18)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    // If invoice was created via standard POS, synthesize GST items from core items so bill rendering is 100% complete
    if gst_items.is_empty() && !core_items.is_empty() {
        let is_inter = gst_info.is_interstate;
        let tax_mode: String = conn
            .query_row("SELECT COALESCE(tax_mode, 'EXCLUSIVE') FROM settings WHERE id = 1", [], |r| r.get(0))
            .unwrap_or_else(|_| "EXCLUSIVE".into());
        let is_inclusive = tax_mode.eq_ignore_ascii_case("INCLUSIVE");

        for ci in &core_items {
            let hsn = if let Some(ref it_id) = ci.item_id {
                conn.query_row(
                    "SELECT hsn_code FROM gst_items WHERE item_id = ?1",
                    params![it_id],
                    |r| r.get(0),
                )
                .unwrap_or_else(|_| "8471".to_string())
            } else {
                "8471".to_string()
            };

            let tax_rate = ci.tax_rate;
            let gross = ci.unit_price * ci.quantity;
            let discount_amount = ((gross * (ci.discount_percent / 100.0)) * 100.0).round() / 100.0;
            let (taxable_amount, total_tax, line_total) = if is_inclusive {
                let taxable = if tax_rate > 0.0 {
                    ci.line_total / (1.0 + tax_rate / 100.0)
                } else {
                    ci.line_total
                };
                let tax = (ci.line_total - taxable).max(0.0);
                (taxable, tax, ci.line_total)
            } else {
                let taxable = ci.line_total;
                let tax = (taxable * (tax_rate / 100.0)).max(0.0);
                (taxable, tax, taxable + tax)
            };

            let (cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount) = if is_inter {
                (0.0, 0.0, 0.0, 0.0, tax_rate, total_tax)
            } else {
                (tax_rate / 2.0, total_tax / 2.0, tax_rate / 2.0, total_tax / 2.0, 0.0, 0.0)
            };

            gst_items.push(GstInvoiceItemRecord {
                id: ci.id.clone(),
                invoice_id: invoice_id.to_string(),
                item_id: ci.item_id.clone(),
                hsn_code: hsn,
                quantity: ci.quantity,
                unit: ci.unit.clone(),
                rate: ci.unit_price,
                discount_amount,
                taxable_amount,
                tax_rate,
                cgst_rate,
                cgst_amount,
                sgst_rate,
                sgst_amount,
                igst_rate,
                igst_amount,
                cess_rate: 0.0,
                cess_amount: 0.0,
                line_total,
            });
        }
    }

    Ok(CompleteGstInvoice {
        invoice: core_invoice,
        items: core_items,
        gst_info,
        gst_items,
    })
}

pub fn list_gst_invoices_internal(
    conn: &Connection,
    invoice_type: Option<String>,
    status: Option<String>,
    search: Option<String>,
) -> Result<Vec<CompleteGstInvoice>, String> {
    let mut query = "SELECT id FROM invoices WHERE 1=1".to_string();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(t) = invoice_type {
        if !t.is_empty() && t != "ALL" {
            query.push_str(" AND invoice_type = ?");
            params_vec.push(Box::new(t));
        }
    }

    if let Some(st) = status {
        if !st.is_empty() && st != "ALL" {
            query.push_str(" AND status = ?");
            params_vec.push(Box::new(st));
        }
    }

    if let Some(s) = search {
        if !s.trim().is_empty() {
            query.push_str(" AND (invoice_number LIKE ? OR party_name LIKE ?)");
            let pattern = format!("%{}%", s.trim());
            params_vec.push(Box::new(pattern.clone()));
            params_vec.push(Box::new(pattern));
        }
    }

    query.push_str(" ORDER BY invoice_date DESC, created_at DESC LIMIT 10000");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let slice: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let invoice_ids: Vec<String> = stmt
        .query_map(slice.as_slice(), |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    drop(stmt);

    let mut results = Vec::new();
    for id in invoice_ids {
        if let Ok(item) = get_gst_invoice_internal(conn, &id) {
            results.push(item);
        }
    }

    Ok(results)
}

pub fn get_sundry_debtors_aging_internal(conn: &Connection) -> Result<Vec<PartyCreditAging>, String> {
    let today = Local::now().date_naive();

    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, p.phone, p.email, p.current_balance,
                    COALESCE(g.gstin, p.tax_number, ''),
                    COALESCE(g.state_name, 'Maharashtra'),
                    COALESCE(g.credit_limit, 0.0),
                    COALESCE(g.credit_period_days, 30),
                    COALESCE(g.tally_ledger_group, 'Sundry Debtors')
             FROM parties p
             LEFT JOIN gst_parties g ON p.id = g.party_id
             WHERE p.party_type = 'CUSTOMER'
             ORDER BY p.current_balance DESC, p.name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, f64>(4)?,
                r.get::<_, String>(5)?,
                r.get::<_, String>(6)?,
                r.get::<_, f64>(7)?,
                r.get::<_, i32>(8)?,
                r.get::<_, String>(9)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();

    for row in rows.filter_map(Result::ok) {
        let (party_id, party_name, phone, email, current_balance, gstin, state_name, credit_limit, credit_period_days, tally_ledger_group) = row;

        let mut inv_stmt = conn
            .prepare(
                "SELECT invoice_date, due_date, total_amount, paid_amount
                 FROM invoices
                 WHERE party_id = ?1 AND invoice_type = 'SALE' AND status NOT IN ('PAID', 'RETURNED', 'CANCELLED')
                 ORDER BY invoice_date ASC",
            )
            .map_err(|e| e.to_string())?;

        let unpaid = inv_stmt
            .query_map(params![party_id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, f64>(2)?,
                    r.get::<_, f64>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut current_30 = 0.0;
        let mut days_60 = 0.0;
        let mut days_90 = 0.0;
        let mut over_90 = 0.0;
        let mut overdue_count = 0;
        let mut pending_bills_count = 0;

        for inv in unpaid.filter_map(Result::ok) {
            let (date_str, due_date_str, total, paid) = inv;
            let due_val = total - paid;
            if due_val <= 0.001 {
                continue;
            }

            pending_bills_count += 1;
            let inv_parsed = parse_flexible_date(&date_str);
            let days_old = if let Some(parsed) = inv_parsed {
                (today - parsed).num_days()
            } else {
                0
            };

            let due_parsed = parse_flexible_date(&due_date_str)
                .or_else(|| inv_parsed.map(|d| d + chrono::Duration::days(credit_period_days.max(0) as i64)))
                .unwrap_or(today);
            if (today - due_parsed).num_days() > 0 {
                overdue_count += 1;
            }

            if days_old <= 30 {
                current_30 += due_val;
            } else if days_old <= 60 {
                days_60 += due_val;
            } else if days_old <= 90 {
                days_90 += due_val;
            } else {
                over_90 += due_val;
            }
        }

        let billed_due = current_30 + days_60 + days_90 + over_90;
        if current_balance > billed_due + 0.01 {
            current_30 += current_balance - billed_due;
        }

        let is_over_limit = credit_limit > 0.0 && current_balance > credit_limit;

        list.push(PartyCreditAging {
            party_id,
            party_name,
            party_type: "CUSTOMER".into(),
            tally_ledger_group,
            phone,
            email,
            gstin,
            state_name,
            total_outstanding: current_balance,
            credit_limit,
            credit_period_days,
            is_over_limit,
            current_30,
            days_60,
            days_90,
            over_90,
            overdue_count,
            pending_bills_count,
        });
    }

    Ok(list)
}

pub fn get_sundry_creditors_aging_internal(conn: &Connection) -> Result<Vec<PartyCreditAging>, String> {
    let today = Local::now().date_naive();

    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, p.phone, p.email, p.current_balance,
                    COALESCE(g.gstin, p.tax_number, ''),
                    COALESCE(g.state_name, 'Maharashtra'),
                    COALESCE(g.credit_limit, 0.0),
                    COALESCE(g.credit_period_days, 30),
                    COALESCE(g.tally_ledger_group, 'Sundry Creditors')
             FROM parties p
             LEFT JOIN gst_parties g ON p.id = g.party_id
             WHERE p.party_type = 'VENDOR'
             ORDER BY p.current_balance ASC, p.name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, f64>(4)?,
                r.get::<_, String>(5)?,
                r.get::<_, String>(6)?,
                r.get::<_, f64>(7)?,
                r.get::<_, i32>(8)?,
                r.get::<_, String>(9)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();

    for row in rows.filter_map(Result::ok) {
        let (party_id, party_name, phone, email, current_balance, gstin, state_name, credit_limit, credit_period_days, tally_ledger_group) = row;

        // Vendor payables are negative; positive current_balance is a supplier advance, not payable debt
        let total_payable = if current_balance < 0.0 { current_balance.abs() } else { 0.0 };

        let mut inv_stmt = conn
            .prepare(
                "SELECT invoice_date, due_date, total_amount, paid_amount
                 FROM invoices
                 WHERE party_id = ?1 AND invoice_type = 'PURCHASE' AND status NOT IN ('PAID', 'RETURNED', 'CANCELLED')
                 ORDER BY invoice_date ASC",
            )
            .map_err(|e| e.to_string())?;

        let unpaid = inv_stmt
            .query_map(params![party_id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, f64>(2)?,
                    r.get::<_, f64>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut current_30 = 0.0;
        let mut days_60 = 0.0;
        let mut days_90 = 0.0;
        let mut over_90 = 0.0;
        let mut overdue_count = 0;
        let mut pending_bills_count = 0;

        for inv in unpaid.filter_map(Result::ok) {
            let (date_str, due_date_str, total, paid) = inv;
            let due_val = total - paid;
            if due_val <= 0.001 {
                continue;
            }

            pending_bills_count += 1;
            let inv_parsed = parse_flexible_date(&date_str);
            let days_old = if let Some(parsed) = inv_parsed {
                (today - parsed).num_days()
            } else {
                0
            };

            let due_parsed = parse_flexible_date(&due_date_str)
                .or_else(|| inv_parsed.map(|d| d + chrono::Duration::days(credit_period_days.max(0) as i64)))
                .unwrap_or(today);
            if (today - due_parsed).num_days() > 0 {
                overdue_count += 1;
            }

            if days_old <= 30 {
                current_30 += due_val;
            } else if days_old <= 60 {
                days_60 += due_val;
            } else if days_old <= 90 {
                days_90 += due_val;
            } else {
                over_90 += due_val;
            }
        }

        let billed_due = current_30 + days_60 + days_90 + over_90;
        if total_payable > billed_due + 0.01 {
            current_30 += total_payable - billed_due;
        }

        list.push(PartyCreditAging {
            party_id,
            party_name,
            party_type: "VENDOR".into(),
            tally_ledger_group,
            phone,
            email,
            gstin,
            state_name,
            total_outstanding: total_payable,
            credit_limit,
            credit_period_days,
            is_over_limit: false,
            current_30,
            days_60,
            days_90,
            over_90,
            overdue_count,
            pending_bills_count,
        });
    }

    Ok(list)
}

pub fn get_party_pending_bills_internal(conn: &Connection, party_id: &str) -> Result<Vec<PendingBill>, String> {
    let today = Local::now().date_naive();

    let party_type: String = conn
        .query_row(
            "SELECT party_type FROM parties WHERE id = ?1",
            params![party_id],
            |r| r.get(0),
        )
        .unwrap_or_default();

    let expected_inv_type: Option<&str> = match party_type.as_str() {
        "VENDOR" => Some("PURCHASE"),
        "CUSTOMER" => Some("SALE"),
        _ => None,
    };

    let sql = if expected_inv_type.is_some() {
        "SELECT i.id, i.invoice_number, i.invoice_type, i.party_id, i.party_name,
                i.invoice_date, i.due_date, i.total_amount, i.paid_amount, i.status,
                COALESCE(g.bill_reference_type, 'New Ref')
         FROM invoices i
         LEFT JOIN gst_invoices g ON i.id = g.invoice_id
         WHERE i.party_id = ?1
           AND i.invoice_type = ?2
           AND i.status NOT IN ('PAID', 'RETURNED', 'CANCELLED')
           AND (i.total_amount - i.paid_amount) > 0.01
         ORDER BY i.invoice_date ASC, i.created_at ASC"
    } else {
        "SELECT i.id, i.invoice_number, i.invoice_type, i.party_id, i.party_name,
                i.invoice_date, i.due_date, i.total_amount, i.paid_amount, i.status,
                COALESCE(g.bill_reference_type, 'New Ref')
         FROM invoices i
         LEFT JOIN gst_invoices g ON i.id = g.invoice_id
         WHERE i.party_id = ?1
           AND i.status NOT IN ('PAID', 'RETURNED', 'CANCELLED')
           AND (i.total_amount - i.paid_amount) > 0.01
         ORDER BY i.invoice_date ASC, i.created_at ASC"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let map_row = |r: &rusqlite::Row<'_>| -> rusqlite::Result<PendingBill> {
        let inv_id: String = r.get(0)?;
        let inv_num: String = r.get(1)?;
        let inv_type: String = r.get(2)?;
        let p_id: String = r.get(3)?;
        let p_name: String = r.get(4)?;
        let inv_date: String = r.get(5)?;
        let due_date: String = r.get(6)?;
        let total: f64 = r.get(7)?;
        let paid: f64 = r.get(8)?;
        let status: String = r.get(9)?;
        let bill_ref: String = r.get(10)?;

        let balance_due = total - paid;
        let due_parsed = parse_flexible_date(&due_date)
            .or_else(|| parse_flexible_date(&inv_date))
            .unwrap_or(today);

        let overdue_days = (today - due_parsed).num_days();

        Ok(PendingBill {
            invoice_id: inv_id,
            invoice_number: inv_num,
            invoice_type: inv_type,
            party_id: p_id,
            party_name: p_name,
            invoice_date: inv_date,
            due_date,
            total_amount: total,
            paid_amount: paid,
            balance_due,
            overdue_days,
            status,
            bill_ref,
        })
    };

    let bills: Vec<PendingBill> = if let Some(inv_t) = expected_inv_type {
        stmt.query_map(params![party_id, inv_t], map_row)
            .map_err(|e| e.to_string())?
            .filter_map(Result::ok)
            .collect()
    } else {
        stmt.query_map(params![party_id], map_row)
            .map_err(|e| e.to_string())?
            .filter_map(Result::ok)
            .collect()
    };

    Ok(bills)
}

pub fn settle_bill_by_bill_internal(
    conn: &mut Connection,
    payload: BillSettlementPayload,
) -> Result<bool, String> {
    if payload.total_amount <= 0.0 || !payload.total_amount.is_finite() {
        return Err("Settlement total amount must be strictly greater than 0".into());
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Verify party exists
    let party_exists: bool = tx
        .query_row(
            "SELECT 1 FROM parties WHERE id = ?1",
            params![payload.party_id],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if !party_exists {
        return Err(format!("Party with ID {} does not exist", payload.party_id));
    }

    // Verify allocations sum does not exceed total settlement amount
    let alloc_sum: f64 = payload
        .allocations
        .iter()
        .filter(|a| a.amount > 0.0)
        .map(|a| a.amount)
        .sum();
    if alloc_sum > payload.total_amount + 0.01 {
        return Err(format!(
            "Total allocated amount (₹{:.2}) cannot exceed settlement payment amount (₹{:.2})",
            alloc_sum, payload.total_amount
        ));
    }

    let bank_id_clean = payload
        .bank_account_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());

    let payment_id = Uuid::new_v4().to_string();

    tx.execute(
        "INSERT INTO payments (
            id, invoice_id, party_id, party_name, amount, payment_type,
            payment_method, payment_date, reference, notes, bank_account_id
        ) VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            payment_id,
            payload.party_id,
            payload.party_name,
            payload.total_amount,
            payload.payment_type,
            payload.payment_method,
            payload.payment_date,
            payload.reference,
            payload.notes,
            bank_id_clean.unwrap_or(""),
        ],
    )
    .map_err(|e| e.to_string())?;

    let mut total_settled_across_bills = 0.0;
    let mut touched_invoices: Vec<String> = Vec::new();

    for alloc in &payload.allocations {
        if alloc.amount <= 0.0 {
            continue;
        }

        // Verify invoice exists and belongs to the party
        let (inv_party_id, total, current_paid): (Option<String>, f64, f64) = tx
            .query_row(
                "SELECT party_id, total_amount, paid_amount FROM invoices WHERE id = ?1",
                params![alloc.invoice_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .map_err(|_| format!("Invoice {} not found", alloc.invoice_id))?;

        if inv_party_id.as_deref() != Some(&payload.party_id) {
            return Err(format!(
                "Invoice {} does not belong to party {}",
                alloc.invoice_id, payload.party_id
            ));
        }

        // Cap allocation at remaining balance due to prevent overpayment of an individual invoice
        let remaining_due = (total - current_paid).max(0.0);
        let effective_settled = alloc.amount.min(remaining_due);
        if effective_settled <= 0.005 {
            continue;
        }

        tx.execute(
            "INSERT INTO bill_settlements (
                id, payment_id, invoice_id, party_id, settled_amount, settlement_date, notes
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                Uuid::new_v4().to_string(),
                payment_id,
                alloc.invoice_id,
                payload.party_id,
                effective_settled,
                payload.payment_date,
                format!("Settled against {}", payload.reference),
            ],
        )
        .map_err(|e| e.to_string())?;

        let new_paid = ((current_paid + effective_settled).min(total) * 100.0).round() / 100.0;
        let new_status = if new_paid >= total - 0.01 {
            "PAID"
        } else if new_paid > 0.01 {
            "PARTIAL"
        } else {
            "UNPAID"
        };

        tx.execute(
            "UPDATE invoices SET paid_amount = ?1, status = ?2 WHERE id = ?3",
            params![new_paid, new_status, alloc.invoice_id],
        )
        .map_err(|e| e.to_string())?;

        total_settled_across_bills += effective_settled;
        touched_invoices.push(alloc.invoice_id.clone());
    }

    // Reconcile any unallocated/excess payment (e.g. from capped allocations or lump-sum settlement)
    // across remaining open bills FIFO so invoice statuses stay synced with party balance.
    let mut excess = payload.total_amount - total_settled_across_bills;
    if excess > 0.01 {
        let target_inv_type = if payload.payment_type == "OUT" { "PURCHASE" } else { "SALE" };
        let open_bills: Vec<(String, f64, f64)> = {
            let mut stmt = tx
                .prepare(
                    "SELECT id, total_amount, paid_amount FROM invoices
                     WHERE party_id = ?1
                       AND invoice_type = ?2
                       AND status NOT IN ('PAID', 'RETURNED', 'CANCELLED')
                       AND (total_amount - paid_amount) > 0.01
                     ORDER BY invoice_date ASC, created_at ASC",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![payload.party_id, target_inv_type], |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?, r.get::<_, f64>(2)?))
                })
                .map_err(|e| e.to_string())?
                .filter_map(Result::ok)
                .collect();
            rows
        };

        for (bill_id, total, current_paid) in open_bills {
            if excess <= 0.01 {
                break;
            }
            if touched_invoices.contains(&bill_id) {
                continue;
            }
            let due = (total - current_paid).max(0.0);
            if due <= 0.01 {
                continue;
            }
            let alloc_amt = excess.min(due);
            tx.execute(
                "INSERT INTO bill_settlements (
                    id, payment_id, invoice_id, party_id, settled_amount, settlement_date, notes
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    Uuid::new_v4().to_string(),
                    payment_id,
                    bill_id,
                    payload.party_id,
                    alloc_amt,
                    payload.payment_date,
                    format!("Auto-allocated from {}", payload.reference),
                ],
            )
            .map_err(|e| e.to_string())?;

            let new_paid = ((current_paid + alloc_amt).min(total) * 100.0).round() / 100.0;
            let new_status = if new_paid >= total - 0.01 { "PAID" } else { "PARTIAL" };
            tx.execute(
                "UPDATE invoices SET paid_amount = ?1, status = ?2 WHERE id = ?3",
                params![new_paid, new_status, bill_id],
            )
            .map_err(|e| e.to_string())?;

            excess -= alloc_amt;
        }
    }

    // Update bank_accounts balance if payment goes through bank/UPI/card/transfer channels
    let (_, bank_part) = parse_payment_liquidity(&payload.payment_method, payload.total_amount);
    if bank_part > 0.0 {
        let bank_delta = if payload.payment_type == "IN" { bank_part } else { -bank_part };
        if let Some(bid) = bank_id_clean {
            tx.execute(
                "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE id = ?2",
                params![bank_delta, bid],
            )
            .ok();
        } else {
            tx.execute(
                "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                params![bank_delta],
            )
            .ok();
        }
    }

    if payload.payment_type == "IN" {
        tx.execute(
            "UPDATE parties SET current_balance = current_balance - ?1 WHERE id = ?2",
            params![payload.total_amount, payload.party_id],
        )
        .map_err(|e| e.to_string())?;
    } else {
        tx.execute(
            "UPDATE parties SET current_balance = current_balance + ?1 WHERE id = ?2",
            params![payload.total_amount, payload.party_id],
        )
        .map_err(|e| e.to_string())?;
    }

    DatabaseManager::log_audit(
        &tx,
        "SETTLE_BILLS",
        "PARTY",
        &payload.party_id,
        &format!(
            "Settled bills for {} with amount ₹{:.2} ({})",
            payload.party_name, payload.total_amount, payload.payment_type
        ),
    )
    .ok();

    tx.commit().map_err(|e| e.to_string())?;
    Ok(true)
}

pub fn get_gstr1_report_internal(
    conn: &Connection,
    start_date: &str,
    end_date: &str,
) -> Result<Gstr1ReportData, String> {
    let (my_gstin, legal_name, state_code, state_name): (String, String, String, String) = conn
        .query_row(
            "SELECT gstin, legal_name, state_code, state_name FROM gst_settings WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .unwrap_or_else(|_| {
            (
                "27AABCU9603R1ZN".into(),
                "LynTerminal India".into(),
                "27".into(),
                "Maharashtra".into(),
            )
        });

    let default_pos = format!("{}-{}", state_code.trim(), state_name.trim());
    let tax_mode: String = conn
        .query_row("SELECT COALESCE(tax_mode, 'EXCLUSIVE') FROM settings WHERE id = 1", [], |r| r.get(0))
        .unwrap_or_else(|_| "EXCLUSIVE".into());
    let is_tax_inclusive = tax_mode.eq_ignore_ascii_case("INCLUSIVE");

    let fp = if let Ok(parsed) = NaiveDate::parse_from_str(start_date, "%Y-%m-%d") {
        parsed.format("%m%Y").to_string()
    } else {
        "042026".to_string()
    };

    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.invoice_number, i.invoice_type, i.invoice_date, i.total_amount,
                    i.subtotal, i.discount_amount, i.party_name,
                    COALESCE(g.customer_gstin, ''),
                    COALESCE(NULLIF(g.place_of_supply, ''), ?3),
                    COALESCE(g.is_interstate, 0),
                    COALESCE(g.is_reverse_charge, 0),
                    COALESCE(g.cgst_amount, CASE WHEN g.invoice_id IS NOT NULL THEN g.cgst_amount ELSE i.tax_amount / 2.0 END),
                    COALESCE(g.sgst_amount, CASE WHEN g.invoice_id IS NOT NULL THEN g.sgst_amount ELSE i.tax_amount / 2.0 END),
                    COALESCE(g.igst_amount, 0.0),
                    COALESCE(g.cess_amount, 0.0)
             FROM invoices i
             LEFT JOIN gst_invoices g ON i.id = g.invoice_id
             WHERE i.invoice_type IN ('SALE', 'RETURN')
               AND i.status NOT IN ('RETURNED', 'CANCELLED')
               AND i.invoice_date BETWEEN ?1 AND ?2
             ORDER BY i.invoice_date ASC, i.invoice_number ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![start_date, end_date, default_pos], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, f64>(4)?,
                r.get::<_, f64>(5)?,
                r.get::<_, f64>(6)?,
                r.get::<_, String>(7)?,
                r.get::<_, String>(8)?,
                r.get::<_, String>(9)?,
                r.get::<_, i32>(10)? == 1,
                r.get::<_, i32>(11)? == 1,
                r.get::<_, f64>(12)?,
                r.get::<_, f64>(13)?,
                r.get::<_, f64>(14)?,
                r.get::<_, f64>(15)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut b2b = Vec::new();
    let mut b2cl = Vec::new();
    let mut b2cs_map: std::collections::HashMap<(String, i64), (f64, f64, f64, f64, f64)> =
        std::collections::HashMap::new();

    let mut total_turnover = 0.0;
    let mut total_taxable = 0.0;
    let mut total_igst = 0.0;
    let mut total_cgst = 0.0;
    let mut total_sgst = 0.0;
    let mut total_cess = 0.0;

    let mut min_inv = String::new();
    let mut max_inv = String::new();

    let mut gst_item_stmt = conn
        .prepare(
            "SELECT tax_rate, taxable_amount, igst_amount, cgst_amount, sgst_amount, cess_amount
             FROM gst_invoice_items WHERE invoice_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut core_item_stmt = conn
        .prepare("SELECT tax_rate, line_total FROM invoice_items WHERE invoice_id = ?1")
        .map_err(|e| e.to_string())?;

    for row in rows.filter_map(Result::ok) {
        let (
            inv_id,
            inv_number,
            inv_type,
            inv_date,
            total_amt,
            subtotal,
            discount,
            party_name,
            cust_gstin,
            place_of_supply,
            is_interstate,
            is_reverse_charge,
            cgst,
            sgst,
            igst,
            cess,
        ) = row;

        let sign = if inv_type == "RETURN" { -1.0 } else { 1.0 };

        if inv_type == "SALE" {
            if min_inv.is_empty() {
                min_inv = inv_number.clone();
            }
            max_inv = inv_number.clone();
        }

        let taxable = (subtotal - discount).max(0.0);
        total_turnover += sign * total_amt;
        total_taxable += sign * taxable;
        total_igst += sign * igst;
        total_cgst += sign * cgst;
        total_sgst += sign * sgst;
        total_cess += sign * cess;

        let has_valid_gstin = cust_gstin.trim().len() == 15;

        if has_valid_gstin {
            b2b.push(Gstr1B2bInvoice {
                customer_gstin: cust_gstin.trim().to_string(),
                customer_name: party_name,
                invoice_number: inv_number,
                invoice_date: inv_date,
                invoice_value: sign * total_amt,
                place_of_supply,
                reverse_charge: if is_reverse_charge { "Y".into() } else { "N".into() },
                invoice_type: if inv_type == "RETURN" { "Credit Note".into() } else { "Regular".into() },
                taxable_value: sign * taxable,
                igst_amount: sign * igst,
                cgst_amount: sign * cgst,
                sgst_amount: sign * sgst,
                cess_amount: sign * cess,
            });
        } else if is_interstate && total_amt > 250000.0 {
            b2cl.push(Gstr1B2bInvoice {
                customer_gstin: "".into(),
                customer_name: party_name,
                invoice_number: inv_number,
                invoice_date: inv_date,
                invoice_value: sign * total_amt,
                place_of_supply,
                reverse_charge: "N".into(),
                invoice_type: if inv_type == "RETURN" { "Credit Note".into() } else { "Regular".into() },
                taxable_value: sign * taxable,
                igst_amount: sign * igst,
                cgst_amount: sign * cgst,
                sgst_amount: sign * sgst,
                cess_amount: sign * cess,
            });
        } else {
            // Aggregate B2CS at item/rate-slab level to avoid blended invalid rates and preserve fractional slabs
            let gst_items: Vec<(f64, f64, f64, f64, f64, f64)> = gst_item_stmt
                .query_map(params![inv_id], |r| {
                    Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?))
                })
                .map_err(|e| e.to_string())?
                .filter_map(Result::ok)
                .collect();

            if !gst_items.is_empty() {
                for (item_rate, item_taxable, item_igst, item_cgst, item_sgst, item_cess) in gst_items {
                    let rate_bps = (item_rate.max(0.0) * 100.0).round() as i64;
                    let entry = b2cs_map
                        .entry((place_of_supply.clone(), rate_bps))
                        .or_insert((0.0, 0.0, 0.0, 0.0, 0.0));
                    entry.0 += sign * item_taxable;
                    entry.1 += sign * item_igst;
                    entry.2 += sign * item_cgst;
                    entry.3 += sign * item_sgst;
                    entry.4 += sign * item_cess;
                }
            } else {
                let core_items: Vec<(f64, f64)> = core_item_stmt
                    .query_map(params![inv_id], |r| Ok((r.get(0)?, r.get(1)?)))
                    .map_err(|e| e.to_string())?
                    .filter_map(Result::ok)
                    .collect();

                if !core_items.is_empty() {
                    let disc_factor = if subtotal > 0.0 { taxable / subtotal } else { 1.0 };
                    for (item_rate, line_tot) in core_items {
                        let rate = item_rate.max(0.0);
                        let rate_bps = (rate * 100.0).round() as i64;
                        let (item_taxable, item_tax) = if is_tax_inclusive {
                            let gross = line_tot * disc_factor;
                            let tax_excl = if rate > 0.0 { gross / (1.0 + rate / 100.0) } else { gross };
                            (tax_excl, gross - tax_excl)
                        } else {
                            let tax_excl = line_tot * disc_factor;
                            (tax_excl, tax_excl * (rate / 100.0))
                        };
                        let (i_igst, i_cgst, i_sgst) = if is_interstate {
                            (item_tax, 0.0, 0.0)
                        } else {
                            (0.0, item_tax / 2.0, item_tax / 2.0)
                        };
                        let entry = b2cs_map
                            .entry((place_of_supply.clone(), rate_bps))
                            .or_insert((0.0, 0.0, 0.0, 0.0, 0.0));
                        entry.0 += sign * item_taxable;
                        entry.1 += sign * i_igst;
                        entry.2 += sign * i_cgst;
                        entry.3 += sign * i_sgst;
                    }
                } else {
                    let tax_rate = if taxable > 0.0 {
                        ((igst + cgst + sgst) / taxable) * 100.0
                    } else {
                        0.0
                    };
                    let rate_bps = (tax_rate.max(0.0) * 100.0).round() as i64;
                    let entry = b2cs_map
                        .entry((place_of_supply, rate_bps))
                        .or_insert((0.0, 0.0, 0.0, 0.0, 0.0));
                    entry.0 += sign * taxable;
                    entry.1 += sign * igst;
                    entry.2 += sign * cgst;
                    entry.3 += sign * sgst;
                    entry.4 += sign * cess;
                }
            }
        }
    }

    let mut b2cs: Vec<Gstr1B2csSummary> = b2cs_map
        .into_iter()
        .map(|((pos, rate_bps), (taxable, igst, cgst, sgst, cess))| Gstr1B2csSummary {
            place_of_supply: pos,
            tax_rate: (rate_bps as f64) / 100.0,
            taxable_value: taxable,
            igst_amount: igst,
            cgst_amount: cgst,
            sgst_amount: sgst,
            cess_amount: cess,
        })
        .collect();
    b2cs.sort_by(|a, b| {
        a.place_of_supply
            .cmp(&b.place_of_supply)
            .then_with(|| a.tax_rate.partial_cmp(&b.tax_rate).unwrap_or(std::cmp::Ordering::Equal))
    });

    let mut hsn_stmt = conn
        .prepare(
            "SELECT hsn_code, MAX(description), unit, tax_rate,
                    SUM(total_qty) as total_qty,
                    SUM(total_val) as total_val,
                    SUM(taxable_val) as taxable_val,
                    SUM(igst_amt) as igst_amt,
                    SUM(cgst_amt) as cgst_amt,
                    SUM(sgst_amt) as sgst_amt,
                    SUM(cess_amt) as cess_amt
             FROM (
                 SELECT gi.hsn_code as hsn_code,
                        COALESCE(ii.item_name, 'Goods / Services') as description,
                        COALESCE(NULLIF(gi.unit, ''), 'PCS') as unit,
                        gi.tax_rate as tax_rate,
                        (CASE WHEN i.invoice_type = 'RETURN' THEN -1.0 ELSE 1.0 END) * gi.quantity as total_qty,
                        (CASE WHEN i.invoice_type = 'RETURN' THEN -1.0 ELSE 1.0 END) * gi.line_total as total_val,
                        (CASE WHEN i.invoice_type = 'RETURN' THEN -1.0 ELSE 1.0 END) * gi.taxable_amount as taxable_val,
                        (CASE WHEN i.invoice_type = 'RETURN' THEN -1.0 ELSE 1.0 END) * gi.igst_amount as igst_amt,
                        (CASE WHEN i.invoice_type = 'RETURN' THEN -1.0 ELSE 1.0 END) * gi.cgst_amount as cgst_amt,
                        (CASE WHEN i.invoice_type = 'RETURN' THEN -1.0 ELSE 1.0 END) * gi.sgst_amount as sgst_amt,
                        (CASE WHEN i.invoice_type = 'RETURN' THEN -1.0 ELSE 1.0 END) * gi.cess_amount as cess_amt
                 FROM gst_invoice_items gi
                 JOIN invoices i ON gi.invoice_id = i.id
                 LEFT JOIN invoice_items ii ON gi.id = ii.id
                 WHERE i.invoice_type IN ('SALE', 'RETURN')
                   AND i.status NOT IN ('RETURNED', 'CANCELLED')
                   AND i.invoice_date BETWEEN ?1 AND ?2

                 UNION ALL

                 SELECT COALESCE(git.hsn_code, '8471') as hsn_code,
                        ii.item_name as description,
                        COALESCE(NULLIF(ii.unit, ''), 'PCS') as unit,
                        ii.tax_rate as tax_rate,
                        (CASE WHEN i.invoice_type = 'RETURN' THEN -1.0 ELSE 1.0 END) * ii.quantity as total_qty,
                        (CASE WHEN i.invoice_type = 'RETURN' THEN -1.0 ELSE 1.0 END) * (
                            CASE WHEN ?3 = 1 THEN
                                ii.line_total * (CASE WHEN i.subtotal > 0 THEN MAX(0.0, i.subtotal - i.discount_amount) / i.subtotal ELSE 1.0 END)
                            ELSE
                                (ii.line_total * (CASE WHEN i.subtotal > 0 THEN MAX(0.0, i.subtotal - i.discount_amount) / i.subtotal ELSE 1.0 END)) * (1.0 + ii.tax_rate / 100.0)
                            END
                        ) as total_val,
                        (CASE WHEN i.invoice_type = 'RETURN' THEN -1.0 ELSE 1.0 END) * (
                            CASE WHEN ?3 = 1 AND ii.tax_rate > 0 THEN
                                (ii.line_total * (CASE WHEN i.subtotal > 0 THEN MAX(0.0, i.subtotal - i.discount_amount) / i.subtotal ELSE 1.0 END)) / (1.0 + ii.tax_rate / 100.0)
                            ELSE
                                ii.line_total * (CASE WHEN i.subtotal > 0 THEN MAX(0.0, i.subtotal - i.discount_amount) / i.subtotal ELSE 1.0 END)
                            END
                        ) as taxable_val,
                        CASE WHEN COALESCE(g.is_interstate, 0) = 1 THEN
                            (CASE WHEN i.invoice_type = 'RETURN' THEN -1.0 ELSE 1.0 END) * (
                                CASE WHEN ?3 = 1 AND ii.tax_rate > 0 THEN
                                    (ii.line_total * (CASE WHEN i.subtotal > 0 THEN MAX(0.0, i.subtotal - i.discount_amount) / i.subtotal ELSE 1.0 END))
                                    - ((ii.line_total * (CASE WHEN i.subtotal > 0 THEN MAX(0.0, i.subtotal - i.discount_amount) / i.subtotal ELSE 1.0 END)) / (1.0 + ii.tax_rate / 100.0))
                                ELSE
                                    (ii.line_total * (CASE WHEN i.subtotal > 0 THEN MAX(0.0, i.subtotal - i.discount_amount) / i.subtotal ELSE 1.0 END)) * (ii.tax_rate / 100.0)
                                END
                            )
                        ELSE 0.0 END as igst_amt,
                        CASE WHEN COALESCE(g.is_interstate, 0) = 0 THEN
                            (CASE WHEN i.invoice_type = 'RETURN' THEN -1.0 ELSE 1.0 END) * (
                                CASE WHEN ?3 = 1 AND ii.tax_rate > 0 THEN
                                    ((ii.line_total * (CASE WHEN i.subtotal > 0 THEN MAX(0.0, i.subtotal - i.discount_amount) / i.subtotal ELSE 1.0 END))
                                    - ((ii.line_total * (CASE WHEN i.subtotal > 0 THEN MAX(0.0, i.subtotal - i.discount_amount) / i.subtotal ELSE 1.0 END)) / (1.0 + ii.tax_rate / 100.0))) / 2.0
                                ELSE
                                    ((ii.line_total * (CASE WHEN i.subtotal > 0 THEN MAX(0.0, i.subtotal - i.discount_amount) / i.subtotal ELSE 1.0 END)) * (ii.tax_rate / 100.0)) / 2.0
                                END
                            )
                        ELSE 0.0 END as cgst_amt,
                        CASE WHEN COALESCE(g.is_interstate, 0) = 0 THEN
                            (CASE WHEN i.invoice_type = 'RETURN' THEN -1.0 ELSE 1.0 END) * (
                                CASE WHEN ?3 = 1 AND ii.tax_rate > 0 THEN
                                    ((ii.line_total * (CASE WHEN i.subtotal > 0 THEN MAX(0.0, i.subtotal - i.discount_amount) / i.subtotal ELSE 1.0 END))
                                    - ((ii.line_total * (CASE WHEN i.subtotal > 0 THEN MAX(0.0, i.subtotal - i.discount_amount) / i.subtotal ELSE 1.0 END)) / (1.0 + ii.tax_rate / 100.0))) / 2.0
                                ELSE
                                    ((ii.line_total * (CASE WHEN i.subtotal > 0 THEN MAX(0.0, i.subtotal - i.discount_amount) / i.subtotal ELSE 1.0 END)) * (ii.tax_rate / 100.0)) / 2.0
                                END
                            )
                        ELSE 0.0 END as sgst_amt,
                        0.0 as cess_amt
                 FROM invoice_items ii
                 JOIN invoices i ON ii.invoice_id = i.id
                 LEFT JOIN gst_invoices g ON i.id = g.invoice_id
                 LEFT JOIN gst_items git ON ii.item_id = git.item_id
                 WHERE i.invoice_type IN ('SALE', 'RETURN')
                   AND i.status NOT IN ('RETURNED', 'CANCELLED')
                   AND i.invoice_date BETWEEN ?1 AND ?2
                   AND i.id NOT IN (SELECT invoice_id FROM gst_invoice_items)
             )
             GROUP BY hsn_code, unit, tax_rate
             ORDER BY hsn_code ASC, tax_rate ASC",
        )
        .map_err(|e| e.to_string())?;

    let inclusive_flag: i32 = if is_tax_inclusive { 1 } else { 0 };
    let hsn_summary = hsn_stmt
        .query_map(params![start_date, end_date, inclusive_flag], |r| {
            Ok(Gstr1HsnSummary {
                hsn_code: r.get(0)?,
                description: r.get(1)?,
                uqc: r.get(2)?,
                tax_rate: r.get(3)?,
                total_quantity: r.get(4)?,
                total_value: r.get(5)?,
                taxable_value: r.get(6)?,
                igst_amount: r.get(7)?,
                cgst_amount: r.get(8)?,
                sgst_amount: r.get(9)?,
                cess_amount: r.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    let (total_doc_count, cancelled_doc_count, true_min_inv, true_max_inv): (usize, usize, String, String) = conn
        .query_row(
            "SELECT COUNT(*),
                    COALESCE(SUM(CASE WHEN status IN ('CANCELLED', 'RETURNED') THEN 1 ELSE 0 END), 0),
                    COALESCE(MIN(invoice_number), ''),
                    COALESCE(MAX(invoice_number), '')
             FROM invoices
             WHERE invoice_type = 'SALE' AND invoice_date BETWEEN ?1 AND ?2",
            params![start_date, end_date],
            |r| Ok((r.get::<_, i64>(0)? as usize, r.get::<_, i64>(1)? as usize, r.get(2)?, r.get(3)?)),
        )
        .unwrap_or((0, 0, min_inv.clone(), max_inv.clone()));

    let mut doc_summary = vec![Gstr1DocSummary {
        doc_type: "Invoices for Outward Supply".into(),
        from_serial: if true_min_inv.is_empty() { "N/A".into() } else { true_min_inv },
        to_serial: if true_max_inv.is_empty() { "N/A".into() } else { true_max_inv },
        total_count: total_doc_count,
        cancelled_count: cancelled_doc_count,
        net_count: total_doc_count.saturating_sub(cancelled_doc_count),
    }];

    let (cn_total, cn_cancelled, cn_min, cn_max): (usize, usize, String, String) = conn
        .query_row(
            "SELECT COUNT(*),
                    COALESCE(SUM(CASE WHEN status IN ('CANCELLED', 'RETURNED') THEN 1 ELSE 0 END), 0),
                    COALESCE(MIN(invoice_number), ''),
                    COALESCE(MAX(invoice_number), '')
             FROM invoices
             WHERE invoice_type = 'RETURN' AND invoice_date BETWEEN ?1 AND ?2",
            params![start_date, end_date],
            |r| Ok((r.get::<_, i64>(0)? as usize, r.get::<_, i64>(1)? as usize, r.get(2)?, r.get(3)?)),
        )
        .unwrap_or((0, 0, String::new(), String::new()));

    if cn_total > 0 {
        doc_summary.push(Gstr1DocSummary {
            doc_type: "Credit Note".into(),
            from_serial: if cn_min.is_empty() { "N/A".into() } else { cn_min },
            to_serial: if cn_max.is_empty() { "N/A".into() } else { cn_max },
            total_count: cn_total,
            cancelled_count: cn_cancelled,
            net_count: cn_total.saturating_sub(cn_cancelled),
        });
    }

    Ok(Gstr1ReportData {
        gstin: my_gstin,
        legal_name,
        fp,
        start_date: start_date.to_string(),
        end_date: end_date.to_string(),
        total_turnover,
        total_taxable,
        total_igst,
        total_cgst,
        total_sgst,
        total_cess,
        b2b,
        b2cl,
        b2cs,
        hsn_summary,
        doc_summary,
    })
}

pub fn get_gstr3b_report_internal(
    conn: &Connection,
    start_date: &str,
    end_date: &str,
) -> Result<Gstr3bReportData, String> {
    let (my_gstin, legal_name, my_state_code, gst_composition): (String, String, String, bool) = conn
        .query_row(
            "SELECT gstin, legal_name, state_code, COALESCE(gst_composition, 0) FROM gst_settings WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get::<_, i32>(3)? == 1)),
        )
        .unwrap_or_else(|_| ("27AABCU9603R1ZN".into(), "LynTerminal India".into(), "27".into(), false));

    let tax_mode: String = conn
        .query_row("SELECT COALESCE(tax_mode, 'EXCLUSIVE') FROM settings WHERE id = 1", [], |r| r.get(0))
        .unwrap_or_else(|_| "EXCLUSIVE".into());
    let is_tax_inclusive = tax_mode.eq_ignore_ascii_case("INCLUSIVE");

    let fp = if let Ok(parsed) = NaiveDate::parse_from_str(start_date, "%Y-%m-%d") {
        parsed.format("%m%Y").to_string()
    } else {
        "042026".to_string()
    };

    let mut outward_taxable = 0.0_f64;
    let mut outward_igst = 0.0_f64;
    let mut outward_cgst = 0.0_f64;
    let mut outward_sgst = 0.0_f64;
    let mut outward_cess = 0.0_f64;
    let mut zero_rated_taxable = 0.0_f64;
    let mut nil_exempt_taxable = 0.0_f64;

    {
        let mut out_stmt = conn
            .prepare(
                "SELECT i.id, i.invoice_type, i.subtotal, i.discount_amount,
                        COALESCE(g.is_interstate, 0),
                        COALESCE(g.is_reverse_charge, 0),
                        COALESCE(g.pos_state_code, ''),
                        COALESCE(gp.gst_type, ''),
                        COALESCE(g.igst_amount, 0.0),
                        COALESCE(g.cgst_amount, CASE WHEN g.invoice_id IS NOT NULL THEN g.cgst_amount ELSE i.tax_amount / 2.0 END),
                        COALESCE(g.sgst_amount, CASE WHEN g.invoice_id IS NOT NULL THEN g.sgst_amount ELSE i.tax_amount / 2.0 END),
                        COALESCE(g.cess_amount, 0.0)
                 FROM invoices i
                 LEFT JOIN gst_invoices g ON i.id = g.invoice_id
                 LEFT JOIN gst_parties gp ON i.party_id = gp.party_id
                 WHERE i.invoice_type IN ('SALE', 'RETURN')
                   AND i.status NOT IN ('RETURNED', 'CANCELLED')
                   AND i.invoice_date BETWEEN ?1 AND ?2",
            )
            .map_err(|e| e.to_string())?;

        let mut gst_item_stmt = conn
            .prepare(
                "SELECT tax_rate, taxable_amount, igst_amount, cgst_amount, sgst_amount, cess_amount
                 FROM gst_invoice_items WHERE invoice_id = ?1",
            )
            .map_err(|e| e.to_string())?;

        let mut core_item_stmt = conn
            .prepare("SELECT tax_rate, line_total FROM invoice_items WHERE invoice_id = ?1")
            .map_err(|e| e.to_string())?;

        let rows = out_stmt
            .query_map(params![start_date, end_date], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, f64>(2)?,
                    r.get::<_, f64>(3)?,
                    r.get::<_, i32>(4)? == 1,
                    r.get::<_, i32>(5)? == 1,
                    r.get::<_, String>(6)?,
                    r.get::<_, String>(7)?,
                    r.get::<_, f64>(8)?,
                    r.get::<_, f64>(9)?,
                    r.get::<_, f64>(10)?,
                    r.get::<_, f64>(11)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for row in rows.filter_map(Result::ok) {
            let (
                inv_id,
                inv_type,
                subtotal,
                discount,
                is_interstate,
                is_rcm,
                pos_code,
                party_gst_type,
                inv_igst,
                inv_cgst,
                inv_sgst,
                inv_cess,
            ) = row;

            if is_rcm {
                // Outward RCM supplies are paid by recipient, not supplier's Table 3.1(a) tax liability
                continue;
            }

            let sign = if inv_type == "RETURN" { -1.0 } else { 1.0 };
            let taxable = (subtotal - discount).max(0.0);
            let is_zero_rated = party_gst_type.eq_ignore_ascii_case("OVERSEAS")
                || pos_code.trim() == "96"
                || pos_code.trim() == "97";

            if is_zero_rated {
                zero_rated_taxable += sign * taxable;
                outward_igst += sign * inv_igst;
                outward_cgst += sign * inv_cgst;
                outward_sgst += sign * inv_sgst;
                outward_cess += sign * inv_cess;
                continue;
            }

            let gst_items: Vec<(f64, f64, f64, f64, f64, f64)> = gst_item_stmt
                .query_map(params![inv_id], |r| {
                    Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?))
                })
                .map_err(|e| e.to_string())?
                .filter_map(Result::ok)
                .collect();

            if !gst_items.is_empty() {
                for (rate, item_taxable, i_igst, i_cgst, i_sgst, i_cess) in gst_items {
                    if rate <= 0.001 && i_cess <= 0.001 {
                        nil_exempt_taxable += sign * item_taxable;
                    } else {
                        outward_taxable += sign * item_taxable;
                        outward_igst += sign * i_igst;
                        outward_cgst += sign * i_cgst;
                        outward_sgst += sign * i_sgst;
                        outward_cess += sign * i_cess;
                    }
                }
            } else {
                let core_items: Vec<(f64, f64)> = core_item_stmt
                    .query_map(params![inv_id], |r| Ok((r.get(0)?, r.get(1)?)))
                    .map_err(|e| e.to_string())?
                    .filter_map(Result::ok)
                    .collect();

                if !core_items.is_empty() {
                    let disc_factor = if subtotal > 0.0 { taxable / subtotal } else { 1.0 };
                    for (rate, line_tot) in core_items {
                        let (item_taxable, item_tax) = if is_tax_inclusive {
                            let gross = line_tot * disc_factor;
                            let tax_excl = if rate > 0.0 { gross / (1.0 + rate / 100.0) } else { gross };
                            (tax_excl, gross - tax_excl)
                        } else {
                            let tax_excl = line_tot * disc_factor;
                            (tax_excl, tax_excl * (rate / 100.0))
                        };
                        if rate <= 0.001 {
                            nil_exempt_taxable += sign * item_taxable;
                        } else {
                            outward_taxable += sign * item_taxable;
                            if is_interstate {
                                outward_igst += sign * item_tax;
                            } else {
                                outward_cgst += sign * (item_tax / 2.0);
                                outward_sgst += sign * (item_tax / 2.0);
                            }
                        }
                    }
                } else if inv_igst + inv_cgst + inv_sgst + inv_cess <= 0.001 {
                    nil_exempt_taxable += sign * taxable;
                } else {
                    outward_taxable += sign * taxable;
                    outward_igst += sign * inv_igst;
                    outward_cgst += sign * inv_cgst;
                    outward_sgst += sign * inv_sgst;
                    outward_cess += sign * inv_cess;
                }
            }
        }
    }

    // Table 3.1(d): Inward supplies liable to reverse charge
    let (reverse_charge_taxable, rcm_igst, rcm_cgst, rcm_sgst, rcm_cess): (f64, f64, f64, f64, f64) = conn
        .query_row(
            "SELECT COALESCE(SUM(MAX(0.0, i.subtotal - i.discount_amount)), 0.0),
                    COALESCE(SUM(COALESCE(g.igst_amount, 0.0)), 0.0),
                    COALESCE(SUM(COALESCE(g.cgst_amount, CASE WHEN g.invoice_id IS NOT NULL THEN g.cgst_amount ELSE i.tax_amount / 2.0 END)), 0.0),
                    COALESCE(SUM(COALESCE(g.sgst_amount, CASE WHEN g.invoice_id IS NOT NULL THEN g.sgst_amount ELSE i.tax_amount / 2.0 END)), 0.0),
                    COALESCE(SUM(COALESCE(g.cess_amount, 0.0)), 0.0)
             FROM invoices i
             JOIN gst_invoices g ON i.id = g.invoice_id
             WHERE i.invoice_type = 'PURCHASE'
               AND i.status NOT IN ('RETURNED', 'CANCELLED')
               AND g.is_reverse_charge = 1
               AND i.invoice_date BETWEEN ?1 AND ?2",
            params![start_date, end_date],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .unwrap_or((0.0, 0.0, 0.0, 0.0, 0.0));

    // Table 4: Eligible ITC (only from registered non-composition vendors with valid 15-char GSTIN;
    // RCM purchases generate eligible ITC once RCM tax is paid; composition dealers cannot claim ITC;
    // purchase_returns debit notes reverse ITC)
    let (itc_igst, itc_cgst, itc_sgst, itc_cess, itc_ineligible): (f64, f64, f64, f64, f64) = {
        let mut pur_stmt = conn
            .prepare(
                "SELECT COALESCE(NULLIF(TRIM(g.customer_gstin), ''), NULLIF(TRIM(gp.gstin), ''), TRIM(p.tax_number), ''),
                        COALESCE(gp.gst_type, ''),
                        COALESCE(g.is_reverse_charge, 0),
                        COALESCE(g.igst_amount, 0.0),
                        COALESCE(g.cgst_amount, CASE WHEN g.invoice_id IS NOT NULL THEN g.cgst_amount ELSE i.tax_amount / 2.0 END),
                        COALESCE(g.sgst_amount, CASE WHEN g.invoice_id IS NOT NULL THEN g.sgst_amount ELSE i.tax_amount / 2.0 END),
                        COALESCE(g.cess_amount, 0.0)
                 FROM invoices i
                 LEFT JOIN gst_invoices g ON i.id = g.invoice_id
                 LEFT JOIN parties p ON i.party_id = p.id
                 LEFT JOIN gst_parties gp ON i.party_id = gp.party_id
                 WHERE i.invoice_type = 'PURCHASE'
                   AND i.status NOT IN ('RETURNED', 'CANCELLED')
                   AND i.invoice_date BETWEEN ?1 AND ?2",
            )
            .map_err(|e| e.to_string())?;

        let pur_rows = pur_stmt
            .query_map(params![start_date, end_date], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i32>(2)? == 1,
                    r.get::<_, f64>(3)?,
                    r.get::<_, f64>(4)?,
                    r.get::<_, f64>(5)?,
                    r.get::<_, f64>(6)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut elig_i = 0.0;
        let mut elig_c = 0.0;
        let mut elig_s = 0.0;
        let mut elig_cs = 0.0;
        let mut inelig = 0.0;

        for r in pur_rows.filter_map(Result::ok) {
            let (gstin, vendor_gst_type, is_rcm_pur, i_igst, i_cgst, i_sgst, i_cess) = r;
            let valid_vendor = gstin.trim().len() == 15;
            let is_comp_vendor = vendor_gst_type.eq_ignore_ascii_case("COMPOSITION");
            if is_rcm_pur {
                if !gst_composition {
                    elig_i += i_igst;
                    elig_c += i_cgst;
                    elig_s += i_sgst;
                    elig_cs += i_cess;
                } else {
                    inelig += i_igst + i_cgst + i_sgst + i_cess;
                }
            } else if !gst_composition && valid_vendor && !is_comp_vendor {
                elig_i += i_igst;
                elig_c += i_cgst;
                elig_s += i_sgst;
                elig_cs += i_cess;
            } else {
                inelig += i_igst + i_cgst + i_sgst + i_cess;
            }
        }

        // Deduct Purchase Returns (Debit Notes) ITC reversal
        if !gst_composition {
            let mut dn_stmt = conn
                .prepare(
                    "SELECT COALESCE(NULLIF(TRIM(gp.gstin), ''), TRIM(p.tax_number), ''),
                            COALESCE(gp.gst_type, ''),
                            COALESCE(NULLIF(TRIM(gp.state_code), ''), ''),
                            pri.unit_price * pri.quantity,
                            pri.line_total,
                            COALESCE(it.tax_rate, 0.0)
                     FROM purchase_returns pr
                     JOIN purchase_return_items pri ON pri.return_id = pr.id
                     LEFT JOIN items it ON pri.item_id = it.id
                     LEFT JOIN parties p ON pr.party_id = p.id
                     LEFT JOIN gst_parties gp ON pr.party_id = gp.party_id
                     WHERE pr.return_date BETWEEN ?1 AND ?2",
                )
                .map_err(|e| e.to_string())?;

            let dn_rows = dn_stmt
                .query_map(params![start_date, end_date], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, f64>(3)?,
                        r.get::<_, f64>(4)?,
                        r.get::<_, f64>(5)?,
                    ))
                })
                .map_err(|e| e.to_string())?;

            for r in dn_rows.filter_map(Result::ok) {
                let (gstin, vendor_gst_type, vendor_state, base_amt, line_total, item_tax_rate) = r;
                let valid_vendor = gstin.trim().len() == 15;
                let is_comp_vendor = vendor_gst_type.eq_ignore_ascii_case("COMPOSITION");
                if !valid_vendor || is_comp_vendor {
                    continue;
                }
                let tax_amt = if item_tax_rate > 0.0 {
                    (line_total - (line_total / (1.0 + item_tax_rate / 100.0))).max(0.0)
                } else if line_total > base_amt + 0.01 && base_amt > 0.0 {
                    (line_total - base_amt).max(0.0)
                } else {
                    0.0
                };
                if tax_amt <= 0.001 {
                    continue;
                }
                let v_sc = if !vendor_state.is_empty() {
                    vendor_state
                } else if gstin.trim().len() >= 2 {
                    gstin.trim()[..2].to_string()
                } else {
                    my_state_code.clone()
                };
                if v_sc != my_state_code {
                    elig_i = (elig_i - tax_amt).max(0.0);
                } else {
                    elig_c = (elig_c - tax_amt / 2.0).max(0.0);
                    elig_s = (elig_s - tax_amt / 2.0).max(0.0);
                }
            }
        }

        (elig_i, elig_c, elig_s, elig_cs, inelig)
    };

    let table31 = Gstr3bTable31 {
        outward_taxable_value: outward_taxable,
        outward_igst,
        outward_cgst,
        outward_sgst,
        outward_cess,
        zero_rated_taxable,
        nil_exempt_taxable,
        reverse_charge_taxable,
        reverse_charge_igst: rcm_igst,
        reverse_charge_cgst: rcm_cgst,
        reverse_charge_sgst: rcm_sgst,
        reverse_charge_cess: rcm_cess,
    };

    let table4_itc = Gstr3bTable4Itc {
        itc_igst,
        itc_cgst,
        itc_sgst,
        itc_cess,
        itc_ineligible,
    };

    // Table 6.1: Section 49(5) / Rule 88A Cross-Utilization Set-Off
    let out_igst = outward_igst.max(0.0);
    let out_cgst = outward_cgst.max(0.0);
    let out_sgst = outward_sgst.max(0.0);
    let out_cess = outward_cess.max(0.0);

    // 1. IGST ITC -> IGST, then CGST, then SGST
    let igst_on_igst = itc_igst.min(out_igst);
    let rem_igst_1 = (itc_igst - igst_on_igst).max(0.0);
    let igst_on_cgst = rem_igst_1.min(out_cgst);
    let rem_igst_2 = (rem_igst_1 - igst_on_cgst).max(0.0);
    let igst_on_sgst = rem_igst_2.min(out_sgst);

    let rem_out_igst = (out_igst - igst_on_igst).max(0.0);
    let rem_out_cgst = (out_cgst - igst_on_cgst).max(0.0);
    let rem_out_sgst = (out_sgst - igst_on_sgst).max(0.0);

    // 2. CGST ITC -> CGST, then IGST (NEVER SGST)
    let cgst_on_cgst = itc_cgst.min(rem_out_cgst);
    let rem_cgst_itc = (itc_cgst - cgst_on_cgst).max(0.0);
    let cgst_on_igst = rem_cgst_itc.min(rem_out_igst);

    // 3. SGST ITC -> SGST, then IGST (NEVER CGST)
    let rem_out_igst_after_cgst = (rem_out_igst - cgst_on_igst).max(0.0);
    let sgst_on_sgst = itc_sgst.min(rem_out_sgst);
    let rem_sgst_itc = (itc_sgst - sgst_on_sgst).max(0.0);
    let sgst_on_igst = rem_sgst_itc.min(rem_out_igst_after_cgst);

    // 4. Cess ITC -> Cess ONLY
    let cess_on_cess = itc_cess.min(out_cess);

    let itc_utilized_igst = igst_on_igst + cgst_on_igst + sgst_on_igst;
    let itc_utilized_cgst = igst_on_cgst + cgst_on_cgst;
    let itc_utilized_sgst = igst_on_sgst + sgst_on_sgst;
    let itc_utilized_cess = cess_on_cess;
    let total_itc_utilized = itc_utilized_igst + itc_utilized_cgst + itc_utilized_sgst + itc_utilized_cess;

    // RCM liability cannot be paid with ITC; it must be paid in cash
    let net_igst_payable = (out_igst - itc_utilized_igst).max(0.0) + rcm_igst.max(0.0);
    let net_cgst_payable = (out_cgst - itc_utilized_cgst).max(0.0) + rcm_cgst.max(0.0);
    let net_sgst_payable = (out_sgst - itc_utilized_sgst).max(0.0) + rcm_sgst.max(0.0);
    let net_cess_payable = (out_cess - itc_utilized_cess).max(0.0) + rcm_cess.max(0.0);

    let total_tax_payable = out_igst + out_cgst + out_sgst + out_cess + rcm_igst.max(0.0) + rcm_cgst.max(0.0) + rcm_sgst.max(0.0) + rcm_cess.max(0.0);
    let total_itc_available = itc_igst + itc_cgst + itc_sgst + itc_cess;
    let net_cash_payable = net_igst_payable + net_cgst_payable + net_sgst_payable + net_cess_payable;

    Ok(Gstr3bReportData {
        gstin: my_gstin,
        legal_name,
        fp,
        start_date: start_date.to_string(),
        end_date: end_date.to_string(),
        table31,
        table4_itc,
        net_igst_payable,
        net_cgst_payable,
        net_sgst_payable,
        net_cess_payable,
        itc_utilized_igst,
        itc_utilized_cgst,
        itc_utilized_sgst,
        itc_utilized_cess,
        total_itc_utilized,
        total_tax_payable,
        total_itc_available,
        net_cash_payable,
    })
}

// ----------------------------------------------------------------------------
// TAURI COMMAND HANDLERS
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn get_gst_settings(state: State<'_, Mutex<AppState>>) -> Result<GstSettings, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    get_gst_settings_internal(&conn)
}

#[tauri::command]
pub fn save_gst_settings(
    settings: GstSettings,
    state: State<'_, Mutex<AppState>>,
) -> Result<GstSettings, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    save_gst_settings_internal(&conn, settings)
}

#[tauri::command]
pub fn get_party_gst_profile(
    party_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Option<GstPartyProfile>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    get_party_gst_profile_internal(&conn, &party_id)
}

#[tauri::command]
pub fn save_party_gst_profile(
    profile: GstPartyProfile,
    state: State<'_, Mutex<AppState>>,
) -> Result<GstPartyProfile, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    save_party_gst_profile_internal(&conn, profile)
}

#[tauri::command]
pub fn get_item_gst_profile(
    item_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Option<GstItemProfile>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    get_item_gst_profile_internal(&conn, &item_id)
}

#[tauri::command]
pub fn save_item_gst_profile(
    profile: GstItemProfile,
    state: State<'_, Mutex<AppState>>,
) -> Result<GstItemProfile, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    save_item_gst_profile_internal(&conn, profile)
}

#[tauri::command]
pub fn create_gst_invoice(
    payload: CreateGstInvoicePayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<CompleteGstInvoice, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    if app.db.is_trial_expired() {
        return Err("14-Day Free Trial has expired. Please acquire and activate a perpetual commercial license to issue new sales and invoices.".into());
    }
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    create_gst_invoice_internal(&mut conn, payload)
}

#[tauri::command]
pub fn get_gst_invoice(
    invoice_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<CompleteGstInvoice, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    get_gst_invoice_internal(&conn, &invoice_id)
}

#[tauri::command]
pub fn list_gst_invoices(
    invoice_type: Option<String>,
    status: Option<String>,
    search: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<CompleteGstInvoice>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    list_gst_invoices_internal(&conn, invoice_type, status, search)
}

#[tauri::command]
pub fn get_sundry_debtors_aging(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<PartyCreditAging>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    get_sundry_debtors_aging_internal(&conn)
}

#[tauri::command]
pub fn get_sundry_creditors_aging(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<PartyCreditAging>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    get_sundry_creditors_aging_internal(&conn)
}

#[tauri::command]
pub fn get_party_pending_bills(
    party_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<PendingBill>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    get_party_pending_bills_internal(&conn, &party_id)
}

#[tauri::command]
pub fn settle_bill_by_bill(
    payload: BillSettlementPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    settle_bill_by_bill_internal(&mut conn, payload)
}

#[tauri::command]
pub fn get_gstr1_report(
    start_date: String,
    end_date: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Gstr1ReportData, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    get_gstr1_report_internal(&conn, &start_date, &end_date)
}

#[tauri::command]
pub fn get_gstr3b_report(
    start_date: String,
    end_date: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Gstr3bReportData, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    get_gstr3b_report_internal(&conn, &start_date, &end_date)
}
