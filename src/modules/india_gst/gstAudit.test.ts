import { describe, expect, test } from "bun:test";
import {
  amountToIndianWords,
  calculateGstBreakdown,
  generateGstr1PortalJson,
  validateGSTIN,
} from "./gstUtils";
import type { Gstr1ReportData } from "./gstTypes";
import { formatAmount, formatCurrency, getDefaultCurrencyDecimals } from "../../context/CurrencyContext";
import { formatLocalDate } from "../../utils/dateUtils";

describe("Indian GST Frontend Math & Portal JSON", () => {
  test("amountToIndianWords handles rounding carry without undefined", () => {
    expect(amountToIndianWords(100.999)).toBe("Rupees One Hundred One Only");
    expect(amountToIndianWords(0.999)).toBe("Rupees One Only");
    expect(amountToIndianWords(100.5)).toBe("Rupees One Hundred and Fifty Paise Only");
    expect(amountToIndianWords(0)).toBe("Rupees Zero Only");
    expect(amountToIndianWords(123456.78)).toBe(
      "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Eight Paise Only"
    );
  });

  test("calculateGstBreakdown splits intra-state 50/50 and inter-state 100% IGST", () => {
    const intra = calculateGstBreakdown(1000, 18, "27", "27");
    expect(intra.isInterstate).toBe(false);
    expect(intra.cgstAmount).toBe(90);
    expect(intra.sgstAmount).toBe(90);
    expect(intra.igstAmount).toBe(0);
    expect(intra.lineTotal).toBe(1180);

    const inter = calculateGstBreakdown(1000, 18, "27", "29");
    expect(inter.isInterstate).toBe(true);
    expect(inter.igstAmount).toBe(180);
    expect(inter.cgstAmount).toBe(0);
    expect(inter.sgstAmount).toBe(0);
    expect(inter.lineTotal).toBe(1180);

    // Fractional 0.25% and 2.5% slabs
    const frac = calculateGstBreakdown(10000, 0.25, "27", "29");
    expect(frac.igstAmount).toBe(25);
    expect(frac.lineTotal).toBe(10025);
  });

  test("generateGstr1PortalJson preserves fractional tax rates and 0% slabs", () => {
    const report: Gstr1ReportData = {
      gstin: "27AABCU9603R1ZN",
      legal_name: "LynTerminal India",
      fp: "112026",
      start_date: "2026-11-01",
      end_date: "2026-11-30",
      total_turnover: 12025,
      total_taxable: 12000,
      total_igst: 25,
      total_cgst: 0,
      total_sgst: 0,
      total_cess: 0,
      b2b: [
        {
          customer_gstin: "29ABCDE1234F1ZW",
          customer_name: "Buyer",
          invoice_number: "INV-00001",
          invoice_date: "2026-11-10",
          invoice_value: 10025,
          place_of_supply: "29-Karnataka",
          reverse_charge: "N",
          invoice_type: "Regular",
          taxable_value: 10000,
          igst_amount: 25,
          cgst_amount: 0,
          sgst_amount: 0,
          cess_amount: 0,
        },
        {
          customer_gstin: "27ABCDE1234F1ZW",
          customer_name: "Zero Buyer",
          invoice_number: "INV-00002",
          invoice_date: "2026-11-11",
          invoice_value: 2000,
          place_of_supply: "27-Maharashtra",
          reverse_charge: "N",
          invoice_type: "Regular",
          taxable_value: 2000,
          igst_amount: 0,
          cgst_amount: 0,
          sgst_amount: 0,
          cess_amount: 0,
        },
      ],
      b2cl: [],
      b2cs: [
        {
          place_of_supply: "27-Maharashtra",
          tax_rate: 2.5,
          taxable_value: 1000,
          igst_amount: 0,
          cgst_amount: 12.5,
          sgst_amount: 12.5,
          cess_amount: 0,
        },
      ],
      hsn_summary: [
        {
          hsn_code: "7102",
          description: "Rough Diamonds",
          uqc: "PCS",
          tax_rate: 0.25,
          total_quantity: 1,
          total_value: 10025,
          taxable_value: 10000,
          igst_amount: 25,
          cgst_amount: 0,
          sgst_amount: 0,
          cess_amount: 0,
        },
      ],
      doc_summary: [
        {
          doc_type: "Invoices for Outward Supply",
          from_serial: "INV-00001",
          to_serial: "INV-00002",
          total_count: 2,
          cancelled_count: 0,
          net_count: 2,
        },
      ],
    };

    const parsed = JSON.parse(generateGstr1PortalJson(report));
    const b2b1 = parsed.b2b.find((x: any) => x.ctin === "29ABCDE1234F1ZW");
    const b2b2 = parsed.b2b.find((x: any) => x.ctin === "27ABCDE1234F1ZW");
    expect(b2b1.inv[0].itms[0].itm_det.rt).toBe(0.25);
    expect(b2b2.inv[0].itms[0].itm_det.rt).toBe(0);
    expect(parsed.b2cs[0].rt).toBe(2.5);
    expect(parsed.hsn.data[0].rt).toBe(0.25);
  });

  test("validateGSTIN checks 15-char checksum format", () => {
    expect(validateGSTIN("27AABCU9603R1ZN").isValid).toBe(true);
    expect(validateGSTIN("INVALID").isValid).toBe(false);
  });
});

describe("Multi-Currency & Local Date Utilities", () => {
  test("zero-decimal currencies default to 0 decimals", () => {
    expect(getDefaultCurrencyDecimals("JPY")).toBe(0);
    expect(getDefaultCurrencyDecimals("KRW")).toBe(0);
    expect(getDefaultCurrencyDecimals("VND")).toBe(0);
    expect(getDefaultCurrencyDecimals("INR")).toBe(2);
    expect(getDefaultCurrencyDecimals("USD")).toBe(2);
    expect(formatCurrency(1500, "¥", getDefaultCurrencyDecimals("JPY"))).toBe("¥1,500");
    expect(formatCurrency(-250.5, "₹", getDefaultCurrencyDecimals("INR"))).toBe("-₹250.50");
    expect(formatAmount(null, 0)).toBe("0");
    expect(formatAmount(undefined, 2)).toBe("0.00");
  });

  test("formatLocalDate formats local calendar date without UTC shift", () => {
    const d = new Date(2026, 10, 26, 0, 15, 0); // 2026-11-26 00:15 local
    expect(formatLocalDate(d)).toBe("2026-11-26");
  });
});
