use lynterminal_lib::commands::{
    calculate_liquidity_internal, create_invoice_internal, generate_native_invoice_pdf,
    get_settings_internal,
};
use lynterminal_lib::db::{verify_offline_license_key, DatabaseManager};
use lynterminal_lib::models::{InvoiceItemPayload, InvoicePayload};
use rusqlite::params;
use std::sync::Arc;
use std::time::Instant;
use uuid::Uuid;

#[test]
fn test_comprehensive_performance_and_windows_readiness() {
    println!("\n========================================================");
    println!("   LYNTERMINAL v1.5.2 HIGH-PERFORMANCE BENCHMARK SUITE   ");
    println!("   Pre-Windows Release Verification & Latency Profiling  ");
    println!("========================================================");

    // ------------------------------------------------------------------------
    // 1. DATABASE INITIALIZATION & MIGRATIONS BENCHMARK
    // ------------------------------------------------------------------------
    let t_start_init = Instant::now();
    let temp_dir = std::env::temp_dir().join(format!("lyn_perf_{}", Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let db_path = temp_dir.join("lynterminal_perf.db");

    let db = DatabaseManager::open_path(db_path.clone())
        .expect("Disk-backed SQLite DatabaseManager must initialize");
    let init_duration = t_start_init.elapsed();
    println!("✓ [1/7] DB Cold Initialization & 18 Schema Migrations: {:?}", init_duration);
    assert!(
        init_duration.as_millis() < 10_000,
        "DB cold init must complete in under 10s, took {:?}",
        init_duration
    );

    // ------------------------------------------------------------------------
    // 2. BATCH INVENTORY INGESTION & INDEX READ THROUGHPUT (1,000 SKUs)
    // ------------------------------------------------------------------------
    let t_start_batch = Instant::now();
    let item_count = 1000;
    {
        let mut conn = db.conn.lock().unwrap();
        let tx = conn.transaction().unwrap();
        {
            let mut stmt = tx
                .prepare(
                    "INSERT INTO items (
                        id, name, sku, barcode, category, unit,
                        purchase_price, sale_price, stock_quantity, min_stock_alert,
                        godown, created_at
                    ) VALUES (
                        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'Main Store', '2026-11-19 12:00:00'
                    )",
                )
                .unwrap();

            for i in 0..item_count {
                let id = format!("SKU-{:04}", i);
                let name = format!("Commercial Hardware Component #{:04}", i);
                let sku = format!("SKU-{:05}", i);
                let barcode = format!("89012345{:05}", i);
                stmt.execute(params![
                    id, name, sku, barcode, "HARDWARE", "PCS",
                    50.0, 100.0, 500.0, 10.0
                ])
                .unwrap();
            }
        }
        tx.commit().unwrap();
    }
    let batch_duration = t_start_batch.elapsed();
    let items_per_sec = (item_count as f64) / batch_duration.as_secs_f64();
    println!(
        "✓ [2/7] Batch Ingestion of 1,000 SKUs: {:?} ({:.0} SKUs/sec, {:.2} µs/item)",
        batch_duration,
        items_per_sec,
        (batch_duration.as_micros() as f64) / (item_count as f64)
    );
    assert!(
        batch_duration.as_millis() < 10_000,
        "Batch 1000 SKU insertion must complete in under 10s"
    );

    // Search query benchmark
    let t_start_query = Instant::now();
    {
        let conn = db.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, name, sale_price, stock_quantity FROM items WHERE category = 'HARDWARE' LIMIT 50")
            .unwrap();
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, f64>(2)?,
                    r.get::<_, f64>(3)?,
                ))
            })
            .unwrap();
        let count = rows.count();
        assert_eq!(count, 50);
    }
    let query_duration = t_start_query.elapsed();
    println!("✓ [2b/7] Indexed Filter Query (50 items): {:?}", query_duration);
    assert!(
        query_duration.as_millis() < 2_000,
        "Indexed query must finish in under 2s"
    );

    // ------------------------------------------------------------------------
    // 3. POS BILLING THROUGHPUT & TRANSACTION LATENCY (100 FULL INVOICES)
    // ------------------------------------------------------------------------
    let t_start_pos = Instant::now();
    let invoice_count = 100;
    let mut latencies_micros = Vec::with_capacity(invoice_count);

    for i in 0..invoice_count {
        let t_inv = Instant::now();
        let payload = InvoicePayload {
            invoice_type: "TAX_INVOICE".to_string(),
            party_id: None,
            party_name: format!("Customer #{:03}", i),
            invoice_date: "2026-11-19".to_string(),
            due_date: "2026-11-19".to_string(),
            payment_method: if i % 2 == 0 { "Cash".into() } else { "UPI".into() },
            notes: format!("Benchmark bill #{:03}", i),
            items: vec![
                InvoiceItemPayload {
                    item_id: Some("SKU-0001".to_string()),
                    item_name: "Component A".to_string(),
                    quantity: 2.0,
                    unit: "PCS".to_string(),
                    unit_price: 100.0,
                    discount_percent: 0.0,
                    tax_rate: 18.0,
                    line_total: 236.0,
                },
                InvoiceItemPayload {
                    item_id: Some("SKU-0002".to_string()),
                    item_name: "Component B".to_string(),
                    quantity: 1.0,
                    unit: "PCS".to_string(),
                    unit_price: 200.0,
                    discount_percent: 5.0,
                    tax_rate: 18.0,
                    line_total: 224.20,
                },
            ],
            subtotal: 390.0,
            discount_amount: 10.0,
            tax_amount: 70.20,
            total_amount: 460.20,
            paid_amount: 460.20,
            reference: Some(format!("REF-{:04}", i)),
        };

        {
            let mut conn = db.conn.lock().unwrap();
            let _detail = create_invoice_internal(&mut conn, payload)
                .expect("Invoice creation must succeed");
        }
        latencies_micros.push(t_inv.elapsed().as_micros());
    }

    let pos_total_duration = t_start_pos.elapsed();
    latencies_micros.sort_unstable();
    let p50 = latencies_micros[invoice_count * 50 / 100];
    let p95 = latencies_micros[invoice_count * 95 / 100];
    let p99 = latencies_micros[invoice_count * 99 / 100];
    let avg_us = (pos_total_duration.as_micros() as f64) / (invoice_count as f64);
    let inv_per_sec = (invoice_count as f64) / pos_total_duration.as_secs_f64();

    println!(
        "✓ [3/7] POS Billing Engine (100 complete sales): {:?} ({:.1} bills/sec)",
        pos_total_duration, inv_per_sec
    );
    println!(
        "       Avg: {:.2}ms | p50: {:.2}ms | p95: {:.2}ms | p99: {:.2}ms",
        avg_us / 1000.0,
        (p50 as f64) / 1000.0,
        (p95 as f64) / 1000.0,
        (p99 as f64) / 1000.0
    );
    let max_p95 = 200_000;
    assert!(
        p95 < max_p95,
        "p95 invoice creation must be under {}µs, got {}µs",
        max_p95,
        p95
    );

    // ------------------------------------------------------------------------
    // 4. LIQUIDITY CALCULATION & RECONCILIATION LATENCY
    // ------------------------------------------------------------------------
    let t_start_liq = Instant::now();
    let (cash, bank) = {
        let conn = db.conn.lock().unwrap();
        calculate_liquidity_internal(&conn).expect("Liquidity calculation must succeed")
    };
    let liq_duration = t_start_liq.elapsed();
    println!(
        "✓ [4/7] Liquidity Ledger Reconciliation: {:?} (Cash: ${:.2}, Bank: ${:.2})",
        liq_duration, cash, bank
    );
    assert!(
        liq_duration.as_millis() < 2000,
        "Liquidity reconciliation must be under 2s"
    );

    // ------------------------------------------------------------------------
    // 5. NATIVE VECTOR PDF GENERATION LATENCY
    // ------------------------------------------------------------------------
    let t_start_pdf = Instant::now();
    let pdf_count = 10;
    {
        let conn = db.conn.lock().unwrap();
        let settings = get_settings_internal(&conn).unwrap_or_default();
        let invoice = conn
            .query_row(
                "SELECT id, invoice_number, invoice_type, party_id, party_name,
                        invoice_date, due_date, subtotal, discount_amount,
                        tax_amount, total_amount, paid_amount, status,
                        payment_method, notes, created_at, reference
                 FROM invoices LIMIT 1",
                [],
                |row| {
                    Ok(lynterminal_lib::models::Invoice {
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
            .unwrap();

        let detail = lynterminal_lib::models::InvoiceDetail {
            invoice,
            items: vec![],
        };

        for _ in 0..pdf_count {
            let pdf_bytes = generate_native_invoice_pdf(&detail, &settings, "123 High Street, Retail District");
            assert!(!pdf_bytes.is_empty());
        }
    }
    let pdf_duration = t_start_pdf.elapsed();
    let avg_pdf_ms = (pdf_duration.as_millis() as f64) / (pdf_count as f64);
    println!(
        "✓ [5/7] Native Vector PDF Generation ({} documents): {:?} ({:.2}ms per PDF)",
        pdf_count, pdf_duration, avg_pdf_ms
    );
    assert!(
        avg_pdf_ms < 100.0,
        "Native PDF generation must take under 100ms per document"
    );

    // ------------------------------------------------------------------------
    // 6. CRYPTOGRAPHIC LICENSE KEY VERIFICATION (10,000 KEYS)
    // ------------------------------------------------------------------------
    let t_start_license = Instant::now();
    let key_iterations = 10_000;
    let test_key = "LYN-COMM-7A4B-9X2M-E47C-8A19"; // Format test
    for _ in 0..key_iterations {
        let _ = verify_offline_license_key(test_key);
    }
    let license_duration = t_start_license.elapsed();
    let keys_per_sec = (key_iterations as f64) / license_duration.as_secs_f64();
    println!(
        "✓ [6/7] Cryptographic License Verification: {:?} ({:.0} keys/sec, {:.2} µs/key)",
        license_duration,
        keys_per_sec,
        (license_duration.as_micros() as f64) / (key_iterations as f64)
    );
    let min_keys_per_sec = 1_000.0;
    assert!(
        keys_per_sec > min_keys_per_sec,
        "License verification throughput must exceed {} keys/sec",
        min_keys_per_sec
    );

    // ------------------------------------------------------------------------
    // 7. CONCURRENT MULTI-THREAD READ/WRITE INTEGRITY UNDER LOAD
    // ------------------------------------------------------------------------
    let t_start_concurrent = Instant::now();
    let shared_db = Arc::new(db);
    let mut handles = vec![];

    // Spawn 4 concurrent read threads querying items and balances
    for _ in 0..4 {
        let db_clone = Arc::clone(&shared_db);
        handles.push(std::thread::spawn(move || {
            let mut read_ops = 0;
            for _ in 0..50 {
                let conn = db_clone.conn.lock().unwrap();
                let count: i64 = conn
                    .query_row("SELECT count(*) FROM items", [], |r| r.get(0))
                    .unwrap();
                assert!(count >= 1000);
                read_ops += 1;
            }
            read_ops
        }));
    }

    // Main thread performs 20 more invoice creations concurrently
    for i in 0..20 {
        let payload = InvoicePayload {
            invoice_type: "TAX_INVOICE".to_string(),
            party_id: None,
            party_name: format!("Concurrent Customer #{:02}", i),
            invoice_date: "2026-11-19".to_string(),
            due_date: "2026-11-19".to_string(),
            payment_method: "Cash".into(),
            notes: "Concurrent benchmark".into(),
            items: vec![InvoiceItemPayload {
                item_id: Some("SKU-0001".to_string()),
                item_name: "Component A".to_string(),
                quantity: 1.0,
                unit: "PCS".to_string(),
                unit_price: 100.0,
                discount_percent: 0.0,
                tax_rate: 18.0,
                line_total: 118.0,
            }],
            subtotal: 100.0,
            discount_amount: 0.0,
            tax_amount: 18.0,
            total_amount: 118.0,
            paid_amount: 118.0,
            reference: None,
        };
        let mut conn = shared_db.conn.lock().unwrap();
        let _ = create_invoice_internal(&mut conn, payload).unwrap();
    }

    for h in handles {
        let ops = h.join().unwrap();
        assert_eq!(ops, 50);
    }
    let concurrent_duration = t_start_concurrent.elapsed();
    println!(
        "✓ [7/7] Concurrent Thread Contention (4 Readers + 1 Continuous Writer): {:?}",
        concurrent_duration
    );

    // Cleanup
    let _ = std::fs::remove_dir_all(&temp_dir);

    println!("========================================================");
    println!("      ALL 7 PERFORMANCE BENCHMARKS PASSED PERFECTLY     ");
    println!("========================================================\n");
}
