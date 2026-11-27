use crate::db::DatabaseManager;
use crate::models::*;
use chrono::Local;
use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

pub struct AppState {
    pub db: DatabaseManager,
}

// ----------------------------------------------------------------------------
// SETTINGS COMMANDS
// ----------------------------------------------------------------------------

pub fn get_settings_internal(conn: &rusqlite::Connection) -> Result<Settings, String> {
    conn.query_row(
        "SELECT id, business_name, tagline, address, phone, email, tax_id,
                currency_symbol, currency_code, tax_name, default_tax_rate,
                invoice_prefix, enable_godowns, terms_and_conditions,
                tax_mode, tax_preset, preview_after_sale, auto_print,
                opening_cash, opening_bank, opening_balance_mode,
                capital_cash, capital_bank, capital_mode,
                custom_payment_1_name, custom_payment_1_enabled,
                custom_payment_2_name, custom_payment_2_enabled,
                printer_type, printer_target, paper_width, auto_cut, open_cash_drawer
         FROM settings WHERE id = 1",
        [],
        |row| {
            Ok(Settings {
                id: row.get(0)?,
                business_name: row.get(1)?,
                tagline: row.get(2)?,
                address: row.get(3)?,
                phone: row.get(4)?,
                email: row.get(5)?,
                tax_id: row.get(6)?,
                currency_symbol: row.get(7)?,
                currency_code: row.get(8)?,
                tax_name: row.get(9)?,
                default_tax_rate: row.get(10)?,
                invoice_prefix: row.get(11)?,
                enable_godowns: row.get::<_, i32>(12)? == 1,
                terms_and_conditions: row.get(13)?,
                tax_mode: row.get::<_, Option<String>>(14)?.unwrap_or_else(|| "EXCLUSIVE".into()),
                tax_preset: row.get::<_, Option<String>>(15)?.unwrap_or_else(|| "CUSTOM".into()),
                preview_after_sale: row.get::<_, Option<i32>>(16)?.unwrap_or(0) == 1,
                auto_print: row.get::<_, Option<i32>>(17)?.unwrap_or(0) == 1,
                opening_cash: row.get::<_, Option<f64>>(18)?.unwrap_or(0.0),
                opening_bank: row.get::<_, Option<f64>>(19)?.unwrap_or(0.0),
                opening_balance_mode: row.get::<_, Option<String>>(20)?.unwrap_or_else(|| "CASH".into()),
                capital_cash: row.get::<_, Option<f64>>(21)?.unwrap_or(0.0),
                capital_bank: row.get::<_, Option<f64>>(22)?.unwrap_or(0.0),
                capital_mode: row.get::<_, Option<String>>(23)?.unwrap_or_else(|| "CASH".into()),
                custom_payment_1_name: row.get::<_, Option<String>>(24)?.unwrap_or_else(|| "UPI".into()),
                custom_payment_1_enabled: row.get::<_, Option<i32>>(25)?.unwrap_or(0) == 1,
                custom_payment_2_name: row.get::<_, Option<String>>(26)?.unwrap_or_else(|| "Bank Transfer".into()),
                custom_payment_2_enabled: row.get::<_, Option<i32>>(27)?.unwrap_or(0) == 1,
                printer_type: row.get::<_, Option<String>>(28)?.unwrap_or_else(|| "BROWSER_DIALOG".into()),
                printer_target: row.get::<_, Option<String>>(29)?.unwrap_or_default(),
                paper_width: row.get::<_, Option<String>>(30)?.unwrap_or_else(|| "80mm".into()),
                auto_cut: row.get::<_, Option<i32>>(31)?.unwrap_or(1) == 1,
                open_cash_drawer: row.get::<_, Option<i32>>(32)?.unwrap_or(0) == 1,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(state: State<'_, Mutex<AppState>>) -> Result<Settings, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    get_settings_internal(&conn)
}

#[tauri::command]
pub fn save_settings(
    settings: Settings,
    state: State<'_, Mutex<AppState>>,
) -> Result<Settings, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE settings SET
            business_name = ?1,
            tagline = ?2,
            address = ?3,
            phone = ?4,
            email = ?5,
            tax_id = ?6,
            currency_symbol = ?7,
            currency_code = ?8,
            tax_name = ?9,
            default_tax_rate = ?10,
            invoice_prefix = ?11,
            enable_godowns = ?12,
            terms_and_conditions = ?13,
            tax_mode = ?14,
            tax_preset = ?15,
            preview_after_sale = ?16,
            auto_print = ?17,
            opening_cash = ?18,
            opening_bank = ?19,
            opening_balance_mode = ?20,
            capital_cash = ?21,
            capital_bank = ?22,
            capital_mode = ?23,
            custom_payment_1_name = ?24,
            custom_payment_1_enabled = ?25,
            custom_payment_2_name = ?26,
            custom_payment_2_enabled = ?27,
            printer_type = ?28,
            printer_target = ?29,
            paper_width = ?30,
            auto_cut = ?31,
            open_cash_drawer = ?32
         WHERE id = 1",
        params![
            settings.business_name,
            settings.tagline,
            settings.address,
            settings.phone,
            settings.email,
            settings.tax_id,
            settings.currency_symbol,
            settings.currency_code,
            settings.tax_name,
            settings.default_tax_rate,
            settings.invoice_prefix,
            if settings.enable_godowns { 1 } else { 0 },
            settings.terms_and_conditions,
            settings.tax_mode,
            settings.tax_preset,
            if settings.preview_after_sale { 1 } else { 0 },
            if settings.auto_print { 1 } else { 0 },
            settings.opening_cash,
            settings.opening_bank,
            settings.opening_balance_mode,
            settings.capital_cash,
            settings.capital_bank,
            settings.capital_mode,
            settings.custom_payment_1_name,
            if settings.custom_payment_1_enabled { 1 } else { 0 },
            settings.custom_payment_2_name,
            if settings.custom_payment_2_enabled { 1 } else { 0 },
            settings.printer_type,
            settings.printer_target,
            settings.paper_width,
            if settings.auto_cut { 1 } else { 0 },
            if settings.open_cash_drawer { 1 } else { 0 },
        ],
    )
    .map_err(|e| e.to_string())?;

    // Sync primary bank balance only when a single bank account exists (avoid clobbering multi-bank balances)
    let (_, cash_in_bank) = calculate_liquidity_internal(&conn).unwrap_or((0.0, 0.0));
    let bank_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM bank_accounts", [], |r| r.get(0))
        .unwrap_or(0);
    if bank_count == 0 {
        let now = chrono::Local::now().to_rfc3339();
        conn.execute(
            "INSERT INTO bank_accounts (id, account_name, bank_name, account_number, current_balance, is_primary, created_at)
             VALUES ('BANK-PRIMARY', 'Primary Operating Account', 'Commercial Bank', '0001', ?1, 1, ?2)",
            params![cash_in_bank, now],
        ).ok();
    } else if bank_count == 1 {
        conn.execute(
            "UPDATE bank_accounts SET current_balance = ?1 WHERE is_primary = 1",
            params![cash_in_bank],
        ).ok();
    }

    DatabaseManager::log_audit(
        &conn,
        "UPDATE",
        "SETTINGS",
        "1",
        "Updated business settings, tax configuration, and checkout preferences",
    )
    .ok();

    // Trigger auto-backup after settings change
    let _ = create_database_backup_internal(&conn);

    get_settings_internal(&conn)
}

// ----------------------------------------------------------------------------
// ITEMS & INVENTORY COMMANDS
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn list_items(
    search: Option<String>,
    category: Option<String>,
    godown: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<Item>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let mut query = "SELECT id, name, sku, barcode, category, unit, purchase_price,
                            sale_price, stock_quantity, min_stock_alert, godown, created_at,
                            size, brand, tax_rate
                     FROM items WHERE 1=1".to_string();

    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(s) = search {
        if !s.trim().is_empty() {
            query.push_str(" AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)");
            let pattern = format!("%{}%", s.trim());
            param_values.push(Box::new(pattern.clone()));
            param_values.push(Box::new(pattern.clone()));
            param_values.push(Box::new(pattern));
        }
    }

    if let Some(c) = category {
        if !c.trim().is_empty() && c != "All" {
            query.push_str(" AND category = ?");
            param_values.push(Box::new(c));
        }
    }

    if let Some(g) = godown {
        if !g.trim().is_empty() && g != "All" {
            query.push_str(" AND godown = ?");
            param_values.push(Box::new(g));
        }
    }

    query.push_str(" ORDER BY name ASC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let slice_params: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|b| b.as_ref()).collect();

    let rows = stmt
        .query_map(&slice_params[..], |row| {
            Ok(Item {
                id: row.get(0)?,
                name: row.get(1)?,
                sku: row.get(2)?,
                barcode: row.get(3)?,
                category: row.get(4)?,
                unit: row.get(5)?,
                purchase_price: row.get(6)?,
                sale_price: row.get(7)?,
                stock_quantity: row.get(8)?,
                min_stock_alert: row.get(9)?,
                godown: row.get(10)?,
                created_at: row.get(11)?,
                size: row.get::<_, Option<String>>(12).unwrap_or(None),
                brand: row.get::<_, Option<String>>(13).unwrap_or(None),
                tax_rate: row.get::<_, Option<f64>>(14).unwrap_or(None),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for item in rows {
        items.push(item.map_err(|e| e.to_string())?);
    }
    Ok(items)
}

#[tauri::command]
pub fn save_item(mut item: Item, state: State<'_, Mutex<AppState>>) -> Result<Item, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    if item.id.is_empty() {
        item.id = Uuid::new_v4().to_string();
        item.created_at = Local::now().to_rfc3339();

        conn.execute(
            "INSERT INTO items (id, name, sku, barcode, category, unit,
                                purchase_price, sale_price, stock_quantity,
                                min_stock_alert, godown, created_at,
                                size, brand, tax_rate)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                item.id,
                item.name,
                item.sku,
                item.barcode,
                item.category,
                item.unit,
                item.purchase_price,
                item.sale_price,
                item.stock_quantity,
                item.min_stock_alert,
                item.godown,
                item.created_at,
                item.size,
                item.brand,
                item.tax_rate,
            ],
        )
        .map_err(|e| e.to_string())?;

        // Stock movement entry
        if item.stock_quantity != 0.0 {
            conn.execute(
                "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                              quantity_after, movement_type, reference_id,
                                              timestamp, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    Uuid::new_v4().to_string(),
                    item.id,
                    item.name,
                    item.stock_quantity,
                    item.stock_quantity,
                    "OPENING",
                    "OPENING_STOCK",
                    Local::now().to_rfc3339(),
                    "Opening stock initialized",
                ],
            )
            .ok();
        }

        DatabaseManager::log_audit(
            &conn,
            "CREATE",
            "ITEM",
            &item.id,
            &format!("Created product {}", item.name),
        )
        .ok();
    } else {
        let old_stock: f64 = conn
            .query_row(
                "SELECT stock_quantity FROM items WHERE id = ?1",
                params![item.id],
                |r| r.get(0),
            )
            .unwrap_or(item.stock_quantity);

        conn.execute(
            "UPDATE items SET
                name = ?1, sku = ?2, barcode = ?3, category = ?4, unit = ?5,
                purchase_price = ?6, sale_price = ?7, stock_quantity = ?8,
                min_stock_alert = ?9, godown = ?10, size = ?11, brand = ?12, tax_rate = ?13
             WHERE id = ?14",
            params![
                item.name,
                item.sku,
                item.barcode,
                item.category,
                item.unit,
                item.purchase_price,
                item.sale_price,
                item.stock_quantity,
                item.min_stock_alert,
                item.godown,
                item.size,
                item.brand,
                item.tax_rate,
                item.id,
            ],
        )
        .map_err(|e| e.to_string())?;

        let stock_delta = item.stock_quantity - old_stock;
        if stock_delta.abs() > 0.0001 {
            conn.execute(
                "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                              quantity_after, movement_type, reference_id,
                                              timestamp, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, 'ADJUSTMENT', 'ITEM_EDIT', ?6, ?7)",
                params![
                    Uuid::new_v4().to_string(),
                    item.id,
                    item.name,
                    stock_delta,
                    item.stock_quantity,
                    Local::now().to_rfc3339(),
                    format!("Manual stock edit from {:.2} to {:.2}", old_stock, item.stock_quantity),
                ],
            )
            .ok();
        }

        DatabaseManager::log_audit(
            &conn,
            "UPDATE",
            "ITEM",
            &item.id,
            &format!("Updated product {}", item.name),
        )
        .ok();
    }

    Ok(item)
}

#[tauri::command]
pub fn delete_item(id: String, state: State<'_, Mutex<AppState>>) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM items WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(&conn, "DELETE", "ITEM", &id, "Deleted product").ok();

    Ok(true)
}

#[tauri::command]
pub fn adjust_stock(
    item_id: String,
    adjustment: f64,
    reason: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Item, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (name, current_stock): (String, f64) = tx
        .query_row(
            "SELECT name, stock_quantity FROM items WHERE id = ?1",
            params![item_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let new_stock = current_stock + adjustment;

    tx.execute(
        "UPDATE items SET stock_quantity = ?1 WHERE id = ?2",
        params![new_stock, item_id],
    )
    .map_err(|e| e.to_string())?;

    let movement_type = if adjustment >= 0.0 { "ADJUSTMENT_ADD" } else { "ADJUSTMENT_REDUCE" };
    tx.execute(
        "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                      quantity_after, movement_type, reference_id,
                                      timestamp, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            Uuid::new_v4().to_string(),
            item_id,
            name,
            adjustment,
            new_stock,
            movement_type,
            "MANUAL_ADJUSTMENT",
            Local::now().to_rfc3339(),
            reason,
        ],
    )
    .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(
        &tx,
        "ADJUST",
        "STOCK",
        &item_id,
        &format!("Adjusted {} by {} (New: {}) - {}", name, adjustment, new_stock, reason),
    )
    .ok();

    tx.commit().map_err(|e| e.to_string())?;

    // Return updated item
    let updated_item = conn
        .query_row(
            "SELECT id, name, sku, barcode, category, unit, purchase_price,
                    sale_price, stock_quantity, min_stock_alert, godown, created_at,
                    size, brand, tax_rate
             FROM items WHERE id = ?1",
            params![item_id],
            |row| {
                Ok(Item {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    sku: row.get(2)?,
                    barcode: row.get(3)?,
                    category: row.get(4)?,
                    unit: row.get(5)?,
                    purchase_price: row.get(6)?,
                    sale_price: row.get(7)?,
                    stock_quantity: row.get(8)?,
                    min_stock_alert: row.get(9)?,
                    godown: row.get(10)?,
                    created_at: row.get(11)?,
                    size: row.get::<_, Option<String>>(12).unwrap_or(None),
                    brand: row.get::<_, Option<String>>(13).unwrap_or(None),
                    tax_rate: row.get::<_, Option<f64>>(14).unwrap_or(None),
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(updated_item)
}

#[tauri::command]
pub fn get_stock_movements(
    item_id: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<StockMovement>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let mut query = "SELECT id, item_id, item_name, change_quantity, quantity_after,
                            movement_type, reference_id, timestamp, notes
                     FROM stock_movements WHERE 1=1".to_string();

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(id) = item_id {
        if !id.is_empty() {
            query.push_str(" AND item_id = ?");
            params_vec.push(Box::new(id));
        }
    }

    query.push_str(" ORDER BY timestamp DESC LIMIT 200");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let slice: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let rows = stmt
        .query_map(&slice[..], |row| {
            Ok(StockMovement {
                id: row.get(0)?,
                item_id: row.get(1)?,
                item_name: row.get(2)?,
                change_quantity: row.get(3)?,
                quantity_after: row.get(4)?,
                movement_type: row.get(5)?,
                reference_id: row.get(6)?,
                timestamp: row.get(7)?,
                notes: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

// ----------------------------------------------------------------------------
// PARTIES COMMANDS (Customers & Vendors)
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn list_parties(
    party_type: Option<String>,
    search: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<Party>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let mut query = "SELECT id, name, party_type, phone, email, address,
                            tax_number, opening_balance, current_balance, created_at
                     FROM parties WHERE 1=1".to_string();

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(pt) = party_type {
        if !pt.is_empty() && pt != "ALL" {
            query.push_str(" AND party_type = ?");
            params_vec.push(Box::new(pt));
        }
    }

    if let Some(s) = search {
        if !s.trim().is_empty() {
            query.push_str(" AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)");
            let pattern = format!("%{}%", s.trim());
            params_vec.push(Box::new(pattern.clone()));
            params_vec.push(Box::new(pattern.clone()));
            params_vec.push(Box::new(pattern));
        }
    }

    query.push_str(" ORDER BY name ASC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let slice: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let rows = stmt
        .query_map(&slice[..], |row| {
            Ok(Party {
                id: row.get(0)?,
                name: row.get(1)?,
                party_type: row.get(2)?,
                phone: row.get(3)?,
                email: row.get(4)?,
                address: row.get(5)?,
                tax_number: row.get(6)?,
                opening_balance: row.get(7)?,
                current_balance: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut parties = Vec::new();
    for p in rows {
        parties.push(p.map_err(|e| e.to_string())?);
    }
    Ok(parties)
}

#[tauri::command]
pub fn save_party(mut party: Party, state: State<'_, Mutex<AppState>>) -> Result<Party, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    if party.id.is_empty() {
        party.id = Uuid::new_v4().to_string();
        party.created_at = Local::now().to_rfc3339();
        if party.current_balance == 0.0 && party.opening_balance != 0.0 {
            if party.party_type == "VENDOR" && party.opening_balance > 0.0 {
                party.current_balance = -party.opening_balance.abs();
            } else {
                party.current_balance = party.opening_balance;
            }
        } else if party.party_type == "VENDOR" && party.opening_balance > 0.0 && party.current_balance > 0.0 {
            // Ensure new vendor opening payables are never accidentally stored with customer positive sign
            if (party.current_balance - party.opening_balance).abs() < 0.01 {
                party.current_balance = -party.opening_balance.abs();
            }
        }

        conn.execute(
            "INSERT INTO parties (id, name, party_type, phone, email, address,
                                 tax_number, opening_balance, current_balance, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                party.id,
                party.name,
                party.party_type,
                party.phone,
                party.email,
                party.address,
                party.tax_number,
                party.opening_balance,
                party.current_balance,
                party.created_at,
            ],
        )
        .map_err(|e| e.to_string())?;

        DatabaseManager::log_audit(
            &conn,
            "CREATE",
            "PARTY",
            &party.id,
            &format!("Created {} ({})", party.name, party.party_type),
        )
        .ok();
    } else {
        conn.execute(
            "UPDATE parties SET
                name = ?1, party_type = ?2, phone = ?3, email = ?4,
                address = ?5, tax_number = ?6, opening_balance = ?7, current_balance = ?8
             WHERE id = ?9",
            params![
                party.name,
                party.party_type,
                party.phone,
                party.email,
                party.address,
                party.tax_number,
                party.opening_balance,
                party.current_balance,
                party.id,
            ],
        )
        .map_err(|e| e.to_string())?;

        DatabaseManager::log_audit(
            &conn,
            "UPDATE",
            "PARTY",
            &party.id,
            &format!("Updated party details for {}", party.name),
        )
        .ok();
    }

    Ok(party)
}

#[tauri::command]
pub fn delete_party(id: String, state: State<'_, Mutex<AppState>>) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let has_history: bool = conn
        .query_row(
            "SELECT (
                EXISTS(SELECT 1 FROM invoices WHERE party_id = ?1)
                OR EXISTS(SELECT 1 FROM payments WHERE party_id = ?1)
                OR EXISTS(SELECT 1 FROM bill_settlements WHERE party_id = ?1)
                OR EXISTS(SELECT 1 FROM purchase_returns WHERE party_id = ?1)
                OR EXISTS(SELECT 1 FROM estimates WHERE party_id = ?1)
            )",
            params![id],
            |r| r.get(0),
        )
        .unwrap_or(false);

    if has_history {
        return Err(
            "Cannot delete contact with historical invoices, payments, settlements, returns, or quotations. Keep the record to preserve ledger integrity."
                .to_string(),
        );
    }

    conn.execute("DELETE FROM gst_parties WHERE party_id = ?1", params![id]).ok();
    conn.execute("DELETE FROM parties WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(&conn, "DELETE", "PARTY", &id, "Deleted party").ok();
    Ok(true)
}

// ----------------------------------------------------------------------------
// INVOICES & BILLING COMMANDS
// ----------------------------------------------------------------------------

pub fn next_sequence_number(conn: &rusqlite::Connection, table: &str, col: &str, prefix: &str) -> i64 {
    let sql = format!("SELECT {} FROM {} WHERE {} LIKE ?1 || '%'", col, table, col);
    let mut max_n: i64 = 0;
    if let Ok(mut stmt) = conn.prepare(&sql) {
        if let Ok(rows) = stmt.query_map(params![prefix], |r| r.get::<_, String>(0)) {
            for val in rows.flatten() {
                if let Some(rest) = val.strip_prefix(prefix) {
                    let trimmed = rest.trim();
                    if !trimmed.is_empty() && trimmed.chars().all(|c| c.is_ascii_digit()) {
                        if let Ok(n) = trimmed.parse::<i64>() {
                            if n > max_n {
                                max_n = n;
                            }
                        }
                    }
                }
            }
        }
    }
    max_n + 1
}

pub fn create_invoice_internal(
    conn: &mut rusqlite::Connection,
    payload: InvoicePayload,
) -> Result<InvoiceDetail, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let invoice_id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();

    // Determine invoice number sequentially based on max numeric suffix
    let prefix: String = tx
        .query_row(
            "SELECT invoice_prefix FROM settings WHERE id = 1",
            [],
            |r| r.get(0),
        )
        .unwrap_or_else(|_| "INV-".into());

    let next_num = next_sequence_number(&tx, "invoices", "invoice_number", &prefix);
    let invoice_number = format!("{}{:05}", prefix, next_num);

    let status = if payload.paid_amount >= payload.total_amount - 0.001 {
        "PAID"
    } else if payload.paid_amount > 0.0 {
        "PARTIAL"
    } else if payload.payment_method.to_lowercase().contains("credit") || payload.notes.to_lowercase().contains("credit") {
        "CREDIT"
    } else {
        "UNPAID"
    };

    // Validate party_id against parties table to ensure foreign key safety
    let valid_party_id: Option<String> = match payload.party_id.as_deref().map(str::trim) {
        Some(pid) if !pid.is_empty() => {
            let exists: bool = tx
                .query_row(
                    "SELECT 1 FROM parties WHERE id = ?1",
                    params![pid],
                    |_| Ok(true),
                )
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
        "INSERT INTO invoices (id, invoice_number, invoice_type, party_id,
                              party_name, invoice_date, due_date, subtotal,
                              discount_amount, tax_amount, total_amount, paid_amount,
                              status, payment_method, notes, created_at, reference)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
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
            payload.tax_amount,
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

    let mut created_items = Vec::new();

    for item_payload in payload.items {
        let item_line_id = Uuid::new_v4().to_string();

        // Validate item_id against items table to guarantee foreign key integrity
        let valid_item_id: Option<String> = match item_payload.item_id.as_deref().map(str::trim) {
            Some(it_id) if !it_id.is_empty() => {
                let exists: bool = tx
                    .query_row(
                        "SELECT 1 FROM items WHERE id = ?1",
                        params![it_id],
                        |_| Ok(true),
                    )
                    .unwrap_or(false);
                if exists {
                    Some(it_id.to_string())
                } else {
                    None
                }
            }
            _ => None,
        };

        tx.execute(
            "INSERT INTO invoice_items (id, invoice_id, item_id, item_name,
                                        quantity, unit, unit_price, discount_percent,
                                        tax_rate, line_total)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                item_line_id,
                invoice_id,
                valid_item_id,
                item_payload.item_name,
                item_payload.quantity,
                item_payload.unit,
                item_payload.unit_price,
                item_payload.discount_percent,
                item_payload.tax_rate,
                item_payload.line_total,
            ],
        )
        .map_err(|e| e.to_string())?;

        // Update inventory & record stock movements only if item genuinely exists
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
                    "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                                  quantity_after, movement_type, reference_id,
                                                  timestamp, notes)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        Uuid::new_v4().to_string(),
                        it_id,
                        item_payload.item_name,
                        -item_payload.quantity,
                        current,
                        "SALE",
                        invoice_number,
                        now,
                        format!("Invoice #{}", invoice_number),
                    ],
                )
                .ok();
            } else if payload.invoice_type == "PURCHASE" {
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

                tx.execute(
                    "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                                  quantity_after, movement_type, reference_id,
                                                  timestamp, notes)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        Uuid::new_v4().to_string(),
                        it_id,
                        item_payload.item_name,
                        item_payload.quantity,
                        current,
                        "PURCHASE",
                        invoice_number,
                        now,
                        format!("Bill #{}", invoice_number),
                    ],
                )
                .ok();
            }
        }

        created_items.push(InvoiceItem {
            id: item_line_id,
            invoice_id: invoice_id.clone(),
            item_id: valid_item_id,
            item_name: item_payload.item_name,
            quantity: item_payload.quantity,
            unit: item_payload.unit,
            unit_price: item_payload.unit_price,
            discount_percent: item_payload.discount_percent,
            tax_rate: item_payload.tax_rate,
            line_total: item_payload.line_total,
        });
    }

    // Update party balance & record payment only if party genuinely exists
    if let Some(ref p_id) = valid_party_id {
        let unpaid = payload.total_amount - payload.paid_amount;
        if payload.invoice_type == "SALE" {
            // Customer owes unpaid portion
            tx.execute(
                "UPDATE parties SET current_balance = current_balance + ?1 WHERE id = ?2",
                params![unpaid, p_id],
            )
            .ok();

            if payload.paid_amount > 0.0 {
                tx.execute(
                    "INSERT INTO payments (id, invoice_id, party_id, party_name,
                                          amount, payment_type, payment_method,
                                          payment_date, reference, notes)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        Uuid::new_v4().to_string(),
                        invoice_id,
                        p_id,
                        payload.party_name,
                        payload.paid_amount,
                        "IN",
                        payload.payment_method,
                        payload.invoice_date,
                        invoice_number,
                        format!("Payment for Sale #{}", invoice_number),
                    ],
                )
                .ok();
            }
        } else if payload.invoice_type == "PURCHASE" {
            // We owe vendor unpaid portion
            tx.execute(
                "UPDATE parties SET current_balance = current_balance - ?1 WHERE id = ?2",
                params![unpaid, p_id],
            )
            .ok();

            if payload.paid_amount > 0.0 {
                tx.execute(
                    "INSERT INTO payments (id, invoice_id, party_id, party_name,
                                          amount, payment_type, payment_method,
                                          payment_date, reference, notes)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        Uuid::new_v4().to_string(),
                        invoice_id,
                        p_id,
                        payload.party_name,
                        payload.paid_amount,
                        "OUT",
                        payload.payment_method,
                        payload.invoice_date,
                        invoice_number,
                        format!("Payment for Purchase #{}", invoice_number),
                    ],
                )
                .ok();
            }
        }
    }

    // Update bank account balance when invoice involves bank/digital tender
    if payload.paid_amount > 0.0 {
        let (_, bank_part) = parse_payment_liquidity(&payload.payment_method, payload.paid_amount);
        if bank_part > 0.0 {
            let target_bank = payload.bank_account_id.as_deref().map(str::trim).filter(|s| !s.is_empty());
            if payload.invoice_type == "SALE" {
                if let Some(bid) = target_bank {
                    tx.execute(
                        "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE id = ?2",
                        params![bank_part, bid],
                    )
                    .ok();
                } else {
                    tx.execute(
                        "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                        params![bank_part],
                    )
                    .ok();
                }
            } else if payload.invoice_type == "PURCHASE" {
                if let Some(bid) = target_bank {
                    tx.execute(
                        "UPDATE bank_accounts SET current_balance = current_balance - ?1 WHERE id = ?2",
                        params![bank_part, bid],
                    )
                    .ok();
                } else {
                    tx.execute(
                        "UPDATE bank_accounts SET current_balance = current_balance - ?1 WHERE is_primary = 1",
                        params![bank_part],
                    )
                    .ok();
                }
            }
        }
    }

    let audit_currency: String = tx
        .query_row("SELECT currency_symbol FROM settings WHERE id = 1", [], |r| r.get(0))
        .unwrap_or_else(|_| "$".into());

    DatabaseManager::log_audit(
        &tx,
        "CREATE",
        "INVOICE",
        &invoice_id,
        &format!("Created {} #{} for {}{:.2}", payload.invoice_type, invoice_number, audit_currency, payload.total_amount),
    )
    .ok();

    tx.commit().map_err(|e| e.to_string())?;

    let invoice_detail = InvoiceDetail {
        invoice: Invoice {
            id: invoice_id,
            invoice_number,
            invoice_type: payload.invoice_type.clone(),
            party_id: valid_party_id.clone(),
            party_name: payload.party_name.clone(),
            invoice_date: payload.invoice_date,
            due_date: payload.due_date,
            subtotal: payload.subtotal,
            discount_amount: payload.discount_amount,
            tax_amount: payload.tax_amount,
            total_amount: payload.total_amount,
            paid_amount: payload.paid_amount,
            status: status.to_string(),
            payment_method: payload.payment_method,
            notes: payload.notes,
            created_at: now,
            reference: payload.reference,
        },
        items: created_items,
    };

    // Automatically generate and store PDF bill in ~/Downloads/lynterminal/bills/<invoice_number>.pdf
    if payload.invoice_type == "SALE" {
        let settings = get_settings_internal(&conn).unwrap_or_default();

        let party_address: String = if let Some(ref pid) = payload.party_id {
            conn.query_row(
                "SELECT address FROM parties WHERE id = ?1",
                params![pid],
                |r| r.get(0),
            )
            .unwrap_or_else(|_| "123 Street Area, Location".to_string())
        } else {
            "123 Street Area, Location".to_string()
        };

        let _ = generate_and_save_invoice_pdf(&invoice_detail, &settings, &party_address);
    }

    // Atomic auto-backup after sale
    let _ = create_database_backup_internal(&conn);

    Ok(invoice_detail)
}

#[tauri::command]
pub fn create_invoice(
    payload: InvoicePayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<InvoiceDetail, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    if app.db.is_trial_expired() {
        return Err("14-Day Free Trial has expired. Please acquire and activate a perpetual commercial license to issue new sales and invoices.".into());
    }
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    create_invoice_internal(&mut conn, payload)
}

#[tauri::command]
pub fn list_invoices(
    invoice_type: Option<String>,
    status: Option<String>,
    search: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<Invoice>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let mut query = "SELECT id, invoice_number, invoice_type, party_id, party_name,
                            invoice_date, due_date, subtotal, discount_amount,
                            tax_amount, total_amount, paid_amount, status,
                            payment_method, notes, created_at, reference
                     FROM invoices WHERE 1=1".to_string();

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

    query.push_str(" ORDER BY invoice_date DESC, created_at DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let slice: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let rows = stmt
        .query_map(&slice[..], |row| {
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
                reference: row.get::<_, Option<String>>(16).unwrap_or(None),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for inv in rows {
        result.push(inv.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn get_invoice(id: String, state: State<'_, Mutex<AppState>>) -> Result<InvoiceDetail, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let invoice = conn
        .query_row(
            "SELECT id, invoice_number, invoice_type, party_id, party_name,
                    invoice_date, due_date, subtotal, discount_amount,
                    tax_amount, total_amount, paid_amount, status,
                    payment_method, notes, created_at, reference
             FROM invoices WHERE id = ?1",
            params![id],
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
                    reference: row.get::<_, Option<String>>(16).unwrap_or(None),
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

    let item_rows = stmt
        .query_map(params![id], |row| {
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
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for it in item_rows {
        items.push(it.map_err(|e| e.to_string())?);
    }

    Ok(InvoiceDetail { invoice, items })
}

#[tauri::command]
pub fn delete_invoice(id: String, state: State<'_, Mutex<AppState>>) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    void_or_delete_invoice_internal(
        &mut conn,
        id,
        "CANCEL".to_string(),
        "Deleted invoice".to_string(),
    )
}

fn escape_pdf_str(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '(' => out.push_str("\\("),
            ')' => out.push_str("\\)"),
            '\n' | '\r' => out.push(' '),
            c if c.is_ascii() => out.push(c),
            '₹' => out.push_str("Rs. "),
            '€' => out.push_str("EUR "),
            '£' => out.push_str("GBP "),
            '¥' => out.push_str("JPY "),
            _ => out.push(' '),
        }
    }
    out
}

fn pdf_currency_label(symbol: &str, code: &str) -> String {
    let trimmed = symbol.trim();
    if trimmed.is_empty() {
        return if code.trim().is_empty() {
            "$".into()
        } else {
            format!("{} ", code.trim())
        };
    }
    if trimmed == "₹" {
        return "Rs.".into();
    }
    if trimmed.is_ascii() {
        return trimmed.to_string();
    }
    if !code.trim().is_empty() {
        format!("{} ", code.trim())
    } else {
        "$".into()
    }
}

pub fn generate_native_invoice_pdf(
    detail: &InvoiceDetail,
    settings: &Settings,
    party_address: &str,
) -> Vec<u8> {
    let mut pages_content: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut y = 790.0;

    let store_name = if !settings.business_name.is_empty() {
        &settings.business_name
    } else {
        "LynTerminal Store"
    };
    let tagline = if !settings.tagline.is_empty() {
        &settings.tagline
    } else {
        "Commercial Retail & Management"
    };
    let currency_sym_owned = pdf_currency_label(&settings.currency_symbol, &settings.currency_code);
    let currency_sym = currency_sym_owned.as_str();

    // Header - Store Logo Emblem & Information
    let initial = store_name.chars().next().unwrap_or('L').to_uppercase().to_string();
    current.push_str(&format!(
        "0.1 0.1 0.1 rg\n40 {y_box:.1} 40 40 re f\n1 1 1 rg\nBT /F2 20 Tf 53 {y_text:.1} Td ({initial}) Tj ET\n",
        y_box = y - 26.0,
        y_text = y - 18.0,
        initial = escape_pdf_str(&initial)
    ));
    current.push_str(&format!(
        "0 0 0 rg\nBT /F2 18 Tf 90 {:.1} Td ({}) Tj ET\n",
        y, escape_pdf_str(store_name)
    ));
    current.push_str(&format!(
        "0 0 0 rg\nBT /F2 18 Tf 430 {:.1} Td (TAX INVOICE) Tj ET\n",
        y
    ));
    y -= 18.0;

    current.push_str(&format!(
        "0.4 0.4 0.4 rg\nBT /F1 9 Tf 90 {:.1} Td ({}) Tj ET\n",
        y, escape_pdf_str(tagline)
    ));
    current.push_str(&format!(
        "0 0.44 0.89 rg\nBT /F2 11 Tf 430 {:.1} Td ({}) Tj ET\n",
        y, escape_pdf_str(&detail.invoice.invoice_number)
    ));
    y -= 14.0;

    let contact_info = format!(
        "{} | Tel: {} | {}: {}",
        settings.address, settings.phone, settings.tax_name, settings.tax_id
    );
    current.push_str(&format!(
        "0.5 0.5 0.5 rg\nBT /F1 8 Tf 90 {:.1} Td ({}) Tj ET\n",
        y, escape_pdf_str(&contact_info)
    ));
    current.push_str(&format!(
        "0.5 0.5 0.5 rg\nBT /F1 8 Tf 430 {:.1} Td (Date: {} | Status: {}) Tj ET\n",
        y, escape_pdf_str(&detail.invoice.invoice_date), escape_pdf_str(&detail.invoice.status)
    ));
    y -= 16.0;

    // Hairline divider
    current.push_str(&format!(
        "0.88 0.88 0.89 RG 0.5 w\n40 {:.1} m 555 {:.1} l S\n",
        y, y
    ));
    y -= 18.0;

    // Billed To
    let customer_name = if !detail.invoice.party_name.is_empty() {
        &detail.invoice.party_name
    } else {
        "Walk-in Customer"
    };
    current.push_str(&format!(
        "0.5 0.5 0.5 rg\nBT /F2 8 Tf 40 {:.1} Td (BILLED TO:) Tj ET\n",
        y
    ));
    current.push_str(&format!(
        "0 0 0 rg\nBT /F2 12 Tf 40 {:.1} Td ({}) Tj ET\n",
        y - 13.0, escape_pdf_str(customer_name)
    ));
    current.push_str(&format!(
        "0.5 0.5 0.5 rg\nBT /F1 8 Tf 40 {:.1} Td ({} | Method: {}) Tj ET\n",
        y - 24.0, escape_pdf_str(party_address), escape_pdf_str(&detail.invoice.payment_method)
    ));
    y -= 38.0;

    let table_header = |y_pos: f64| -> String {
        let y_box = y_pos - 4.0;
        format!(
            "0.96 0.96 0.97 rg\n40 {y_box:.1} 515 18 re f\n0.88 0.88 0.89 RG 0.5 w\n40 {y_box:.1} 515 18 re S\n0.3 0.3 0.3 rg\nBT /F2 8 Tf 45 {y_pos:.1} Td (#) Tj ET\nBT /F2 8 Tf 75 {y_pos:.1} Td (ITEM DESCRIPTION) Tj ET\nBT /F2 8 Tf 330 {y_pos:.1} Td (UNIT PRICE) Tj ET\nBT /F2 8 Tf 420 {y_pos:.1} Td (QTY) Tj ET\nBT /F2 8 Tf 500 {y_pos:.1} Td (TOTAL) Tj ET\n",
            y_box = y_box,
            y_pos = y_pos
        )
    };

    current.push_str(&table_header(y));
    y -= 18.0;

    for (idx, it) in detail.items.iter().enumerate() {
        if y < 140.0 {
            pages_content.push(current.clone());
            current.clear();
            y = 790.0;
            current.push_str(&format!(
                "0.5 0.5 0.5 rg\nBT /F1 8 Tf 40 {:.1} Td (Invoice {} - Continued) Tj ET\n",
                y, escape_pdf_str(&detail.invoice.invoice_number)
            ));
            y -= 16.0;
            current.push_str(&table_header(y));
            y -= 18.0;
        }

        let name_trimmed: String = it.item_name.chars().take(42).collect();
        let y_line = y - 4.0;
        current.push_str(&format!(
            "0.2 0.2 0.2 rg\nBT /F1 9 Tf 45 {y:.1} Td ({idx}) Tj ET\nBT /F2 9 Tf 75 {y:.1} Td ({name}) Tj ET\n0.4 0.4 0.4 rg\nBT /F1 9 Tf 330 {y:.1} Td ({curr}{price:.2}) Tj ET\nBT /F1 9 Tf 420 {y:.1} Td ({qty} {unit}) Tj ET\n0 0 0 rg\nBT /F2 9 Tf 500 {y:.1} Td ({curr}{tot:.2}) Tj ET\n0.92 0.92 0.93 RG 0.5 w\n40 {y_line:.1} m 555 {y_line:.1} l S\n",
            y = y,
            idx = idx + 1,
            name = escape_pdf_str(&name_trimmed),
            curr = escape_pdf_str(currency_sym),
            price = it.unit_price,
            qty = it.quantity,
            unit = escape_pdf_str(&it.unit),
            tot = it.line_total,
            y_line = y_line,
        ));
        y -= 18.0;
    }

    if y < 140.0 {
        pages_content.push(current.clone());
        current.clear();
        y = 790.0;
    }

    y -= 12.0;
    current.push_str(&format!(
        "0.88 0.88 0.89 RG 0.75 w\n40 {:.1} m 555 {:.1} l S\n",
        y, y
    ));
    current.push_str(&format!(
        "0.4 0.4 0.4 rg\nBT /F1 8 Tf 40 {:.1} Td (Terms: Returns accepted within 14 days with original receipt.) Tj ET\nBT /F1 8 Tf 40 {:.1} Td (*** VERIFIED LOCAL TRANSACTION - 100% SECURE & PRIVATE ***) Tj ET\n",
        y - 16.0, y - 28.0
    ));

    current.push_str(&format!(
        "0.3 0.3 0.3 rg\nBT /F1 9 Tf 360 {:.1} Td (Subtotal:) Tj ET\nBT /F1 9 Tf 480 {:.1} Td ({}{:.2}) Tj ET\n",
        y - 14.0, y - 14.0, escape_pdf_str(currency_sym), detail.invoice.subtotal
    ));
    current.push_str(&format!(
        "BT /F1 9 Tf 360 {:.1} Td ({} ({:.1}%):) Tj ET\nBT /F1 9 Tf 480 {:.1} Td (+{}{:.2}) Tj ET\n",
        y - 28.0, escape_pdf_str(&settings.tax_name), settings.default_tax_rate,
        y - 28.0, escape_pdf_str(currency_sym), detail.invoice.tax_amount
    ));
    current.push_str(&format!(
        "0.88 0.88 0.89 RG 0.5 w\n360 {:.1} m 555 {:.1} l S\n",
        y - 34.0, y - 34.0
    ));
    current.push_str(&format!(
        "0 0 0 rg\nBT /F2 12 Tf 360 {:.1} Td (Grand Total:) Tj ET\n0 0.44 0.89 rg\nBT /F2 14 Tf 475 {:.1} Td ({}{:.2}) Tj ET\n",
        y - 48.0, y - 48.0, escape_pdf_str(currency_sym), detail.invoice.total_amount
    ));
    current.push_str(&format!(
        "0.4 0.4 0.4 rg\nBT /F1 9 Tf 360 {:.1} Td (Amount Paid:) Tj ET\nBT /F1 9 Tf 480 {:.1} Td ({}{:.2}) Tj ET\n",
        y - 62.0, y - 62.0, escape_pdf_str(currency_sym), detail.invoice.paid_amount
    ));
    current.push_str(&format!(
        "0.8 0.8 0.8 RG 0.75 w\n440 {:.1} m 555 {:.1} l S\n0.4 0.4 0.4 rg\nBT /F2 8 Tf 445 {:.1} Td (AUTHORIZED SIGNATORY) Tj ET\n",
        y - 95.0, y - 95.0, y - 105.0
    ));

    pages_content.push(current);

    // Build PDF objects
    let num_pages = pages_content.len();
    let font1_id = 3 + num_pages;
    let font2_id = font1_id + 1;
    let first_stream_id = font2_id + 1;

    let mut objects: std::collections::BTreeMap<usize, Vec<u8>> = std::collections::BTreeMap::new();
    objects.insert(1, b"<< /Type /Catalog /Pages 2 0 R >>".to_vec());

    let mut kids = String::new();
    for i in 0..num_pages {
        kids.push_str(&format!("{} 0 R ", 3 + i));
    }
    objects.insert(
        2,
        format!("<< /Type /Pages /Kids [{}] /Count {} >>", kids.trim(), num_pages).into_bytes(),
    );

    for i in 0..num_pages {
        let page_id = 3 + i;
        let stream_id = first_stream_id + i;
        objects.insert(
            page_id,
            format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents {} 0 R /Resources << /Font << /F1 {} 0 R /F2 {} 0 R >> >> >>",
                stream_id, font1_id, font2_id
            ).into_bytes(),
        );
    }

    objects.insert(font1_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_vec());
    objects.insert(font2_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>".to_vec());

    for (i, content) in pages_content.iter().enumerate() {
        let stream_id = first_stream_id + i;
        let s_bytes = content.as_bytes();
        let mut stream_obj = format!("<< /Length {} >>\nstream\n", s_bytes.len()).into_bytes();
        stream_obj.extend_from_slice(s_bytes);
        stream_obj.extend_from_slice(b"\nendstream");
        objects.insert(stream_id, stream_obj);
    }

    let total_objs = objects.len();
    let mut out: Vec<u8> = b"%PDF-1.4\n".to_vec();
    let mut offsets: std::collections::BTreeMap<usize, usize> = std::collections::BTreeMap::new();

    for obj_idx in 1..=total_objs {
        offsets.insert(obj_idx, out.len());
        out.extend_from_slice(format!("{} 0 obj\n", obj_idx).as_bytes());
        if let Some(obj_data) = objects.get(&obj_idx) {
            out.extend_from_slice(obj_data);
        }
        out.extend_from_slice(b"\nendobj\n");
    }

    let xref_offset = out.len();
    out.extend_from_slice(format!("xref\n0 {}\n0000000000 65535 f \n", total_objs + 1).as_bytes());
    for obj_idx in 1..=total_objs {
        let off = offsets.get(&obj_idx).copied().unwrap_or(0);
        out.extend_from_slice(format!("{:010} 00000 n \n", off).as_bytes());
    }

    out.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
            total_objs + 1, xref_offset
        ).as_bytes(),
    );

    out
}

pub fn get_user_home_dir() -> std::path::PathBuf {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        std::path::PathBuf::from(profile)
    } else if let Ok(home) = std::env::var("HOME") {
        std::path::PathBuf::from(home)
    } else if let Ok(app_data) = std::env::var("APPDATA") {
        std::path::PathBuf::from(app_data)
    } else {
        std::env::temp_dir()
    }
}

pub fn get_bills_storage_dir() -> std::path::PathBuf {
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        std::path::PathBuf::from(userprofile).join("Downloads").join("lynterminal").join("bills")
    } else if let Ok(home) = std::env::var("HOME") {
        std::path::PathBuf::from(home).join("Downloads").join("lynterminal").join("bills")
    } else {
        std::env::temp_dir().join("lynterminal").join("bills")
    }
}

pub fn get_backups_storage_dir() -> (std::path::PathBuf, std::path::PathBuf) {
    let base = get_user_home_dir();
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| base.join("AppData").join("Roaming"));
        let backup_dir = appdata.join("lynterminal").join("backups");
        let vault_dir = appdata.join("lynterminal").join("vault");
        (backup_dir, vault_dir)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let backup_dir = base.join(".local").join("share").join("com.lynterminal.app").join("backups");
        let vault_dir = base.join(".config").join("lynterminal").join("vault");
        (backup_dir, vault_dir)
    }
}

pub fn generate_and_save_invoice_pdf(
    detail: &InvoiceDetail,
    settings: &Settings,
    party_address: &str,
) -> Result<String, String> {
    let bills_dir = get_bills_storage_dir();

    std::fs::create_dir_all(&bills_dir)
        .map_err(|e| format!("Failed to create bills directory: {}", e))?;

    let dest_pdf = bills_dir.join(format!("{}.pdf", detail.invoice.invoice_number));
    let pdf_bytes = generate_native_invoice_pdf(detail, settings, party_address);

    std::fs::write(&dest_pdf, pdf_bytes)
        .map_err(|e| format!("Failed to write invoice PDF: {}", e))?;

    // Clean up any stale fallback .html file with the same invoice number
    let old_html = bills_dir.join(format!("{}.html", detail.invoice.invoice_number));
    if old_html.exists() {
        let _ = std::fs::remove_file(old_html);
    }

    Ok(dest_pdf.to_string_lossy().to_string())
}

fn decode_base64_pdf(s: &str) -> Result<Vec<u8>, String> {
    let raw = if let Some(idx) = s.find(";base64,") {
        &s[idx + 8..]
    } else {
        s.trim()
    };
    let mut out = Vec::new();
    let mut buf: u32 = 0;
    let mut bits: u32 = 0;
    for &b in raw.as_bytes() {
        let val = match b {
            b'A'..=b'Z' => (b - b'A') as u32,
            b'a'..=b'z' => (b - b'a' + 26) as u32,
            b'0'..=b'9' => (b - b'0' + 52) as u32,
            b'+' => 62,
            b'/' => 63,
            b'=' | b'\r' | b'\n' | b' ' => continue,
            _ => continue,
        };
        buf = (buf << 6) | val;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }
    if out.is_empty() {
        return Err("Failed to decode base64 PDF: empty decoded buffer".to_string());
    }
    Ok(out)
}

#[tauri::command]
pub fn save_invoice_pdf_file(
    invoice_number: String,
    bytes: Option<Vec<u8>>,
    base64_data: Option<String>,
) -> Result<String, String> {
    let bills_dir = get_bills_storage_dir();

    std::fs::create_dir_all(&bills_dir)
        .map_err(|e| format!("Failed to create bills directory: {}", e))?;

    let safe_name = invoice_number
        .replace('/', "-")
        .replace('\\', "-")
        .replace(':', "-")
        .replace('*', "-")
        .replace('?', "-")
        .replace('"', "-")
        .replace('<', "-")
        .replace('>', "-")
        .replace('|', "-");

    let dest_pdf = bills_dir.join(format!("{}.pdf", safe_name));
    if let Some(parent) = dest_pdf.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let pdf_bytes = if let Some(b) = bytes {
        if !b.is_empty() {
            b
        } else if let Some(b64) = base64_data {
            decode_base64_pdf(&b64)?
        } else {
            return Err("Empty PDF data provided".to_string());
        }
    } else if let Some(b64) = base64_data {
        decode_base64_pdf(&b64)?
    } else {
        return Err("No PDF bytes or base64 provided".to_string());
    };

    std::fs::write(&dest_pdf, &pdf_bytes)
        .map_err(|e| format!("Failed to write PDF: {}", e))?;

    let old_html = bills_dir.join(format!("{}.html", safe_name));
    if old_html.exists() {
        let _ = std::fs::remove_file(old_html);
    }

    Ok(dest_pdf.to_string_lossy().to_string())
}

#[tauri::command]
pub fn export_invoice_pdf(
    invoice_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let invoice = conn
        .query_row(
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
                    reference: row.get::<_, Option<String>>(16).unwrap_or(None),
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

    let item_rows = stmt
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
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for it in item_rows {
        items.push(it.map_err(|e| e.to_string())?);
    }

    let detail = InvoiceDetail { invoice, items };

    let settings = get_settings_internal(&conn).unwrap_or_default();

    let party_address: String = if let Some(ref pid) = detail.invoice.party_id {
        conn.query_row(
            "SELECT address FROM parties WHERE id = ?1",
            params![pid],
            |r| r.get(0),
        )
        .unwrap_or_else(|_| "123 Street Area, Location".to_string())
    } else {
        "123 Street Area, Location".to_string()
    };

    generate_and_save_invoice_pdf(&detail, &settings, &party_address)
}

#[tauri::command]
pub fn open_invoice_pdf(invoice_number: String) -> Result<bool, String> {
    let dest_pdf = get_bills_storage_dir().join(format!("{}.pdf", invoice_number));

    if !dest_pdf.exists() {
        return Err(format!("PDF not found at {}", dest_pdf.display()));
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &dest_pdf.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open PDF on Windows: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&dest_pdf)
            .spawn()
            .map_err(|e| format!("Failed to open PDF on macOS: {}", e))?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&dest_pdf)
            .spawn()
            .map_err(|e| format!("Failed to open PDF on Linux: {}", e))?;
    }

    Ok(true)
}

// ----------------------------------------------------------------------------
// PAYMENTS COMMANDS
// ----------------------------------------------------------------------------

pub fn record_payment_internal(
    conn: &mut rusqlite::Connection,
    mut payment: Payment,
) -> Result<Payment, String> {
    if payment.amount <= 0.0 || !payment.amount.is_finite() {
        return Err("Payment amount must be greater than zero".into());
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    if payment.id.is_empty() {
        payment.id = Uuid::new_v4().to_string();
    }

    // Normalize empty invoice_id to None
    if let Some(ref inv_id) = payment.invoice_id {
        if inv_id.trim().is_empty() {
            payment.invoice_id = None;
        }
    }
    if let Some(ref bid) = payment.bank_account_id {
        if bid.trim().is_empty() {
            payment.bank_account_id = None;
        }
    }

    // Auto-resolve party_id and party_name from invoice if not provided
    if payment.party_id.is_empty() {
        if let Some(ref inv_id) = payment.invoice_id {
            if let Ok((p_id, p_name)) = tx.query_row(
                "SELECT party_id, party_name FROM invoices WHERE id = ?1",
                params![inv_id],
                |r| Ok((r.get::<_, Option<String>>(0)?, r.get::<_, String>(1)?)),
            ) {
                if let Some(pid) = p_id {
                    payment.party_id = pid;
                }
                if payment.party_name.is_empty() {
                    payment.party_name = p_name;
                }
            }
        }
    }

    let party_id_opt: Option<&str> = if payment.party_id.trim().is_empty() {
        None
    } else {
        Some(payment.party_id.trim())
    };

    tx.execute(
        "INSERT INTO payments (id, invoice_id, party_id, party_name, amount,
                              payment_type, payment_method, payment_date, reference, notes, bank_account_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            payment.id,
            payment.invoice_id,
            party_id_opt,
            payment.party_name,
            payment.amount,
            payment.payment_type,
            payment.payment_method,
            payment.payment_date,
            payment.reference,
            payment.notes,
            payment.bank_account_id.as_deref().unwrap_or(""),
        ],
    )
    .map_err(|e| e.to_string())?;

    // Update party balance
    if !payment.party_id.is_empty() {
        if payment.payment_type == "IN" {
            // Customer paid money, reduces what they owe us
            tx.execute(
                "UPDATE parties SET current_balance = current_balance - ?1 WHERE id = ?2",
                params![payment.amount, payment.party_id],
            )
            .ok();
        } else {
            // We paid money to vendor, reduces what we owe them
            tx.execute(
                "UPDATE parties SET current_balance = current_balance + ?1 WHERE id = ?2",
                params![payment.amount, payment.party_id],
            )
            .ok();
        }
    }

    // Update bank account balance when tender goes through bank/digital channels
    let (_, bank_part) = parse_payment_liquidity(&payment.payment_method, payment.amount);
    if bank_part > 0.0 {
        let delta = if payment.payment_type == "IN" { bank_part } else { -bank_part };
        if let Some(ref bid) = payment.bank_account_id {
            tx.execute(
                "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE id = ?2",
                params![delta, bid],
            )
            .ok();
        } else {
            tx.execute(
                "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                params![delta],
            )
            .ok();
        }
    }

    // If attached to an invoice, update paid_amount & status (capped at due, excess spills FIFO); otherwise FIFO-allocate across open bills
    if let Some(ref inv_id) = payment.invoice_id {
        let (total, paid): (f64, f64) = tx
            .query_row(
                "SELECT total_amount, paid_amount FROM invoices WHERE id = ?1",
                params![inv_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap_or((0.0, 0.0));

        let due = (total - paid).max(0.0);
        let alloc = payment.amount.min(due);
        let mut excess = payment.amount - alloc;

        if alloc > 0.005 {
            let new_paid = ((paid + alloc).min(total) * 100.0).round() / 100.0;
            let new_status = if new_paid >= total - 0.01 {
                "PAID"
            } else if new_paid > 0.01 {
                "PARTIAL"
            } else {
                "UNPAID"
            };

            tx.execute(
                "UPDATE invoices SET paid_amount = ?1, status = ?2 WHERE id = ?3",
                params![new_paid, new_status, inv_id],
            )
            .ok();

            if !payment.party_id.is_empty() {
                let settlement_id = Uuid::new_v4().to_string();
                let _ = tx.execute(
                    "INSERT INTO bill_settlements (
                        id, payment_id, invoice_id, party_id, settled_amount, settlement_date, notes
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        settlement_id,
                        payment.id,
                        inv_id,
                        payment.party_id,
                        alloc,
                        payment.payment_date,
                        payment.notes,
                    ],
                );
            }
        }

        if excess > 0.005 && !payment.party_id.is_empty() {
            let target_inv_type = if payment.payment_type == "OUT" { "PURCHASE" } else { "SALE" };
            let open_bills: Vec<(String, f64, f64)> = {
                let mut stmt = tx
                    .prepare(
                        "SELECT id, total_amount, paid_amount FROM invoices
                         WHERE party_id = ?1
                           AND id != ?2
                           AND invoice_type = ?3
                           AND status NOT IN ('PAID', 'RETURNED', 'CANCELLED')
                           AND (total_amount - paid_amount) > 0.01
                         ORDER BY invoice_date ASC, created_at ASC",
                    )
                    .map_err(|e| e.to_string())?;
                let mapped = stmt
                    .query_map(params![payment.party_id, inv_id, target_inv_type], |r| {
                        Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?, r.get::<_, f64>(2)?))
                    })
                    .map_err(|e| e.to_string())?
                    .filter_map(Result::ok)
                    .collect();
                mapped
            };
            for (bill_id, total_amt, paid_amt) in open_bills {
                if excess <= 0.005 {
                    break;
                }
                let b_due = (total_amt - paid_amt).max(0.0);
                if b_due <= 0.005 {
                    continue;
                }
                let b_alloc = excess.min(b_due);
                let b_new_paid = ((paid_amt + b_alloc) * 100.0).round() / 100.0;
                let b_new_status = if b_new_paid >= total_amt - 0.01 { "PAID" } else { "PARTIAL" };
                tx.execute(
                    "UPDATE invoices SET paid_amount = ?1, status = ?2 WHERE id = ?3",
                    params![b_new_paid, b_new_status, bill_id],
                )
                .ok();
                let _ = tx.execute(
                    "INSERT INTO bill_settlements (
                        id, payment_id, invoice_id, party_id, settled_amount, settlement_date, notes
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        Uuid::new_v4().to_string(),
                        payment.id,
                        bill_id,
                        payment.party_id,
                        b_alloc,
                        payment.payment_date,
                        payment.notes,
                    ],
                );
                excess -= b_alloc;
            }
        }
    } else if !payment.party_id.is_empty() {
        // FIFO allocation across the party's unpaid/partial bills
        let target_inv_type = if payment.payment_type == "OUT" { "PURCHASE" } else { "SALE" };
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
            let mapped = stmt
                .query_map(params![payment.party_id, target_inv_type], |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?, r.get::<_, f64>(2)?))
                })
                .map_err(|e| e.to_string())?
                .filter_map(Result::ok)
                .collect();
            mapped
        };

        let mut remaining = payment.amount;
        for (bill_id, total_amt, paid_amt) in open_bills {
            if remaining <= 0.005 {
                break;
            }
            let due = (total_amt - paid_amt).max(0.0);
            if due <= 0.005 {
                continue;
            }
            let alloc = remaining.min(due);
            let new_paid = ((paid_amt + alloc) * 100.0).round() / 100.0;
            let new_status = if new_paid >= total_amt - 0.01 {
                "PAID"
            } else {
                "PARTIAL"
            };

            tx.execute(
                "UPDATE invoices SET paid_amount = ?1, status = ?2 WHERE id = ?3",
                params![new_paid, new_status, bill_id],
            )
            .ok();

            let settlement_id = Uuid::new_v4().to_string();
            let _ = tx.execute(
                "INSERT INTO bill_settlements (
                    id, payment_id, invoice_id, party_id, settled_amount, settlement_date, notes
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    settlement_id,
                    payment.id,
                    bill_id,
                    payment.party_id,
                    alloc,
                    payment.payment_date,
                    payment.notes,
                ],
            );
            remaining -= alloc;
        }
    }

    DatabaseManager::log_audit(
        &tx,
        "CREATE",
        "PAYMENT",
        &payment.id,
        &format!("Recorded {} payment of ${:.2} from/to {}", payment.payment_type, payment.amount, payment.party_name),
    )
    .ok();

    tx.commit().map_err(|e| e.to_string())?;
    Ok(payment)
}

#[tauri::command]
pub fn record_payment(
    payment: Payment,
    state: State<'_, Mutex<AppState>>,
) -> Result<Payment, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    record_payment_internal(&mut conn, payment)
}

#[tauri::command]
pub fn list_payments(
    party_id: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<Payment>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let mut query = "SELECT id, invoice_id, party_id, party_name, amount,
                            payment_type, payment_method, payment_date, reference, notes,
                            COALESCE(bank_account_id, '')
                     FROM payments WHERE 1=1".to_string();

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(pid) = party_id {
        if !pid.is_empty() {
            query.push_str(" AND party_id = ?");
            params_vec.push(Box::new(pid));
        }
    }

    query.push_str(" ORDER BY payment_date DESC LIMIT 300");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let slice: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let rows = stmt
        .query_map(&slice[..], |row| {
            let bid: String = row.get::<_, Option<String>>(10)?.unwrap_or_default();
            Ok(Payment {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                party_id: row.get(2)?,
                party_name: row.get(3)?,
                amount: row.get(4)?,
                payment_type: row.get(5)?,
                payment_method: row.get(6)?,
                payment_date: row.get(7)?,
                reference: row.get(8)?,
                notes: row.get(9)?,
                bank_account_id: if bid.is_empty() { None } else { Some(bid) },
            })
        })
        .map_err(|e| e.to_string())?;

    let mut payments = Vec::new();
    for p in rows {
        payments.push(p.map_err(|e| e.to_string())?);
    }
    Ok(payments)
}

// ----------------------------------------------------------------------------
// EXPENSES COMMANDS
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn list_expenses(
    category: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<Expense>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let mut query = "SELECT id, title, category, amount, expense_date, payment_method, notes
                     FROM expenses WHERE id NOT LIKE 'EXP-SAL-%'".to_string();

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(c) = category {
        if !c.is_empty() && c != "All" {
            query.push_str(" AND category = ?");
            params_vec.push(Box::new(c));
        }
    }

    query.push_str(" ORDER BY expense_date DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let slice: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let rows = stmt
        .query_map(&slice[..], |row| {
            Ok(Expense {
                id: row.get(0)?,
                title: row.get(1)?,
                category: row.get(2)?,
                amount: row.get(3)?,
                expense_date: row.get(4)?,
                payment_method: row.get(5)?,
                notes: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut expenses = Vec::new();
    for exp in rows {
        expenses.push(exp.map_err(|e| e.to_string())?);
    }
    Ok(expenses)
}

#[tauri::command]
pub fn save_expense(
    mut expense: Expense,
    state: State<'_, Mutex<AppState>>,
) -> Result<Expense, String> {
    if expense.amount <= 0.0 || !expense.amount.is_finite() {
        return Err("Expense amount must be greater than zero".to_string());
    }

    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    if expense.id.is_empty() {
        expense.id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO expenses (id, title, category, amount, expense_date, payment_method, notes, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                expense.id,
                expense.title,
                expense.category,
                expense.amount,
                expense.expense_date,
                expense.payment_method,
                expense.notes,
                Local::now().to_rfc3339(),
            ],
        )
        .map_err(|e| e.to_string())?;

        let (_, bank_out) = parse_payment_liquidity(&expense.payment_method, expense.amount);
        if bank_out > 0.0 {
            tx.execute(
                "UPDATE bank_accounts SET current_balance = current_balance - ?1 WHERE is_primary = 1",
                params![bank_out],
            )
            .ok();
        }

        DatabaseManager::log_audit(
            &tx,
            "CREATE",
            "EXPENSE",
            &expense.id,
            &format!("Created expense: {} ({:.2})", expense.title, expense.amount),
        )
        .ok();
    } else {
        if expense.id.starts_with("EXP-SAL-") {
            return Err("Payroll expense vouchers must be managed from the Staff & Payroll page.".into());
        }
        let old_row: Option<(f64, String)> = tx
            .query_row(
                "SELECT amount, payment_method FROM expenses WHERE id = ?1",
                params![expense.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .ok();

        tx.execute(
            "UPDATE expenses SET title = ?1, category = ?2, amount = ?3,
                                expense_date = ?4, payment_method = ?5, notes = ?6
             WHERE id = ?7",
            params![
                expense.title,
                expense.category,
                expense.amount,
                expense.expense_date,
                expense.payment_method,
                expense.notes,
                expense.id,
            ],
        )
        .map_err(|e| e.to_string())?;

        let old_bank = old_row
            .map(|(amt, meth)| parse_payment_liquidity(&meth, amt).1)
            .unwrap_or(0.0);
        let new_bank = parse_payment_liquidity(&expense.payment_method, expense.amount).1;
        let bank_delta = old_bank - new_bank;
        if bank_delta.abs() > 0.0001 {
            tx.execute(
                "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                params![bank_delta],
            )
            .ok();
        }

        DatabaseManager::log_audit(
            &tx,
            "UPDATE",
            "EXPENSE",
            &expense.id,
            &format!("Updated expense: {} ({:.2})", expense.title, expense.amount),
        )
        .ok();
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(expense)
}

#[tauri::command]
pub fn delete_expense(id: String, state: State<'_, Mutex<AppState>>) -> Result<bool, String> {
    if id.starts_with("EXP-SAL-") {
        return Err("Payroll expense vouchers cannot be deleted directly; manage payroll on Staff & Payroll.".into());
    }
    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let old_row: Option<(f64, String)> = tx
        .query_row(
            "SELECT amount, payment_method FROM expenses WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .ok();

    tx.execute("DELETE FROM expenses WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    if let Some((old_amt, old_method)) = old_row {
        let (_, bank_part) = parse_payment_liquidity(&old_method, old_amt);
        if bank_part > 0.0 {
            tx.execute(
                "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                params![bank_part],
            )
            .ok();
        }
    }

    DatabaseManager::log_audit(&tx, "DELETE", "EXPENSE", &id, "Deleted expense").ok();
    tx.commit().map_err(|e| e.to_string())?;
    Ok(true)
}

// ----------------------------------------------------------------------------
// REPORTS & DASHBOARD
// ----------------------------------------------------------------------------

fn is_cash_tender_token(upper: &str) -> bool {
    upper.contains("CASH")
        || upper == "REFUND"
        || upper == "COUNTER"
        || upper == "DRAWER"
        || upper == "PETTY"
}

fn is_credit_tender_token(upper: &str) -> bool {
    (upper.contains("CREDIT") && !upper.contains("CREDIT CARD"))
        || upper.contains("UDHAAR")
        || upper.contains("UDHAR")
}

fn is_bank_tender(tender_str: &str) -> bool {
    let upper = tender_str.trim().to_uppercase();
    if upper.is_empty() || is_cash_tender_token(&upper) || is_credit_tender_token(&upper) {
        return false;
    }
    // Any explicit non-cash, non-credit tender label (Card, UPI, Bank, Wise, SEPA, Revolut, PayPay, Custom 1/2, etc.)
    // routes through digital/bank liquidity rather than physical cash drawer.
    true
}

pub fn parse_payment_liquidity(method: &str, amount: f64) -> (f64, f64) {
    let trimmed = method.trim();
    if trimmed.is_empty() {
        return (amount, 0.0);
    }

    let upper = trimmed.to_uppercase();

    // Check for Split or Partial payment string e.g.
    // "Split ($20.00 Cash + $30.00 Card)" or "Partial Credit ($50.00 Cash + $50.00 Credit)"
    // or "Partial Credit (₹4307.00 UPI + ₹4307.00 Credit)" or "Partial Credit ($40.00 Wise + $60.00 Credit)"
    if upper.starts_with("SPLIT") || upper.starts_with("PARTIAL") || upper.contains('+') {
        let mut cash_part = 0.0;
        let mut bank_part = 0.0;
        let mut has_credit_part = false;

        let inner = if let (Some(open), Some(close)) = (upper.find('('), upper.rfind(')')) {
            if open < close {
                &upper[open + 1..close]
            } else {
                upper.as_str()
            }
        } else {
            upper.as_str()
        };
        let parts: Vec<&str> = inner.split('+').collect();
        for part in &parts {
            let has_cash = part.contains("CASH");
            let has_credit = is_credit_tender_token(part);
            let has_bank = !has_cash && !has_credit && is_bank_tender(part);

            if has_credit && !has_cash {
                has_credit_part = true;
                // Unpaid credit portion contributes strictly 0 liquidity to cash/bank
                continue;
            }

            let mut num_str = String::new();
            let mut started = false;
            let mut seen_dot = false;
            for c in part.chars() {
                if c.is_ascii_digit() {
                    started = true;
                    num_str.push(c);
                } else if started && c == '.' && !seen_dot {
                    seen_dot = true;
                    num_str.push(c);
                } else if started && c == ',' {
                    continue;
                } else if started {
                    break;
                }
            }
            if let Ok(val) = num_str.parse::<f64>() {
                if has_cash {
                    cash_part += val;
                } else if has_bank {
                    bank_part += val;
                }
            }
        }

        if cash_part > 0.0 || bank_part > 0.0 {
            if has_credit_part {
                // Never let parsed front tokens exceed actual collected `amount`
                let total_parsed = cash_part + bank_part;
                if total_parsed > amount + 0.01 && total_parsed > 0.0 {
                    let ratio = amount / total_parsed;
                    cash_part = ((cash_part * ratio) * 100.0).round() / 100.0;
                    bank_part = ((amount - cash_part) * 100.0).round() / 100.0;
                }
            } else {
                if cash_part > 0.0 && bank_part == 0.0 && (amount - cash_part).abs() > 0.005 {
                    // Preserve split remainder when only cash chunk parsed in a split
                    if parts.len() > 1 {
                        bank_part = (amount - cash_part).max(0.0);
                    }
                } else if bank_part > 0.0 && cash_part == 0.0 && (amount - bank_part).abs() > 0.005 {
                    if parts.len() > 1 {
                        cash_part = (amount - bank_part).max(0.0);
                    }
                }
            }
            return (cash_part, bank_part);
        }

        if has_credit_part {
            return (0.0, 0.0);
        }
    }

    // Pure Credit sales provide strictly 0 cash and 0 bank liquidity
    if is_credit_tender_token(&upper) {
        return (0.0, 0.0);
    }

    if is_bank_tender(&upper) {
        (0.0, amount)
    } else {
        // "CASH", "Cash", "REFUND", counter retail default
        (amount, 0.0)
    }
}

pub fn calculate_liquidity_internal(conn: &rusqlite::Connection) -> Result<(f64, f64), String> {
    // Starting balances from settings
    let (opening_cash, opening_bank, capital_cash, capital_bank): (f64, f64, f64, f64) = conn
        .query_row(
            "SELECT opening_cash, opening_bank, capital_cash, capital_bank FROM settings WHERE id = 1",
            [],
            |r| Ok((
                r.get::<_, Option<f64>>(0)?.unwrap_or(0.0),
                r.get::<_, Option<f64>>(1)?.unwrap_or(0.0),
                r.get::<_, Option<f64>>(2)?.unwrap_or(0.0),
                r.get::<_, Option<f64>>(3)?.unwrap_or(0.0),
            )),
        )
        .unwrap_or((0.0, 0.0, 0.0, 0.0));

    let mut cash = opening_cash + capital_cash;
    let mut bank = opening_bank + capital_bank;

    // 1. Walk-in Invoices (exclude follow-up rows already recorded in payments table to prevent double counting)
    {
        let mut stmt = conn
            .prepare(
                "SELECT MAX(0.0, paid_amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = invoices.id), 0.0)),
                        payment_method,
                        invoice_type
                 FROM invoices
                 WHERE status NOT IN ('RETURNED', 'CANCELLED')
                   AND (party_id IS NULL OR party_id = '')",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, f64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for row in rows.flatten() {
            let (amt, method, inv_type) = row;
            if amt <= 0.005 {
                continue;
            }
            let (c, b) = parse_payment_liquidity(&method, amt);
            if inv_type == "SALE" {
                cash += c;
                bank += b;
            } else if inv_type == "PURCHASE" {
                cash -= c;
                bank -= b;
            }
        }
    }

    // 2. Customer & Vendor Payments from payments table
    {
        let mut stmt = conn
            .prepare("SELECT amount, payment_method, payment_type FROM payments")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, f64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for row in rows.flatten() {
            let (amt, method, pmt_type) = row;
            let (c, b) = parse_payment_liquidity(&method, amt);
            if pmt_type == "IN" {
                cash += c;
                bank += b;
            } else if pmt_type == "OUT" {
                cash -= c;
                bank -= b;
            }
        }
    }

    // 3. Operating Expenses (exclude mirrored EXP-SAL-% payroll rows to prevent double-counting with salary_payments)
    {
        let mut stmt = conn
            .prepare("SELECT amount, payment_method FROM expenses WHERE id NOT LIKE 'EXP-SAL-%'")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, f64>(0)?, r.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;

        for row in rows.flatten() {
            let (amt, method) = row;
            let (c, b) = parse_payment_liquidity(&method, amt);
            cash -= c;
            bank -= b;
        }
    }

    // 4. Staff Salary Disbursements
    {
        let mut stmt = conn
            .prepare("SELECT amount, payment_source FROM salary_payments")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, f64>(0)?, r.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;

        for row in rows.flatten() {
            let (amt, src) = row;
            let (c, b) = parse_payment_liquidity(&src, amt);
            cash -= c;
            bank -= b;
        }
    }

    // 5. Cash / Bank Contra Transfers
    {
        let mut stmt = conn
            .prepare("SELECT direction, amount FROM cash_bank_transfers")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?)))
            .map_err(|e| e.to_string())?;

        for row in rows.flatten() {
            let (direction, amt) = row;
            if direction == "CASH_TO_BANK" {
                cash -= amt;
                bank += amt;
            } else if direction == "BANK_TO_CASH" {
                cash += amt;
                bank -= amt;
            }
        }
    }

    // 6. Business Loan Transactions
    {
        let mut stmt = conn
            .prepare("SELECT transaction_type, account_type, amount FROM loan_transactions")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, f64>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for row in rows.flatten() {
            let (tx_type, acct_type, amt) = row;
            let is_cash = acct_type.to_uppercase().contains("CASH");
            if tx_type == "DRAWDOWN" {
                if is_cash { cash += amt; } else { bank += amt; }
            } else if tx_type == "REPAYMENT" {
                if is_cash { cash -= amt; } else { bank -= amt; }
            }
        }
    }

    // 7. Operational Cash/Bank Deposits (excluding CAPITAL which lives in settings.capital_cash / capital_bank)
    {
        let mut stmt = conn
            .prepare("SELECT cash_amount, bank_amount FROM deposits WHERE deposit_type != 'CAPITAL'")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, f64>(0)?, r.get::<_, f64>(1)?)))
            .map_err(|e| e.to_string())?;

        for (c, b) in rows.flatten() {
            cash += c;
            bank += b;
        }
    }

    let final_cash = (cash * 100.0).round() / 100.0;
    let final_bank = (bank * 100.0).round() / 100.0;
    Ok((final_cash, final_bank))
}

#[tauri::command]
pub fn get_dashboard_summary(
    state: State<'_, Mutex<AppState>>,
) -> Result<DashboardSummary, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    // 1. Total Sales (Gross Sales - Sales Returns)
    let gross_sales: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_amount), 0.0) FROM invoices WHERE invoice_type = 'SALE' AND status NOT IN ('RETURNED', 'CANCELLED')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    let sales_returns: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_amount), 0.0) FROM invoices WHERE invoice_type = 'RETURN' AND status NOT IN ('RETURNED', 'CANCELLED')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    let total_sales = ((gross_sales - sales_returns) * 100.0).round() / 100.0;

    // 2. Total Purchases (Gross Purchases - Purchase Returns)
    let gross_purchases: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_amount), 0.0) FROM invoices WHERE invoice_type = 'PURCHASE' AND status NOT IN ('RETURNED', 'CANCELLED')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    let purchase_returns: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_amount), 0.0) FROM purchase_returns",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    let total_purchases = ((gross_purchases - purchase_returns) * 100.0).round() / 100.0;

    // 3. Accounts Receivable (Customer Balances > 0)
    let total_receivables: f64 = {
        let v: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(current_balance), 0.0) FROM parties WHERE party_type = 'CUSTOMER' AND current_balance > 0",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0.0);
        (v * 100.0).round() / 100.0
    };

    // 4. Accounts Payable (Vendor Balances < 0, represented positively)
    let total_payables: f64 = {
        let v: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(ABS(current_balance)), 0.0) FROM parties WHERE party_type = 'VENDOR' AND current_balance < 0",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0.0);
        (v * 100.0).round() / 100.0
    };

    // 5. Total Expenses (Operating Expenses excluding mirrored EXP-SAL-% + Staff Salary Payments)
    let operating_expenses: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE id NOT LIKE 'EXP-SAL-%'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    let salary_expenses: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM salary_payments",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    let total_expenses = ((operating_expenses + salary_expenses) * 100.0).round() / 100.0;

    // 6. Total Stock Valuation (positive stock only)
    let total_stock_value: f64 = {
        let v: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(stock_quantity * purchase_price), 0.0) FROM items WHERE stock_quantity > 0",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0.0);
        (v * 100.0).round() / 100.0
    };

    // 7. Sales Count & Low Stock Alert
    let sales_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM invoices WHERE invoice_type = 'SALE' AND status NOT IN ('RETURNED', 'CANCELLED')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let low_stock_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM items WHERE stock_quantity <= min_stock_alert",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    // 8. Cost of Goods Sold (COGS) & Net Operating Profit
    let item_catalog_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM items", [], |r| r.get(0))
        .unwrap_or(0);
    let sold_cogs: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(
                CASE
                    WHEN inv.invoice_type = 'SALE' THEN ii.quantity * COALESCE(it.purchase_price, 0.0)
                    WHEN inv.invoice_type = 'RETURN' THEN -ii.quantity * COALESCE(it.purchase_price, 0.0)
                    ELSE 0.0
                END
             ), 0.0)
             FROM invoice_items ii
             JOIN invoices inv ON ii.invoice_id = inv.id
             LEFT JOIN items it ON ii.item_id = it.id
             WHERE inv.invoice_type IN ('SALE', 'RETURN') AND inv.status NOT IN ('RETURNED', 'CANCELLED')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);
    let cogs = if item_catalog_count == 0 {
        total_purchases
    } else {
        (sold_cogs * 100.0).round() / 100.0
    };
    let net_profit = ((total_sales - cogs - total_expenses) * 100.0).round() / 100.0;

    // 9. Fetch Opening Capital & Base Float
    let (opening_cash, opening_bank, capital_cash, capital_bank): (f64, f64, f64, f64) = conn
        .query_row(
            "SELECT opening_cash, opening_bank, capital_cash, capital_bank FROM settings WHERE id = 1",
            [],
            |r| Ok((
                r.get::<_, Option<f64>>(0)?.unwrap_or(0.0),
                r.get::<_, Option<f64>>(1)?.unwrap_or(0.0),
                r.get::<_, Option<f64>>(2)?.unwrap_or(0.0),
                r.get::<_, Option<f64>>(3)?.unwrap_or(0.0),
            )),
        )
        .unwrap_or((0.0, 0.0, 0.0, 0.0));

    // 10 & 11. Deterministic Master Liquidity Reconciliation
    let (cash_in_hand, cash_in_bank) = calculate_liquidity_internal(&conn)?;

    // Only auto-sync primary bank account when there is a single bank account (never overwrite multi-bank balances on read)
    let bank_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM bank_accounts", [], |r| r.get(0))
        .unwrap_or(0);
    if bank_count == 1 {
        let _ = conn.execute(
            "UPDATE bank_accounts SET current_balance = ?1 WHERE is_primary = 1",
            params![cash_in_bank],
        );
    }

    // 12. Active Loans Liability
    let active_loans: f64 = {
        let v: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(current_balance), 0.0) FROM business_loans WHERE status = 'ACTIVE'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0.0);
        (v * 100.0).round() / 100.0
    };

    // 13. Balance Sheet Calculations
    let total_assets = ((cash_in_hand + cash_in_bank + total_receivables + total_stock_value) * 100.0).round() / 100.0;
    let total_liabilities = ((total_payables + active_loans) * 100.0).round() / 100.0;
    let net_worth = ((total_assets - total_liabilities) * 100.0).round() / 100.0;
    let working_capital = (((cash_in_hand + cash_in_bank + total_receivables) - total_payables) * 100.0).round() / 100.0;
    let opening_balance = (((opening_cash + opening_bank)) * 100.0).round() / 100.0;
    let capital = (((capital_cash + capital_bank)) * 100.0).round() / 100.0;

    // Recent invoices
    let mut stmt = conn
        .prepare(
            "SELECT id, invoice_number, invoice_type, party_id, party_name,
                    invoice_date, due_date, subtotal, discount_amount,
                    tax_amount, total_amount, paid_amount, status,
                    payment_method, notes, created_at, reference
             FROM invoices ORDER BY created_at DESC LIMIT 6",
        )
        .map_err(|e| e.to_string())?;

    let inv_rows = stmt
        .query_map([], |row| {
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
                reference: row.get::<_, Option<String>>(16).unwrap_or(None),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut recent_invoices = Vec::new();
    for inv in inv_rows {
        if let Ok(i) = inv {
            recent_invoices.push(i);
        }
    }

    // Low stock items
    let mut stmt_items = conn
        .prepare(
            "SELECT id, name, sku, barcode, category, unit, purchase_price,
                    sale_price, stock_quantity, min_stock_alert, godown, created_at
             FROM items WHERE stock_quantity <= min_stock_alert
             ORDER BY stock_quantity ASC LIMIT 6",
        )
        .map_err(|e| e.to_string())?;

    let item_rows = stmt_items
        .query_map([], |row| {
            Ok(Item {
                id: row.get(0)?,
                name: row.get(1)?,
                sku: row.get(2)?,
                barcode: row.get(3)?,
                category: row.get(4)?,
                unit: row.get(5)?,
                purchase_price: row.get(6)?,
                sale_price: row.get(7)?,
                stock_quantity: row.get(8)?,
                min_stock_alert: row.get(9)?,
                godown: row.get(10)?,
                created_at: row.get(11)?,
                size: row.get::<_, Option<String>>(12).unwrap_or(None),
                brand: row.get::<_, Option<String>>(13).unwrap_or(None),
                tax_rate: row.get::<_, Option<f64>>(14).unwrap_or(None),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut low_stock_items = Vec::new();
    for it in item_rows {
        if let Ok(i) = it {
            low_stock_items.push(i);
        }
    }

    Ok(DashboardSummary {
        total_sales,
        total_purchases,
        cogs,
        total_receivables,
        total_payables,
        total_expenses,
        net_profit,
        total_stock_value,
        sales_count,
        low_stock_count,
        recent_invoices,
        low_stock_items,
        cash_in_hand,
        cash_in_bank,
        total_assets,
        active_loans,
        total_liabilities,
        net_worth,
        working_capital,
        opening_balance,
        opening_cash,
        opening_bank,
        capital,
        capital_cash,
        capital_bank,
    })
}

pub fn get_daybook_internal(conn: &rusqlite::Connection, date: &str) -> Result<Vec<DaybookEntry>, String> {
    let mut timed: Vec<(String, usize, DaybookEntry)> = Vec::new();
    let mut seq: usize = 0;

    let channel_label = |c: f64, b: f64| -> String {
        if c > 0.005 && b > 0.005 {
            "SPLIT".into()
        } else if b > 0.005 {
            "BANK".into()
        } else {
            "CASH".into()
        }
    };

    // Compute Cash opening balance going into `date`:
    // opening_cash + (capital_cash minus any CAPITAL deposits on or after `date`) + prior operational cash flows before `date`
    let (opening_cash, capital_cash): (f64, f64) = conn
        .query_row(
            "SELECT COALESCE(opening_cash, 0.0), COALESCE(capital_cash, 0.0) FROM settings WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0.0, 0.0));
    let capital_deposits_from_date: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(cash_amount), 0.0) FROM deposits WHERE deposit_type = 'CAPITAL' AND substr(deposit_date, 1, 10) >= ?1",
            params![date],
            |r| r.get(0),
        )
        .unwrap_or(0.0);
    let mut running_balance = opening_cash + (capital_cash - capital_deposits_from_date);

    // Prior Walk-in invoices cash flow before `date`
    {
        if let Ok(mut stmt) = conn.prepare(
            "SELECT MAX(0.0, paid_amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = invoices.id), 0.0)),
                    payment_method, invoice_type
             FROM invoices
             WHERE substr(invoice_date, 1, 10) < ?1
               AND (party_id IS NULL OR party_id = '')
               AND status NOT IN ('RETURNED', 'CANCELLED')",
        ) {
            if let Ok(rows) = stmt.query_map(params![date], |r| Ok((r.get::<_, f64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?))) {
                for (amt, m, t) in rows.flatten() {
                    if amt > 0.005 {
                        let (c, _) = parse_payment_liquidity(&m, amt);
                        if t == "PURCHASE" { running_balance -= c; } else if t == "SALE" { running_balance += c; }
                    }
                }
            }
        }
    }
    // Prior Payments cash flow before `date`
    {
        if let Ok(mut stmt) = conn.prepare("SELECT amount, payment_method, payment_type FROM payments WHERE substr(payment_date, 1, 10) < ?1") {
            if let Ok(rows) = stmt.query_map(params![date], |r| Ok((r.get::<_, f64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?))) {
                for (amt, m, t) in rows.flatten() {
                    let (c, _) = parse_payment_liquidity(&m, amt);
                    if t == "IN" { running_balance += c; } else if t == "OUT" { running_balance -= c; }
                }
            }
        }
    }
    // Prior Expenses cash flow before `date`
    {
        if let Ok(mut stmt) = conn.prepare("SELECT amount, payment_method FROM expenses WHERE substr(expense_date, 1, 10) < ?1 AND id NOT LIKE 'EXP-SAL-%'") {
            if let Ok(rows) = stmt.query_map(params![date], |r| Ok((r.get::<_, f64>(0)?, r.get::<_, String>(1)?))) {
                for (amt, m) in rows.flatten() {
                    let (c, _) = parse_payment_liquidity(&m, amt);
                    running_balance -= c;
                }
            }
        }
    }
    // Prior Salary payouts cash flow before `date`
    {
        if let Ok(mut stmt) = conn.prepare("SELECT amount, payment_source FROM salary_payments WHERE substr(payment_date, 1, 10) < ?1") {
            if let Ok(rows) = stmt.query_map(params![date], |r| Ok((r.get::<_, f64>(0)?, r.get::<_, String>(1)?))) {
                for (amt, s) in rows.flatten() {
                    let (c, _) = parse_payment_liquidity(&s, amt);
                    running_balance -= c;
                }
            }
        }
    }
    // Prior Transfers before `date`
    {
        if let Ok(mut stmt) = conn.prepare("SELECT direction, amount FROM cash_bank_transfers WHERE substr(timestamp, 1, 10) < ?1") {
            if let Ok(rows) = stmt.query_map(params![date], |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?))) {
                for (dir, amt) in rows.flatten() {
                    if dir == "CASH_TO_BANK" { running_balance -= amt; } else if dir == "BANK_TO_CASH" { running_balance += amt; }
                }
            }
        }
    }
    // Prior Loan cash transactions before `date`
    {
        if let Ok(mut stmt) = conn.prepare("SELECT transaction_type, account_type, amount FROM loan_transactions WHERE substr(timestamp, 1, 10) < ?1") {
            if let Ok(rows) = stmt.query_map(params![date], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, f64>(2)?))) {
                for (tx_t, acct, amt) in rows.flatten() {
                    if acct.to_uppercase().contains("CASH") {
                        if tx_t == "DRAWDOWN" { running_balance += amt; } else if tx_t == "REPAYMENT" { running_balance -= amt; }
                    }
                }
            }
        }
    }
    // Prior operational deposits before `date`
    {
        if let Ok(mut stmt) = conn.prepare("SELECT cash_amount FROM deposits WHERE deposit_type != 'CAPITAL' AND substr(deposit_date, 1, 10) < ?1") {
            if let Ok(rows) = stmt.query_map(params![date], |r| r.get::<_, f64>(0)) {
                for c in rows.flatten() {
                    running_balance += c;
                }
            }
        }
    }

    // 1. Walk-in POS Sales & Purchases (exclude settled follow-up payments so they are not double-counted)
    {
        let mut inv_stmt = conn
            .prepare(
                "SELECT invoice_date, invoice_number, party_name, invoice_type,
                        MAX(0.0, paid_amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = invoices.id), 0.0)),
                        payment_method, COALESCE(NULLIF(created_at, ''), invoice_date)
                 FROM invoices
                 WHERE substr(invoice_date, 1, 10) = ?1
                   AND (party_id IS NULL OR party_id = '')
                   AND paid_amount > 0.0
                   AND status NOT IN ('RETURNED', 'CANCELLED')
                 ORDER BY rowid ASC",
            )
            .map_err(|e| e.to_string())?;

        let rows = inv_stmt
            .query_map(params![date], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, f64>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for r in rows.flatten() {
            let (d, inv_num, p_name, inv_type, paid_amt, method, sort_ts) = r;
            if paid_amt <= 0.005 {
                continue;
            }
            let (c, b) = parse_payment_liquidity(&method, paid_amt);
            if c <= 0.005 && b <= 0.005 {
                continue;
            }
            let (cash_in, cash_out, bank_in, bank_out, entry_type, title) = if inv_type == "PURCHASE" {
                (0.0, c, 0.0, b, "PURCHASE".to_string(), format!("Walk-in Purchase: {}", p_name))
            } else {
                (c, 0.0, b, 0.0, "SALE".to_string(), format!("Walk-in Sale: {}", p_name))
            };
            seq += 1;
            timed.push((
                sort_ts,
                seq,
                DaybookEntry {
                    date: d,
                    reference: inv_num,
                    title,
                    entry_type,
                    cash_in,
                    cash_out,
                    bank_in,
                    bank_out,
                    payment_channel: channel_label(c, b),
                    balance: 0.0,
                },
            ));
        }
    }

    // 2. Customer & Vendor Payments in & out (including settled Walk-in follow-ups)
    {
        let mut stmt = conn
            .prepare(
                "SELECT payment_date, reference, party_name, payment_type, amount, payment_method, payment_date
                 FROM payments WHERE substr(payment_date, 1, 10) = ?1 ORDER BY rowid ASC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![date], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, f64>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for r in rows.flatten() {
            let (p_date, reference, party_name, p_type, amount, method, sort_ts) = r;
            let (c, b) = parse_payment_liquidity(&method, amount);
            if c <= 0.005 && b <= 0.005 {
                continue;
            }
            let (cash_in, cash_out, bank_in, bank_out) = if p_type == "IN" {
                (c, 0.0, b, 0.0)
            } else {
                (0.0, c, 0.0, b)
            };

            seq += 1;
            timed.push((
                sort_ts,
                seq,
                DaybookEntry {
                    date: p_date,
                    reference,
                    title: if p_type == "IN" {
                        format!("Receipt from {}", party_name)
                    } else {
                        format!("Payment to {}", party_name)
                    },
                    entry_type: if p_type == "IN" { "PAYMENT_IN".into() } else { "PAYMENT_OUT".into() },
                    cash_in,
                    cash_out,
                    bank_in,
                    bank_out,
                    payment_channel: channel_label(c, b),
                    balance: 0.0,
                },
            ));
        }
    }

    // 3. Operating Expenses (excluding mirrored EXP-SAL-% payroll entries)
    {
        let mut exp_stmt = conn
            .prepare(
                "SELECT expense_date, title, amount, payment_method, COALESCE(NULLIF(created_at, ''), expense_date)
                 FROM expenses
                 WHERE substr(expense_date, 1, 10) = ?1 AND id NOT LIKE 'EXP-SAL-%'
                 ORDER BY rowid ASC",
            )
            .map_err(|e| e.to_string())?;

        let exp_rows = exp_stmt
            .query_map(params![date], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for exp in exp_rows.flatten() {
            let (d, t, a, method, sort_ts) = exp;
            let (c, b) = parse_payment_liquidity(&method, a);
            seq += 1;
            timed.push((
                sort_ts,
                seq,
                DaybookEntry {
                    date: d,
                    reference: "EXP".into(),
                    title: format!("Expense: {}", t),
                    entry_type: "EXPENSE".into(),
                    cash_in: 0.0,
                    cash_out: c,
                    bank_in: 0.0,
                    bank_out: b,
                    payment_channel: channel_label(c, b),
                    balance: 0.0,
                },
            ));
        }
    }

    // 4. Staff Salary Disbursements
    {
        let mut sal_stmt = conn
            .prepare(
                "SELECT payment_date, voucher_number, employee_name, amount, payment_source, COALESCE(NULLIF(created_at, ''), payment_date)
                 FROM salary_payments WHERE substr(payment_date, 1, 10) = ?1 ORDER BY rowid ASC",
            )
            .map_err(|e| e.to_string())?;

        let sal_rows = sal_stmt
            .query_map(params![date], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for sal in sal_rows.flatten() {
            let (d, v_num, emp_name, amt, src, sort_ts) = sal;
            let (c, b) = parse_payment_liquidity(&src, amt);
            seq += 1;
            timed.push((
                sort_ts,
                seq,
                DaybookEntry {
                    date: d,
                    reference: v_num,
                    title: format!("Salary Payout: {}", emp_name),
                    entry_type: "SALARY".into(),
                    cash_in: 0.0,
                    cash_out: c,
                    bank_in: 0.0,
                    bank_out: b,
                    payment_channel: channel_label(c, b),
                    balance: 0.0,
                },
            ));
        }
    }

    // 5. Cash <-> Bank Contra Transfers
    {
        let mut tr_stmt = conn
            .prepare(
                "SELECT timestamp, direction, amount, notes
                 FROM cash_bank_transfers WHERE substr(timestamp, 1, 10) = ?1 ORDER BY rowid ASC",
            )
            .map_err(|e| e.to_string())?;

        let tr_rows = tr_stmt
            .query_map(params![date], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for tr in tr_rows.flatten() {
            let (ts, direction, amt, notes) = tr;
            let (cash_in, cash_out, bank_in, bank_out, label) = if direction == "CASH_TO_BANK" {
                (0.0, amt, amt, 0.0, "Cash Deposited to Bank")
            } else {
                (amt, 0.0, 0.0, amt, "Cash Withdrawn from Bank")
            };
            seq += 1;
            timed.push((
                ts.clone(),
                seq,
                DaybookEntry {
                    date: ts.chars().take(10).collect(),
                    reference: "CONTRA".into(),
                    title: if notes.trim().is_empty() { label.into() } else { format!("{}: {}", label, notes) },
                    entry_type: "TRANSFER".into(),
                    cash_in,
                    cash_out,
                    bank_in,
                    bank_out,
                    payment_channel: "SPLIT".into(),
                    balance: 0.0,
                },
            ));
        }
    }

    // 6. Business Loan Transactions (Drawdowns & Repayments)
    {
        let mut ln_stmt = conn
            .prepare(
                "SELECT timestamp, transaction_type, account_type, amount, notes
                 FROM loan_transactions WHERE substr(timestamp, 1, 10) = ?1 ORDER BY rowid ASC",
            )
            .map_err(|e| e.to_string())?;

        let ln_rows = ln_stmt
            .query_map(params![date], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for ln in ln_rows.flatten() {
            let (ts, tx_type, acct_type, amt, notes) = ln;
            let is_bank = acct_type.to_uppercase() == "BANK";
            let (cash_in, cash_out, bank_in, bank_out, entry_type) = if tx_type == "DRAWDOWN" {
                if is_bank {
                    (0.0, 0.0, amt, 0.0, "LOAN_DRAWDOWN".to_string())
                } else {
                    (amt, 0.0, 0.0, 0.0, "LOAN_DRAWDOWN".to_string())
                }
            } else if is_bank {
                (0.0, 0.0, 0.0, amt, "LOAN_REPAYMENT".to_string())
            } else {
                (0.0, amt, 0.0, 0.0, "LOAN_REPAYMENT".to_string())
            };
            seq += 1;
            timed.push((
                ts.clone(),
                seq,
                DaybookEntry {
                    date: ts.chars().take(10).collect(),
                    reference: "LOAN".into(),
                    title: if notes.trim().is_empty() { entry_type.clone() } else { notes },
                    entry_type,
                    cash_in,
                    cash_out,
                    bank_in,
                    bank_out,
                    payment_channel: if is_bank { "BANK".into() } else { "CASH".into() },
                    balance: 0.0,
                },
            ));
        }
    }

    // 7. Deposits & Capital Injections
    {
        let mut dep_stmt = conn
            .prepare(
                "SELECT id, deposit_type, cash_amount, bank_amount, notes, deposit_date, timestamp
                 FROM deposits WHERE substr(deposit_date, 1, 10) = ?1 ORDER BY rowid ASC",
            )
            .map_err(|e| e.to_string())?;

        let dep_rows = dep_stmt
            .query_map(params![date], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for (dep_id, dep_type, c_amt, b_amt, notes, d_date, ts) in dep_rows.flatten() {
            if c_amt <= 0.005 && b_amt <= 0.005 {
                continue;
            }
            let entry_type = if dep_type == "CAPITAL" {
                "CAPITAL_INJECTION".to_string()
            } else {
                "DEPOSIT".to_string()
            };
            let title = if dep_type == "CAPITAL" {
                if notes.trim().is_empty() { "Owner Capital Injection".into() } else { format!("Owner Capital: {}", notes) }
            } else if dep_type == "BANK" {
                if notes.trim().is_empty() { "Bank Deposit".into() } else { format!("Bank Deposit: {}", notes) }
            } else if notes.trim().is_empty() {
                "Cash Drawer Deposit".into()
            } else {
                format!("Cash Deposit: {}", notes)
            };
            seq += 1;
            timed.push((
                if ts.trim().is_empty() { d_date.clone() } else { ts },
                seq,
                DaybookEntry {
                    date: d_date.chars().take(10).collect(),
                    reference: dep_id,
                    title,
                    entry_type,
                    cash_in: c_amt,
                    cash_out: 0.0,
                    bank_in: b_amt,
                    bank_out: 0.0,
                    payment_channel: channel_label(c_amt, b_amt),
                    balance: 0.0,
                },
            ));
        }
    }

    timed.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));

    let mut entries = Vec::with_capacity(timed.len());
    for (_, _, mut entry) in timed {
        running_balance = ((running_balance + entry.cash_in - entry.cash_out) * 100.0).round() / 100.0;
        entry.balance = running_balance;
        entries.push(entry);
    }

    Ok(entries)
}

#[tauri::command]
pub fn get_daybook(date: String, state: State<'_, Mutex<AppState>>) -> Result<Vec<DaybookEntry>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    get_daybook_internal(&conn, &date)
}

// ----------------------------------------------------------------------------
// AUDIT LOGS & SYSTEM
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn get_audit_logs(
    limit: Option<i64>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<AuditLog>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let row_limit = limit.unwrap_or(200);

    let mut stmt = conn
        .prepare(
            "SELECT id, action, entity, entity_id, details, timestamp
             FROM audit_logs ORDER BY id DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![row_limit], |row| {
            Ok(AuditLog {
                id: row.get(0)?,
                action: row.get(1)?,
                entity: row.get(2)?,
                entity_id: row.get(3)?,
                details: row.get(4)?,
                timestamp: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut logs = Vec::new();
    for l in rows {
        logs.push(l.map_err(|e| e.to_string())?);
    }
    Ok(logs)
}

// ----------------------------------------------------------------------------
// SEEDING SIMULATED 30-DAY BUSINESS DATA
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn seed_demo_data(days: i32, state: State<'_, Mutex<AppState>>) -> Result<String, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    seed_demo_data_conn(&mut conn, days)
}

pub fn seed_demo_data_conn(conn: &mut Connection, days: i32) -> Result<String, String> {
    conn.execute_batch("PRAGMA foreign_keys = OFF;").ok();
    {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        // Clear all operational, catalog, GST, banking, payroll, and log tables cleanly in child-first FK order
        tx.execute_batch(
            "DELETE FROM gst_invoice_items;
             DELETE FROM gst_invoices;
             DELETE FROM gst_items;
             DELETE FROM gst_parties;
             DELETE FROM bill_settlements;
             DELETE FROM deposits;
             DELETE FROM cash_bank_transfers;
             DELETE FROM loan_transactions;
             DELETE FROM invoice_items;
             DELETE FROM estimate_items;
             DELETE FROM purchase_return_items;
             DELETE FROM stock_movements;
             DELETE FROM employee_attendance;
             DELETE FROM salary_payments;
             DELETE FROM payments;
             DELETE FROM expenses;
             DELETE FROM recurring_bills;
             DELETE FROM purchase_orders;
             DELETE FROM cash_closings;
             DELETE FROM estimates;
             DELETE FROM purchase_returns;
             DELETE FROM invoices;
             DELETE FROM items;
             DELETE FROM parties;
             DELETE FROM employees;
             DELETE FROM business_loans;
             DELETE FROM bank_accounts;
             DELETE FROM audit_logs;
             UPDATE settings SET
                opening_cash = 1000.0,
                opening_bank = 5000.0,
                opening_balance_mode = 'SPLIT',
                capital_cash = 0.0,
                capital_bank = 0.0,
                capital_mode = 'CASH'
             WHERE id = 1;"
        )
        .map_err(|e| e.to_string())?;

        let now_ts = Local::now().to_rfc3339();
        tx.execute(
            "INSERT INTO bank_accounts (id, account_name, bank_name, account_number, current_balance, is_primary, created_at)
             VALUES ('BANK-PRIMARY', 'Primary Operating Account', 'Commercial Bank', '0001', 5000.0, 1, ?1)",
            params![now_ts],
        )
        .map_err(|e| e.to_string())?;

        // 1. Seed Categories & Items (higher initial stock so demo sales leave positive stock)
        let items_data = vec![
            ("Ethiopian Single-Origin Coffee Beans (500g)", "BEV-001", "8901001", "Beverages", "pack", 12.0, 22.0, 120.0, 15.0, "Front Store"),
            ("Cold Brew Concentrate (1L)", "BEV-002", "8901002", "Beverages", "bottle", 8.5, 16.0, 80.0, 10.0, "Cold Storage"),
            ("Organic Matcha Green Tea Powder", "BEV-003", "8901003", "Beverages", "jar", 14.0, 26.5, 60.0, 8.0, "Front Store"),
            ("Almond Croissant (Artisan)", "BAKE-001", "8901004", "Bakery", "pcs", 1.8, 4.5, 150.0, 20.0, "Kitchen Shelf"),
            ("Sourdough Country Loaf", "BAKE-002", "8901005", "Bakery", "loaf", 3.0, 7.5, 80.0, 12.0, "Kitchen Shelf"),
            ("Dark Chocolate Espresso Truffles", "BAKE-003", "8901006", "Bakery", "box", 6.0, 12.0, 45.0, 10.0, "Front Store"),
            ("Stainless Steel Thermal Tumbler 16oz", "MERCH-001", "8901007", "Merchandise", "pcs", 9.0, 24.0, 70.0, 8.0, "Godown A"),
            ("Ceramic Minimalist Mug (Matte Charcoal)", "MERCH-002", "8901008", "Merchandise", "pcs", 5.5, 15.0, 90.0, 10.0, "Godown A"),
            ("Hand Drip Glass Carafe & Filter Set", "MERCH-003", "8901009", "Merchandise", "set", 18.0, 38.0, 50.0, 6.0, "Godown B"),
            ("Oat Milk Barista Blend (6x1L Box)", "SUP-001", "8901010", "Supplies", "box", 13.0, 21.0, 75.0, 10.0, "Cold Storage"),
            ("Eco-Friendly Takeout Coffee Cups (100pk)", "SUP-002", "8901011", "Supplies", "pack", 7.0, 14.0, 140.0, 25.0, "Godown B"),
            ("Unbleached Paper Coffee Filters (100pk)", "SUP-003", "8901012", "Supplies", "pack", 2.2, 5.0, 160.0, 30.0, "Front Store"),
        ];

        let mut item_ids = Vec::new();
        let now_date = Local::now().date_naive();

        for it in &items_data {
            let id = Uuid::new_v4().to_string();
            item_ids.push((id.clone(), it.0, it.5, it.6, it.4)); // id, name, purchase, sale, unit

            tx.execute(
                "INSERT INTO items (id, name, sku, barcode, category, unit,
                                    purchase_price, sale_price, stock_quantity,
                                    min_stock_alert, godown, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    id, it.0, it.1, it.2, it.3, it.4, it.5, it.6, it.7, it.8, it.9,
                    now_date.format("%Y-%m-%d").to_string(),
                ],
            )
            .map_err(|e| e.to_string())?;

            tx.execute(
                "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                              quantity_after, movement_type, reference_id,
                                              timestamp, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, 'OPENING', 'INITIAL_STOCK', ?6, 'Opening stock initialized')",
                params![
                    Uuid::new_v4().to_string(),
                    id,
                    it.0,
                    it.7,
                    it.7,
                    now_date.format("%Y-%m-%d").to_string(),
                ],
            )
            .ok();
        }

        // 2. Seed Parties with zero opening balance so current_balance reconciles 100% with seeded open invoices
        let parties_data = vec![
            ("Alexander Wright", "CUSTOMER", "+1 555-0121", "alex.w@gmail.com", "12 Sunset Blvd", "CUST-901", 0.0, 0.0),
            ("Sophia Lin & Co", "CUSTOMER", "+1 555-0134", "sophia@linstudio.design", "88 Design District", "CUST-902", 0.0, 0.0),
            ("Marcus Vance", "CUSTOMER", "+1 555-0145", "marcus.v@acme.org", "45 Wall Street", "CUST-903", 0.0, 0.0),
            ("Bella Terra Roasters", "VENDOR", "+1 555-0188", "orders@bellaterra.coffee", "400 Harbor Pier", "VEN-401", 0.0, 0.0),
            ("Alpine Bakery Supplies", "VENDOR", "+1 555-0192", "wholesale@alpinebakery.io", "12 Mill Road", "VEN-402", 0.0, 0.0),
            ("Nordic Packaging Ltd", "VENDOR", "+1 555-0199", "sales@nordicpack.com", "76 Industrial Way", "VEN-403", 0.0, 0.0),
        ];

        let mut customer_ids = Vec::new();
        let mut vendor_ids = Vec::new();

        for p in &parties_data {
            let id = Uuid::new_v4().to_string();
            if p.1 == "CUSTOMER" {
                customer_ids.push((id.clone(), p.0.to_string()));
            } else {
                vendor_ids.push((id.clone(), p.0.to_string()));
            }

            tx.execute(
                "INSERT INTO parties (id, name, party_type, phone, email, address,
                                     tax_number, opening_balance, current_balance, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![id, p.0, p.1, p.2, p.3, p.4, p.5, p.6, p.7, now_date.format("%Y-%m-%d").to_string()],
            )
            .map_err(|e| e.to_string())?;
        }

        // 3. Generate realistic sales, purchases, and expenses
        let payment_methods = ["CASH", "CARD", "TRANSFER", "UPI"];
        let num_days = if days <= 0 { 30 } else { days };
        let mut inv_counter = 1;

        for d in (0..num_days).rev() {
            let current_day = now_date - chrono::Duration::days(d as i64);
            let date_str = current_day.format("%Y-%m-%d").to_string();

            // Periodic vendor purchases (every 8 days)
            if d % 8 == 0 {
                let ven = &vendor_ids[(d as usize / 8) % vendor_ids.len()];
                let pur_num = format!("PUR-{:04}", (d / 8) + 1);
                let pur_id = Uuid::new_v4().to_string();

                let it1 = &item_ids[0];
                let it2 = &item_ids[9];
                let qty1 = 10.0;
                let qty2 = 15.0;
                let cost1 = it1.2;
                let cost2 = it2.2;
                let line_tot1 = qty1 * cost1;
                let line_tot2 = qty2 * cost2;
                let pur_subtotal = line_tot1 + line_tot2;
                let leave_open_vendor = d == 0;
                let pur_paid = if leave_open_vendor { 0.0 } else { pur_subtotal };
                let pur_status = if leave_open_vendor { "UNPAID" } else { "PAID" };
                let pur_method = if leave_open_vendor { "Credit" } else { "TRANSFER" };

                tx.execute(
                    "INSERT INTO invoices (id, invoice_number, invoice_type, party_id,
                                          party_name, invoice_date, due_date, subtotal,
                                          discount_amount, tax_amount, total_amount, paid_amount,
                                          status, payment_method, notes, created_at)
                     VALUES (?1, ?2, 'PURCHASE', ?3, ?4, ?5, ?5, ?6, 0.0, 0.0, ?6, ?7, ?8, ?9, 'Restocking order', ?10)",
                    params![
                        pur_id, pur_num, ven.0, ven.1, date_str, pur_subtotal, pur_paid, pur_status, pur_method,
                        format!("{}T09:00:00", date_str),
                    ],
                )
                .ok();

                for (it, qty, cost, line_tot) in [(it1, qty1, cost1, line_tot1), (it2, qty2, cost2, line_tot2)] {
                    tx.execute(
                        "INSERT INTO invoice_items (id, invoice_id, item_id, item_name, quantity, unit, unit_price, discount_percent, tax_rate, line_total)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0.0, 0.0, ?8)",
                        params![Uuid::new_v4().to_string(), pur_id, it.0, it.1, qty, it.4, cost, line_tot],
                    )
                    .ok();

                    tx.execute("UPDATE items SET stock_quantity = stock_quantity + ?1 WHERE id = ?2", params![qty, it.0]).ok();
                    let cur_s: f64 = tx.query_row("SELECT stock_quantity FROM items WHERE id = ?1", params![it.0], |r| r.get(0)).unwrap_or(0.0);
                    tx.execute(
                        "INSERT INTO stock_movements (id, item_id, item_name, change_quantity, quantity_after, movement_type, reference_id, timestamp, notes)
                         VALUES (?1, ?2, ?3, ?4, ?5, 'PURCHASE', ?6, ?7, 'Restocking order')",
                        params![Uuid::new_v4().to_string(), it.0, it.1, qty, cur_s, pur_num, date_str],
                    )
                    .ok();
                }

                if pur_paid > 0.0 {
                    tx.execute(
                        "INSERT INTO payments (id, invoice_id, party_id, party_name, amount, payment_type, payment_method, payment_date, reference, notes)
                         VALUES (?1, ?2, ?3, ?4, ?5, 'OUT', 'TRANSFER', ?6, ?7, 'Supplier bill settled')",
                        params![Uuid::new_v4().to_string(), pur_id, ven.0, ven.1, pur_paid, date_str, pur_num],
                    )
                    .ok();
                } else {
                    tx.execute(
                        "UPDATE parties SET current_balance = current_balance - ?1 WHERE id = ?2",
                        params![pur_subtotal, ven.0],
                    )
                    .ok();
                }
            }

            // 2 to 4 sales per day
            let sales_today = 2 + (d % 3);
            for s in 0..sales_today {
                let inv_id = Uuid::new_v4().to_string();
                let inv_num = format!("INV-{:05}", inv_counter);
                inv_counter += 1;

                let cust = &customer_ids[(s as usize + d as usize) % customer_ids.len()];
                let pay_method = payment_methods[(s as usize + d as usize) % payment_methods.len()];

                let mut subtotal = 0.0;
                let mut line_items = Vec::new();
                let item_count = 1 + ((s + d) % 3);

                for i in 0..item_count {
                    let it_idx = (s as usize + d as usize * 2 + i as usize) % item_ids.len();
                    let it = &item_ids[it_idx];
                    let qty = 1.0 + ((s + i) % 3) as f64;
                    let price = it.3;
                    let line_tot = qty * price;
                    subtotal += line_tot;

                    line_items.push((it.0.clone(), it.1, qty, it.4, price, line_tot));
                }

                let tax = (subtotal * 0.05 * 100.0).round() / 100.0;
                let total = ((subtotal + tax) * 100.0).round() / 100.0;
                let is_unpaid = (s == 0) && (d < 5);
                let paid = if is_unpaid { (total * 0.5 * 100.0).round() / 100.0 } else { total };
                let status = if paid >= total - 0.01 { "PAID" } else { "PARTIAL" };

                tx.execute(
                    "INSERT INTO invoices (id, invoice_number, invoice_type, party_id,
                                          party_name, invoice_date, due_date, subtotal,
                                          discount_amount, tax_amount, total_amount, paid_amount,
                                          status, payment_method, notes, created_at)
                     VALUES (?1, ?2, 'SALE', ?3, ?4, ?5, ?5, ?6, 0.0, ?7, ?8, ?9, ?10, ?11, 'Counter sale', ?12)",
                    params![
                        inv_id, inv_num, cust.0, cust.1, date_str, subtotal, tax, total, paid, status, pay_method,
                        format!("{}T14:30:00", date_str),
                    ],
                )
                .map_err(|e| e.to_string())?;

                for li in line_items {
                    tx.execute(
                        "INSERT INTO invoice_items (id, invoice_id, item_id, item_name,
                                                    quantity, unit, unit_price, discount_percent,
                                                    tax_rate, line_total)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0.0, 5.0, ?8)",
                        params![
                            Uuid::new_v4().to_string(), inv_id, li.0, li.1, li.2, li.3, li.4, li.5,
                        ],
                    )
                    .map_err(|e| e.to_string())?;

                    tx.execute("UPDATE items SET stock_quantity = MAX(0.0, stock_quantity - ?1) WHERE id = ?2", params![li.2, li.0]).ok();
                    let cur_s: f64 = tx.query_row("SELECT stock_quantity FROM items WHERE id = ?1", params![li.0], |r| r.get(0)).unwrap_or(0.0);
                    tx.execute(
                        "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                                      quantity_after, movement_type, reference_id,
                                                      timestamp, notes)
                         VALUES (?1, ?2, ?3, ?4, ?5, 'SALE', ?6, ?7, 'Counter POS Sale')",
                        params![
                            Uuid::new_v4().to_string(), li.0, li.1, -li.2, cur_s, inv_num, date_str,
                        ],
                    )
                    .ok();
                }

                if paid > 0.0 {
                    tx.execute(
                        "INSERT INTO payments (id, invoice_id, party_id, party_name,
                                              amount, payment_type, payment_method,
                                              payment_date, reference, notes)
                         VALUES (?1, ?2, ?3, ?4, ?5, 'IN', ?6, ?7, ?8, 'Sale settled')",
                        params![
                            Uuid::new_v4().to_string(), inv_id, cust.0, cust.1, paid, pay_method, date_str, inv_num,
                        ],
                    )
                    .map_err(|e| e.to_string())?;
                }

                let unpaid = total - paid;
                if unpaid > 0.01 {
                    tx.execute(
                        "UPDATE parties SET current_balance = current_balance + ?1 WHERE id = ?2",
                        params![unpaid, cust.0],
                    )
                    .ok();
                }
            }

            if d % 2 == 0 {
                let exp_cats = [
                    ("Utility: Electric & Water", "Utilities & Electricity", 180.0),
                    ("High Speed Fiber Internet", "Software & Subscriptions", 65.0),
                    ("Store Cleaning & Sanitation Supplies", "Repairs & Maintenance", 42.0),
                    ("Social Media & Local Flyer Promotion", "Marketing & Advertising", 50.0),
                    ("Takeout Cups & Bio Packaging Restock", "Packaging & Supplies", 85.0),
                    ("Courier & Logistics Delivery Fee", "Inventory & Logistics", 28.0),
                    ("Staff Weekly Shift Allowance", "Salaries & Wages", 250.0),
                    ("Petty Cash: Cafe Milk & Fresh Citrus", "Miscellaneous", 22.5),
                ];
                let exp = &exp_cats[(d as usize / 2) % exp_cats.len()];
                tx.execute(
                    "INSERT INTO expenses (id, title, category, amount, expense_date, payment_method, notes)
                     VALUES (?1, ?2, ?3, ?4, ?5, 'Cash', 'Operating store expenditure')",
                    params![Uuid::new_v4().to_string(), exp.0, exp.1, exp.2, date_str],
                )
                .ok();
            }
        }

        DatabaseManager::log_audit(
            &tx,
            "SEED",
            "SYSTEM",
            "DEMO",
            &format!("Generated {} days of commercial business data", num_days),
        )
        .ok();

        tx.commit().map_err(|e| e.to_string())?;
    }

    let _ = conn.execute_batch("PRAGMA foreign_keys = ON;");
    if let Ok((_, bank_bal)) = calculate_liquidity_internal(conn) {
        let _ = conn.execute(
            "UPDATE bank_accounts SET current_balance = ?1 WHERE is_primary = 1",
            params![bank_bal],
        );
    }

    let num_days = if days <= 0 { 30 } else { days };
    Ok(format!("Successfully generated {} days of business records.", num_days))
}

#[tauri::command]
pub fn clear_all_data(state: State<'_, Mutex<AppState>>) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let now = Local::now().to_rfc3339();

    conn.execute_batch(
        "PRAGMA foreign_keys = OFF;
         DELETE FROM gst_invoice_items;
         DELETE FROM gst_invoices;
         DELETE FROM gst_items;
         DELETE FROM gst_parties;
         DELETE FROM bill_settlements;
         DELETE FROM deposits;
         DELETE FROM cash_bank_transfers;
         DELETE FROM loan_transactions;
         DELETE FROM invoice_items;
         DELETE FROM estimate_items;
         DELETE FROM purchase_return_items;
         DELETE FROM stock_movements;
         DELETE FROM employee_attendance;
         DELETE FROM salary_payments;
         DELETE FROM payments;
         DELETE FROM expenses;
         DELETE FROM recurring_bills;
         DELETE FROM purchase_orders;
         DELETE FROM cash_closings;
         DELETE FROM estimates;
         DELETE FROM purchase_returns;
         DELETE FROM invoices;
         DELETE FROM items;
         DELETE FROM parties;
         DELETE FROM employees;
         DELETE FROM business_loans;
         DELETE FROM bank_accounts;
         DELETE FROM audit_logs;
         UPDATE settings SET
            opening_cash = 0.0,
            opening_bank = 0.0,
            opening_balance_mode = 'CASH',
            capital_cash = 0.0,
            capital_bank = 0.0,
            capital_mode = 'CASH'
         WHERE id = 1;
         PRAGMA foreign_keys = ON;"
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO bank_accounts (id, account_name, bank_name, account_number, current_balance, is_primary, created_at)
         VALUES ('BANK-PRIMARY', 'Primary Operating Account', 'Commercial Bank', '0001', 0.0, 1, ?1)",
        params![now],
    )
    .ok();

    DatabaseManager::log_audit(
        &conn,
        "RESET",
        "DATABASE",
        "ALL",
        "Purged all operational, payroll, banking, and opening liquidity records",
    )
    .ok();

    Ok(true)
}

// ----------------------------------------------------------------------------
// SAFE BACKUP & VAULT ENGINE
// ----------------------------------------------------------------------------

pub fn rotate_backups(dir: &std::path::Path, max_keep: usize) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        let mut backups: Vec<(std::path::PathBuf, std::time::SystemTime)> = Vec::new();
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("db") {
                if let Ok(meta) = path.metadata() {
                    if let Ok(modified) = meta.modified() {
                        backups.push((path, modified));
                    }
                }
            }
        }

        // Sort newest first
        backups.sort_by(|a, b| b.1.cmp(&a.1));

        // Delete older ones beyond max_keep
        if backups.len() > max_keep {
            for (p, _) in &backups[max_keep..] {
                let _ = std::fs::remove_file(p);
            }
        }
    }
}

pub fn create_database_backup_internal(conn: &Connection) -> Result<String, String> {
    let (backup_dir, vault_dir) = get_backups_storage_dir();

    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&vault_dir).map_err(|e| e.to_string())?;

    let rand_suffix = &uuid::Uuid::new_v4().to_string()[..8];
    let now_str = Local::now().format("%Y%m%d_%H%M%S_%3f").to_string();
    let filename = format!("lynterminal_backup_{}_{}.db", now_str, rand_suffix);
    let target_path = backup_dir.join(&filename);
    let vault_path = vault_dir.join(&filename);

    if target_path.exists() {
        let _ = std::fs::remove_file(&target_path);
    }
    if vault_path.exists() {
        let _ = std::fs::remove_file(&vault_path);
    }

    let safe_target_path = target_path.to_string_lossy().replace('\\', "/").replace('\'', "''");
    let sql = format!("VACUUM INTO '{}'", safe_target_path);
    conn.execute_batch(&sql).map_err(|e| format!("VACUUM INTO error: {}", e))?;

    let _ = std::fs::copy(&target_path, &vault_path);

    rotate_backups(&backup_dir, 10);
    rotate_backups(&vault_dir, 10);

    Ok(target_path.to_string_lossy().to_string())
}

pub fn create_pre_update_backup_internal(conn: &Connection, version: &str) -> Result<String, String> {
    let (backup_dir, vault_dir) = get_backups_storage_dir();

    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&vault_dir).map_err(|e| e.to_string())?;

    let rand_suffix = &uuid::Uuid::new_v4().to_string()[..8];
    let v_clean = version.trim_start_matches('v').trim_end_matches('v');
    let now_str = Local::now().format("%Y%m%d_%H%M%S_%3f").to_string();
    let filename = format!("lynterminal_preupdate_v{}_{}_{}.db", v_clean, now_str, rand_suffix);
    let target_path = backup_dir.join(&filename);
    let vault_path = vault_dir.join(&filename);

    if target_path.exists() {
        let _ = std::fs::remove_file(&target_path);
    }
    if vault_path.exists() {
        let _ = std::fs::remove_file(&vault_path);
    }

    let safe_target_path = target_path.to_string_lossy().replace('\\', "/").replace('\'', "''");
    let sql = format!("VACUUM INTO '{}'", safe_target_path);
    conn.execute_batch(&sql).map_err(|e| format!("VACUUM INTO error: {}", e))?;

    let _ = std::fs::copy(&target_path, &vault_path);

    rotate_backups(&backup_dir, 10);
    rotate_backups(&vault_dir, 10);

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_database_backup(state: State<'_, Mutex<AppState>>) -> Result<String, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    create_database_backup_internal(&conn)
}

#[tauri::command]
pub fn list_database_backups() -> Result<Vec<BackupInfo>, String> {
    let (backup_dir, _) = get_backups_storage_dir();

    let mut result = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&backup_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("db") {
                if let Ok(meta) = path.metadata() {
                    let size_bytes = meta.len();
                    let created_at = meta.modified()
                        .map(|t| {
                            let dt: chrono::DateTime<Local> = t.into();
                            dt.format("%Y-%m-%d %H:%M:%S").to_string()
                        })
                        .unwrap_or_else(|_| "Unknown".into());

                    let filename = path.file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();

                    result.push(BackupInfo {
                        filename,
                        filepath: path.to_string_lossy().to_string(),
                        size_bytes,
                        created_at,
                    });
                }
            }
        }
    }

    result.sort_by(|a, b| b.filename.cmp(&a.filename));
    Ok(result)
}

#[tauri::command]
pub fn restore_database_backup(
    backup_path: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let source = std::path::Path::new(&backup_path);
    if !source.exists() {
        return Err("Selected backup file does not exist".into());
    }

    // 1. Validate backup file & core tables BEFORE creating safety backup or modifying live data
    let restore_conn = Connection::open(source).map_err(|e| format!("Failed to open backup file: {}", e))?;
    let required_tables = ["settings", "invoices", "items", "parties"];
    for tbl in required_tables {
        let exists: bool = restore_conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = ?1",
                params![tbl],
                |r| r.get(0),
            )
            .unwrap_or(false);
        if !exists {
            return Err(format!("Invalid or corrupted backup: missing core table '{}'", tbl));
        }
    }

    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    // Create safety backup of current state before restore
    create_database_backup_internal(&conn)
        .map_err(|e| format!("Could not create safety snapshot before restore: {}", e))?;

    conn.execute_batch("PRAGMA foreign_keys = OFF;")
        .map_err(|e| e.to_string())?;

    let restore_res: Result<(), String> = (|| {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        tx.execute_batch(
            "DELETE FROM gst_invoice_items;
             DELETE FROM gst_invoices;
             DELETE FROM gst_items;
             DELETE FROM gst_parties;
             DELETE FROM gst_settings;
             DELETE FROM bill_settlements;
             DELETE FROM deposits;
             DELETE FROM cash_bank_transfers;
             DELETE FROM loan_transactions;
             DELETE FROM invoice_items;
             DELETE FROM estimate_items;
             DELETE FROM purchase_return_items;
             DELETE FROM stock_movements;
             DELETE FROM employee_attendance;
             DELETE FROM salary_payments;
             DELETE FROM payments;
             DELETE FROM expenses;
             DELETE FROM recurring_bills;
             DELETE FROM purchase_orders;
             DELETE FROM cash_closings;
             DELETE FROM estimates;
             DELETE FROM purchase_returns;
             DELETE FROM invoices;
             DELETE FROM items;
             DELETE FROM parties;
             DELETE FROM bank_accounts;
             DELETE FROM business_loans;
             DELETE FROM employees;
             DELETE FROM settings;"
        )
        .map_err(|e| e.to_string())?;

        let tables = [
            "settings",
            "gst_settings",
            "parties",
            "gst_parties",
            "items",
            "gst_items",
            "invoices",
            "invoice_items",
            "gst_invoices",
            "gst_invoice_items",
            "payments",
            "bill_settlements",
            "deposits",
            "expenses",
            "stock_movements",
            "bank_accounts",
            "cash_bank_transfers",
            "business_loans",
            "loan_transactions",
            "recurring_bills",
            "employees",
            "employee_attendance",
            "salary_payments",
            "estimates",
            "estimate_items",
            "purchase_returns",
            "purchase_return_items",
            "cash_closings",
            "purchase_orders",
        ];
        for table in tables {
            let exists_in_src: bool = restore_conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = ?1",
                    params![table],
                    |r| r.get(0),
                )
                .unwrap_or(false);
            if !exists_in_src {
                continue;
            }

            let sql = format!("SELECT * FROM {}", table);
            let mut stmt = restore_conn.prepare(&sql).map_err(|e| format!("Backup read failed on {}: {}", table, e))?;
            let col_count = stmt.column_count();
            let col_names: Vec<String> = stmt.column_names().into_iter().map(|s| s.to_string()).collect();

            // Intersect columns supported by target schema so older backups restore cleanly
            let mut target_cols = std::collections::HashSet::new();
            {
                let mut pragma_stmt = tx
                    .prepare(&format!("PRAGMA table_info({})", table))
                    .map_err(|e| e.to_string())?;
                if let Ok(rows) = pragma_stmt.query_map([], |r| r.get::<_, String>(1)) {
                    for c in rows.flatten() {
                        target_cols.insert(c);
                    }
                }
            }
            let valid_indices: Vec<(usize, String)> = col_names
                .into_iter()
                .enumerate()
                .filter(|(_, name)| target_cols.contains(name))
                .collect();
            if valid_indices.is_empty() {
                continue;
            }

            let placeholders = vec!["?"; valid_indices.len()].join(", ");
            let insert_cols: Vec<String> = valid_indices.iter().map(|(_, n)| n.clone()).collect();
            let insert_sql = format!(
                "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
                table,
                insert_cols.join(", "),
                placeholders
            );

            let mut insert_stmt = tx.prepare(&insert_sql).map_err(|e| format!("Target prepare failed on {}: {}", table, e))?;
            let mut rows = stmt.query([]).map_err(|e| format!("Backup query failed on {}: {}", table, e))?;
            while let Some(row) = rows.next().map_err(|e| format!("Backup row failed on {}: {}", table, e))? {
                let mut vals: Vec<rusqlite::types::Value> = Vec::with_capacity(valid_indices.len());
                for (i, _) in &valid_indices {
                    if *i < col_count {
                        vals.push(row.get(*i).map_err(|e| e.to_string())?);
                    }
                }
                let params_ref: Vec<&dyn rusqlite::ToSql> = vals.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
                insert_stmt
                    .execute(&params_ref[..])
                    .map_err(|e| format!("Failed restoring row into {}: {}", table, e))?;
            }
        }

        DatabaseManager::log_audit(
            &tx,
            "RESTORE",
            "DATABASE",
            &backup_path,
            "Restored database snapshot",
        )
        .ok();

        tx.commit().map_err(|e| format!("Failed committing database restore: {}", e))?;
        Ok(())
    })();

    let _ = conn.execute_batch("PRAGMA foreign_keys = ON;");
    restore_res?;
    Ok(true)
}

// ----------------------------------------------------------------------------
// QUICK PRODUCT CREATION IN POS
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn quick_create_product(
    payload: QuickProductPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<Item, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();

    let raw_prefix = payload.category.chars().filter(|c| c.is_ascii_alphanumeric()).take(3).collect::<String>().to_uppercase();
    let sku_prefix = format!("{}-", if raw_prefix.is_empty() { "GEN" } else { &raw_prefix });
    let next_sku_n = next_sequence_number(&conn, "items", "sku", &sku_prefix);
    let sku = format!("{}{:03}", sku_prefix, next_sku_n);
    let next_bc_n = next_sequence_number(&conn, "items", "barcode", "890").max(100);
    let barcode = payload
        .barcode
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("890{:09}", next_bc_n));

    let purchase_price = payload.purchase_price.unwrap_or(0.0);
    let unit = if payload.unit.trim().is_empty() { "pcs".to_string() } else { payload.unit };

    conn.execute(
        "INSERT INTO items (id, name, sku, barcode, category, unit,
                            purchase_price, sale_price, stock_quantity,
                            min_stock_alert, godown, created_at,
                            size, brand, tax_rate)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            id,
            payload.name,
            sku,
            barcode,
            payload.category,
            unit,
            purchase_price,
            payload.sale_price,
            payload.stock_quantity,
            5.0,
            "Main Store",
            now,
            payload.size,
            payload.brand,
            payload.tax_rate,
        ],
    )
    .map_err(|e| e.to_string())?;

    if payload.stock_quantity > 0.0 {
        conn.execute(
            "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                          quantity_after, movement_type, reference_id,
                                          timestamp, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                Uuid::new_v4().to_string(),
                id,
                payload.name,
                payload.stock_quantity,
                payload.stock_quantity,
                "QUICK_ADD",
                sku,
                now,
                "Quick product added from POS counter",
            ],
        )
        .ok();
    }

    DatabaseManager::log_audit(
        &conn,
        "QUICK_ADD",
        "ITEM",
        &id,
        &format!("Quick product '{}' created from POS", payload.name),
    )
    .ok();

    Ok(Item {
        id,
        name: payload.name,
        sku,
        barcode,
        category: payload.category,
        unit,
        purchase_price,
        sale_price: payload.sale_price,
        stock_quantity: payload.stock_quantity,
        min_stock_alert: 5.0,
        godown: "Main Store".into(),
        created_at: now,
        size: payload.size,
        brand: payload.brand,
        tax_rate: payload.tax_rate,
    })
}

// ----------------------------------------------------------------------------
// INVOICE RETURN & VOID RESTOCK LOGIC
// ----------------------------------------------------------------------------

pub fn void_or_delete_invoice_internal(
    conn: &mut rusqlite::Connection,
    invoice_id: String,
    action: String, // "RETURN" | "CANCEL"
    reason: String,
) -> Result<bool, String> {
    let now = Local::now().to_rfc3339();
    let today = Local::now().format("%Y-%m-%d").to_string();

    {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        let (invoice_number, invoice_type, party_id, party_name, total_amount, paid_amount, payment_method, inv_status): (
            String,
            String,
            Option<String>,
            String,
            f64,
            f64,
            String,
            String,
        ) = tx
            .query_row(
                "SELECT invoice_number, invoice_type, party_id, party_name, total_amount, paid_amount, payment_method, status
                 FROM invoices WHERE id = ?1",
                params![invoice_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?, r.get(7)?)),
            )
            .map_err(|e| format!("Invoice not found: {}", e))?;

        if inv_status == "RETURNED" || inv_status == "CANCELLED" {
            return Err(format!("Invoice #{} is already {}", invoice_number, inv_status));
        }
        if invoice_type == "RETURN" {
            return Err(format!("Credit/Return document #{} cannot be voided or returned again.", invoice_number));
        }

        let items: Vec<(Option<String>, String, f64)> = {
            let mut stmt = tx
                .prepare("SELECT item_id, item_name, quantity FROM invoice_items WHERE invoice_id = ?1")
                .map_err(|e| e.to_string())?;

            let mapped = stmt.query_map(params![invoice_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
                .map_err(|e| e.to_string())?
                .filter_map(Result::ok)
                .collect();
            mapped
        };

        // 1. Reverse stock movements!
        for (item_id_opt, item_name, qty) in &items {
            if let Some(it_id) = item_id_opt.as_ref() {
                if invoice_type == "SALE" {
                    tx.execute(
                        "UPDATE items SET stock_quantity = stock_quantity + ?1 WHERE id = ?2",
                        params![qty, it_id],
                    ).ok();

                    let current: f64 = tx
                        .query_row("SELECT stock_quantity FROM items WHERE id = ?1", params![it_id], |r| r.get(0))
                        .unwrap_or(0.0);

                    let mov_type = if action == "RETURN" { "SALES_RETURN" } else { "CANCEL_RESTOCK" };
                    tx.execute(
                        "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                                      quantity_after, movement_type, reference_id,
                                                      timestamp, notes)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                        params![
                            Uuid::new_v4().to_string(),
                            it_id,
                            item_name,
                            qty,
                            current,
                            mov_type,
                            invoice_number,
                            now,
                            format!("{}: Invoice #{} ({})", mov_type, invoice_number, reason),
                        ],
                    ).ok();
                } else if invoice_type == "PURCHASE" || invoice_type == "RETURN" {
                    tx.execute(
                        "UPDATE items SET stock_quantity = stock_quantity - ?1 WHERE id = ?2",
                        params![qty, it_id],
                    ).ok();

                    let current: f64 = tx
                        .query_row("SELECT stock_quantity FROM items WHERE id = ?1", params![it_id], |r| r.get(0))
                        .unwrap_or(0.0);

                    let mov_type = if action == "RETURN" { "PURCHASE_RETURN" } else { "CANCEL_REVERT" };
                    tx.execute(
                        "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                                      quantity_after, movement_type, reference_id,
                                                      timestamp, notes)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                        params![
                            Uuid::new_v4().to_string(),
                            it_id,
                            item_name,
                            -qty,
                            current,
                            mov_type,
                            invoice_number,
                            now,
                            format!("{}: Invoice #{} ({})", mov_type, invoice_number, reason),
                        ],
                    ).ok();
                }
            }
        }

        // 2. Adjust customer/vendor ledger & payments/bank balances
        if action == "RETURN" {
            let unpaid = total_amount - paid_amount;
            if let Some(p_id) = party_id.as_ref() {
                if unpaid.abs() > 0.0001 {
                    if invoice_type == "SALE" {
                        tx.execute(
                            "UPDATE parties SET current_balance = current_balance - ?1 WHERE id = ?2",
                            params![unpaid, p_id],
                        ).ok();
                    } else if invoice_type == "PURCHASE" {
                        tx.execute(
                            "UPDATE parties SET current_balance = current_balance + ?1 WHERE id = ?2",
                            params![unpaid, p_id],
                        ).ok();
                    }
                }
            }

            if paid_amount > 0.0 {
                // Collect every payment chunk linked to this invoice (direct invoice payments + bill_settlements allocations)
                // so multi-tender refunds (e.g. partial Cash + partial UPI) reverse the exact channels & bank accounts.
                let mut refund_chunks: Vec<(f64, String, Option<String>, bool)> = Vec::new();
                {
                    let mut d_stmt = tx
                        .prepare(
                            "SELECT amount, payment_method, COALESCE(bank_account_id, '')
                             FROM payments WHERE invoice_id = ?1 ORDER BY rowid ASC",
                        )
                        .map_err(|e| e.to_string())?;
                    let d_rows = d_stmt
                        .query_map(params![invoice_id], |r| {
                            let amt: f64 = r.get(0)?;
                            let m: String = r.get(1)?;
                            let b: String = r.get(2)?;
                            Ok((amt, m, if b.is_empty() { None } else { Some(b) }, true))
                        })
                        .map_err(|e| e.to_string())?;
                    for row in d_rows.flatten() {
                        refund_chunks.push(row);
                    }
                }
                {
                    let mut s_stmt = tx
                        .prepare(
                            "SELECT bs.settled_amount, p.payment_method, COALESCE(p.bank_account_id, '')
                             FROM bill_settlements bs
                             JOIN payments p ON p.id = bs.payment_id
                             WHERE bs.invoice_id = ?1 AND (p.invoice_id IS NULL OR p.invoice_id != ?1)
                             ORDER BY bs.rowid ASC",
                        )
                        .map_err(|e| e.to_string())?;
                    let s_rows = s_stmt
                        .query_map(params![invoice_id], |r| {
                            let amt: f64 = r.get(0)?;
                            let m: String = r.get(1)?;
                            let b: String = r.get(2)?;
                            Ok((amt, m, if b.is_empty() { None } else { Some(b) }, true))
                        })
                        .map_err(|e| e.to_string())?;
                    for row in s_rows.flatten() {
                        refund_chunks.push(row);
                    }
                }

                let mut remaining_to_refund = paid_amount;
                let mut actual_chunks: Vec<(f64, String, Option<String>, bool)> = Vec::new();
                for (amt, method, bid, from_payments) in refund_chunks {
                    if remaining_to_refund <= 0.005 {
                        break;
                    }
                    let take = amt.min(remaining_to_refund);
                    if take > 0.005 {
                        actual_chunks.push((take, method, bid, from_payments));
                        remaining_to_refund -= take;
                    }
                }
                if remaining_to_refund > 0.005 {
                    let upper_pm = payment_method.to_uppercase();
                    let is_pure_credit = (upper_pm.contains("CREDIT") && !upper_pm.contains("CREDIT CARD"))
                        || upper_pm.contains("UDHAAR")
                        || upper_pm.contains("UDHAR");
                    let fallback_method = if is_pure_credit { "CASH".into() } else { payment_method.clone() };
                    actual_chunks.push((remaining_to_refund, fallback_method, None, false));
                }

                for (chunk_amt, refund_method, refund_bank_id, from_payments) in actual_chunks {
                    let (_, bank_part) = parse_payment_liquidity(&refund_method, chunk_amt);
                    if bank_part > 0.0 {
                        let bank_delta = if invoice_type == "PURCHASE" { bank_part } else { -bank_part };
                        if let Some(ref bid) = refund_bank_id {
                            tx.execute(
                                "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE id = ?2",
                                params![bank_delta, bid],
                            ).ok();
                        } else {
                            tx.execute(
                                "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                                params![bank_delta],
                            ).ok();
                        }
                    }

                    // For registered parties OR Walk-in chunks that came from `payments` rows, insert countervailing refund row(s)
                    // so Step 2 of calculate_liquidity_internal cancels out cleanly.
                    // (Initial POS Walk-in front tenders are excluded automatically once status = 'RETURNED'.)
                    if party_id.is_some() || from_payments {
                        let refund_type = if invoice_type == "PURCHASE" { "IN" } else { "OUT" };
                        tx.execute(
                            "INSERT INTO payments (id, invoice_id, party_id, party_name, amount,
                                                  payment_type, payment_method, payment_date, reference, notes, bank_account_id)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'Refund for Return', ?10)",
                            params![
                                Uuid::new_v4().to_string(),
                                invoice_id,
                                party_id.as_deref(),
                                party_name,
                                chunk_amt,
                                refund_type,
                                refund_method,
                                today,
                                invoice_number,
                                refund_bank_id.as_deref().unwrap_or(""),
                            ],
                        ).ok();
                    }
                }
            }

            tx.execute("DELETE FROM bill_settlements WHERE invoice_id = ?1", params![invoice_id]).ok();
            tx.execute(
                "UPDATE invoices SET status = 'RETURNED', paid_amount = 0.0, notes = notes || ?1 WHERE id = ?2",
                params![format!(" [RETURN: {}]", reason), invoice_id],
            ).map_err(|e| e.to_string())?;

            DatabaseManager::log_audit(
                &tx,
                "SALES_RETURN",
                "INVOICE",
                &invoice_id,
                &format!("Return for #{} - Restocked items. Reason: {}", invoice_number, reason),
            ).ok();
        } else {
            // CANCEL / Permanent Delete:
            // First reverse unpaid portion on party ledger
            if let Some(p_id) = party_id.as_ref() {
                let unpaid = total_amount - paid_amount;
                if unpaid.abs() > 0.0001 {
                    if invoice_type == "SALE" {
                        tx.execute(
                            "UPDATE parties SET current_balance = current_balance - ?1 WHERE id = ?2",
                            params![unpaid, p_id],
                        ).ok();
                    } else if invoice_type == "PURCHASE" || invoice_type == "RETURN" {
                        tx.execute(
                            "UPDATE parties SET current_balance = current_balance + ?1 WHERE id = ?2",
                            params![unpaid, p_id],
                        ).ok();
                    }
                }
            }

            // Reverse any parent payments linked via bill_settlements (including settle_bill_by_bill)
            let settlements: Vec<(String, f64)> = {
                let mut stmt = tx
                    .prepare("SELECT payment_id, settled_amount FROM bill_settlements WHERE invoice_id = ?1 AND payment_id IS NOT NULL")
                    .map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map(params![invoice_id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?)))
                    .map_err(|e| e.to_string())?
                    .filter_map(Result::ok)
                    .collect();
                rows
            };

            for (pay_id, settled_amt) in settlements {
                if let Ok((pay_amt, pay_inv_id, pay_type, pay_method, pay_bank_id)) = tx.query_row(
                    "SELECT amount, invoice_id, payment_type, payment_method, COALESCE(bank_account_id, '')
                     FROM payments WHERE id = ?1",
                    params![pay_id],
                    |r| Ok((
                        r.get::<_, f64>(0)?,
                        r.get::<_, Option<String>>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, String>(3)?,
                        r.get::<_, String>(4)?,
                    )),
                ) {
                    // Only handle multi-bill / lump-sum parent payments here; direct invoice_id payments are handled below
                    if pay_inv_id.as_deref() != Some(&invoice_id) {
                        let rev_amt = settled_amt.min(pay_amt);
                        let (_, bank_part) = parse_payment_liquidity(&pay_method, rev_amt);
                        if bank_part > 0.0 {
                            let bank_delta = if pay_type == "IN" { -bank_part } else { bank_part };
                            if !pay_bank_id.is_empty() {
                                tx.execute(
                                    "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE id = ?2",
                                    params![bank_delta, pay_bank_id],
                                ).ok();
                            } else {
                                tx.execute(
                                    "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                                    params![bank_delta],
                                ).ok();
                            }
                        }

                        if (pay_amt - rev_amt).abs() <= 0.01 {
                            tx.execute("DELETE FROM payments WHERE id = ?1", params![pay_id]).ok();
                        } else {
                            tx.execute(
                                "UPDATE payments SET amount = amount - ?1 WHERE id = ?2",
                                params![rev_amt, pay_id],
                            ).ok();
                        }
                    }
                }
            }

            // Reverse bank impact for direct invoice payments (where payments.invoice_id = invoice_id)
            let direct_payments: Vec<(f64, String, String, String)> = {
                let mut stmt = tx
                    .prepare("SELECT amount, payment_type, payment_method, COALESCE(bank_account_id, '') FROM payments WHERE invoice_id = ?1")
                    .map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map(params![invoice_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
                    .map_err(|e| e.to_string())?
                    .filter_map(Result::ok)
                    .collect();
                rows
            };
            let mut direct_sum = 0.0;
            for (amt, p_type, p_method, p_bank_id) in direct_payments {
                direct_sum += amt;
                let (_, bank_part) = parse_payment_liquidity(&p_method, amt);
                if bank_part > 0.0 {
                    let bank_delta = if p_type == "IN" { -bank_part } else { bank_part };
                    if !p_bank_id.is_empty() {
                        tx.execute(
                            "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE id = ?2",
                            params![bank_delta, p_bank_id],
                        ).ok();
                    } else {
                        tx.execute(
                            "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                            params![bank_delta],
                        ).ok();
                    }
                }
            }
            if party_id.is_none() {
                let walkin_front = (paid_amount - direct_sum).max(0.0);
                if walkin_front > 0.005 {
                    let (_, bank_part) = parse_payment_liquidity(&payment_method, walkin_front);
                    if bank_part > 0.0 {
                        let bank_delta = if invoice_type == "PURCHASE" { bank_part } else { -bank_part };
                        tx.execute(
                            "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                            params![bank_delta],
                        ).ok();
                    }
                }
            }

            tx.execute("DELETE FROM bill_settlements WHERE invoice_id = ?1", params![invoice_id]).ok();
            tx.execute("DELETE FROM payments WHERE invoice_id = ?1", params![invoice_id]).ok();
            tx.execute("DELETE FROM gst_invoice_items WHERE invoice_id = ?1", params![invoice_id]).ok();
            tx.execute("DELETE FROM gst_invoices WHERE invoice_id = ?1", params![invoice_id]).ok();
            tx.execute("DELETE FROM invoice_items WHERE invoice_id = ?1", params![invoice_id]).ok();
            tx.execute("DELETE FROM invoices WHERE id = ?1", params![invoice_id])
                .map_err(|e| e.to_string())?;

            DatabaseManager::log_audit(
                &tx,
                "DELETE_PERMANENT",
                "INVOICE",
                &invoice_id,
                &format!("Permanently deleted invoice #{}. Restocked items. Reason: {}", invoice_number, reason),
            ).ok();
        }

        tx.commit().map_err(|e| e.to_string())?;
    }

    Ok(true)
}

#[tauri::command]
pub fn void_or_delete_invoice(
    invoice_id: String,
    action: String, // "RETURN" | "CANCEL"
    reason: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let res = void_or_delete_invoice_internal(&mut conn, invoice_id, action, reason)?;

    // Auto-backup triggered after vital inventory mutation
    let _ = create_database_backup_internal(&conn);

    Ok(res)
}

// ----------------------------------------------------------------------------
// 5 UNIQUE HIGH-IMPACT FEATURES
// ----------------------------------------------------------------------------

// Feature 1: Smart Low-Stock Purchase Order Generator
#[tauri::command]
pub fn generate_low_stock_po(
    state: State<'_, Mutex<AppState>>,
) -> Result<PurchaseOrder, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM items WHERE stock_quantity <= min_stock_alert",
        [],
        |r| r.get(0),
    ).unwrap_or(0);

    if count == 0 {
        return Err("All inventory items are healthy! No low stock replenishment needed.".into());
    }

    let po_id = Uuid::new_v4().to_string();
    let next_po_n = next_sequence_number(&conn, "purchase_orders", "po_number", "PO-");
    let po_num = format!("PO-{:04}", next_po_n);
    let now = Local::now().to_rfc3339();

    let total_cost: f64 = conn.query_row(
        "SELECT COALESCE(SUM(
            purchase_price * MAX(
                1.0,
                (CASE WHEN min_stock_alert * 2.0 > 10.0 THEN min_stock_alert * 2.0 ELSE 10.0 END) - stock_quantity
            )
         ), 0.0)
         FROM items WHERE stock_quantity <= min_stock_alert",
        [],
        |r| r.get(0),
    ).unwrap_or(0.0);

    conn.execute(
        "INSERT INTO purchase_orders (id, po_number, vendor_name, total_cost, status, items_count, created_at)
         VALUES (?1, ?2, 'Primary Supplier', ?3, 'DRAFT', ?4, ?5)",
        params![po_id, po_num, total_cost, count, now],
    ).map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(
        &conn,
        "CREATE",
        "PURCHASE_ORDER",
        &po_id,
        &format!("Generated replenishment PO #{} for {} low stock items (${:.2})", po_num, count, total_cost),
    ).ok();

    Ok(PurchaseOrder {
        id: po_id,
        po_number: po_num,
        vendor_name: "Primary Supplier".into(),
        total_cost,
        status: "DRAFT".into(),
        items_count: count,
        created_at: now,
    })
}

#[tauri::command]
pub fn list_purchase_orders(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<PurchaseOrder>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, po_number, vendor_name, total_cost, status, items_count, created_at
         FROM purchase_orders ORDER BY rowid DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |r| {
        Ok(PurchaseOrder {
            id: r.get(0)?,
            po_number: r.get(1)?,
            vendor_name: r.get(2)?,
            total_cost: r.get(3)?,
            status: r.get(4)?,
            items_count: r.get(5)?,
            created_at: r.get(6)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for row in rows.filter_map(Result::ok) {
        list.push(row);
    }
    Ok(list)
}

// Feature 4: Daily Shift Closing (Z-Report)
#[tauri::command]
pub fn record_cash_closing(
    mut closing: CashClosing,
    state: State<'_, Mutex<AppState>>,
) -> Result<CashClosing, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    if closing.id.is_empty() {
        closing.id = Uuid::new_v4().to_string();
    }
    closing.closed_at = Local::now().to_rfc3339();
    closing.variance = closing.actual_cash - closing.expected_cash;

    conn.execute(
        "INSERT INTO cash_closings (id, shift_date, opening_cash, sales_cash, expected_cash, actual_cash, variance, notes, closed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            closing.id,
            closing.shift_date,
            closing.opening_cash,
            closing.sales_cash,
            closing.expected_cash,
            closing.actual_cash,
            closing.variance,
            closing.notes,
            closing.closed_at,
        ],
    ).map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(
        &conn,
        "CLOSE_SHIFT",
        "CASH_REGISTER",
        &closing.id,
        &format!("Z-Report shift closed. Variance: ${:.2}", closing.variance),
    ).ok();

    let _ = create_database_backup_internal(&conn);

    Ok(closing)
}

#[tauri::command]
pub fn list_cash_closings(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<CashClosing>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, shift_date, opening_cash, sales_cash, expected_cash, actual_cash, variance, notes, closed_at
         FROM cash_closings ORDER BY rowid DESC LIMIT 30"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |r| {
        Ok(CashClosing {
            id: r.get(0)?,
            shift_date: r.get(1)?,
            opening_cash: r.get(2)?,
            sales_cash: r.get(3)?,
            expected_cash: r.get(4)?,
            actual_cash: r.get(5)?,
            variance: r.get(6)?,
            notes: r.get(7)?,
            closed_at: r.get(8)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for row in rows.filter_map(Result::ok) {
        list.push(row);
    }
    Ok(list)
}

// Feature 5: Multi-Godown Stock Transfer
#[tauri::command]
pub fn transfer_godown_stock(
    payload: StockTransferPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    if payload.quantity <= 0.0 || !payload.quantity.is_finite() {
        return Err("Transfer quantity must be greater than zero.".into());
    }
    let to_godown = payload.to_godown.trim();
    if to_godown.is_empty() {
        return Err("Destination godown / warehouse is required.".into());
    }

    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let now = Local::now().to_rfc3339();

    let (item_name, sku, barcode, category, unit, purchase_price, sale_price, source_stock, min_stock_alert, from_godown, size, brand, tax_rate): (
        String, String, String, String, String, f64, f64, f64, f64, String, Option<String>, Option<String>, Option<f64>
    ) = tx.query_row(
        "SELECT name, sku, barcode, category, unit, purchase_price, sale_price, stock_quantity, min_stock_alert, godown, size, brand, tax_rate
         FROM items WHERE id = ?1",
        params![payload.item_id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?, r.get(7)?, r.get(8)?, r.get(9)?, r.get(10)?, r.get(11)?, r.get(12)?)),
    ).map_err(|e| format!("Item not found: {}", e))?;

    if from_godown.trim().eq_ignore_ascii_case(to_godown) {
        return Err(format!("'{}' is already located in '{}'.", item_name, to_godown));
    }
    if source_stock < payload.quantity - 0.0001 {
        return Err(format!(
            "Insufficient stock in '{}': available {:.2} {}, requested {:.2} {}.",
            from_godown, source_stock, unit, payload.quantity, unit
        ));
    }

    let transfer_qty = payload.quantity.min(source_stock);

    // Check if matching product row already exists in destination godown
    let dest_match: Option<(String, f64)> = tx
        .query_row(
            "SELECT id, stock_quantity FROM items
             WHERE LOWER(TRIM(godown)) = LOWER(TRIM(?1))
               AND id != ?2
               AND (
                   (TRIM(?3) != '' AND sku = ?3)
                   OR (TRIM(?4) != '' AND barcode = ?4)
                   OR LOWER(TRIM(name)) = LOWER(TRIM(?5))
               )
             LIMIT 1",
            params![to_godown, payload.item_id, sku, barcode, item_name],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .ok();

    let is_full_transfer = (source_stock - transfer_qty).abs() <= 0.0001;

    if is_full_transfer && dest_match.is_none() {
        // Moving entire SKU to destination godown when no matching destination SKU exists
        tx.execute(
            "UPDATE items SET godown = ?1 WHERE id = ?2",
            params![to_godown, payload.item_id],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                          quantity_after, movement_type, reference_id,
                                          timestamp, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, 'TRANSFER', 'GODOWN_TRANSFER', ?6, ?7)",
            params![
                Uuid::new_v4().to_string(),
                payload.item_id,
                item_name,
                transfer_qty,
                source_stock,
                now,
                format!("Moved all {:.2} {} from [{}] to [{}]: {}", transfer_qty, unit, from_godown, to_godown, payload.notes),
            ],
        ).ok();
    } else {
        // Partial transfer or merge into existing destination SKU
        let source_after = ((source_stock - transfer_qty).max(0.0) * 1000.0).round() / 1000.0;
        tx.execute(
            "UPDATE items SET stock_quantity = ?1 WHERE id = ?2",
            params![source_after, payload.item_id],
        ).map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                          quantity_after, movement_type, reference_id,
                                          timestamp, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, 'TRANSFER_OUT', 'GODOWN_TRANSFER', ?6, ?7)",
            params![
                Uuid::new_v4().to_string(),
                payload.item_id,
                item_name,
                -transfer_qty,
                source_after,
                now,
                format!("Transferred {:.2} {} from [{}] to [{}]: {}", transfer_qty, unit, from_godown, to_godown, payload.notes),
            ],
        ).ok();

        if let Some((dest_id, dest_stock)) = dest_match {
            let dest_after = ((dest_stock + transfer_qty) * 1000.0).round() / 1000.0;
            tx.execute(
                "UPDATE items SET stock_quantity = ?1 WHERE id = ?2",
                params![dest_after, dest_id],
            ).map_err(|e| e.to_string())?;

            tx.execute(
                "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                              quantity_after, movement_type, reference_id,
                                              timestamp, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, 'TRANSFER_IN', 'GODOWN_TRANSFER', ?6, ?7)",
                params![
                    Uuid::new_v4().to_string(),
                    dest_id,
                    item_name,
                    transfer_qty,
                    dest_after,
                    now,
                    format!("Received {:.2} {} from [{}]: {}", transfer_qty, unit, from_godown, payload.notes),
                ],
            ).ok();
        } else {
            let dest_id = Uuid::new_v4().to_string();
            let dest_date = Local::now().format("%Y-%m-%d").to_string();
            tx.execute(
                "INSERT INTO items (id, name, sku, barcode, category, unit,
                                    purchase_price, sale_price, stock_quantity,
                                    min_stock_alert, godown, created_at, size, brand, tax_rate)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    dest_id, item_name, sku, barcode, category, unit,
                    purchase_price, sale_price, transfer_qty, min_stock_alert, to_godown, dest_date, size, brand, tax_rate,
                ],
            ).map_err(|e| e.to_string())?;

            if let Ok((hsn, cess)) = tx.query_row(
                "SELECT hsn_code, cess_rate FROM gst_items WHERE item_id = ?1",
                params![payload.item_id],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?)),
            ) {
                let _ = tx.execute(
                    "INSERT INTO gst_items (item_id, hsn_code, tax_preference, cess_rate, gst_rate)
                     VALUES (?1, ?2, 'TAXABLE', ?3, ?4)",
                    params![dest_id, hsn, cess, tax_rate.unwrap_or(0.0)],
                );
            }

            tx.execute(
                "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                              quantity_after, movement_type, reference_id,
                                              timestamp, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, 'TRANSFER_IN', 'GODOWN_TRANSFER', ?6, ?7)",
                params![
                    Uuid::new_v4().to_string(),
                    dest_id,
                    item_name,
                    transfer_qty,
                    transfer_qty,
                    now,
                    format!("Received {:.2} {} from [{}]: {}", transfer_qty, unit, from_godown, payload.notes),
                ],
            ).ok();
        }
    }

    DatabaseManager::log_audit(
        &tx,
        "TRANSFER",
        "INVENTORY",
        &payload.item_id,
        &format!("Transferred {:.2} {} of '{}' from {} to {}", transfer_qty, unit, item_name, from_godown, to_godown),
    ).ok();

    tx.commit().map_err(|e| e.to_string())?;
    Ok(true)
}

// ----------------------------------------------------------------------------
// FEATURE 2: ESTIMATES & QUOTATIONS
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn create_estimate(
    payload: EstimatePayload,
    discount_amount: Option<f64>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Estimate, String> {
    if payload.items.is_empty() {
        return Err("Quotation must include at least one item.".into());
    }

    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let estimate_id = Uuid::new_v4().to_string();
    let next_est_n = next_sequence_number(&tx, "estimates", "estimate_number", "EST-");
    let estimate_number = format!("EST-{:05}", next_est_n);
    let now = Local::now().to_rfc3339();

    let tax_mode: String = tx
        .query_row("SELECT tax_mode FROM settings WHERE id = 1", [], |r| r.get(0))
        .unwrap_or_else(|_| "EXCLUSIVE".into());
    let is_inclusive = tax_mode.eq_ignore_ascii_case("INCLUSIVE");

    let mut subtotal = 0.0;
    let mut tax_amount = 0.0;
    let mut computed_lines: Vec<(f64, f64, f64)> = Vec::with_capacity(payload.items.len());

    for item in &payload.items {
        let gross_before_disc = item.unit_price * item.quantity;
        let line_disc = gross_before_disc * (item.discount_percent / 100.0);
        let after_disc = gross_before_disc - line_disc;
        let (base, line_tax, line_tot) = if is_inclusive && item.tax_rate > 0.0 {
            let ex_base = after_disc / (1.0 + item.tax_rate / 100.0);
            let tax_part = after_disc - ex_base;
            (ex_base, tax_part, after_disc)
        } else {
            let tax_part = after_disc * (item.tax_rate / 100.0);
            (after_disc, tax_part, after_disc + tax_part)
        };
        subtotal += base;
        tax_amount += line_tax;
        computed_lines.push((base, line_tax, line_tot));
    }

    let gross_total = subtotal + tax_amount;
    let requested_disc = discount_amount.unwrap_or(0.0).max(0.0);
    let applied_disc = requested_disc.min(gross_total);
    if applied_disc > 0.005 && gross_total > 0.0 {
        let scale = ((gross_total - applied_disc) / gross_total).max(0.0);
        subtotal *= scale;
        tax_amount *= scale;
    }
    subtotal = (subtotal * 100.0).round() / 100.0;
    tax_amount = (tax_amount * 100.0).round() / 100.0;
    let total_amount = ((subtotal + tax_amount) * 100.0).round() / 100.0;

    // Validate party_id against parties table for foreign key integrity
    let valid_party_id: Option<String> = match payload.party_id.as_deref().map(str::trim) {
        Some(pid) if !pid.is_empty() => {
            let exists: bool = tx
                .query_row(
                    "SELECT 1 FROM parties WHERE id = ?1",
                    params![pid],
                    |_| Ok(true),
                )
                .unwrap_or(false);
            if exists {
                Some(pid.to_string())
            } else {
                None
            }
        }
        _ => None,
    };

    let estimate = Estimate {
        id: estimate_id.clone(),
        estimate_number: estimate_number.clone(),
        party_id: valid_party_id.clone(),
        party_name: payload.party_name.clone(),
        estimate_date: payload.estimate_date,
        expiry_date: payload.expiry_date,
        subtotal,
        tax_amount,
        total_amount,
        status: "DRAFT".into(),
        notes: payload.notes,
        created_at: now.clone(),
    };

    // Insert parent estimate record FIRST before child line items
    tx.execute(
        "INSERT INTO estimates (id, estimate_number, party_id, party_name, estimate_date,
                                expiry_date, subtotal, tax_amount, total_amount, status, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            estimate.id,
            estimate.estimate_number,
            estimate.party_id,
            estimate.party_name,
            estimate.estimate_date,
            estimate.expiry_date,
            estimate.subtotal,
            estimate.tax_amount,
            estimate.total_amount,
            estimate.status,
            estimate.notes,
            estimate.created_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Now insert child line items referencing the parent estimate
    for (idx, item) in payload.items.iter().enumerate() {
        let (_, _, line_total) = computed_lines[idx];

        let valid_item_id: Option<String> = match item.item_id.as_deref().map(str::trim) {
            Some(it_id) if !it_id.is_empty() => {
                let exists: bool = tx
                    .query_row(
                        "SELECT 1 FROM items WHERE id = ?1",
                        params![it_id],
                        |_| Ok(true),
                    )
                    .unwrap_or(false);
                if exists {
                    Some(it_id.to_string())
                } else {
                    None
                }
            }
            _ => None,
        };

        let line_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO estimate_items (id, estimate_id, item_id, item_name, quantity, unit,
                                         unit_price, discount_percent, tax_rate, line_total)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                line_id,
                estimate_id,
                valid_item_id,
                item.item_name,
                item.quantity,
                item.unit,
                item.unit_price,
                item.discount_percent,
                item.tax_rate,
                (line_total * 100.0).round() / 100.0,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    DatabaseManager::log_audit(
        &tx,
        "CREATE",
        "ESTIMATE",
        &estimate_id,
        &format!("Created quotation #{} for {}", estimate_number, payload.party_name),
    )
    .ok();

    tx.commit().map_err(|e| e.to_string())?;
    Ok(estimate)
}

#[tauri::command]
pub fn list_estimates(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<Estimate>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, estimate_number, party_id, party_name, estimate_date,
                    expiry_date, subtotal, tax_amount, total_amount, status, notes, created_at
             FROM estimates ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Estimate {
                id: row.get(0)?,
                estimate_number: row.get(1)?,
                party_id: row.get(2)?,
                party_name: row.get(3)?,
                estimate_date: row.get(4)?,
                expiry_date: row.get(5)?,
                subtotal: row.get(6)?,
                tax_amount: row.get(7)?,
                total_amount: row.get(8)?,
                status: row.get(9)?,
                notes: row.get(10)?,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows.filter_map(Result::ok) {
        list.push(r);
    }
    Ok(list)
}

#[tauri::command]
pub fn get_estimate(
    estimate_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<EstimateDetail, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let estimate = conn
        .query_row(
            "SELECT id, estimate_number, party_id, party_name, estimate_date,
                    expiry_date, subtotal, tax_amount, total_amount, status, notes, created_at
             FROM estimates WHERE id = ?1",
            params![estimate_id],
            |row| {
                Ok(Estimate {
                    id: row.get(0)?,
                    estimate_number: row.get(1)?,
                    party_id: row.get(2)?,
                    party_name: row.get(3)?,
                    estimate_date: row.get(4)?,
                    expiry_date: row.get(5)?,
                    subtotal: row.get(6)?,
                    tax_amount: row.get(7)?,
                    total_amount: row.get(8)?,
                    status: row.get(9)?,
                    notes: row.get(10)?,
                    created_at: row.get(11)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, estimate_id, item_id, item_name, quantity, unit,
                    unit_price, discount_percent, tax_rate, line_total
             FROM estimate_items WHERE estimate_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let items_rows = stmt
        .query_map(params![estimate_id], |row| {
            Ok(EstimateItem {
                id: row.get(0)?,
                estimate_id: row.get(1)?,
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
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for it in items_rows.filter_map(Result::ok) {
        items.push(it);
    }

    Ok(EstimateDetail { estimate, items })
}

pub fn convert_estimate_to_invoice_internal(
    conn: &mut rusqlite::Connection,
    estimate_id: String,
    payment_method: String,
) -> Result<Invoice, String> {
    let (estimate, items) = {
        let est: Estimate = conn
            .query_row(
                "SELECT id, estimate_number, party_id, party_name, estimate_date,
                        expiry_date, subtotal, tax_amount, total_amount, status, notes, created_at
                 FROM estimates WHERE id = ?1",
                params![estimate_id],
                |row| {
                    Ok(Estimate {
                        id: row.get(0)?,
                        estimate_number: row.get(1)?,
                        party_id: row.get(2)?,
                        party_name: row.get(3)?,
                        estimate_date: row.get(4)?,
                        expiry_date: row.get(5)?,
                        subtotal: row.get(6)?,
                        tax_amount: row.get(7)?,
                        total_amount: row.get(8)?,
                        status: row.get(9)?,
                        notes: row.get(10)?,
                        created_at: row.get(11)?,
                    })
                },
            )
            .map_err(|e| format!("Estimate not found: {}", e))?;

        let mut stmt = conn
            .prepare(
                "SELECT id, estimate_id, item_id, item_name, quantity, unit,
                        unit_price, discount_percent, tax_rate, line_total
                 FROM estimate_items WHERE estimate_id = ?1",
            )
            .map_err(|e| e.to_string())?;

        let item_rows: Vec<EstimateItem> = stmt
            .query_map(params![estimate_id], |row| {
                Ok(EstimateItem {
                    id: row.get(0)?,
                    estimate_id: row.get(1)?,
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
            .collect();

        (est, item_rows)
    };

    if estimate.status.eq_ignore_ascii_case("CONVERTED") {
        return Err(format!("Quotation #{} has already been converted to an invoice.", estimate.estimate_number));
    }

    // Use transaction to create invoice, update stock and mark estimate converted
    let created_invoice = {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        let inv_id = Uuid::new_v4().to_string();
        let prefix: String = tx
            .query_row("SELECT invoice_prefix FROM settings WHERE id = 1", [], |r| r.get(0))
            .unwrap_or_else(|_| "INV-".to_string());

        let next_num = next_sequence_number(&tx, "invoices", "invoice_number", &prefix);
        let invoice_number = format!("{}{:05}", prefix, next_num);
        let now = Local::now().to_rfc3339();
        let today = Local::now().format("%Y-%m-%d").to_string();

        let subtotal = estimate.subtotal;
        let tax_amount = estimate.tax_amount;
        let total_amount = estimate.total_amount;
        let upper_pm = payment_method.to_uppercase();
        let is_paid = !((upper_pm.contains("CREDIT") && !upper_pm.contains("CREDIT CARD"))
            || upper_pm.contains("UDHAAR")
            || upper_pm.contains("UDHAR"));
        let paid_amount = if is_paid { total_amount } else { 0.0 };
        let status = if is_paid { "PAID" } else { "CREDIT" };

        let new_inv = Invoice {
            id: inv_id.clone(),
            invoice_number: invoice_number.clone(),
            invoice_type: "SALE".into(),
            party_id: estimate.party_id.clone(),
            party_name: estimate.party_name.clone(),
            invoice_date: today.clone(),
            due_date: today.clone(),
            subtotal,
            discount_amount: 0.0,
            tax_amount,
            total_amount,
            paid_amount,
            status: status.into(),
            payment_method: payment_method.clone(),
            notes: format!("Converted from Quote #{}", estimate.estimate_number),
            created_at: now.clone(),
            reference: Some(format!("QUOTE:{}", estimate.estimate_number)),
        };

        tx.execute(
            "INSERT INTO invoices (id, invoice_number, invoice_type, party_id, party_name,
                                  invoice_date, due_date, subtotal, discount_amount,
                                  tax_amount, total_amount, paid_amount, status,
                                  payment_method, notes, created_at, reference)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![
                new_inv.id,
                new_inv.invoice_number,
                new_inv.invoice_type,
                new_inv.party_id,
                new_inv.party_name,
                new_inv.invoice_date,
                new_inv.due_date,
                new_inv.subtotal,
                new_inv.discount_amount,
                new_inv.tax_amount,
                new_inv.total_amount,
                new_inv.paid_amount,
                new_inv.status,
                new_inv.payment_method,
                new_inv.notes,
                new_inv.created_at,
                new_inv.reference,
            ],
        )
        .map_err(|e| e.to_string())?;

        // Check if GST is active (INR currency AND gst_settings.is_enabled = 1) for GST metadata mirror
        let (currency_code, tax_mode): (String, String) = tx
            .query_row("SELECT currency_code, tax_mode FROM settings WHERE id = 1", [], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap_or_else(|_| ("USD".into(), "EXCLUSIVE".into()));
        let is_inclusive = tax_mode.eq_ignore_ascii_case("INCLUSIVE");

        let gst_meta: Option<(String, String, String)> = if currency_code.eq_ignore_ascii_case("INR") {
            tx.query_row(
                "SELECT gstin, state_code, state_name FROM gst_settings WHERE id = 1 AND is_enabled = 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .ok()
        } else {
            None
        };

        let (cust_gstin, pos_code, pos_name, is_interstate) = if let Some((_, ref s_code, ref s_name)) = gst_meta {
            if let Some(ref pid) = estimate.party_id {
                tx.query_row(
                    "SELECT gstin, state_code, state_name FROM gst_parties WHERE party_id = ?1",
                    params![pid],
                    |r| {
                        let cg: String = r.get(0)?;
                        let pc: String = r.get(1)?;
                        let pn: String = r.get(2)?;
                        let inter = pc != *s_code;
                        Ok((cg, pc, pn, inter))
                    },
                )
                .unwrap_or_else(|_| ("".into(), s_code.clone(), s_name.clone(), false))
            } else {
                ("".into(), s_code.clone(), s_name.clone(), false)
            }
        } else {
            ("".into(), "27".into(), "Maharashtra".into(), false)
        };

        if let Some((ref sup_gstin, _, _)) = gst_meta {
            let (cgst_total, sgst_total, igst_total) = if is_interstate {
                (0.0, 0.0, tax_amount)
            } else {
                let half = (tax_amount / 2.0 * 100.0).round() / 100.0;
                (half, ((tax_amount - half) * 100.0).round() / 100.0, 0.0)
            };
            let pos_str = format!("{}-{}", pos_code, pos_name);
            let _ = tx.execute(
                "INSERT INTO gst_invoices (
                    invoice_id, place_of_supply, pos_state_code, pos_state_name,
                    supplier_gstin, customer_gstin, is_interstate, is_reverse_charge,
                    cgst_amount, sgst_amount, igst_amount, cess_amount, round_off, bill_reference_type
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9, ?10, 0.0, 0.0, 'New Ref')",
                params![
                    inv_id,
                    pos_str,
                    pos_code,
                    pos_name,
                    sup_gstin,
                    cust_gstin,
                    if is_interstate { 1 } else { 0 },
                    cgst_total,
                    sgst_total,
                    igst_total,
                ],
            );
        }

        // Deduct items from stock & create invoice_items (+ gst_invoice_items if GST active)
        for item in &items {
            let line_id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO invoice_items (id, invoice_id, item_id, item_name, quantity, unit,
                                           unit_price, discount_percent, tax_rate, line_total)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    line_id,
                    inv_id,
                    item.item_id,
                    item.item_name,
                    item.quantity,
                    item.unit,
                    item.unit_price,
                    item.discount_percent,
                    item.tax_rate,
                    item.line_total,
                ],
            )
            .map_err(|e| e.to_string())?;

            if gst_meta.is_some() {
                let line_disc = item.unit_price * item.quantity * (item.discount_percent / 100.0);
                let after_disc = (item.unit_price * item.quantity) - line_disc;
                let (taxable, line_tax) = if is_inclusive && item.tax_rate > 0.0 {
                    let ex_base = after_disc / (1.0 + item.tax_rate / 100.0);
                    (ex_base, after_disc - ex_base)
                } else {
                    (after_disc, after_disc * (item.tax_rate / 100.0))
                };
                let hsn: String = if let Some(ref it_id) = item.item_id {
                    tx.query_row("SELECT hsn_code FROM gst_items WHERE item_id = ?1", params![it_id], |r| r.get(0))
                        .unwrap_or_else(|_| "8471".into())
                } else {
                    "8471".into()
                };
                let (cg_r, sg_r, ig_r, cg_a, sg_a, ig_a) = if is_interstate {
                    (0.0, 0.0, item.tax_rate, 0.0, 0.0, line_tax)
                } else {
                    (item.tax_rate / 2.0, item.tax_rate / 2.0, 0.0, line_tax / 2.0, line_tax / 2.0, 0.0)
                };
                let _ = tx.execute(
                    "INSERT INTO gst_invoice_items (
                        id, invoice_id, item_id, hsn_code, quantity, unit, rate,
                        discount_amount, taxable_amount, tax_rate,
                        cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
                        cess_rate, cess_amount, line_total
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 0.0, 0.0, ?17)",
                    params![
                        line_id,
                        inv_id,
                        item.item_id,
                        hsn,
                        item.quantity,
                        item.unit,
                        item.unit_price,
                        line_disc,
                        (taxable * 100.0).round() / 100.0,
                        item.tax_rate,
                        cg_r,
                        (cg_a * 100.0).round() / 100.0,
                        sg_r,
                        (sg_a * 100.0).round() / 100.0,
                        ig_r,
                        (ig_a * 100.0).round() / 100.0,
                        ((taxable + line_tax) * 100.0).round() / 100.0,
                    ],
                );
            }

            if let Some(ref it_id) = item.item_id {
                tx.execute(
                    "UPDATE items SET stock_quantity = stock_quantity - ?1 WHERE id = ?2",
                    params![item.quantity, it_id],
                )
                .ok();

                let current_stock: f64 = tx
                    .query_row("SELECT stock_quantity FROM items WHERE id = ?1", params![it_id], |r| r.get(0))
                    .unwrap_or(0.0);

                tx.execute(
                    "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                                  quantity_after, movement_type, reference_id,
                                                  timestamp, notes)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        Uuid::new_v4().to_string(),
                        it_id,
                        item.item_name,
                        -item.quantity,
                        current_stock,
                        "SALE",
                        invoice_number,
                        now,
                        format!("Converted from Quote #{}", estimate.estimate_number),
                    ],
                )
                .ok();
            }
        }

        // Record payment & liquidity when paid, OR customer balance when on credit
        if is_paid && paid_amount > 0.0 {
            if let Some(ref pid) = estimate.party_id {
                let pay_id = Uuid::new_v4().to_string();
                let _ = tx.execute(
                    "INSERT INTO payments (id, invoice_id, party_id, party_name,
                                           amount, payment_type, payment_method,
                                           payment_date, reference, notes)
                     VALUES (?1, ?2, ?3, ?4, ?5, 'IN', ?6, ?7, ?8, ?9)",
                    params![
                        pay_id,
                        inv_id,
                        pid,
                        estimate.party_name,
                        paid_amount,
                        payment_method,
                        today,
                        invoice_number,
                        format!("Payment on Quote #{} conversion", estimate.estimate_number),
                    ],
                );
            }
            let (_, bank_part) = parse_payment_liquidity(&payment_method, paid_amount);
            if bank_part > 0.0 {
                tx.execute(
                    "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                    params![bank_part],
                )
                .ok();
            }
        } else if !is_paid {
            if let Some(ref pid) = estimate.party_id {
                tx.execute(
                    "UPDATE parties SET current_balance = current_balance + ?1 WHERE id = ?2",
                    params![total_amount, pid],
                )
                .ok();
            }
        }

        // Mark estimate as CONVERTED
        tx.execute(
            "UPDATE estimates SET status = 'CONVERTED' WHERE id = ?1",
            params![estimate_id],
        )
        .ok();

        DatabaseManager::log_audit(
            &tx,
            "CONVERT",
            "ESTIMATE",
            &estimate_id,
            &format!("Converted Quote #{} to Invoice #{}", estimate.estimate_number, invoice_number),
        )
        .ok();

        tx.commit().map_err(|e| e.to_string())?;

        new_inv
    };

    Ok(created_invoice)
}

#[tauri::command]
pub fn convert_estimate_to_invoice(
    estimate_id: String,
    payment_method: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Invoice, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    if app.db.is_trial_expired() {
        return Err("14-Day Free Trial has expired. Please acquire and activate a perpetual commercial license to issue new sales and invoices.".into());
    }
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let created_invoice = convert_estimate_to_invoice_internal(&mut conn, estimate_id, payment_method)?;
    let _ = create_database_backup_internal(&conn);
    Ok(created_invoice)
}

// ----------------------------------------------------------------------------
// FEATURE 4: CUSTOMER CREDIT AGING ANALYSIS
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn get_customer_aging_analysis(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<CustomerAging>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, phone, email, current_balance
             FROM parties WHERE party_type = 'CUSTOMER' AND current_balance > 0
             ORDER BY current_balance DESC",
        )
        .map_err(|e| e.to_string())?;

    let today = Local::now().date_naive();

    let customer_rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, f64>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut aging_list = Vec::new();

    for cust in customer_rows.filter_map(Result::ok) {
        let (party_id, party_name, phone, email, current_balance) = cust;

        let mut inv_stmt = conn
            .prepare(
                "SELECT invoice_date, total_amount, paid_amount
                 FROM invoices
                 WHERE party_id = ?1 AND invoice_type = 'SALE' AND status NOT IN ('PAID', 'RETURNED', 'CANCELLED')",
            )
            .map_err(|e| e.to_string())?;

        let unpaid_invoices = inv_stmt
            .query_map(params![party_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, f64>(1)?,
                    row.get::<_, f64>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut current_30 = 0.0;
        let mut days_60 = 0.0;
        let mut days_90 = 0.0;
        let mut over_90 = 0.0;
        let mut overdue_count = 0;

        for inv in unpaid_invoices.filter_map(Result::ok) {
            let (date_str, total, paid) = inv;
            let due_val = total - paid;
            if due_val <= 0.0 {
                continue;
            }

            let days_old = if let Ok(parsed) = chrono::NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
                (today - parsed).num_days()
            } else {
                0
            };

            if days_old <= 30 {
                current_30 += due_val;
            } else if days_old <= 60 {
                days_60 += due_val;
                overdue_count += 1;
            } else if days_old <= 90 {
                days_90 += due_val;
                overdue_count += 1;
            } else {
                over_90 += due_val;
                overdue_count += 1;
            }
        }

        // If no individual invoices found, fallback entire balance into current_30
        if current_30 == 0.0 && days_60 == 0.0 && days_90 == 0.0 && over_90 == 0.0 {
            current_30 = current_balance;
        }

        aging_list.push(CustomerAging {
            party_id,
            party_name,
            phone,
            email,
            current_30,
            days_60,
            days_90,
            over_90,
            total_due: current_balance,
            overdue_invoices_count: overdue_count,
        });
    }

    Ok(aging_list)
}

// ----------------------------------------------------------------------------
// FEATURE 14: PURCHASE RETURNS & DEBIT NOTES
// ----------------------------------------------------------------------------

pub fn create_purchase_return_internal(
    conn: &mut rusqlite::Connection,
    payload: PurchaseReturnPayload,
) -> Result<PurchaseReturn, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let return_id = Uuid::new_v4().to_string();
    let next_dn = next_sequence_number(&tx, "purchase_returns", "return_number", "DN-");
    let return_number = format!("DN-{:05}", next_dn);
    let now = Local::now().to_rfc3339();

    let mut total_amount = 0.0;
    let mut line_totals: Vec<f64> = Vec::with_capacity(payload.items.len());
    for it in &payload.items {
        let gross = it.unit_price * it.quantity;
        let disc = gross * (it.discount_percent / 100.0);
        let taxable = gross - disc;
        let tax = taxable * (it.tax_rate / 100.0);
        let line_tot = ((taxable + tax) * 100.0).round() / 100.0;
        line_totals.push(line_tot);
        total_amount += line_tot;
    }
    total_amount = (total_amount * 100.0).round() / 100.0;

    // Validate party_id against parties table for foreign key integrity
    let valid_party_id: Option<String> = match payload.party_id.as_deref().map(str::trim) {
        Some(pid) if !pid.is_empty() => {
            let exists: bool = tx
                .query_row(
                    "SELECT 1 FROM parties WHERE id = ?1",
                    params![pid],
                    |_| Ok(true),
                )
                .unwrap_or(false);
            if exists {
                Some(pid.to_string())
            } else {
                None
            }
        }
        _ => None,
    };

    let ret = PurchaseReturn {
        id: return_id.clone(),
        return_number: return_number.clone(),
        party_id: valid_party_id.clone(),
        party_name: payload.party_name.clone(),
        return_date: payload.return_date.clone(),
        total_amount,
        reason: payload.reason.clone(),
        notes: payload.notes.clone(),
        created_at: now.clone(),
    };

    // Insert parent purchase return record FIRST before child line items
    tx.execute(
        "INSERT INTO purchase_returns (id, return_number, party_id, party_name, return_date, total_amount, reason, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            ret.id,
            ret.return_number,
            ret.party_id,
            ret.party_name,
            ret.return_date,
            ret.total_amount,
            ret.reason,
            ret.notes,
            ret.created_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Now insert child line items referencing the parent purchase return
    for (idx, it) in payload.items.iter().enumerate() {
        let line_tot = line_totals[idx];

        let valid_item_id: Option<String> = match it.item_id.as_deref().map(str::trim) {
            Some(it_id) if !it_id.is_empty() => {
                let exists: bool = tx
                    .query_row(
                        "SELECT 1 FROM items WHERE id = ?1",
                        params![it_id],
                        |_| Ok(true),
                    )
                    .unwrap_or(false);
                if exists {
                    Some(it_id.to_string())
                } else {
                    None
                }
            }
            _ => None,
        };

        tx.execute(
            "INSERT INTO purchase_return_items (id, return_id, item_id, item_name, quantity, unit, unit_price, line_total)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                Uuid::new_v4().to_string(),
                return_id,
                valid_item_id,
                it.item_name,
                it.quantity,
                it.unit,
                it.unit_price,
                line_tot,
            ],
        )
        .map_err(|e| e.to_string())?;

        // Deduct from inventory only if item exists
        if let Some(ref it_id) = valid_item_id {
            tx.execute(
                "UPDATE items SET stock_quantity = stock_quantity - ?1 WHERE id = ?2",
                params![it.quantity, it_id],
            )
            .ok();

            let current_stock: f64 = tx
                .query_row("SELECT stock_quantity FROM items WHERE id = ?1", params![it_id], |r| r.get(0))
                .unwrap_or(0.0);

            tx.execute(
                "INSERT INTO stock_movements (id, item_id, item_name, change_quantity,
                                              quantity_after, movement_type, reference_id,
                                              timestamp, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    Uuid::new_v4().to_string(),
                    it_id,
                    it.item_name,
                    -it.quantity,
                    current_stock,
                    "PURCHASE_RETURN",
                    return_number,
                    now,
                    format!("Debit Note to {}: {}", payload.party_name, payload.reason),
                ],
            )
            .ok();
        }
    }

    // Debit note reduces what we owe to the vendor and FIFO-settles open PURCHASE bills
    if let Some(ref pid) = valid_party_id {
        tx.execute(
            "UPDATE parties SET current_balance = current_balance + ?1 WHERE id = ?2",
            params![total_amount, pid],
        )
        .ok();

        if total_amount > 0.0 {
            let open_bills: Vec<(String, f64, f64)> = {
                let mut stmt = tx
                    .prepare(
                        "SELECT id, total_amount, paid_amount FROM invoices
                         WHERE party_id = ?1
                           AND invoice_type = 'PURCHASE'
                           AND status NOT IN ('PAID', 'RETURNED', 'CANCELLED')
                           AND (total_amount - paid_amount) > 0.01
                         ORDER BY invoice_date ASC, created_at ASC",
                    )
                    .map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map(params![pid], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
                    .map_err(|e| e.to_string())?
                    .filter_map(Result::ok)
                    .collect();
                rows
            };

            let mut remaining = total_amount;
            for (bill_id, b_total, b_paid) in open_bills {
                if remaining <= 0.005 {
                    break;
                }
                let due = (b_total - b_paid).max(0.0);
                if due <= 0.005 {
                    continue;
                }
                let alloc = remaining.min(due);
                let new_paid = ((b_paid + alloc) * 100.0).round() / 100.0;
                let new_status = if new_paid >= b_total - 0.01 { "PAID" } else { "PARTIAL" };
                tx.execute(
                    "UPDATE invoices SET paid_amount = ?1, status = ?2 WHERE id = ?3",
                    params![new_paid, new_status, bill_id],
                )
                .ok();

                // Debit note settlement adjustment with NULL payment_id (no synthetic payments row)
                tx.execute(
                    "INSERT INTO bill_settlements (
                        id, payment_id, invoice_id, party_id, settled_amount, settlement_date, notes
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        Uuid::new_v4().to_string(),
                        None::<&str>,
                        bill_id,
                        pid,
                        alloc,
                        ret.return_date,
                        format!("Debit Note {} credit adjustment", return_number),
                    ],
                )
                .map_err(|e| e.to_string())?;
                remaining -= alloc;
            }
        }
    }

    DatabaseManager::log_audit(
        &tx,
        "CREATE",
        "PURCHASE_RETURN",
        &return_id,
        &format!("Issued Debit Note #{} to {} (${:.2})", return_number, payload.party_name, total_amount),
    )
    .ok();

    tx.commit().map_err(|e| e.to_string())?;
    Ok(ret)
}

#[tauri::command]
pub fn create_purchase_return(
    payload: PurchaseReturnPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<PurchaseReturn, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let ret = create_purchase_return_internal(&mut conn, payload)?;
    let _ = create_database_backup_internal(&conn);
    Ok(ret)
}

#[tauri::command]
pub fn list_purchase_returns(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<PurchaseReturn>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, return_number, party_id, party_name, return_date, total_amount, reason, notes, created_at
             FROM purchase_returns ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(PurchaseReturn {
                id: row.get(0)?,
                return_number: row.get(1)?,
                party_id: row.get(2)?,
                party_name: row.get(3)?,
                return_date: row.get(4)?,
                total_amount: row.get(5)?,
                reason: row.get(6)?,
                notes: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows.filter_map(Result::ok) {
        list.push(r);
    }
    Ok(list)
}

// ----------------------------------------------------------------------------
// BANKING & BUSINESS LOANS (CASH IN HAND, CASH AT BANK, LIABILITIES)
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn list_bank_accounts(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<BankAccount>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, account_name, bank_name, account_number, current_balance, is_primary, created_at
             FROM bank_accounts ORDER BY is_primary DESC, account_name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |r| {
            Ok(BankAccount {
                id: r.get(0)?,
                account_name: r.get(1)?,
                bank_name: r.get(2)?,
                account_number: r.get(3)?,
                current_balance: r.get(4)?,
                is_primary: r.get::<_, i32>(5)? == 1,
                created_at: r.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows.filter_map(Result::ok) {
        list.push(r);
    }
    if list.is_empty() {
        let (_, cash_in_bank) = calculate_liquidity_internal(&conn).unwrap_or((0.0, 0.0));
        let now = Local::now().to_rfc3339();
        let default_acc = BankAccount {
            id: "BANK-PRIMARY".to_string(),
            account_name: "Primary Operating Account".to_string(),
            bank_name: "Commercial Bank".to_string(),
            account_number: "0001".to_string(),
            current_balance: cash_in_bank,
            is_primary: true,
            created_at: now.clone(),
        };
        let _ = conn.execute(
            "INSERT INTO bank_accounts (id, account_name, bank_name, account_number, current_balance, is_primary, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                default_acc.id,
                default_acc.account_name,
                default_acc.bank_name,
                default_acc.account_number,
                default_acc.current_balance,
                1,
                now,
            ],
        );
        list.push(default_acc);
    }
    Ok(list)
}

#[tauri::command]
pub fn save_bank_account(
    mut account: BankAccount,
    state: State<'_, Mutex<AppState>>,
) -> Result<BankAccount, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    if account.id.is_empty() {
        account.id = format!("BANK-{}", Uuid::new_v4().to_string()[..8].to_uppercase());
        account.created_at = Local::now().to_rfc3339();
    }

    conn.execute(
        "INSERT INTO bank_accounts (id, account_name, bank_name, account_number, current_balance, is_primary, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
            account_name = excluded.account_name,
            bank_name = excluded.bank_name,
            account_number = excluded.account_number,
            current_balance = excluded.current_balance,
            is_primary = excluded.is_primary",
        params![
            account.id,
            account.account_name,
            account.bank_name,
            account.account_number,
            account.current_balance,
            if account.is_primary { 1 } else { 0 },
            account.created_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(
        &conn,
        "SAVE",
        "BANK_ACCOUNT",
        &account.id,
        &format!("Updated bank account '{}' (Balance: ${:.2})", account.account_name, account.current_balance),
    )
    .ok();

    Ok(account)
}

pub fn transfer_cash_bank_internal(
    conn: &rusqlite::Connection,
    direction: &str,
    bank_account_id: &str,
    amount: f64,
    notes: &str,
) -> Result<bool, String> {
    if amount <= 0.0 {
        return Err("Transfer amount must be greater than zero".to_string());
    }

    let target_acct = if bank_account_id.trim().is_empty() {
        "BANK-PRIMARY"
    } else {
        bank_account_id.trim()
    };

    if direction == "CASH_TO_BANK" {
        // Deposit physical cash drawer to bank account
        let mut updated = conn.execute(
            "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE id = ?2",
            params![amount, target_acct],
        )
        .map_err(|e| e.to_string())?;

        if updated == 0 {
            updated = conn.execute(
                "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                params![amount],
            )
            .unwrap_or(0);
        }

        if updated == 0 {
            let now = Local::now().to_rfc3339();
            let _ = conn.execute(
                "INSERT INTO bank_accounts (id, account_name, bank_name, account_number, current_balance, is_primary, created_at)
                 VALUES ('BANK-PRIMARY', 'Primary Operating Account', 'Commercial Bank', '0001', ?1, 1, ?2)",
                params![amount, now],
            );
        }

        let tx_id = Uuid::new_v4().to_string();
        let now = Local::now().to_rfc3339();
        let _ = conn.execute(
            "INSERT INTO cash_bank_transfers (id, direction, bank_account_id, amount, notes, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![tx_id, direction, target_acct, amount, notes, now],
        );

        DatabaseManager::log_audit(
            conn,
            "DEPOSIT",
            "BANK_ACCOUNT",
            target_acct,
            &format!("Deposited {:.2} from Cash Drawer to Bank: {}", amount, notes),
        )
        .ok();
    } else {
        // Withdraw bank cash to register drawer float
        let mut updated = conn.execute(
            "UPDATE bank_accounts SET current_balance = current_balance - ?1 WHERE id = ?2",
            params![amount, target_acct],
        )
        .map_err(|e| e.to_string())?;

        if updated == 0 {
            updated = conn.execute(
                "UPDATE bank_accounts SET current_balance = current_balance - ?1 WHERE is_primary = 1",
                params![amount],
            )
            .unwrap_or(0);
        }

        if updated == 0 {
            let now = Local::now().to_rfc3339();
            let _ = conn.execute(
                "INSERT INTO bank_accounts (id, account_name, bank_name, account_number, current_balance, is_primary, created_at)
                 VALUES ('BANK-PRIMARY', 'Primary Operating Account', 'Commercial Bank', '0001', ?1, 1, ?2)",
                params![-amount, now],
            );
        }

        let tx_id = Uuid::new_v4().to_string();
        let now = Local::now().to_rfc3339();
        let _ = conn.execute(
            "INSERT INTO cash_bank_transfers (id, direction, bank_account_id, amount, notes, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![tx_id, direction, target_acct, amount, notes, now],
        );

        DatabaseManager::log_audit(
            conn,
            "WITHDRAWAL",
            "BANK_ACCOUNT",
            target_acct,
            &format!("Withdrew {:.2} from Bank to Cash Drawer: {}", amount, notes),
        )
        .ok();
    }

    Ok(true)
}

#[tauri::command]
pub fn transfer_cash_bank(
    direction: String, // "CASH_TO_BANK" | "BANK_TO_CASH"
    bank_account_id: String,
    amount: f64,
    notes: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    transfer_cash_bank_internal(&conn, &direction, &bank_account_id, amount, &notes)
}

pub fn record_deposit_internal(
    conn: &rusqlite::Connection,
    payload: &DepositPayload,
) -> Result<(f64, f64), String> {
    if payload.amount <= 0.0 || !payload.amount.is_finite() {
        return Err("Deposit amount must be greater than zero".to_string());
    }

    let upper_dest = payload.destination.to_uppercase();
    let now_ts = Local::now().to_rfc3339();
    let deposit_date = if payload.date.trim().is_empty() {
        Local::now().format("%Y-%m-%d").to_string()
    } else {
        payload.date.trim().to_string()
    };
    let ref_str = if payload.reference.trim().is_empty() {
        format!("DEP-{}", &Uuid::new_v4().to_string()[..8].to_uppercase())
    } else {
        payload.reference.trim().to_string()
    };

    let apply_bank_deposit = |bank_amt: f64| {
        if bank_amt <= 0.005 {
            return;
        }
        let bank_acc_id = match payload.bank_account_id {
            Some(ref bid) if !bid.trim().is_empty() => bid.trim().to_string(),
            _ => "BANK-PRIMARY".to_string(),
        };

        let mut updated = conn
            .execute(
                "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE id = ?2",
                params![bank_amt, bank_acc_id],
            )
            .unwrap_or(0);

        if updated == 0 {
            updated = conn
                .execute(
                    "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                    params![bank_amt],
                )
                .unwrap_or(0);
        }

        if updated == 0 {
            let (_, bank_bal) = calculate_liquidity_internal(conn).unwrap_or((0.0, 0.0));
            let _ = conn.execute(
                "INSERT INTO bank_accounts (id, account_name, bank_name, account_number, current_balance, is_primary, created_at)
                 VALUES ('BANK-PRIMARY', 'Primary Operating Account', 'Commercial Bank', '0001', ?1, 1, ?2)",
                params![bank_bal, now_ts],
            );
        }
    };

    if upper_dest == "CASH" {
        // Operational cash drawer deposit / float topup (stored in deposits table so settings.capital_cash remains Owner Capital)
        conn.execute(
            "INSERT INTO deposits (id, deposit_type, account_type, bank_account_id, cash_amount, bank_amount, notes, deposit_date, timestamp)
             VALUES (?1, 'CASH', 'CASH', '', ?2, 0.0, ?3, ?4, ?5)",
            params![
                ref_str,
                payload.amount,
                if payload.notes.trim().is_empty() { payload.source.trim().to_string() } else { format!("{} - {}", payload.source.trim(), payload.notes.trim()) },
                deposit_date,
                now_ts,
            ],
        )
        .map_err(|e| e.to_string())?;

        DatabaseManager::log_audit(
            conn,
            "DEPOSIT",
            "CASH_DRAWER",
            &ref_str,
            &format!(
                "Deposited {:.2} to Cash Drawer. Source: {}. Notes: {}",
                payload.amount, payload.source, payload.notes
            ),
        )
        .ok();
    } else if upper_dest == "BANK" {
        let target_bank = payload.bank_account_id.as_deref().unwrap_or("").trim().to_string();
        conn.execute(
            "INSERT INTO deposits (id, deposit_type, account_type, bank_account_id, cash_amount, bank_amount, notes, deposit_date, timestamp)
             VALUES (?1, 'BANK', 'BANK', ?2, 0.0, ?3, ?4, ?5, ?6)",
            params![
                ref_str,
                target_bank,
                payload.amount,
                if payload.notes.trim().is_empty() { payload.source.trim().to_string() } else { format!("{} - {}", payload.source.trim(), payload.notes.trim()) },
                deposit_date,
                now_ts,
            ],
        )
        .map_err(|e| e.to_string())?;

        apply_bank_deposit(payload.amount);

        DatabaseManager::log_audit(
            conn,
            "DEPOSIT",
            "BANK_ACCOUNT",
            &ref_str,
            &format!(
                "Deposited {:.2} to Bank Account. Source: {}. Notes: {}",
                payload.amount, payload.source, payload.notes
            ),
        )
        .ok();
    } else {
        // Owner Capital Equity Injection ("CASH" | "BANK" | "SPLIT")
        let (cap_mode, cur_cap_cash, cur_cap_bank): (String, f64, f64) = conn
            .query_row(
                "SELECT COALESCE(capital_mode, 'CASH'), COALESCE(capital_cash, 0.0), COALESCE(capital_bank, 0.0) FROM settings WHERE id = 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap_or_else(|_| ("CASH".to_string(), 0.0, 0.0));

        let mode_upper = cap_mode.trim().to_uppercase();
        let (cash_inj, bank_inj) = if mode_upper == "BANK" {
            (0.0, payload.amount)
        } else if mode_upper == "SPLIT" {
            let total_cap = cur_cap_cash + cur_cap_bank;
            let cash_share = if total_cap > 0.01 {
                ((payload.amount * (cur_cap_cash / total_cap)) * 100.0).round() / 100.0
            } else {
                ((payload.amount / 2.0) * 100.0).round() / 100.0
            };
            (cash_share, ((payload.amount - cash_share) * 100.0).round() / 100.0)
        } else {
            (payload.amount, 0.0)
        };

        conn.execute(
            "UPDATE settings SET capital_cash = capital_cash + ?1, capital_bank = capital_bank + ?2 WHERE id = 1",
            params![cash_inj, bank_inj],
        )
        .map_err(|e| e.to_string())?;

        if bank_inj > 0.005 {
            apply_bank_deposit(bank_inj);
        }

        let target_bank = payload.bank_account_id.as_deref().unwrap_or("").trim().to_string();
        conn.execute(
            "INSERT INTO deposits (id, deposit_type, account_type, bank_account_id, cash_amount, bank_amount, notes, deposit_date, timestamp)
             VALUES (?1, 'CAPITAL', ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                ref_str,
                mode_upper,
                target_bank,
                cash_inj,
                bank_inj,
                if payload.notes.trim().is_empty() { payload.source.trim().to_string() } else { format!("{} - {}", payload.source.trim(), payload.notes.trim()) },
                deposit_date,
                now_ts,
            ],
        )
        .map_err(|e| e.to_string())?;

        DatabaseManager::log_audit(
            conn,
            "CAPITAL_INJECTION",
            "OWNER_CAPITAL",
            &ref_str,
            &format!(
                "Injected {:.2} Owner Capital (Cash: {:.2}, Bank: {:.2}). Source: {}. Notes: {}",
                payload.amount, cash_inj, bank_inj, payload.source, payload.notes
            ),
        )
        .ok();
    }

    calculate_liquidity_internal(conn)
}

#[tauri::command]
pub fn record_deposit(
    payload: DepositPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<(f64, f64), String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    record_deposit_internal(&conn, &payload)
}

#[tauri::command]
pub fn show_main_window(window: tauri::Window) -> Result<bool, String> {
    let _ = window.show();
    let _ = window.set_focus();
    Ok(true)
}

#[tauri::command]
pub fn list_business_loans(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<BusinessLoan>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, loan_name, lender_name, principal_amount, interest_rate,
                    current_balance, monthly_emi, disbursed_date, due_date, status, notes, created_at
             FROM business_loans ORDER BY status ASC, created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |r| {
            Ok(BusinessLoan {
                id: r.get(0)?,
                loan_name: r.get(1)?,
                lender_name: r.get(2)?,
                principal_amount: r.get(3)?,
                interest_rate: r.get(4)?,
                current_balance: r.get(5)?,
                monthly_emi: r.get(6)?,
                disbursed_date: r.get(7)?,
                due_date: r.get(8)?,
                status: r.get(9)?,
                notes: r.get(10)?,
                created_at: r.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows.filter_map(Result::ok) {
        list.push(r);
    }
    Ok(list)
}

#[tauri::command]
pub fn save_business_loan(
    mut loan: BusinessLoan,
    state: State<'_, Mutex<AppState>>,
) -> Result<BusinessLoan, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    if loan.id.is_empty() {
        loan.id = format!("LOAN-{}", Uuid::new_v4().to_string()[..8].to_uppercase());
        loan.created_at = Local::now().to_rfc3339();
        if loan.current_balance == 0.0 {
            loan.current_balance = loan.principal_amount;
        }
    }

    conn.execute(
        "INSERT INTO business_loans (id, loan_name, lender_name, principal_amount, interest_rate,
                                    current_balance, monthly_emi, disbursed_date, due_date, status, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(id) DO UPDATE SET
            loan_name = excluded.loan_name,
            lender_name = excluded.lender_name,
            principal_amount = excluded.principal_amount,
            interest_rate = excluded.interest_rate,
            current_balance = excluded.current_balance,
            monthly_emi = excluded.monthly_emi,
            disbursed_date = excluded.disbursed_date,
            due_date = excluded.due_date,
            status = excluded.status,
            notes = excluded.notes",
        params![
            loan.id,
            loan.loan_name,
            loan.lender_name,
            loan.principal_amount,
            loan.interest_rate,
            loan.current_balance,
            loan.monthly_emi,
            loan.disbursed_date,
            loan.due_date,
            loan.status,
            loan.notes,
            loan.created_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(
        &conn,
        "SAVE",
        "BUSINESS_LOAN",
        &loan.id,
        &format!("Saved loan '{}' from {} (${:.2})", loan.loan_name, loan.lender_name, loan.principal_amount),
    )
    .ok();

    Ok(loan)
}

#[tauri::command]
pub fn record_loan_transaction(
    payload: LoanTransactionPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    if payload.amount <= 0.0 || !payload.amount.is_finite() {
        return Err("Loan transaction amount must be greater than zero".into());
    }

    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let is_bank = !payload.account_type.to_uppercase().contains("CASH");

    if payload.transaction_type == "DRAWDOWN" {
        // Borrowed capital injected into the business
        conn.execute(
            "UPDATE business_loans SET current_balance = current_balance + ?1 WHERE id = ?2",
            params![payload.amount, payload.loan_id],
        )
        .map_err(|e| e.to_string())?;

        if is_bank {
            if let Some(ref bid) = payload.bank_account_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
                conn.execute(
                    "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE id = ?2",
                    params![payload.amount, bid],
                )
                .ok();
            } else {
                conn.execute(
                    "UPDATE bank_accounts SET current_balance = current_balance + ?1 WHERE is_primary = 1",
                    params![payload.amount],
                )
                .ok();
            }
        }

        DatabaseManager::log_audit(
            &conn,
            "DRAWDOWN",
            "BUSINESS_LOAN",
            &payload.loan_id,
            &format!("Injected loan capital of {:.2} into business: {}", payload.amount, payload.notes),
        )
        .ok();
    } else {
        // Repaying loan / paying monthly installment
        conn.execute(
            "UPDATE business_loans SET current_balance = MAX(0.0, current_balance - ?1) WHERE id = ?2",
            params![payload.amount, payload.loan_id],
        )
        .map_err(|e| e.to_string())?;

        let balance: f64 = conn
            .query_row("SELECT current_balance FROM business_loans WHERE id = ?1", params![payload.loan_id], |r| r.get(0))
            .unwrap_or(0.0);

        if balance <= 0.005 {
            conn.execute("UPDATE business_loans SET status = 'PAID_OFF' WHERE id = ?1", params![payload.loan_id]).ok();
        }

        if is_bank {
            if let Some(ref bid) = payload.bank_account_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
                conn.execute(
                    "UPDATE bank_accounts SET current_balance = current_balance - ?1 WHERE id = ?2",
                    params![payload.amount, bid],
                )
                .ok();
            } else {
                conn.execute(
                    "UPDATE bank_accounts SET current_balance = current_balance - ?1 WHERE is_primary = 1",
                    params![payload.amount],
                )
                .ok();
            }
        }

        DatabaseManager::log_audit(
            &conn,
            "REPAYMENT",
            "BUSINESS_LOAN",
            &payload.loan_id,
            &format!("Repaid {:.2} against loan debt: {}", payload.amount, payload.notes),
        )
        .ok();
    }

    let tx_id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();
    let _ = conn.execute(
        "INSERT INTO loan_transactions (id, loan_id, transaction_type, account_type, bank_account_id, amount, notes, timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![tx_id, payload.loan_id, payload.transaction_type, payload.account_type, payload.bank_account_id, payload.amount, payload.notes, now],
    );

    let _ = create_database_backup_internal(&conn);
    Ok(true)
}

pub fn pay_supplier_bill_internal(
    conn: &mut rusqlite::Connection,
    mut payload: SupplierPaymentPayload,
) -> Result<bool, String> {
    if payload.amount <= 0.0 || !payload.amount.is_finite() {
        return Err("Supplier payment amount must be greater than zero".into());
    }
    if payload.party_id.trim().is_empty() {
        return Err("Supplier party_id is required".into());
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let party_exists: bool = tx
        .query_row(
            "SELECT 1 FROM parties WHERE id = ?1",
            params![payload.party_id],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if !party_exists {
        return Err("Selected supplier party does not exist".into());
    }

    if let Some(ref inv_id) = payload.invoice_id {
        if inv_id.trim().is_empty() {
            payload.invoice_id = None;
        }
    }
    if let Some(ref bid) = payload.bank_account_id {
        if bid.trim().is_empty() {
            payload.bank_account_id = None;
        }
    }

    let payment_id = Uuid::new_v4().to_string();
    let pay_date = payload
        .payment_date
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| Local::now().format("%Y-%m-%d").to_string());

    tx.execute(
        "INSERT INTO payments (id, invoice_id, party_id, party_name, amount,
                              payment_type, payment_method, payment_date, reference, notes, bank_account_id)
         VALUES (?1, ?2, ?3, ?4, ?5, 'OUT', ?6, ?7, ?8, ?9, ?10)",
        params![
            payment_id,
            payload.invoice_id,
            payload.party_id,
            payload.party_name,
            payload.amount,
            payload.payment_method,
            pay_date,
            payload.reference,
            payload.notes,
            payload.bank_account_id.as_deref().unwrap_or(""),
        ],
    )
    .map_err(|e| e.to_string())?;

    // Paying vendor reduces our payable (in LynTerminal, vendor payables are negative so paying adds to current_balance)
    tx.execute(
        "UPDATE parties SET current_balance = current_balance + ?1 WHERE id = ?2",
        params![payload.amount, payload.party_id],
    )
    .map_err(|e| e.to_string())?;

    // Deduct from bank account for any bank/card/UPI/transfer tender, falling back to primary bank account
    let (_, bank_part) = parse_payment_liquidity(&payload.payment_method, payload.amount);
    if bank_part > 0.0 {
        if let Some(ref bid) = payload.bank_account_id {
            tx.execute(
                "UPDATE bank_accounts SET current_balance = current_balance - ?1 WHERE id = ?2",
                params![bank_part, bid],
            )
            .ok();
        } else {
            tx.execute(
                "UPDATE bank_accounts SET current_balance = current_balance - ?1 WHERE is_primary = 1",
                params![bank_part],
            )
            .ok();
        }
    }

    // Update specific purchase bill (capped at due, excess spills FIFO) OR FIFO-allocate across unpaid/partial PURCHASE bills
    if let Some(ref inv_id) = payload.invoice_id {
        let (total, paid): (f64, f64) = tx
            .query_row(
                "SELECT total_amount, paid_amount FROM invoices WHERE id = ?1",
                params![inv_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(|_| "Selected purchase invoice does not exist".to_string())?;

        let due = (total - paid).max(0.0);
        let alloc = payload.amount.min(due);
        let mut excess = payload.amount - alloc;

        if alloc > 0.005 {
            let new_paid = ((paid + alloc).min(total) * 100.0).round() / 100.0;
            let new_status = if new_paid >= total - 0.01 {
                "PAID"
            } else if new_paid > 0.01 {
                "PARTIAL"
            } else {
                "UNPAID"
            };

            tx.execute(
                "UPDATE invoices SET paid_amount = ?1, status = ?2 WHERE id = ?3",
                params![new_paid, new_status, inv_id],
            )
            .ok();

            let _ = tx.execute(
                "INSERT INTO bill_settlements (
                    id, payment_id, invoice_id, party_id, settled_amount, settlement_date, notes
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    Uuid::new_v4().to_string(),
                    payment_id,
                    inv_id,
                    payload.party_id,
                    alloc,
                    pay_date,
                    payload.notes,
                ],
            );
        }

        if excess > 0.005 {
            let open_bills: Vec<(String, f64, f64)> = {
                let mut stmt = tx
                    .prepare(
                        "SELECT id, total_amount, paid_amount FROM invoices
                         WHERE party_id = ?1
                           AND id != ?2
                           AND invoice_type = 'PURCHASE'
                           AND status NOT IN ('PAID', 'RETURNED', 'CANCELLED')
                           AND (total_amount - paid_amount) > 0.01
                         ORDER BY invoice_date ASC, created_at ASC",
                    )
                    .map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map(params![payload.party_id, inv_id], |r| {
                        Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?, r.get::<_, f64>(2)?))
                    })
                    .map_err(|e| e.to_string())?
                    .filter_map(Result::ok)
                    .collect();
                rows
            };
            for (bill_id, total_amt, paid_amt) in open_bills {
                if excess <= 0.005 {
                    break;
                }
                let b_due = (total_amt - paid_amt).max(0.0);
                if b_due <= 0.005 {
                    continue;
                }
                let b_alloc = excess.min(b_due);
                let b_new_paid = ((paid_amt + b_alloc) * 100.0).round() / 100.0;
                let b_new_status = if b_new_paid >= total_amt - 0.01 { "PAID" } else { "PARTIAL" };
                tx.execute(
                    "UPDATE invoices SET paid_amount = ?1, status = ?2 WHERE id = ?3",
                    params![b_new_paid, b_new_status, bill_id],
                )
                .ok();
                let _ = tx.execute(
                    "INSERT INTO bill_settlements (
                        id, payment_id, invoice_id, party_id, settled_amount, settlement_date, notes
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        Uuid::new_v4().to_string(),
                        payment_id,
                        bill_id,
                        payload.party_id,
                        b_alloc,
                        pay_date,
                        payload.notes,
                    ],
                );
                excess -= b_alloc;
            }
        }
    } else {
        let open_bills: Vec<(String, f64, f64)> = {
            let mut stmt = tx
                .prepare(
                    "SELECT id, total_amount, paid_amount FROM invoices
                     WHERE party_id = ?1
                       AND invoice_type = 'PURCHASE'
                       AND status NOT IN ('PAID', 'RETURNED', 'CANCELLED')
                       AND (total_amount - paid_amount) > 0.01
                     ORDER BY invoice_date ASC, created_at ASC",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![payload.party_id], |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?, r.get::<_, f64>(2)?))
                })
                .map_err(|e| e.to_string())?
                .filter_map(Result::ok)
                .collect();
            rows
        };

        let mut remaining = payload.amount;
        for (bill_id, total_amt, paid_amt) in open_bills {
            if remaining <= 0.005 {
                break;
            }
            let due = (total_amt - paid_amt).max(0.0);
            if due <= 0.005 {
                continue;
            }
            let alloc = remaining.min(due);
            let new_paid = ((paid_amt + alloc) * 100.0).round() / 100.0;
            let new_status = if new_paid >= total_amt - 0.01 { "PAID" } else { "PARTIAL" };

            tx.execute(
                "UPDATE invoices SET paid_amount = ?1, status = ?2 WHERE id = ?3",
                params![new_paid, new_status, bill_id],
            )
            .ok();

            let _ = tx.execute(
                "INSERT INTO bill_settlements (
                    id, payment_id, invoice_id, party_id, settled_amount, settlement_date, notes
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    Uuid::new_v4().to_string(),
                    payment_id,
                    bill_id,
                    payload.party_id,
                    alloc,
                    pay_date,
                    payload.notes,
                ],
            );
            remaining -= alloc;
        }
    }

    DatabaseManager::log_audit(
        &tx,
        "PAYMENT_OUT",
        "PARTY",
        &payload.party_id,
        &format!("Paid supplier {} ${:.2} via {}", payload.party_name, payload.amount, payload.payment_method),
    )
    .ok();

    tx.commit().map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn pay_supplier_bill(
    payload: SupplierPaymentPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let res = pay_supplier_bill_internal(&mut conn, payload)?;
    let _ = create_database_backup_internal(&conn);
    Ok(res)
}

// ----------------------------------------------------------------------------
// MONTHLY RECURRING BILLS (RENT, LOAN INTEREST, ELECTRICITY, SUBSCRIPTIONS)
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn list_recurring_bills(state: State<'_, Mutex<AppState>>) -> Result<Vec<RecurringBill>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    // Automatically cycle PAID recurring bills from prior months back to DUE at month rollover
    let current_ym = chrono::Local::now().format("%Y-%m").to_string();
    let _ = conn.execute(
        "UPDATE recurring_bills
         SET status = 'DUE'
         WHERE status = 'PAID'
           AND last_paid_date IS NOT NULL
           AND TRIM(last_paid_date) != ''
           AND substr(last_paid_date, 1, 7) < ?1",
        params![current_ym],
    );

    let mut stmt = conn
        .prepare(
            "SELECT id, title, category, due_day, estimated_amount, status,
                    last_paid_date, last_paid_amount, payment_method, notes, created_at
             FROM recurring_bills ORDER BY due_day ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |r| {
            Ok(RecurringBill {
                id: r.get(0)?,
                title: r.get(1)?,
                category: r.get(2)?,
                due_day: r.get(3)?,
                estimated_amount: r.get(4)?,
                status: r.get(5)?,
                last_paid_date: r.get(6)?,
                last_paid_amount: r.get(7)?,
                payment_method: r.get(8)?,
                notes: r.get(9)?,
                created_at: r.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut bills = Vec::new();
    for b in rows {
        bills.push(b.map_err(|e| e.to_string())?);
    }
    Ok(bills)
}

#[tauri::command]
pub fn save_recurring_bill(
    bill: RecurringBillPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<RecurringBill, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let id = match bill.id {
        Some(ref existing_id) if !existing_id.trim().is_empty() => existing_id.clone(),
        _ => {
            let next_rec = next_sequence_number(&conn, "recurring_bills", "id", "REC-");
            format!("REC-{:03}", next_rec)
        }
    };
    let clamped_due_day = bill.due_day.clamp(1, 31);

    let now = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO recurring_bills (id, title, category, due_day, estimated_amount, status, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'DUE', ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            category = excluded.category,
            due_day = excluded.due_day,
            estimated_amount = excluded.estimated_amount,
            notes = excluded.notes",
        params![
            id,
            bill.title.trim(),
            bill.category.trim(),
            clamped_due_day,
            bill.estimated_amount,
            bill.notes.trim(),
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(
        &conn,
        "SAVE",
        "RECURRING_BILL",
        &id,
        &format!("Saved recurring commitment {} (Due day {})", bill.title, bill.due_day),
    )
    .ok();

    conn.query_row(
        "SELECT id, title, category, due_day, estimated_amount, status,
                last_paid_date, last_paid_amount, payment_method, notes, created_at
         FROM recurring_bills WHERE id = ?1",
        params![id],
        |r| {
            Ok(RecurringBill {
                id: r.get(0)?,
                title: r.get(1)?,
                category: r.get(2)?,
                due_day: r.get(3)?,
                estimated_amount: r.get(4)?,
                status: r.get(5)?,
                last_paid_date: r.get(6)?,
                last_paid_amount: r.get(7)?,
                payment_method: r.get(8)?,
                notes: r.get(9)?,
                created_at: r.get(10)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_recurring_bill(
    id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM recurring_bills WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(&conn, "DELETE", "RECURRING_BILL", &id, "Removed recurring bill").ok();
    Ok(true)
}

#[tauri::command]
pub fn pay_recurring_bill(
    payload: PayRecurringBillPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<RecurringBill, String> {
    if payload.amount <= 0.0 || !payload.amount.is_finite() {
        return Err("Bill payment amount must be greater than zero.".into());
    }

    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 1. Fetch the recurring bill details & enforce single payment per billing cycle
    let (title, category, status, last_paid_date): (String, String, String, Option<String>) = tx
        .query_row(
            "SELECT title, category, status, last_paid_date FROM recurring_bills WHERE id = ?1",
            params![payload.bill_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|e| format!("Recurring bill not found: {}", e))?;

    let pay_ym: String = payload.payment_date.chars().take(7).collect();
    if status == "PAID" {
        if let Some(ref lpd) = last_paid_date {
            let lpd_ym: String = lpd.chars().take(7).collect();
            if !pay_ym.is_empty() && lpd_ym == pay_ym {
                return Err(format!("'{}' is already marked PAID for {}. Wait until next cycle to pay again.", title, pay_ym));
            }
        }
    }

    // 2. Insert into official expenses table
    let exp_id = format!("EXP-REC-{}", &uuid::Uuid::new_v4().to_string()[..8]);
    let note = if payload.reference.trim().is_empty() {
        format!("{}. Paid via {}", payload.notes, payload.payment_source)
    } else {
        format!("{}. Ref: {}. Paid via {}", payload.notes, payload.reference, payload.payment_source)
    };

    tx.execute(
        "INSERT INTO expenses (id, title, category, amount, payment_method, expense_date, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            exp_id,
            title,
            category,
            payload.amount,
            payload.payment_source,
            payload.payment_date,
            note,
            chrono::Local::now().to_rfc3339()
        ],
    )
    .map_err(|e| e.to_string())?;

    // 3. If paid via non-cash channel (Bank, UPI, Card, Transfer, etc.), deduct from target or primary bank account
    let (_, bank_part) = parse_payment_liquidity(&payload.payment_source, payload.amount);
    if bank_part > 0.0 {
        if let Some(ref bid) = payload.bank_account_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            tx.execute(
                "UPDATE bank_accounts SET current_balance = current_balance - ?1 WHERE id = ?2",
                params![bank_part, bid],
            )
            .ok();
        } else {
            tx.execute(
                "UPDATE bank_accounts SET current_balance = current_balance - ?1 WHERE is_primary = 1",
                params![bank_part],
            )
            .ok();
        }
    }

    // 4. Update the recurring bill status
    tx.execute(
        "UPDATE recurring_bills SET
            status = 'PAID',
            last_paid_date = ?1,
            last_paid_amount = ?2,
            payment_method = ?3
         WHERE id = ?4",
        params![payload.payment_date, payload.amount, payload.payment_source, payload.bill_id],
    )
    .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(
        &tx,
        "PAY",
        "RECURRING_BILL",
        &payload.bill_id,
        &format!("Paid recurring bill {} for ${:.2} via {}", title, payload.amount, payload.payment_source),
    )
    .ok();

    tx.commit().map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, title, category, due_day, estimated_amount, status,
                last_paid_date, last_paid_amount, payment_method, notes, created_at
         FROM recurring_bills WHERE id = ?1",
        params![payload.bill_id],
        |r| {
            Ok(RecurringBill {
                id: r.get(0)?,
                title: r.get(1)?,
                category: r.get(2)?,
                due_day: r.get(3)?,
                estimated_amount: r.get(4)?,
                status: r.get(5)?,
                last_paid_date: r.get(6)?,
                last_paid_amount: r.get(7)?,
                payment_method: r.get(8)?,
                notes: r.get(9)?,
                created_at: r.get(10)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

// ----------------------------------------------------------------------------
// OWNER MODE: EMPLOYEE ATTENDANCE, WORK, SALARY & STATS
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn list_employees(
    include_inactive: Option<bool>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<Employee>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let show_inactive = include_inactive.unwrap_or(false);

    let sql = if show_inactive {
        "SELECT id, name, role, phone, email, monthly_salary, salary_type, status, joining_date, notes, created_at
         FROM employees ORDER BY status ASC, name ASC"
    } else {
        "SELECT id, name, role, phone, email, monthly_salary, salary_type, status, joining_date, notes, created_at
         FROM employees WHERE status = 'ACTIVE' ORDER BY name ASC"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |r| {
            Ok(Employee {
                id: r.get(0)?,
                name: r.get(1)?,
                role: r.get(2)?,
                phone: r.get(3)?,
                email: r.get(4)?,
                monthly_salary: r.get(5)?,
                salary_type: r.get(6)?,
                status: r.get(7)?,
                joining_date: r.get(8)?,
                notes: r.get(9)?,
                created_at: r.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut emps = Vec::new();
    for emp in rows {
        emps.push(emp.map_err(|e| e.to_string())?);
    }
    Ok(emps)
}

#[tauri::command]
pub fn save_employee(
    employee: EmployeePayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<Employee, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    if employee.name.trim().is_empty() {
        return Err("Employee name is required.".into());
    }

    let id = match employee.id {
        Some(ref existing_id) if !existing_id.trim().is_empty() => existing_id.clone(),
        _ => {
            let next_emp = next_sequence_number(&conn, "employees", "id", "EMP-");
            format!("EMP-{:03}", next_emp)
        }
    };

    let now = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO employees (id, name, role, phone, email, monthly_salary, salary_type, status, joining_date, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            role = excluded.role,
            phone = excluded.phone,
            email = excluded.email,
            monthly_salary = excluded.monthly_salary,
            salary_type = excluded.salary_type,
            status = excluded.status,
            joining_date = excluded.joining_date,
            notes = excluded.notes",
        params![
            id,
            employee.name.trim(),
            employee.role.trim(),
            employee.phone.trim(),
            employee.email.trim(),
            employee.monthly_salary,
            employee.salary_type.trim(),
            employee.status.trim(),
            employee.joining_date.trim(),
            employee.notes.trim(),
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(
        &conn,
        "SAVE",
        "EMPLOYEE",
        &id,
        &format!("Saved employee {} ({})", employee.name, employee.role),
    )
    .ok();

    conn.query_row(
        "SELECT id, name, role, phone, email, monthly_salary, salary_type, status, joining_date, notes, created_at
         FROM employees WHERE id = ?1",
        params![id],
        |r| {
            Ok(Employee {
                id: r.get(0)?,
                name: r.get(1)?,
                role: r.get(2)?,
                phone: r.get(3)?,
                email: r.get(4)?,
                monthly_salary: r.get(5)?,
                salary_type: r.get(6)?,
                status: r.get(7)?,
                joining_date: r.get(8)?,
                notes: r.get(9)?,
                created_at: r.get(10)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_employee(
    id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let sal_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM salary_payments WHERE employee_id = ?1",
            params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if sal_count > 0 {
        return Err(
            "Cannot delete staff member with historical salary payroll vouchers. Edit their status to INACTIVE instead to preserve payroll and expense integrity."
                .into(),
        );
    }

    conn.execute("DELETE FROM employee_attendance WHERE employee_id = ?1", params![id]).ok();
    conn.execute("DELETE FROM employees WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(&conn, "DELETE", "EMPLOYEE", &id, "Removed employee record").ok();
    Ok(true)
}

#[tauri::command]
pub fn record_attendance(
    payload: RecordAttendancePayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<EmployeeAttendance, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let (emp_name,): (String,) = conn
        .query_row(
            "SELECT name FROM employees WHERE id = ?1",
            params![payload.employee_id],
            |r| Ok((r.get(0)?,)),
        )
        .map_err(|e| format!("Employee not found: {}", e))?;

    let att_id = format!("ATT-{}-{}", payload.employee_id, payload.attendance_date);
    let now = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO employee_attendance (id, employee_id, attendance_date, status, check_in, check_out, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(employee_id, attendance_date) DO UPDATE SET
            status = excluded.status,
            check_in = excluded.check_in,
            check_out = excluded.check_out,
            notes = excluded.notes",
        params![
            att_id,
            payload.employee_id,
            payload.attendance_date,
            payload.status,
            payload.check_in,
            payload.check_out,
            payload.notes,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(EmployeeAttendance {
        id: att_id,
        employee_id: payload.employee_id,
        employee_name: emp_name,
        attendance_date: payload.attendance_date,
        status: payload.status,
        check_in: payload.check_in,
        check_out: payload.check_out,
        notes: payload.notes,
        created_at: now,
    })
}

#[tauri::command]
pub fn list_attendance(
    date: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<EmployeeAttendance>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let target_date = date.unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.employee_id, e.name, a.attendance_date, a.status,
                    a.check_in, a.check_out, a.notes, a.created_at
             FROM employee_attendance a
             JOIN employees e ON a.employee_id = e.id
             WHERE a.attendance_date = ?1
             ORDER BY e.name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![target_date], |r| {
            Ok(EmployeeAttendance {
                id: r.get(0)?,
                employee_id: r.get(1)?,
                employee_name: r.get(2)?,
                attendance_date: r.get(3)?,
                status: r.get(4)?,
                check_in: r.get(5)?,
                check_out: r.get(6)?,
                notes: r.get(7)?,
                created_at: r.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for row in rows {
        list.push(row.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn pay_salary(
    payload: PaySalaryPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<SalaryPayment, String> {
    if payload.amount <= 0.0 || !payload.amount.is_finite() {
        return Err("Salary payment amount must be greater than zero.".into());
    }

    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (emp_name,): (String,) = tx
        .query_row(
            "SELECT name FROM employees WHERE id = ?1",
            params![payload.employee_id],
            |r| Ok((r.get(0)?,)),
        )
        .map_err(|e| format!("Employee not found: {}", e))?;

    let next_sal_n = next_sequence_number(&tx, "salary_payments", "voucher_number", "SAL-");
    let voucher_number = format!("SAL-{:04}", next_sal_n);
    let payment_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Local::now().to_rfc3339();

    // 1. Record salary payment
    tx.execute(
        "INSERT INTO salary_payments (id, voucher_number, employee_id, employee_name, amount, payment_date, payment_source, for_month, days_present, bonus, deductions, reference, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            payment_id,
            voucher_number,
            payload.employee_id,
            emp_name,
            payload.amount,
            payload.payment_date,
            payload.payment_source,
            payload.for_month,
            payload.days_present,
            payload.bonus,
            payload.deductions,
            payload.reference,
            payload.notes,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    // 2. Also record in expenses table under category "Payroll"
    let exp_id = format!("EXP-SAL-{}", &uuid::Uuid::new_v4().to_string()[..8]);
    let expense_note = format!(
        "Staff salary payout for {} ({}) - Voucher #{}. Paid via {}",
        emp_name, payload.for_month, voucher_number, payload.payment_source
    );

    tx.execute(
        "INSERT INTO expenses (id, title, category, amount, payment_method, expense_date, notes, created_at)
         VALUES (?1, ?2, 'Payroll', ?3, ?4, ?5, ?6, ?7)",
        params![
            exp_id,
            format!("Salary: {}", emp_name),
            payload.amount,
            payload.payment_source,
            payload.payment_date,
            expense_note,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    // 3. If paid via non-cash channel (Bank/UPI/Transfer), debit bank account
    let (_, bank_part) = parse_payment_liquidity(&payload.payment_source, payload.amount);
    if bank_part > 0.0 {
        if let Some(ref bid) = payload.bank_account_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            tx.execute(
                "UPDATE bank_accounts SET current_balance = current_balance - ?1 WHERE id = ?2",
                params![bank_part, bid],
            )
            .ok();
        } else {
            tx.execute(
                "UPDATE bank_accounts SET current_balance = current_balance - ?1 WHERE is_primary = 1",
                params![bank_part],
            )
            .ok();
        }
    }

    DatabaseManager::log_audit(
        &tx,
        "PAY_SALARY",
        "EMPLOYEE",
        &payload.employee_id,
        &format!("Disbursed salary of ${:.2} to {} for {} via {}", payload.amount, emp_name, payload.for_month, payload.payment_source),
    )
    .ok();

    tx.commit().map_err(|e| e.to_string())?;

    Ok(SalaryPayment {
        id: payment_id,
        voucher_number,
        employee_id: payload.employee_id,
        employee_name: emp_name,
        amount: payload.amount,
        payment_date: payload.payment_date,
        payment_source: payload.payment_source,
        for_month: payload.for_month,
        days_present: payload.days_present,
        bonus: payload.bonus,
        deductions: payload.deductions,
        reference: payload.reference,
        notes: payload.notes,
        created_at: now,
    })
}

#[tauri::command]
pub fn list_salary_payments(
    employee_id: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<SalaryPayment>, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let filtered_eid = employee_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());

    let sql = if filtered_eid.is_some() {
        "SELECT id, voucher_number, employee_id, employee_name, amount, payment_date,
                payment_source, for_month, days_present, bonus, deductions, reference, notes, created_at
         FROM salary_payments WHERE employee_id = ?1 ORDER BY rowid DESC"
    } else {
        "SELECT id, voucher_number, employee_id, employee_name, amount, payment_date,
                payment_source, for_month, days_present, bonus, deductions, reference, notes, created_at
         FROM salary_payments ORDER BY rowid DESC"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let map_row = |r: &rusqlite::Row<'_>| -> rusqlite::Result<SalaryPayment> {
        Ok(SalaryPayment {
            id: r.get(0)?,
            voucher_number: r.get(1)?,
            employee_id: r.get(2)?,
            employee_name: r.get(3)?,
            amount: r.get(4)?,
            payment_date: r.get(5)?,
            payment_source: r.get(6)?,
            for_month: r.get(7)?,
            days_present: r.get(8)?,
            bonus: r.get(9)?,
            deductions: r.get(10)?,
            reference: r.get(11)?,
            notes: r.get(12)?,
            created_at: r.get(13)?,
        })
    };

    let mut payments = Vec::new();
    if let Some(eid) = filtered_eid {
        let rows = stmt.query_map(params![eid], map_row).map_err(|e| e.to_string())?;
        for p in rows {
            payments.push(p.map_err(|e| e.to_string())?);
        }
    } else {
        let rows = stmt.query_map([], map_row).map_err(|e| e.to_string())?;
        for p in rows {
            payments.push(p.map_err(|e| e.to_string())?);
        }
    }
    Ok(payments)
}

#[tauri::command]
pub fn get_staff_stats(state: State<'_, Mutex<AppState>>) -> Result<StaffSummaryStats, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let total_active_employees: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM employees WHERE status = 'ACTIVE'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let present_today: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM employee_attendance WHERE attendance_date = ?1 AND status IN ('PRESENT', 'HALF_DAY')",
            params![today],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let gross_monthly_payroll: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(monthly_salary), 0.0) FROM employees WHERE status = 'ACTIVE'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    let current_month = chrono::Local::now().format("%Y-%m").to_string();
    let total_payroll_paid_this_month: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM salary_payments WHERE for_month = ?1",
            params![current_month],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    let total_monthly_payroll_due = ((gross_monthly_payroll - total_payroll_paid_this_month).max(0.0) * 100.0).round() / 100.0;

    Ok(StaffSummaryStats {
        total_active_employees,
        present_today,
        total_monthly_payroll_due,
        total_payroll_paid_this_month,
    })
}

// ----------------------------------------------------------------------------
// OPENING CAPITAL & CURRENCY RESET (ZERO DATA CORRUPTION SAFETY)
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn update_opening_capital(
    payload: OpeningCapitalPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<Settings, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE settings SET
            opening_cash = ?1,
            opening_bank = ?2,
            opening_balance_mode = ?3,
            capital_cash = ?4,
            capital_bank = ?5,
            capital_mode = ?6
         WHERE id = 1",
        params![
            payload.opening_cash,
            payload.opening_bank,
            payload.opening_balance_mode,
            payload.capital_cash,
            payload.capital_bank,
            payload.capital_mode,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Sync primary operating bank account balance only when operating with a single account (never clobber multi-bank accounts)
    let (_, cash_in_bank) = calculate_liquidity_internal(&conn).unwrap_or((0.0, 0.0));
    let bank_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM bank_accounts", [], |r| r.get(0))
        .unwrap_or(0);

    if bank_count == 0 {
        let now = chrono::Local::now().to_rfc3339();
        conn.execute(
            "INSERT INTO bank_accounts (id, account_name, bank_name, account_number, current_balance, is_primary, created_at)
             VALUES ('BANK-PRIMARY', 'Primary Operating Account', 'Commercial Bank', '0001', ?1, 1, ?2)",
            params![cash_in_bank, now],
        ).ok();
    } else if bank_count == 1 {
        conn.execute(
            "UPDATE bank_accounts SET current_balance = ?1 WHERE is_primary = 1",
            params![cash_in_bank],
        ).ok();
    }

    DatabaseManager::log_audit(
        &conn,
        "UPDATE",
        "CAPITAL",
        "1",
        &format!(
            "Configured opening balances: Cash ${:.2}, Bank ${:.2} (Mode: {}), Capital: Cash ${:.2}, Bank ${:.2} (Mode: {})",
            payload.opening_cash, payload.opening_bank, payload.opening_balance_mode,
            payload.capital_cash, payload.capital_bank, payload.capital_mode
        ),
    )
    .ok();

    get_settings_internal(&conn)
}

pub fn switch_currency_and_reset_data_internal(
    conn: &mut Connection,
    payload: SwitchCurrencyPayload,
) -> Result<Settings, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Clear all financial transactions to prevent mixed-currency corruption
    tx.execute("DELETE FROM bill_settlements", []).ok();
    tx.execute("DELETE FROM gst_invoice_items", []).ok();
    tx.execute("DELETE FROM gst_invoices", []).ok();
    tx.execute("DELETE FROM invoice_items", []).ok();
    tx.execute("DELETE FROM invoices", []).ok();
    tx.execute("DELETE FROM payments", []).ok();
    tx.execute("DELETE FROM expenses", []).ok();
    tx.execute("DELETE FROM stock_movements", []).ok();
    tx.execute("DELETE FROM cash_closings", []).ok();
    tx.execute("DELETE FROM purchase_orders", []).ok();
    tx.execute("DELETE FROM estimate_items", []).ok();
    tx.execute("DELETE FROM estimates", []).ok();
    tx.execute("DELETE FROM purchase_return_items", []).ok();
    tx.execute("DELETE FROM purchase_returns", []).ok();
    tx.execute("DELETE FROM salary_payments", []).ok();
    tx.execute("DELETE FROM employee_attendance", []).ok();
    tx.execute("DELETE FROM cash_bank_transfers", []).ok();
    tx.execute("DELETE FROM loan_transactions", []).ok();
    tx.execute("DELETE FROM business_loans", []).ok();
    tx.execute("DELETE FROM recurring_bills", []).ok();
    tx.execute("DELETE FROM bank_accounts", []).ok();

    // Reset customer & supplier balances to 0
    tx.execute("UPDATE parties SET current_balance = 0.0, opening_balance = 0.0", []).ok();

    // If preserve_catalog is false, clear products too
    if !payload.preserve_catalog {
        tx.execute("DELETE FROM gst_items", []).ok();
        tx.execute("DELETE FROM items", []).ok();
    }

    // Update settings with new currency and reset opening/capital balances
    tx.execute(
        "UPDATE settings SET currency_code = ?1, currency_symbol = ?2, opening_cash = 0.0, opening_bank = 0.0, capital_cash = 0.0, capital_bank = 0.0 WHERE id = 1",
        params![payload.new_currency_code.trim(), payload.new_currency_symbol.trim()],
    )
    .map_err(|e| e.to_string())?;

    // Sync GST module enablement with INR vs non-INR currency
    let is_inr = payload.new_currency_code.trim().eq_ignore_ascii_case("INR");
    tx.execute(
        "UPDATE gst_settings SET is_enabled = ?1 WHERE id = 1",
        params![if is_inr { 1 } else { 0 }],
    )
    .ok();

    DatabaseManager::log_audit(
        &tx,
        "RESET_SWITCH_CURRENCY",
        "SYSTEM",
        "1",
        &format!("Switched operating currency to {} ({}) with fresh data reset", payload.new_currency_code, payload.new_currency_symbol),
    )
    .ok();

    tx.commit().map_err(|e| e.to_string())?;

    get_settings_internal(conn)
}

#[tauri::command]
pub fn switch_currency_and_reset_data(
    payload: SwitchCurrencyPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<Settings, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let mut conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    // 1. Perform automated safety backup before clearing anything
    let _ = create_database_backup_internal(&conn);

    switch_currency_and_reset_data_internal(&mut conn, payload)
}

// ----------------------------------------------------------------------------
// AUTH, SECURITY & ONBOARDING COMMANDS
// ----------------------------------------------------------------------------

fn compute_password_hash(password: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(salt.as_bytes());
    hex::encode(hasher.finalize())
}

fn normalize_key(code: &str) -> String {
    code.chars().filter(|c| c.is_alphanumeric()).collect::<String>().to_uppercase()
}

#[tauri::command]
pub fn get_auth_state(state: State<'_, Mutex<AppState>>) -> Result<AuthState, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let row = conn.query_row(
        "SELECT username, password_hash, is_setup_completed, is_locked FROM app_auth WHERE id = 1",
        [],
        |r| {
            let username: String = r.get(0)?;
            let password_hash: String = r.get(1)?;
            let is_setup_completed: i32 = r.get(2)?;
            let is_locked: i32 = r.get(3)?;
            Ok((username, password_hash, is_setup_completed == 1, is_locked == 1))
        },
    );

    match row {
        Ok((username, hash, setup_done, locked)) => {
            let has_account = !hash.is_empty();
            Ok(AuthState {
                is_setup_completed: setup_done,
                is_locked: locked && has_account,
                username: if username.is_empty() { "admin".into() } else { username },
                has_account,
            })
        }
        Err(_) => Ok(AuthState {
            is_setup_completed: false,
            is_locked: false,
            username: "admin".into(),
            has_account: false,
        }),
    }
}

#[tauri::command]
pub fn complete_setup(
    payload: SetupPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let raw_username = payload.username.trim();
    let username = if raw_username.is_empty() { "admin" } else { raw_username };
    let pwd = payload.password.trim();
    let recovery_code = payload.recovery_code.trim();

    let (hash, salt, stored_code) = if pwd.is_empty() {
        // App lock skipped by user during onboarding
        (String::new(), String::new(), String::new())
    } else {
        if pwd.len() < 4 {
            return Err("Password must be at least 4 characters long".into());
        }
        if recovery_code.is_empty() {
            return Err("Recovery code cannot be empty when app lock is configured".into());
        }
        let s = Uuid::new_v4().to_string();
        let h = compute_password_hash(pwd, &s);
        (h, s, recovery_code.to_string())
    };

    let now = Local::now().to_rfc3339();

    conn.execute(
        "UPDATE app_auth
         SET username = ?1,
             password_hash = ?2,
             password_salt = ?3,
             recovery_code = ?4,
             is_setup_completed = 1,
             is_locked = 0,
             created_at = ?5,
             last_login_at = ?5
         WHERE id = 1",
        params![username, hash, salt, stored_code, now],
    )
    .map_err(|e| format!("Failed to update auth table: {}", e))?;

    // Update settings if business name provided
    let b_name = payload.business_name.trim();
    if !b_name.is_empty() {
        let tagline = payload.tagline.unwrap_or_else(|| "Retail, Wholesale & Cafe Management".into());
        let currency_symbol = payload.currency_symbol.unwrap_or_else(|| "$".into());
        let currency_code = payload.currency_code.unwrap_or_else(|| "USD".into());

        conn.execute(
            "UPDATE settings
             SET business_name = ?1,
                 tagline = ?2,
                 currency_symbol = ?3,
                 currency_code = ?4
             WHERE id = 1",
            params![b_name, tagline, currency_symbol, currency_code],
        )
        .map_err(|e| format!("Failed to update settings during onboarding: {}", e))?;

        // Sync fresh store identity to GST profile if it only contains seeded placeholder values
        conn.execute(
            "UPDATE gst_settings
             SET legal_name = ?1,
                 trade_name = '',
                 gstin = '',
                 pan = '',
                 bank_name = '',
                 bank_account_no = '',
                 bank_ifsc = '',
                 bank_branch = '',
                 upi_id = '',
                 updated_at = ?2
             WHERE id = 1
               AND (gstin IN ('27AABCU9603R1ZN', '27AABCU9603R1ZM')
                    OR legal_name = 'LynTerminal India Enterprises Pvt Ltd')",
            params![b_name, now],
        )
        .ok();
    }

    DatabaseManager::log_audit(
        &conn,
        "SETUP_COMPLETED",
        "AUTH",
        username,
        &format!("Initial setup wizard completed for administrator '{}'", username),
    )
    .ok();

    Ok(true)
}

#[tauri::command]
pub fn verify_unlock_password(
    password: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let row = conn.query_row(
        "SELECT username, password_hash, password_salt FROM app_auth WHERE id = 1",
        [],
        |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)),
    ).map_err(|e| format!("Auth record not found: {}", e))?;

    let (username, stored_hash, salt) = row;
    let computed_hash = compute_password_hash(&password, &salt);

    if computed_hash != stored_hash {
        return Err("Incorrect master password. Please verify your password.".into());
    }

    let now = Local::now().to_rfc3339();
    conn.execute(
        "UPDATE app_auth SET is_locked = 0, last_login_at = ?1 WHERE id = 1",
        params![now],
    )
    .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(
        &conn,
        "APP_UNLOCKED",
        "AUTH",
        &username,
        "LynTerminal unlocked with master password",
    )
    .ok();

    Ok(true)
}

#[tauri::command]
pub fn set_app_locked(
    locked: bool,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let val = if locked { 1 } else { 0 };
    conn.execute("UPDATE app_auth SET is_locked = ?1 WHERE id = 1", params![val])
        .map_err(|e| e.to_string())?;

    if locked {
        DatabaseManager::log_audit(
            &conn,
            "APP_LOCKED",
            "AUTH",
            "SYSTEM",
            "LynTerminal locked by user request or shortcut",
        )
        .ok();
    }

    Ok(true)
}

#[tauri::command]
pub fn reset_password_with_recovery_code(
    recovery_code: String,
    new_password: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    if new_password.len() != 4 || !new_password.chars().all(|c| c.is_ascii_digit()) {
        return Err("PIN must be exactly 4 numeric digits".into());
    }

    let (username, stored_code) = conn.query_row(
        "SELECT username, recovery_code FROM app_auth WHERE id = 1",
        [],
        |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
    ).map_err(|e| format!("Failed to read auth state: {}", e))?;

    if normalize_key(&recovery_code) != normalize_key(&stored_code) {
        return Err("Invalid 18-character recovery key. Please check the code you recorded.".into());
    }

    let new_salt = Uuid::new_v4().to_string();
    let new_hash = compute_password_hash(&new_password, &new_salt);
    let now = Local::now().to_rfc3339();

    conn.execute(
        "UPDATE app_auth
         SET password_hash = ?1,
             password_salt = ?2,
             is_locked = 0,
             last_login_at = ?3
         WHERE id = 1",
        params![new_hash, new_salt, now],
    )
    .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(
        &conn,
        "PASSWORD_RESET",
        "AUTH",
        &username,
        "Master password reset successfully via 18-character recovery code",
    )
    .ok();

    Ok(true)
}

#[tauri::command]
pub fn change_password(
    current_password: String,
    new_password: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    if new_password.len() != 4 || !new_password.chars().all(|c| c.is_ascii_digit()) {
        return Err("PIN must be exactly 4 numeric digits".into());
    }

    let (username, stored_hash, salt, stored_recovery) = conn.query_row(
        "SELECT username, password_hash, password_salt, recovery_code FROM app_auth WHERE id = 1",
        [],
        |r| Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, String>(3).unwrap_or_default(),
        )),
    ).map_err(|e| format!("Auth record not found: {}", e))?;

    // Only verify current PIN when a PIN is already configured
    if !stored_hash.trim().is_empty() {
        let check_hash = compute_password_hash(&current_password, &salt);
        if check_hash != stored_hash {
            return Err("Current 4-digit PIN is incorrect".into());
        }
    }

    let new_salt = Uuid::new_v4().to_string();
    let new_hash = compute_password_hash(&new_password, &new_salt);

    // Ensure recovery code exists so View Recovery Key always works
    let recovery_to_save = if stored_recovery.trim().is_empty() {
        let raw = Uuid::new_v4().simple().to_string().to_uppercase();
        format!("LYN-{}-{}-{}-{}", &raw[0..4], &raw[4..8], &raw[8..12], &raw[12..14])
    } else {
        stored_recovery
    };

    conn.execute(
        "UPDATE app_auth
         SET password_hash = ?1,
             password_salt = ?2,
             recovery_code = ?3
         WHERE id = 1",
        params![new_hash, new_salt, recovery_to_save],
    )
    .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(
        &conn,
        "PASSWORD_CHANGED",
        "AUTH",
        &username,
        "4-digit lock PIN configured from Settings",
    )
    .ok();

    Ok(true)
}

#[tauri::command]
pub fn disable_password(
    current_password: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let (username, stored_hash, salt) = conn.query_row(
        "SELECT username, password_hash, password_salt FROM app_auth WHERE id = 1",
        [],
        |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)),
    ).map_err(|e| format!("Auth record not found: {}", e))?;

    if !stored_hash.trim().is_empty() {
        let check_hash = compute_password_hash(&current_password, &salt);
        if check_hash != stored_hash {
            return Err("Current 4-digit PIN is incorrect".into());
        }
    }

    conn.execute(
        "UPDATE app_auth
         SET password_hash = '',
             password_salt = '',
             is_locked = 0
         WHERE id = 1",
        [],
    )
    .map_err(|e| e.to_string())?;

    DatabaseManager::log_audit(
        &conn,
        "PASSWORD_DISABLED",
        "AUTH",
        &username,
        "4-digit lock PIN disabled; reverted to 1-click lock",
    )
    .ok();

    Ok(true)
}

#[tauri::command]
pub fn get_recovery_code(state: State<'_, Mutex<AppState>>) -> Result<String, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;

    let existing: String = conn.query_row(
        "SELECT recovery_code FROM app_auth WHERE id = 1",
        [],
        |r| r.get::<_, String>(0),
    ).unwrap_or_default();

    if !existing.trim().is_empty() {
        return Ok(existing);
    }

    // Auto-generate and persist an 18-character recovery key if none exists yet
    let raw = Uuid::new_v4().simple().to_string().to_uppercase();
    let generated = format!("LYN-{}-{}-{}-{}", &raw[0..4], &raw[4..8], &raw[8..12], &raw[12..14]);
    conn.execute(
        "UPDATE app_auth SET recovery_code = ?1 WHERE id = 1",
        params![generated],
    )
    .map_err(|e| format!("Could not save recovery code: {}", e))?;

    Ok(generated)
}

#[tauri::command]
pub fn restart_app(app_handle: tauri::AppHandle) -> Result<(), String> {
    app_handle.restart();
}

#[tauri::command]
pub fn create_pre_update_backup(
    version: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
    let path = create_pre_update_backup_internal(&conn, &version)?;
    DatabaseManager::log_audit(
        &conn,
        "BACKUP",
        "PRE_UPDATE",
        &version,
        &format!("Created pre-update safety backup before updating to {}: {}", version, path),
    ).ok();
    Ok(path)
}

#[tauri::command]
pub fn check_app_update() -> Result<AppUpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    Ok(AppUpdateInfo {
        current_version: current_version.clone(),
        latest_version: current_version,
        has_update: false,
        release_notes: "".into(),
        published_at: "".into(),
        html_url: "".into(),
        download_url: "".into(),
    })
}

#[tauri::command]
pub fn download_update_binary(
    _download_url: String,
    _target_version: String,
) -> Result<String, String> {
    Err("In-app updates are permanently disabled in this release.".into())
}

#[tauri::command]
pub fn verify_update_binary(
    _target_version: String,
) -> Result<bool, String> {
    Err("In-app updates are permanently disabled in this release.".into())
}

#[tauri::command]
pub fn apply_update_and_restart(
    _target_version: String,
    _app_handle: tauri::AppHandle,
) -> Result<(), String> {
    Err("In-app updates are permanently disabled in this release.".into())
}

#[tauri::command]
pub fn apply_app_update(
    _download_url: String,
    _target_version: String,
    _app_handle: tauri::AppHandle,
    _state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    Err("In-app updates are permanently disabled in this release.".into())
}

#[tauri::command]
pub fn get_license_status(state: State<'_, Mutex<AppState>>) -> Result<LicenseStatus, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    app.db.get_license_status()
}

#[tauri::command]
pub fn activate_license(
    payload: LicenseActivationPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<LicenseStatus, String> {
    let app = state.lock().map_err(|e| e.to_string())?;
    app.db.activate_license(&payload.license_key, payload.customer_email)
}



