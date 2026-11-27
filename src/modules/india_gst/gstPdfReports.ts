import { jsPDF } from "jspdf";
import type { Gstr1ReportData, Gstr3bReportData } from "./gstTypes";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM_LIMIT = PAGE_H - 18;

const COLOR_INK: [number, number, number] = [20, 22, 28];
const COLOR_MUTED: [number, number, number] = [100, 108, 120];
const COLOR_BORDER: [number, number, number] = [218, 222, 230];
const COLOR_SURFACE: [number, number, number] = [245, 247, 250];
const COLOR_HEADER_BG: [number, number, number] = [24, 28, 36];
const COLOR_ACCENT: [number, number, number] = [185, 28, 28];

function fmtAmt(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `Rs. ${safe.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtNum(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDateDisplay(iso: string): string {
  if (!iso) return "-";
  const parts = iso.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return iso;
}

interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
  bold?: boolean;
}

function drawReportHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  badge: string,
  meta: {
    legalName: string;
    gstin: string;
    fp: string;
    startDate: string;
    endDate: string;
  }
): number {
  let y = MARGIN;

  // Top dark slate statutory banner
  doc.setFillColor(...COLOR_HEADER_BG);
  doc.roundedRect(MARGIN, y, CONTENT_W, 20, 2, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, MARGIN + 5, y + 8.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 206, 218);
  doc.text(subtitle, MARGIN + 5, y + 14.5);

  // Right badge pill
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const badgeW = doc.getTextWidth(badge) + 8;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN + CONTENT_W - badgeW - 5, y + 5.5, badgeW, 7, 1.5, 1.5, "F");
  doc.setTextColor(...COLOR_HEADER_BG);
  doc.text(badge, MARGIN + CONTENT_W - badgeW - 1, y + 10.2);

  y += 23;

  // Entity & Period Metadata Grid Box
  doc.setFillColor(...COLOR_SURFACE);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_W, 18, 1.5, 1.5, "FD");

  const col1 = MARGIN + 4;
  const col2 = MARGIN + 72;
  const col3 = MARGIN + 132;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("LEGAL / TRADE NAME", col1, y + 5.5);
  doc.text("SUPPLIER GSTIN", col2, y + 5.5);
  doc.text("RETURN PERIOD / DATES", col3, y + 5.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_INK);
  doc.text((meta.legalName || "Unregistered Entity").slice(0, 34), col1, y + 12.5);
  doc.setFont("courier", "bold");
  doc.text(meta.gstin || "N/A", col2, y + 12.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `${meta.fp || "-"}  (${fmtDateDisplay(meta.startDate)} to ${fmtDateDisplay(meta.endDate)})`,
    col3,
    y + 12.5
  );

  return y + 23;
}

function drawKpiStrip(
  doc: jsPDF,
  y: number,
  items: Array<{ label: string; value: string; accent?: boolean }>
): number {
  const gap = 3;
  const cardW = (CONTENT_W - gap * (items.length - 1)) / items.length;
  const cardH = 15;

  items.forEach((item, idx) => {
    const x = MARGIN + idx * (cardW + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(item.label.toUpperCase(), x + 3, y + 5.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...(item.accent ? COLOR_ACCENT : COLOR_INK));
    doc.text(item.value, x + 3, y + 11.5);
  });

  return y + cardH + 6;
}

function drawSectionHeading(doc: jsPDF, y: number, title: string, rightNote = "Values in INR"): number {
  if (y + 16 > BOTTOM_LIMIT) {
    doc.addPage();
    y = MARGIN;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR_INK);
  doc.text(title, MARGIN, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(rightNote, MARGIN + CONTENT_W, y + 4, { align: "right" });

  doc.setDrawColor(...COLOR_HEADER_BG);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 6, MARGIN + CONTENT_W, y + 6);

  return y + 8;
}

function drawTableHeaderRow(doc: jsPDF, y: number, columns: TableColumn[]): number {
  const rowH = 7;
  doc.setFillColor(...COLOR_SURFACE);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.25);
  doc.rect(MARGIN, y, CONTENT_W, rowH, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(55, 62, 74);

  let x = MARGIN;
  columns.forEach((col) => {
    const pad = 2;
    const tx =
      col.align === "right"
        ? x + col.width - pad
        : col.align === "center"
        ? x + col.width / 2
        : x + pad;
    doc.text(col.header, tx, y + 4.7, { align: col.align || "left" });
    x += col.width;
  });

  return y + rowH;
}

function drawDataTable(
  doc: jsPDF,
  startY: number,
  columns: TableColumn[],
  rows: string[][],
  emptyMessage: string,
  totalsRow?: string[]
): number {
  let y = drawTableHeaderRow(doc, startY, columns);

  if (rows.length === 0) {
    const emptyH = 9;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...COLOR_BORDER);
    doc.rect(MARGIN, y, CONTENT_W, emptyH, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(emptyMessage, MARGIN + CONTENT_W / 2, y + 5.7, { align: "center" });
    return y + emptyH + 6;
  }

  const rowH = 6.5;

  rows.forEach((row, rIdx) => {
    if (y + rowH > BOTTOM_LIMIT) {
      doc.addPage();
      y = MARGIN;
      y = drawTableHeaderRow(doc, y, columns);
    }

    if (rIdx % 2 === 1) {
      doc.setFillColor(250, 251, 253);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, y, CONTENT_W, rowH, "FD");

    let x = MARGIN;
    columns.forEach((col, cIdx) => {
      const cellText = row[cIdx] ?? "";
      doc.setFont("helvetica", col.bold ? "bold" : "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(...COLOR_INK);

      const pad = 2;
      const maxChars = Math.max(4, Math.floor((col.width - pad * 2) / 1.45));
      const truncated =
        cellText.length > maxChars ? `${cellText.slice(0, maxChars - 1)}…` : cellText;

      const tx =
        col.align === "right"
          ? x + col.width - pad
          : col.align === "center"
          ? x + col.width / 2
          : x + pad;
      doc.text(truncated, tx, y + 4.4, { align: col.align || "left" });
      x += col.width;
    });

    y += rowH;
  });

  if (totalsRow) {
    if (y + 7.5 > BOTTOM_LIMIT) {
      doc.addPage();
      y = MARGIN;
      y = drawTableHeaderRow(doc, y, columns);
    }
    const totH = 7.5;
    doc.setFillColor(238, 242, 247);
    doc.setDrawColor(...COLOR_HEADER_BG);
    doc.setLineWidth(0.35);
    doc.rect(MARGIN, y, CONTENT_W, totH, "FD");

    let x = MARGIN;
    columns.forEach((col, cIdx) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.4);
      doc.setTextColor(...COLOR_INK);
      const pad = 2;
      const tx =
        col.align === "right"
          ? x + col.width - pad
          : col.align === "center"
          ? x + col.width / 2
          : x + pad;
      doc.text(totalsRow[cIdx] ?? "", tx, y + 5, { align: col.align || "left" });
      x += col.width;
    });
    y += totH;
  }

  return y + 6;
}

function drawVerificationSignOff(doc: jsPDF, y: number, legalName: string): void {
  const blockH = 26;
  if (y + blockH > BOTTOM_LIMIT) {
    doc.addPage();
    y = MARGIN;
  }

  doc.setFillColor(...COLOR_SURFACE);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_W, blockH, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_INK);
  doc.text("VERIFICATION & STATUTORY DECLARATION", MARGIN + 4, y + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    "I hereby solemnly affirm and declare that the information furnished above is true and correct to the best of my knowledge",
    MARGIN + 4,
    y + 10.5
  );
  doc.text(
    "and belief, reconciled against local SQLite accounting vouchers, and nothing has been concealed therefrom.",
    MARGIN + 4,
    y + 14.5
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_INK);
  doc.text(`For ${legalName || "Authorised Signatory"}`, MARGIN + CONTENT_W - 4, y + 10.5, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("Authorised Signatory / Chartered Accountant", MARGIN + CONTENT_W - 4, y + 22, {
    align: "right",
  });
}

function applyPageFooters(doc: jsPDF, reportCode: string, gstin: string): void {
  const totalPages = doc.getNumberOfPages();
  const timestamp = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, PAGE_H - 12, MARGIN + CONTENT_W, PAGE_H - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(
      `LynTerminal GST Compliance Engine  •  ${reportCode}  •  GSTIN: ${gstin || "N/A"}  •  Generated: ${timestamp}`,
      MARGIN,
      PAGE_H - 7.5
    );
    doc.text(`Page ${p} of ${totalPages}`, MARGIN + CONTENT_W, PAGE_H - 7.5, {
      align: "right",
    });
  }
}

export function buildGstr1AuditPdf(report: Gstr1ReportData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const totalTax =
    report.total_igst + report.total_cgst + report.total_sgst + report.total_cess;

  let y = drawReportHeader(
    doc,
    "FORM GSTR-1 — AUDIT & FILING RETURN",
    "Statement of Outward Supplies of Goods & Services under Section 37 of the CGST Act, 2017",
    "OFFICIAL SCHEMA",
    {
      legalName: report.legal_name,
      gstin: report.gstin,
      fp: report.fp,
      startDate: report.start_date,
      endDate: report.end_date,
    }
  );

  y = drawKpiStrip(doc, y, [
    { label: "Gross Turnover", value: fmtAmt(report.total_turnover) },
    { label: "Taxable Value", value: fmtAmt(report.total_taxable) },
    { label: "IGST", value: fmtAmt(report.total_igst) },
    { label: "CGST", value: fmtAmt(report.total_cgst) },
    { label: "SGST", value: fmtAmt(report.total_sgst) },
    { label: "Total Tax", value: fmtAmt(totalTax), accent: true },
  ]);

  // Table 4: B2B Invoices (186mm total width)
  y = drawSectionHeading(doc, y, `Table 4 — B2B Outward Supplies (${report.b2b.length} Invoices)`);
  y = drawDataTable(
    doc,
    y,
    [
      { header: "Recipient GSTIN", width: 28, bold: true },
      { header: "Receiver Name", width: 32 },
      { header: "Invoice #", width: 22, bold: true },
      { header: "Date", width: 17 },
      { header: "POS", width: 19 },
      { header: "Inv Value", width: 18, align: "right", bold: true },
      { header: "Taxable", width: 17, align: "right" },
      { header: "IGST", width: 11, align: "right" },
      { header: "CGST", width: 11, align: "right" },
      { header: "SGST", width: 11, align: "right" },
    ],
    report.b2b.map((inv) => [
      inv.customer_gstin,
      inv.customer_name,
      inv.invoice_number,
      inv.invoice_date,
      inv.place_of_supply,
      fmtNum(inv.invoice_value),
      fmtNum(inv.taxable_value),
      fmtNum(inv.igst_amount),
      fmtNum(inv.cgst_amount),
      fmtNum(inv.sgst_amount),
    ]),
    "Nil — No registered B2B outward supplies recorded in this period."
  );

  // Table 7: B2CS Consumer Small
  y = drawSectionHeading(doc, y, `Table 7 — B2CS Consumer Small Summary (${report.b2cs.length} Slabs)`);
  const b2csTaxableTotal = report.b2cs.reduce((s, x) => s + x.taxable_value, 0);
  const b2csIgstTotal = report.b2cs.reduce((s, x) => s + x.igst_amount, 0);
  const b2csCgstTotal = report.b2cs.reduce((s, x) => s + x.cgst_amount, 0);
  const b2csSgstTotal = report.b2cs.reduce((s, x) => s + x.sgst_amount, 0);
  const b2csCessTotal = report.b2cs.reduce((s, x) => s + x.cess_amount, 0);

  y = drawDataTable(
    doc,
    y,
    [
      { header: "Place of Supply (POS)", width: 62, bold: true },
      { header: "Rate %", width: 18, align: "center", bold: true },
      { header: "Taxable Value", width: 28, align: "right", bold: true },
      { header: "IGST", width: 20, align: "right" },
      { header: "CGST", width: 20, align: "right" },
      { header: "SGST", width: 20, align: "right" },
      { header: "Cess", width: 18, align: "right" },
    ],
    report.b2cs.map((b) => [
      b.place_of_supply,
      `${b.tax_rate}%`,
      fmtNum(b.taxable_value),
      fmtNum(b.igst_amount),
      fmtNum(b.cgst_amount),
      fmtNum(b.sgst_amount),
      fmtNum(b.cess_amount),
    ]),
    "Nil — No B2CS consumer supplies recorded in this period.",
    report.b2cs.length > 0
      ? [
          "TOTAL B2CS",
          "-",
          fmtNum(b2csTaxableTotal),
          fmtNum(b2csIgstTotal),
          fmtNum(b2csCgstTotal),
          fmtNum(b2csSgstTotal),
          fmtNum(b2csCessTotal),
        ]
      : undefined
  );

  // Table 5: B2CL Large
  y = drawSectionHeading(doc, y, `Table 5 — B2CL Interstate Large (> Rs. 2.5L) (${report.b2cl.length} Invoices)`);
  y = drawDataTable(
    doc,
    y,
    [
      { header: "Receiver Name", width: 48 },
      { header: "Invoice #", width: 28, bold: true },
      { header: "Date", width: 22 },
      { header: "POS", width: 26 },
      { header: "Invoice Value", width: 22, align: "right", bold: true },
      { header: "Taxable", width: 22, align: "right" },
      { header: "IGST", width: 18, align: "right" },
    ],
    report.b2cl.map((inv) => [
      inv.customer_name,
      inv.invoice_number,
      inv.invoice_date,
      inv.place_of_supply,
      fmtNum(inv.invoice_value),
      fmtNum(inv.taxable_value),
      fmtNum(inv.igst_amount),
    ]),
    "Nil — Zero interstate B2C invoices exceeding Rs. 2,50,000 threshold."
  );

  // Table 12: HSN Summary
  y = drawSectionHeading(doc, y, `Table 12 — HSN-Wise Outward Supply Summary (${report.hsn_summary.length} Codes)`);
  const hsnTotalVal = report.hsn_summary.reduce((s, h) => s + h.total_value, 0);
  const hsnTaxableVal = report.hsn_summary.reduce((s, h) => s + h.taxable_value, 0);
  const hsnIgst = report.hsn_summary.reduce((s, h) => s + h.igst_amount, 0);
  const hsnCgst = report.hsn_summary.reduce((s, h) => s + h.cgst_amount, 0);
  const hsnSgst = report.hsn_summary.reduce((s, h) => s + h.sgst_amount, 0);

  y = drawDataTable(
    doc,
    y,
    [
      { header: "HSN", width: 20, bold: true },
      { header: "Description", width: 46 },
      { header: "UQC", width: 14, align: "center" },
      { header: "Qty", width: 14, align: "right" },
      { header: "Total Val", width: 22, align: "right", bold: true },
      { header: "Taxable", width: 22, align: "right" },
      { header: "IGST", width: 16, align: "right" },
      { header: "CGST", width: 16, align: "right" },
      { header: "SGST", width: 16, align: "right" },
    ],
    report.hsn_summary.map((h) => [
      h.hsn_code,
      h.description,
      h.uqc,
      String(h.total_quantity),
      fmtNum(h.total_value),
      fmtNum(h.taxable_value),
      fmtNum(h.igst_amount),
      fmtNum(h.cgst_amount),
      fmtNum(h.sgst_amount),
    ]),
    "Nil — No HSN summary entries recorded for this period.",
    report.hsn_summary.length > 0
      ? [
          "TOTAL HSN",
          "-",
          "-",
          "-",
          fmtNum(hsnTotalVal),
          fmtNum(hsnTaxableVal),
          fmtNum(hsnIgst),
          fmtNum(hsnCgst),
          fmtNum(hsnSgst),
        ]
      : undefined
  );

  // Table 13: Documents Issued
  y = drawSectionHeading(doc, y, "Table 13 — Documents Issued During the Tax Period");
  y = drawDataTable(
    doc,
    y,
    [
      { header: "Nature of Document", width: 64, bold: true },
      { header: "From Serial #", width: 32 },
      { header: "To Serial #", width: 32 },
      { header: "Total Issued", width: 20, align: "center" },
      { header: "Cancelled", width: 18, align: "center" },
      { header: "Net Valid", width: 20, align: "center", bold: true },
    ],
    report.doc_summary.map((d) => [
      d.doc_type,
      d.from_serial,
      d.to_serial,
      String(d.total_count),
      String(d.cancelled_count),
      String(d.net_count),
    ]),
    "No documents issued in this period."
  );

  drawVerificationSignOff(doc, y, report.legal_name);
  applyPageFooters(doc, "FORM GSTR-1 AUDIT REPORT", report.gstin);

  return doc;
}

export function buildGstr3bPdf(report: Gstr3bReportData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = drawReportHeader(
    doc,
    "FORM GSTR-3B — MONTHLY SELF-DECLARATION RETURN",
    "Summary Return of Outward Supplies, Input Tax Credit (ITC) & Net Cash Tax Payable under Rule 61(5)",
    "RULE 61(5) CGST",
    {
      legalName: report.legal_name,
      gstin: report.gstin,
      fp: report.fp,
      startDate: report.start_date,
      endDate: report.end_date,
    }
  );

  y = drawKpiStrip(doc, y, [
    { label: "1. Gross Outward Tax Liability", value: fmtAmt(report.total_tax_payable), accent: true },
    { label: "2. Eligible Input Tax Credit (ITC)", value: fmtAmt(report.total_itc_available) },
    { label: "3. Net Tax Payable in Cash", value: fmtAmt(report.net_cash_payable) },
  ]);

  // Table 3.1: Outward Supplies
  y = drawSectionHeading(doc, y, "3.1 Details of Outward Supplies & Inward Supplies Liable to Reverse Charge");
  y = drawDataTable(
    doc,
    y,
    [
      { header: "Nature of Supplies", width: 82, bold: true },
      { header: "Taxable Value", width: 24, align: "right", bold: true },
      { header: "IGST", width: 20, align: "right" },
      { header: "CGST", width: 20, align: "right" },
      { header: "SGST / UTGST", width: 22, align: "right" },
      { header: "Cess", width: 18, align: "right" },
    ],
    [
      [
        "(a) Outward taxable supplies (other than zero, nil & exempted)",
        fmtNum(report.table31.outward_taxable_value),
        fmtNum(report.table31.outward_igst),
        fmtNum(report.table31.outward_cgst),
        fmtNum(report.table31.outward_sgst),
        fmtNum(report.table31.outward_cess),
      ],
      [
        "(b) Outward taxable supplies (zero rated exports / SEZ)",
        fmtNum(report.table31.zero_rated_taxable),
        "0.00",
        "-",
        "-",
        "0.00",
      ],
      [
        "(c) Other outward supplies (nil rated, exempted)",
        fmtNum(report.table31.nil_exempt_taxable),
        "-",
        "-",
        "-",
        "-",
      ],
      [
        "(d) Inward supplies liable to reverse charge (RCM)",
        fmtNum(report.table31.reverse_charge_taxable),
        fmtNum(report.table31.reverse_charge_igst || 0),
        fmtNum(report.table31.reverse_charge_cgst || 0),
        fmtNum(report.table31.reverse_charge_sgst || 0),
        fmtNum(report.table31.reverse_charge_cess || 0),
      ],
    ],
    "No outward supply entries."
  );

  // Table 4: Eligible ITC
  y = drawSectionHeading(doc, y, "4. Eligible Input Tax Credit (ITC Available)");
  y = drawDataTable(
    doc,
    y,
    [
      { header: "Details of Inward Supplies / ITC", width: 98, bold: true },
      { header: "IGST", width: 22, align: "right" },
      { header: "CGST", width: 22, align: "right" },
      { header: "SGST / UTGST", width: 24, align: "right" },
      { header: "Cess", width: 20, align: "right" },
    ],
    [
      [
        "(A)(5) All other ITC (Inward B2B Purchase Bills from Registered Vendors)",
        fmtNum(report.table4_itc.itc_igst),
        fmtNum(report.table4_itc.itc_cgst),
        fmtNum(report.table4_itc.itc_sgst),
        fmtNum(report.table4_itc.itc_cess),
      ],
      [
        "(D) Ineligible ITC (Blocked Credits u/s 17(5) CGST Act)",
        fmtNum(report.table4_itc.itc_ineligible),
        "0.00",
        "0.00",
        "0.00",
      ],
    ],
    "No ITC entries."
  );

  // Table 6.1: Payment of Tax
  y = drawSectionHeading(doc, y, "6.1 Payment of Tax (Net Liability Computation)");
  y = drawDataTable(
    doc,
    y,
    [
      { header: "Tax Head Description", width: 78, bold: true },
      { header: "Total Tax Payable (3.1)", width: 36, align: "right" },
      { header: "ITC Utilized (Table 4)", width: 36, align: "right" },
      { header: "Net Cash Payable", width: 36, align: "right", bold: true },
    ],
    [
      [
        "Integrated Tax (IGST)",
        fmtNum(report.table31.outward_igst + (report.table31.reverse_charge_igst || 0)),
        fmtNum(report.itc_utilized_igst),
        fmtNum(report.net_igst_payable),
      ],
      [
        "Central Tax (CGST)",
        fmtNum(report.table31.outward_cgst + (report.table31.reverse_charge_cgst || 0)),
        fmtNum(report.itc_utilized_cgst),
        fmtNum(report.net_cgst_payable),
      ],
      [
        "State / UT Tax (SGST)",
        fmtNum(report.table31.outward_sgst + (report.table31.reverse_charge_sgst || 0)),
        fmtNum(report.itc_utilized_sgst),
        fmtNum(report.net_sgst_payable),
      ],
      [
        "Cess",
        fmtNum(report.table31.outward_cess + (report.table31.reverse_charge_cess || 0)),
        fmtNum(report.itc_utilized_cess),
        fmtNum(report.net_cess_payable),
      ],
    ],
    "No tax payable entries.",
    [
      "TOTAL NET PAYABLE IN CASH",
      fmtAmt(report.total_tax_payable),
      fmtAmt(report.total_itc_utilized),
      fmtAmt(report.net_cash_payable),
    ]
  );

  drawVerificationSignOff(doc, y, report.legal_name);
  applyPageFooters(doc, "FORM GSTR-3B RETURN", report.gstin);

  return doc;
}
