import type { IndianState, Gstr1ReportData, Gstr3bReportData } from "./gstTypes";

// ============================================================================
// 1. OFFICIAL INDIAN STATES & UNION TERRITORIES DIRECTORY (2-DIGIT GST CODES)
// ============================================================================
export const INDIAN_STATES: IndianState[] = [
  { code: "01", name: "Jammu and Kashmir", isUnionTerritory: true },
  { code: "02", name: "Himachal Pradesh", isUnionTerritory: false },
  { code: "03", name: "Punjab", isUnionTerritory: false },
  { code: "04", name: "Chandigarh", isUnionTerritory: true },
  { code: "05", name: "Uttarakhand", isUnionTerritory: false },
  { code: "06", name: "Haryana", isUnionTerritory: false },
  { code: "07", name: "Delhi", isUnionTerritory: true },
  { code: "08", name: "Rajasthan", isUnionTerritory: false },
  { code: "09", name: "Uttar Pradesh", isUnionTerritory: false },
  { code: "10", name: "Bihar", isUnionTerritory: false },
  { code: "11", name: "Sikkim", isUnionTerritory: false },
  { code: "12", name: "Arunachal Pradesh", isUnionTerritory: false },
  { code: "13", name: "Nagaland", isUnionTerritory: false },
  { code: "14", name: "Manipur", isUnionTerritory: false },
  { code: "15", name: "Mizoram", isUnionTerritory: false },
  { code: "16", name: "Tripura", isUnionTerritory: false },
  { code: "17", name: "Meghalaya", isUnionTerritory: false },
  { code: "18", name: "Assam", isUnionTerritory: false },
  { code: "19", name: "West Bengal", isUnionTerritory: false },
  { code: "20", name: "Jharkhand", isUnionTerritory: false },
  { code: "21", name: "Odisha", isUnionTerritory: false },
  { code: "22", name: "Chhattisgarh", isUnionTerritory: false },
  { code: "23", name: "Madhya Pradesh", isUnionTerritory: false },
  { code: "24", name: "Gujarat", isUnionTerritory: false },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu", isUnionTerritory: true },
  { code: "27", name: "Maharashtra", isUnionTerritory: false },
  { code: "28", name: "Andhra Pradesh (Old)", isUnionTerritory: false },
  { code: "29", name: "Karnataka", isUnionTerritory: false },
  { code: "30", name: "Goa", isUnionTerritory: false },
  { code: "31", name: "Lakshadweep", isUnionTerritory: true },
  { code: "32", name: "Kerala", isUnionTerritory: false },
  { code: "33", name: "Tamil Nadu", isUnionTerritory: false },
  { code: "34", name: "Puducherry", isUnionTerritory: true },
  { code: "35", name: "Andaman and Nicobar Islands", isUnionTerritory: true },
  { code: "36", name: "Telangana", isUnionTerritory: false },
  { code: "37", name: "Andhra Pradesh", isUnionTerritory: false },
  { code: "38", name: "Ladakh", isUnionTerritory: true },
  { code: "97", name: "Other Territory", isUnionTerritory: true },
];

export function getStateByCode(code: string): IndianState | undefined {
  const normalized = code.trim().padStart(2, "0");
  return INDIAN_STATES.find((s) => s.code === normalized);
}

// ============================================================================
// 2. GSTIN VALIDATION & PAN EXTRACTION (OFFICIAL LUHN MOD-36 ALGORITHM)
// ============================================================================
// Format: 2-digit state code + 10-char PAN + 1-char entity no + 1-char Z + 1-char check code
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const GSTIN_CODES = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function computeGstinChecksum(gstin14: string): string {
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const ch = gstin14[i];
    const charIndex = GSTIN_CODES.indexOf(ch);
    if (charIndex === -1) return "";
    const multiplier = i % 2 === 0 ? 1 : 2;
    const product = charIndex * multiplier;
    total += Math.floor(product / 36) + (product % 36);
  }
  const remainder = total % 36;
  const checkIndex = (36 - remainder) % 36;
  return GSTIN_CODES[checkIndex];
}

export interface GstinValidationResult {
  isValid: boolean;
  stateCode?: string;
  stateName?: string;
  pan?: string;
  error?: string;
}

export function validateGSTIN(gstin: string): GstinValidationResult {
  const clean = gstin.trim().toUpperCase();
  if (!clean) {
    return { isValid: false, error: "GSTIN cannot be empty" };
  }
  if (clean.length !== 15) {
    return {
      isValid: false,
      error: `GSTIN must be exactly 15 characters (current: ${clean.length})`,
    };
  }
  if (!GSTIN_REGEX.test(clean)) {
    return {
      isValid: false,
      error: "Invalid GSTIN structure. Expected format: 22AAAAA0000A1Z5",
    };
  }

  const stateCode = clean.substring(0, 2);
  const state = getStateByCode(stateCode);
  if (!state) {
    return {
      isValid: false,
      error: `State code "${stateCode}" is not a recognized Indian State / UT code`,
    };
  }

  // Statutory Mod-36 Luhn check
  const expectedCheck = computeGstinChecksum(clean.substring(0, 14));
  if (clean[14] !== expectedCheck) {
    return {
      isValid: false,
      error: `Invalid GSTIN checksum character '${clean[14]}'. Expected '${expectedCheck}' based on Mod-36 verification.`,
    };
  }

  const pan = clean.substring(2, 12);

  return {
    isValid: true,
    stateCode,
    stateName: state.name,
    pan,
  };
}

// ============================================================================
// 3. INDIAN NUMBERING SYSTEM TO WORDS (LEGAL RULE 46 REQUIREMENT)
// Converts numbers into "Lakhs and Crores" rather than Western Millions
// e.g. 12,34,567.50 -> "Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Fifty Paise Only"
// ============================================================================
const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function twoDigitToWords(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  const tensPart = TENS[Math.floor(n / 10)];
  const onesPart = ONES[n % 10];
  return onesPart ? `${tensPart} ${onesPart}` : tensPart;
}

function threeDigitToWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  let res = "";
  if (hundreds > 0) {
    res += `${ONES[hundreds]} Hundred`;
    if (remainder > 0) res += " ";
  }
  if (remainder > 0) {
    res += twoDigitToWords(remainder);
  }
  return res;
}

function convertNumberToWords(num: number): string {
  if (num === 0) return "";
  const parts: string[] = [];

  const crores = Math.floor(num / 10000000);
  num %= 10000000;

  const lakhs = Math.floor(num / 100000);
  num %= 100000;

  const thousands = Math.floor(num / 1000);
  num %= 1000;

  const hundredsPart = num;

  if (crores > 0) {
    parts.push(`${convertNumberToWords(crores)} Crore`);
  }
  if (lakhs > 0) {
    parts.push(`${twoDigitToWords(lakhs)} Lakh`);
  }
  if (thousands > 0) {
    parts.push(`${twoDigitToWords(thousands)} Thousand`);
  }
  if (hundredsPart > 0) {
    parts.push(threeDigitToWords(hundredsPart));
  }

  return parts.filter(Boolean).join(" ");
}

export function amountToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) {
    return "Rupees Zero Only";
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const totalPaise = Math.round(absAmount * 100);
  const integerPart = Math.floor(totalPaise / 100);
  const paisePart = totalPaise % 100;

  if (integerPart === 0 && paisePart === 0) {
    return "Rupees Zero Only";
  }

  let words = "";

  if (integerPart > 0) {
    words = `Rupees ${convertNumberToWords(integerPart)}`;
    if (paisePart > 0) {
      words += ` and ${twoDigitToWords(paisePart)} Paise`;
    }
  } else if (paisePart > 0) {
    words = `${twoDigitToWords(paisePart)} Paise`;
  }

  words += " Only";

  return isNegative ? `Minus ${words}` : words;
}

// ============================================================================
// 4. PLACE OF SUPPLY (POS) & TAX SPLIT ENGINE
// ============================================================================
export interface GstTaxBreakdown {
  isInterstate: boolean;
  taxableAmount: number;
  taxRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  lineTotal: number;
}

export function calculateGstBreakdown(
  taxableAmount: number,
  taxRate: number,
  supplierStateCode: string,
  posStateCode: string
): GstTaxBreakdown {
  const suppCode = supplierStateCode.trim().padStart(2, "0");
  const posCode = posStateCode.trim().padStart(2, "0");
  const isInterstate = suppCode !== posCode;

  if (isInterstate) {
    // Inter-State: 100% IGST
    const igstRate = taxRate;
    const igstAmount = Math.round(taxableAmount * (igstRate / 100) * 100) / 100;
    const totalTax = igstAmount;
    const lineTotal = Math.round((taxableAmount + totalTax) * 100) / 100;

    return {
      isInterstate: true,
      taxableAmount,
      taxRate,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate,
      igstAmount,
      totalTax,
      lineTotal,
    };
  } else {
    // Intra-State: 50% CGST + 50% SGST
    const cgstRate = taxRate / 2;
    const sgstRate = taxRate / 2;
    const cgstAmount = Math.round(taxableAmount * (cgstRate / 100) * 100) / 100;
    const sgstAmount = Math.round(taxableAmount * (sgstRate / 100) * 100) / 100;
    const totalTax = Math.round((cgstAmount + sgstAmount) * 100) / 100;
    const lineTotal = Math.round((taxableAmount + totalTax) * 100) / 100;

    return {
      isInterstate: false,
      taxableAmount,
      taxRate,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate: 0,
      igstAmount: 0,
      totalTax,
      lineTotal,
    };
  }
}

// ============================================================================
// 5. COMMON HSN & SAC DIRECTORY (POPULAR INDIAN TAX SLABS)
// ============================================================================
export interface HsnSuggestion {
  code: string;
  category: string;
  description: string;
  defaultRate: number; // 0, 5, 12, 18, 28
  isService: boolean;
}

export const POPULAR_HSN_CODES: HsnSuggestion[] = [
  // IT & Electronics
  { code: "8471", category: "IT Hardware", description: "Computers, Laptops, POS Hardware & Terminals", defaultRate: 18, isService: false },
  { code: "847130", category: "IT Hardware", description: "Portable automatic data processing machines", defaultRate: 18, isService: false },
  { code: "8443", category: "Printers", description: "Thermal receipt printers, laser printers", defaultRate: 18, isService: false },
  { code: "8517", category: "Telecom", description: "Smartphones, Barcode scanners, cellular modems", defaultRate: 18, isService: false },
  // Grocery & Food
  { code: "1006", category: "Groceries", description: "Rice (packaged / branded)", defaultRate: 5, isService: false },
  { code: "0401", category: "Dairy", description: "Fresh milk and dairy products (unflavoured)", defaultRate: 0, isService: false },
  { code: "0402", category: "Dairy", description: "Packaged butter, paneer, condensed milk", defaultRate: 5, isService: false },
  { code: "0902", category: "Beverages", description: "Tea leaves, green tea, black tea", defaultRate: 5, isService: false },
  { code: "0901", category: "Beverages", description: "Coffee beans, roasted coffee powder", defaultRate: 5, isService: false },
  { code: "1905", category: "Bakery", description: "Bread, pastries, cakes, biscuits", defaultRate: 18, isService: false },
  // Apparels & Textiles
  { code: "6109", category: "Textiles", description: "T-shirts, singlets and other vests, knitted", defaultRate: 5, isService: false },
  { code: "6203", category: "Textiles", description: "Men's suits, jackets, blazers, trousers", defaultRate: 12, isService: false },
  { code: "6204", category: "Textiles", description: "Women's dresses, skirts, trousers", defaultRate: 12, isService: false },
  { code: "6403", category: "Footwear", description: "Leather footwear, sports shoes", defaultRate: 18, isService: false },
  // FMCG & Household
  { code: "3401", category: "Personal Care", description: "Soap, organic surface-active products", defaultRate: 18, isService: false },
  { code: "3306", category: "Oral Care", description: "Toothpaste, dental hygiene preparations", defaultRate: 18, isService: false },
  { code: "3004", category: "Pharma", description: "Medicaments consisting of mixed or unmixed products", defaultRate: 12, isService: false },
  // Services (SAC)
  { code: "998311", category: "IT Services", description: "Management consulting and IT support", defaultRate: 18, isService: true },
  { code: "998313", category: "Software", description: "IT infrastructure, software development", defaultRate: 18, isService: true },
  { code: "996331", category: "Restaurant", description: "Restaurant & food outlet service", defaultRate: 5, isService: true },
  { code: "997212", category: "Real Estate", description: "Commercial lease / premises rent service", defaultRate: 18, isService: true },
];

// ============================================================================
// 6. OFFICIAL GSTN PORTAL JSON EXPORTERS (GOVERNMENT SCHEMA COMPLIANT)
// ============================================================================
function csvCell(val: unknown): string {
  const s = String(val ?? "");
  const neutralized = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export function generateGstr1PortalJson(report: Gstr1ReportData): string {
  // Official GSTN portal JSON structure for GSTR-1 offline tool

  // Table 4: B2B Invoices grouped by CTIN, and Table 9B: CDNR (Registered Credit Notes)
  const b2bMap = new Map<string, any[]>();
  const cdnrMap = new Map<string, any[]>();

  for (const inv of report.b2b) {
    const invAny = inv as any;
    const isCreditNote = inv.invoice_type === "C" || inv.invoice_value < 0 || inv.taxable_value < 0;
    const idt = inv.invoice_date.split("-").reverse().join("-"); // DD-MM-YYYY
    const pos = inv.place_of_supply.split("-")[0].padStart(2, "0");
    const absTaxable = Math.abs(inv.taxable_value);
    const absIgst = Math.abs(inv.igst_amount);
    const absCgst = Math.abs(inv.cgst_amount);
    const absSgst = Math.abs(inv.sgst_amount);
    const absCess = Math.abs(inv.cess_amount);
    const taxRate = absTaxable > 0
      ? Math.round(((absIgst + absCgst + absSgst) / absTaxable) * 10000) / 100
      : 0;

    const itms = Array.isArray(invAny.items) && invAny.items.length > 0
      ? invAny.items.map((sl: any, idx: number) => ({
          num: idx + 1,
          itm_det: {
            txval: Math.abs(sl.taxable_value ?? 0),
            rt: sl.tax_rate ?? taxRate,
            iamt: Math.abs(sl.igst_amount ?? 0),
            camt: Math.abs(sl.cgst_amount ?? 0),
            samt: Math.abs(sl.sgst_amount ?? 0),
            csamt: Math.abs(sl.cess_amount ?? 0),
          },
        }))
      : [
          {
            num: 1,
            itm_det: {
              txval: absTaxable,
              rt: taxRate,
              iamt: absIgst,
              camt: absCgst,
              samt: absSgst,
              csamt: absCess,
            },
          },
        ];

    if (isCreditNote) {
      const ntList = cdnrMap.get(inv.customer_gstin) || [];
      ntList.push({
        ntty: "C",
        nt_num: inv.invoice_number,
        nt_dt: idt,
        val: Math.abs(inv.invoice_value),
        pos,
        rchrg: inv.reverse_charge,
        inv_typ: "R",
        itms,
      });
      cdnrMap.set(inv.customer_gstin, ntList);
    } else {
      const list = b2bMap.get(inv.customer_gstin) || [];
      list.push({
        inum: inv.invoice_number,
        idt,
        val: inv.invoice_value,
        pos,
        rchrg: inv.reverse_charge,
        inv_typ: "R",
        itms,
      });
      b2bMap.set(inv.customer_gstin, list);
    }
  }

  const b2bFormatted = Array.from(b2bMap.entries()).map(([ctin, invList]) => ({
    ctin,
    inv: invList,
  }));
  const cdnrFormatted = Array.from(cdnrMap.entries()).map(([ctin, ntList]) => ({
    ctin,
    nt: ntList,
  }));

  // Table 5: B2CL Large Invoices grouped by POS, and Table 9B: CDNUR
  const b2clMap = new Map<string, any[]>();
  const cdnurFormatted: any[] = [];
  for (const inv of report.b2cl) {
    const posCode = inv.place_of_supply.split("-")[0].padStart(2, "0");
    const isCreditNote = inv.invoice_value < 0 || inv.taxable_value < 0;
    const idt = inv.invoice_date.split("-").reverse().join("-");
    const absTaxable = Math.abs(inv.taxable_value);
    const absIgst = Math.abs(inv.igst_amount);
    const absCgst = Math.abs(inv.cgst_amount);
    const absSgst = Math.abs(inv.sgst_amount);
    const absCess = Math.abs(inv.cess_amount);
    const taxRate = absTaxable > 0
      ? Math.round(((absIgst + absCgst + absSgst) / absTaxable) * 10000) / 100
      : 0;

    const itms = [
      {
        num: 1,
        itm_det: {
          txval: absTaxable,
          rt: taxRate,
          iamt: absIgst,
          csamt: absCess,
        },
      },
    ];

    if (isCreditNote) {
      cdnurFormatted.push({
        typ: "B2CL",
        ntty: "C",
        nt_num: inv.invoice_number,
        nt_dt: idt,
        val: Math.abs(inv.invoice_value),
        pos: posCode,
        itms,
      });
    } else {
      const list = b2clMap.get(posCode) || [];
      list.push({
        inum: inv.invoice_number,
        idt,
        val: inv.invoice_value,
        itms,
      });
      b2clMap.set(posCode, list);
    }
  }

  const b2clFormatted = Array.from(b2clMap.entries()).map(([pos, invList]) => ({
    pos,
    inv: invList,
  }));

  // Table 7: B2CS Small Supplies with accurate INTRA vs INTER supply type
  const supplierStateCode = (report.gstin || "").trim().length >= 2 ? report.gstin.trim().substring(0, 2) : "";
  const b2csFormatted = report.b2cs.map((item) => {
    const posCode = item.place_of_supply.split("-")[0].padStart(2, "0");
    const isInter = supplierStateCode ? posCode !== supplierStateCode : item.igst_amount > 0;
    return {
      sply_ty: isInter ? "INTER" : "INTRA",
      pos: posCode,
      typ: "OE",
      rt: item.tax_rate,
      txval: item.taxable_value,
      iamt: item.igst_amount,
      camt: item.cgst_amount,
      samt: item.sgst_amount,
      csamt: item.cess_amount,
    };
  });

  const hsnFormatted = {
    data: report.hsn_summary.map((h, idx) => ({
      num: idx + 1,
      hsn_sc: h.hsn_code,
      desc: h.description,
      uqc: h.uqc || "PCS",
      rt: h.tax_rate ?? 0,
      qty: h.total_quantity,
      val: h.total_value,
      txval: h.taxable_value,
      iamt: h.igst_amount,
      camt: h.cgst_amount,
      samt: h.sgst_amount,
      csamt: h.cess_amount,
    })),
  };

  const portalPayload: Record<string, any> = {
    gstin: report.gstin,
    fp: report.fp,
    cur_gt: report.total_turnover,
    gt: report.total_turnover,
    b2b: b2bFormatted,
    b2cl: b2clFormatted,
    b2cs: b2csFormatted,
    ...(cdnrFormatted.length > 0 ? { cdnr: cdnrFormatted } : {}),
    ...(cdnurFormatted.length > 0 ? { cdnur: cdnurFormatted } : {}),
    hsn: hsnFormatted,
    doc_issue: {
      doc_det: report.doc_summary.map((d, idx) => ({
        doc_num: idx + 1,
        doc_typ: d.doc_type,
        docs: [
          {
            num: 1,
            from: d.from_serial,
            to: d.to_serial,
            totnum: d.total_count,
            canc: d.cancelled_count,
            net_issue: d.net_count,
          },
        ],
      })),
    },
  };

  return JSON.stringify(portalPayload, null, 2);
}

export function generateGstr1Csv(report: Gstr1ReportData): string {
  const lines: string[] = [];
  lines.push([csvCell("GSTR-1 AUDIT REPORT"), csvCell(`GSTIN: ${report.gstin}`), csvCell(`Legal Name: ${report.legal_name}`), csvCell(`Period: ${report.fp}`)].join(","));
  lines.push([csvCell(`Period Start: ${report.start_date}`), csvCell(`Period End: ${report.end_date}`), csvCell(`Turnover: ₹${report.total_turnover.toFixed(2)}`), csvCell(`Taxable: ₹${report.total_taxable.toFixed(2)}`)].join(","));
  lines.push("");

  // Table 4: B2B
  lines.push("--- TABLE 4: B2B TAX INVOICES (REGISTERED RECIPIENTS) ---");
  lines.push("GSTIN of Recipient,Receiver Name,Invoice Number,Invoice Date,Invoice Value,Place Of Supply,Reverse Charge,Invoice Type,Taxable Value,IGST Amount,CGST Amount,SGST Amount,Cess Amount");
  for (const b of report.b2b) {
    lines.push(
      [
        csvCell(b.customer_gstin),
        csvCell(b.customer_name),
        csvCell(b.invoice_number),
        csvCell(b.invoice_date),
        b.invoice_value.toFixed(2),
        csvCell(b.place_of_supply),
        csvCell(b.reverse_charge),
        csvCell(b.invoice_type),
        b.taxable_value.toFixed(2),
        b.igst_amount.toFixed(2),
        b.cgst_amount.toFixed(2),
        b.sgst_amount.toFixed(2),
        b.cess_amount.toFixed(2),
      ].join(",")
    );
  }
  lines.push("");

  // Table 5: B2CL
  lines.push("--- TABLE 5: B2CL LARGE INVOICES (UNREGISTERED INTER-STATE > ₹2.5 LAKH) ---");
  lines.push("Invoice Number,Invoice Date,Invoice Value,Place Of Supply,Taxable Value,IGST Amount,Cess Amount");
  for (const l of report.b2cl) {
    lines.push(
      [
        csvCell(l.invoice_number),
        csvCell(l.invoice_date),
        l.invoice_value.toFixed(2),
        csvCell(l.place_of_supply),
        l.taxable_value.toFixed(2),
        l.igst_amount.toFixed(2),
        l.cess_amount.toFixed(2),
      ].join(",")
    );
  }
  lines.push("");

  // Table 7: B2CS
  lines.push("--- TABLE 7: B2CS CONSUMER SMALL SUPPLIES ---");
  lines.push("Place of Supply,Rate (%),Taxable Value,IGST Amount,CGST Amount,SGST Amount,Cess Amount");
  for (const c of report.b2cs) {
    lines.push(
      [
        csvCell(c.place_of_supply),
        `${c.tax_rate}%`,
        c.taxable_value.toFixed(2),
        c.igst_amount.toFixed(2),
        c.cgst_amount.toFixed(2),
        c.sgst_amount.toFixed(2),
        c.cess_amount.toFixed(2),
      ].join(",")
    );
  }
  lines.push("");

  // Table 12: HSN
  lines.push("--- TABLE 12: HSN SUMMARY OF OUTWARD SUPPLIES ---");
  lines.push("HSN Code,Description,UQC,Total Quantity,Total Value,Taxable Value,IGST Amount,CGST Amount,SGST Amount,Cess Amount");
  for (const h of report.hsn_summary) {
    lines.push(
      [
        csvCell(h.hsn_code),
        csvCell(h.description),
        csvCell(h.uqc),
        h.total_quantity,
        h.total_value.toFixed(2),
        h.taxable_value.toFixed(2),
        h.igst_amount.toFixed(2),
        h.cgst_amount.toFixed(2),
        h.sgst_amount.toFixed(2),
        h.cess_amount.toFixed(2),
      ].join(",")
    );
  }

  return lines.join("\n");
}

export function generateGstr3bCsv(report: Gstr3bReportData): string {
  const lines: string[] = [];
  lines.push([csvCell("GSTR-3B MONTHLY SUMMARY RETURN"), csvCell(`GSTIN: ${report.gstin}`), csvCell(`Legal Name: ${report.legal_name}`), csvCell(`Period: ${report.fp}`)].join(","));
  lines.push([csvCell(`Period Start: ${report.start_date}`), csvCell(`Period End: ${report.end_date}`)].join(","));
  lines.push("");
  lines.push("--- 3.1 DETAILS OF OUTWARD SUPPLIES & INWARD LIABLE TO REVERSE CHARGE ---");
  lines.push("Nature of Supplies,Total Taxable Value,Integrated Tax,Central Tax,State/UT Tax,Cess");
  lines.push(
    `"(a) Outward Taxable Supplies",${report.table31.outward_taxable_value.toFixed(2)},${report.table31.outward_igst.toFixed(2)},${report.table31.outward_cgst.toFixed(2)},${report.table31.outward_sgst.toFixed(2)},${report.table31.outward_cess.toFixed(2)}`
  );
  lines.push(
    `"(b) Zero Rated Supplies",${report.table31.zero_rated_taxable.toFixed(2)},0.00,0.00,0.00,0.00`
  );
  lines.push(
    `"(c) Nil Rated / Exempted Supplies",${report.table31.nil_exempt_taxable.toFixed(2)},0.00,0.00,0.00,0.00`
  );
  lines.push(
    `"(d) Inward Supplies Liable to Reverse Charge (RCM)",${report.table31.reverse_charge_taxable.toFixed(2)},${(report.table31.reverse_charge_igst || 0).toFixed(2)},${(report.table31.reverse_charge_cgst || 0).toFixed(2)},${(report.table31.reverse_charge_sgst || 0).toFixed(2)},${(report.table31.reverse_charge_cess || 0).toFixed(2)}`
  );
  lines.push("");
  lines.push("--- 4. ELIGIBLE INPUT TAX CREDIT (ITC) ---");
  lines.push("Details,Integrated Tax,Central Tax,State/UT Tax,Cess");
  lines.push(
    `"(A)(5) All Other ITC from Inward Supplies & RCM",${report.table4_itc.itc_igst.toFixed(2)},${report.table4_itc.itc_cgst.toFixed(2)},${report.table4_itc.itc_sgst.toFixed(2)},${report.table4_itc.itc_cess.toFixed(2)}`
  );
  lines.push(
    `"(D) Ineligible ITC",${report.table4_itc.itc_ineligible.toFixed(2)},0.00,0.00,0.00`
  );
  lines.push("");
  lines.push("--- 6.1 PAYMENT OF TAX SUMMARY ---");
  lines.push("Description,Integrated Tax,Central Tax,State/UT Tax,Cess,Total");
  lines.push(`"Total Tax Liability (Outward + RCM)",${(report.table31.outward_igst + (report.table31.reverse_charge_igst || 0)).toFixed(2)},${(report.table31.outward_cgst + (report.table31.reverse_charge_cgst || 0)).toFixed(2)},${(report.table31.outward_sgst + (report.table31.reverse_charge_sgst || 0)).toFixed(2)},${(report.table31.outward_cess + (report.table31.reverse_charge_cess || 0)).toFixed(2)},${report.total_tax_payable.toFixed(2)}`);
  lines.push(`"Total Input Tax Credit (ITC)",${report.table4_itc.itc_igst.toFixed(2)},${report.table4_itc.itc_cgst.toFixed(2)},${report.table4_itc.itc_sgst.toFixed(2)},${report.table4_itc.itc_cess.toFixed(2)},${report.total_itc_available.toFixed(2)}`);
  lines.push(`"Net Cash Tax Payable",${report.net_igst_payable.toFixed(2)},${report.net_cgst_payable.toFixed(2)},${report.net_sgst_payable.toFixed(2)},${report.net_cess_payable.toFixed(2)},${report.net_cash_payable.toFixed(2)}`);

  return lines.join("\n");
}
