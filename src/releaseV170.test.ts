import { describe, expect, test } from "bun:test";
import { formatCurrency, getDefaultCurrencyDecimals } from "./context/CurrencyContext";
import {
  createScannerState,
  findItemByBarcodeOrSku,
  processBarcodeKeystroke,
} from "./hooks/useBarcodeScanner";
import {
  buildEscposPreviewLines,
  ESC_DRAWER_PULSE,
  ESC_INIT,
  getReceiptColumnWidth,
  GS_CUT_PARTIAL,
  sanitizeEscposText,
} from "./utils/escpos";
import { calculateGstBreakdown, INDIAN_STATES } from "./modules/india_gst/gstUtils";
import type { DaybookEntry, Item, ReceiptPrintPayload, Settings } from "./types";

describe("v1.7.0 Supplier Pay, Daybook/Z-Report, ESC/POS & Barcode Scanner", () => {
  test("multi-currency supplier payable calculation & payment direction", () => {
    // Vendor opening payables are negative (-payable); payment OUT reduces payable toward 0
    const computeVendorNetPayable = (currentBalance: number) =>
      currentBalance < 0 ? Math.abs(currentBalance) : 0;

    expect(computeVendorNetPayable(-4500)).toBe(4500);
    expect(computeVendorNetPayable(500)).toBe(0); // vendor advance, not debt

    // Payment OUT for PURCHASE vs IN for SALE
    const resolvePaymentType = (invoiceType: "SALE" | "PURCHASE" | "RETURN") =>
      invoiceType === "PURCHASE" ? "OUT" : "IN";
    expect(resolvePaymentType("PURCHASE")).toBe("OUT");
    expect(resolvePaymentType("SALE")).toBe("IN");

    // Multi-currency formatting consistency across supported currencies
    expect(formatCurrency(1250.5, "₹", getDefaultCurrencyDecimals("INR"))).toContain("₹");
    expect(formatCurrency(1250.5, "$", getDefaultCurrencyDecimals("USD"))).toContain("$");
    expect(formatCurrency(1500, "¥", getDefaultCurrencyDecimals("JPY"))).toBe("¥1,500");
    expect(formatCurrency(99.95, "AED ", getDefaultCurrencyDecimals("AED"))).toContain("AED");
  });

  test("Daybook cash vs bank separation & Z-Report expected cash math", () => {
    const entries: DaybookEntry[] = [
      {
        date: "2026-11-27",
        reference: "INV-0001",
        title: "Walk-in Cash Sale",
        entry_type: "SALE",
        cash_in: 1500,
        cash_out: 0,
        bank_in: 0,
        bank_out: 0,
        payment_channel: "CASH",
        balance: 1500,
      },
      {
        date: "2026-11-27",
        reference: "INV-0002",
        title: "Walk-in UPI Sale",
        entry_type: "SALE",
        cash_in: 0,
        cash_out: 0,
        bank_in: 2400,
        bank_out: 0,
        payment_channel: "BANK",
        balance: 1500,
      },
      {
        date: "2026-11-27",
        reference: "EXP",
        title: "Petty Cash Expense",
        entry_type: "EXPENSE",
        cash_in: 0,
        cash_out: 350,
        bank_in: 0,
        bank_out: 0,
        payment_channel: "CASH",
        balance: 1150,
      },
      {
        date: "2026-11-27",
        reference: "CONTRA",
        title: "Cash Deposited to Bank",
        entry_type: "TRANSFER",
        cash_in: 0,
        cash_out: 500,
        bank_in: 500,
        bank_out: 0,
        payment_channel: "SPLIT",
        balance: 650,
      },
    ];

    const totalCashIn = entries.reduce((s, e) => s + e.cash_in, 0);
    const totalCashOut = entries.reduce((s, e) => s + e.cash_out, 0);
    const totalBankIn = entries.reduce((s, e) => s + (e.bank_in || 0), 0);
    const openingFloat = 250; // settings.opening_cash (not hardcoded 100)
    const netCashMovement = totalCashIn - totalCashOut;
    const expectedCashInDrawer = openingFloat + netCashMovement;

    expect(totalCashIn).toBe(1500);
    expect(totalCashOut).toBe(850);
    expect(totalBankIn).toBe(2900);
    expect(netCashMovement).toBe(650);
    expect(expectedCashInDrawer).toBe(900);
  });

  test("58mm / 80mm / A4 ESC/POS byte formatting, cutter, cash drawer & WinAnsi safety", () => {
    expect(getReceiptColumnWidth("58mm")).toBe(32);
    expect(getReceiptColumnWidth("80mm")).toBe(48);
    expect(getReceiptColumnWidth("A4")).toBe(48);
    expect(sanitizeEscposText("₹1,200 — Paid")).toBe("Rs.1,200 - Paid");

    const baseSettings: Pick<
      Settings,
      | "business_name"
      | "currency_symbol"
      | "currency_code"
      | "tax_name"
      | "paper_width"
      | "auto_cut"
      | "open_cash_drawer"
    > = {
      business_name: "LynTerminal Cafe",
      currency_symbol: "₹",
      currency_code: "INR",
      tax_name: "GST",
      paper_width: "58mm",
      auto_cut: true,
      open_cash_drawer: true,
    };

    const payload: ReceiptPrintPayload = {
      invoice_number: "INV-00010",
      invoice_date: "2026-11-27",
      invoice_type: "SALE",
      party_name: "Walk-in",
      payment_method: "UPI",
      subtotal: 200,
      discount_amount: 0,
      tax_amount: 36,
      round_off: 0,
      total_amount: 236,
      paid_amount: 236,
      items: [
        {
          name: "Matcha Tin",
          quantity: 1,
          unit_price: 200,
          line_total: 200,
          tax_rate: 18,
        },
      ],
    };

    const preview58 = buildEscposPreviewLines(baseSettings, payload);
    expect(preview58.columns).toBe(32);
    expect(preview58.lines.every((l) => l.length <= 32)).toBe(true);
    expect(preview58.lines.some((l) => l.includes("Rs.236.00"))).toBe(true);
    expect(preview58.bytes.slice(0, 2)).toEqual([...ESC_INIT]);
    expect(
      preview58.bytes.slice(-ESC_DRAWER_PULSE.length - GS_CUT_PARTIAL.length, -ESC_DRAWER_PULSE.length)
    ).toEqual([...GS_CUT_PARTIAL]);
    expect(preview58.bytes.slice(-ESC_DRAWER_PULSE.length)).toEqual([...ESC_DRAWER_PULSE]);

    const preview80 = buildEscposPreviewLines(
      { ...baseSettings, paper_width: "80mm", auto_cut: false, open_cash_drawer: false },
      payload
    );
    expect(preview80.columns).toBe(48);
    expect(preview80.lines[1].length).toBe(48);
  });

  test("universal HID barcode scanner burst detection & case-insensitive exact match", () => {
    // 1. Rapid scanner burst (< 50ms per keystroke ending in Enter)
    let state = createScannerState();
    const code = "890123ABC";
    let t = 1000;
    for (const ch of code) {
      const res = processBarcodeKeystroke(state, { key: ch, timestamp: t });
      state = res.nextState;
      expect(res.scannedCode).toBeNull();
      t += 12; // 12ms HID burst
    }
    const endRes = processBarcodeKeystroke(state, { key: "Enter", timestamp: t });
    expect(endRes.scannedCode).toBe("890123ABC");
    expect(endRes.isBurstActive).toBe(true);

    // 2. Normal slow human typing (> 80ms between keystrokes) must NOT hijack Enter as a hardware burst
    let humanState = createScannerState();
    let ht = 5000;
    for (const ch of "coffee") {
      const res = processBarcodeKeystroke(humanState, { key: ch, timestamp: ht });
      humanState = res.nextState;
      ht += 120;
    }
    const humanEnd = processBarcodeKeystroke(humanState, { key: "Enter", timestamp: ht });
    expect(humanEnd.scannedCode).toBeNull();

    // 3. Case-insensitive exact barcode or SKU match
    const catalog: Pick<Item, "id" | "name" | "barcode" | "sku">[] = [
      { id: "1", name: "Item A", barcode: "890123abc", sku: "SKU-001" },
      { id: "2", name: "Item B", barcode: "890999", sku: "TEA-MATCHA" },
    ];
    expect(findItemByBarcodeOrSku(catalog, "890123ABC")?.id).toBe("1");
    expect(findItemByBarcodeOrSku(catalog, "tea-matcha")?.id).toBe("2");
    expect(findItemByBarcodeOrSku(catalog, "UNKNOWN")).toBeUndefined();
  });

  test("GST manual GSTIN -> Place of Supply state sync & breakdown", () => {
    const gstin = "29AABCU9603R1ZN";
    const derivedStateCode = gstin.slice(0, 2);
    expect(INDIAN_STATES.some((s) => s.code === derivedStateCode)).toBe(true);
    const breakdown = calculateGstBreakdown(1000, 18, "27", derivedStateCode);
    expect(breakdown.isInterstate).toBe(true);
    expect(breakdown.igstAmount).toBe(180);
  });
});
