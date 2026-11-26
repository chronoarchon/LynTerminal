import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Printer,
  FileDown,
  X,
  FileText,
  Receipt as ReceiptIcon,
  Copy,
  Check,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { safeHtml2Canvas } from "../../utils/safeHtml2Canvas";
import { printPdfDocument } from "../../utils/printPdf";
import type { CompleteGstInvoice, GstSettings } from "./gstTypes";
import type { Settings } from "../../types";
import { amountToIndianWords, getStateByCode } from "./gstUtils";
import { sanitizeGstSettings, isDemoTaxId } from "./gstDefaults";
import { useAppleDialog } from "../../components/common/AppleDialog";
import { api } from "../../services/api";

interface GSTTaxInvoiceModalProps {
  completeInvoice: CompleteGstInvoice;
  settings: Settings;
  gstSettings: GstSettings;
  onClose: () => void;
}

export const GSTTaxInvoiceModal: React.FC<GSTTaxInvoiceModalProps> = ({
  completeInvoice,
  settings,
  gstSettings,
  onClose,
}) => {
  const { invoice, gst_info, gst_items } = completeInvoice;
  const [docFormat, setDocFormat] = useState<"standard" | "thermal">("standard");
  const [copyType, setCopyType] = useState<
    "ORIGINAL FOR RECIPIENT" | "DUPLICATE FOR TRANSPORTER" | "TRIPLICATE FOR SUPPLIER"
  >("ORIGINAL FOR RECIPIENT");
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [customLogo] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("lynterminal_custom_logo") ||
        localStorage.getItem("lyndesk_custom_logo")
      );
    }
    return null;
  });
  const docRef = useRef<HTMLDivElement>(null);
  const { alert, toast } = useAppleDialog();

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(invoice.invoice_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generatePdfObject = async (): Promise<jsPDF | null> => {
    if (!docRef.current) return null;
    const element = docRef.current;
    const canvas = await safeHtml2Canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#FFFFFF",
      scrollY: 0,
      scrollX: 0,
    });

    let pdf: jsPDF;

    if (docFormat === "thermal") {
      const imgWidth = 80;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [imgWidth, Math.max(80, imgHeight + 4)],
      });
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 2, imgWidth, imgHeight);
    } else {
      pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 6;
      const usableHeight = pageHeight - margin * 2;
      const printWidth = pageWidth - margin * 2;
      const printHeight = (canvas.height * printWidth) / canvas.width;
      const imgData = canvas.toDataURL("image/png");

      if (printHeight <= usableHeight) {
        pdf.addImage(imgData, "PNG", margin, margin, printWidth, printHeight);
      } else if (printHeight <= usableHeight * 1.15) {
        // Fit near-single-page A4 invoices cleanly onto 1 sheet without stranding Terms on Page 2
        const scale = usableHeight / printHeight;
        const scaledWidth = printWidth * scale;
        const xOffset = (pageWidth - scaledWidth) / 2;
        pdf.addImage(imgData, "PNG", xOffset, margin, scaledWidth, usableHeight);
      } else {
        // Multi-page slicing for GST bills with many line items
        let heightLeft = printHeight;
        let position = margin;
        let page = 1;

        while (heightLeft > 0) {
          if (page > 1) {
            pdf.addPage();
          }
          pdf.addImage(imgData, "PNG", margin, position, printWidth, printHeight);
          heightLeft -= usableHeight;
          position -= usableHeight;
          page++;
        }
      }
    }
    return pdf;
  };

  const handlePrint = async () => {
    try {
      setIsExporting(true);
      const pdf = await generatePdfObject();
      if (pdf) {
        const printed = await printPdfDocument(pdf);
        if (printed) return;
      }
      // Fallback to DOM print isolation
      document.body.classList.add("printing-doc");
      window.print();
      setTimeout(() => {
        document.body.classList.remove("printing-doc");
      }, 1000);
    } catch {
      document.body.classList.add("printing-doc");
      window.print();
      setTimeout(() => {
        document.body.classList.remove("printing-doc");
      }, 1000);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove("printing-doc");
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const handleExportPdf = async () => {
    if (!docRef.current) return;
    try {
      setIsExporting(true);

      const pdf = await generatePdfObject();
      if (!pdf) throw new Error("Could not synthesize invoice layout");

      // Persist client bytes through backend storage
      const arrayBuffer = pdf.output("arraybuffer");
      const uint8Array = new Uint8Array(arrayBuffer);
      const savedPath = await api.saveInvoicePdfFile(
        `GST-${invoice.invoice_number}`,
        uint8Array
      );

      pdf.save(`GST_Tax_Invoice_${invoice.invoice_number}.pdf`);

      toast({
        message: `GST Tax Invoice saved to ${savedPath}`,
        type: "success",
      });
    } catch (e) {
      alert({
        title: "PDF Export Error",
        message: "Failed to generate PDF: " + String(e),
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const effectiveGst = sanitizeGstSettings(gstSettings, settings);
  const sellerLegalName =
    effectiveGst.legal_name || settings.business_name || "Your Business";
  const sellerGstin =
    effectiveGst.gstin ||
    (!isDemoTaxId(settings.tax_id) ? settings.tax_id : "") ||
    "Unregistered";
  const isRegisteredSeller = sellerGstin !== "Unregistered";

  const isInterstate = gst_info.is_interstate;
  const supplierState = getStateByCode(effectiveGst.state_code) || {
    name: effectiveGst.state_name || "Maharashtra",
    code: effectiveGst.state_code || "27",
  };
  const posState = getStateByCode(gst_info.pos_state_code) || {
    name: gst_info.pos_state_name || "Maharashtra",
    code: gst_info.pos_state_code || "27",
  };

  // Group HSN summary
  const hsnMap = new Map<
    string,
    {
      hsn_code: string;
      taxable: number;
      cgst: number;
      sgst: number;
      igst: number;
      totalTax: number;
    }
  >();

  for (const itm of gst_items) {
    const key = itm.hsn_code || "N/A";
    const existing = hsnMap.get(key) || {
      hsn_code: key,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalTax: 0,
    };
    existing.taxable += itm.taxable_amount;
    existing.cgst += itm.cgst_amount;
    existing.sgst += itm.sgst_amount;
    existing.igst += itm.igst_amount;
    existing.totalTax += itm.cgst_amount + itm.sgst_amount + itm.igst_amount;
    hsnMap.set(key, existing);
  }

  const hsnSummaryList = Array.from(hsnMap.values());
  const wordsRepresentation = amountToIndianWords(invoice.total_amount);

  const modalContent = (
    <div id="invoice-modal-portal">
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl border border-black/[0.08] overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-150 text-black">
        
        {/* Top Control Bar */}
        <div className="px-5 py-3.5 bg-[#F9FAFB] border-b border-black/[0.08] no-print shrink-0 text-black">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-black/5 text-black flex items-center justify-center font-bold text-xs border border-black/[0.08] shrink-0">
                GST
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-black font-mono">
                    {invoice.invoice_number}
                  </span>
                  <button
                    onClick={handleCopyNumber}
                    title="Copy Invoice Number"
                    className="text-neutral-400 hover:text-black transition cursor-pointer p-0.5"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50 uppercase">
                    Rule 46 CGST
                  </span>
                </div>
                <span className="text-[11px] text-neutral-500 font-mono truncate block">
                  {invoice.invoice_date} · {invoice.payment_method}
                </span>
              </div>
            </div>

            {/* Controls Toolbar (Always Aligned, Never Wrapping Close Button into Center) */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={copyType}
                onChange={(e) => setCopyType(e.target.value as any)}
                className="text-xs bg-white border border-black/[0.1] rounded-xl px-2.5 py-1.5 font-bold text-black focus:outline-none focus:border-black cursor-pointer shadow-2xs"
              >
                <option value="ORIGINAL FOR RECIPIENT">Original (Recipient)</option>
                <option value="DUPLICATE FOR TRANSPORTER">Duplicate (Transporter)</option>
                <option value="TRIPLICATE FOR SUPPLIER">Triplicate (Supplier)</option>
              </select>

              <div className="flex items-center p-0.5 rounded-xl bg-neutral-100 border border-black/[0.06] text-xs">
                <button
                  onClick={() => setDocFormat("standard")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    docFormat === "standard"
                      ? "bg-white text-black shadow-xs"
                      : "text-neutral-500 hover:text-black"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>A4 Tax</span>
                </button>
                <button
                  onClick={() => setDocFormat("thermal")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    docFormat === "thermal"
                      ? "bg-white text-black shadow-xs"
                      : "text-neutral-500 hover:text-black"
                  }`}
                >
                  <ReceiptIcon className="w-3.5 h-3.5" />
                  <span>80mm</span>
                </button>
              </div>

              <button
                onClick={handleExportPdf}
                disabled={isExporting}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-black/[0.1] bg-white hover:bg-neutral-50 text-black text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>{isExporting ? "..." : "PDF"}</span>
              </button>

              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <div className="pl-1 border-l border-black/[0.1] ml-0.5">
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
                  title="Close preview"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Document Canvas with Clean Light Desk Canvas */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 pb-20 bg-[#F5F5F7]">
          
          {/* FORMAT 1: A4 Commercial GST Tax Invoice (Rule 46 CGST Compliant) */}
          {docFormat === "standard" && (
            <div
              ref={docRef}
              data-printable="true"
              className="mx-auto w-full max-w-3xl bg-white p-5 sm:p-6 rounded-2xl shadow-xl border border-black/[0.1] text-[#1D1D1F] select-text my-2 text-xs font-sans print:m-0 print:p-0 print:border-none print:shadow-none"
            >
              {/* Top Banner Marking */}
              <div className="flex justify-between items-center pb-2 border-b-2 border-black/80 print-avoid-break">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-black">
                  <ShieldCheck className={`w-4 h-4 ${isRegisteredSeller ? "text-emerald-600" : "text-neutral-500"}`} />
                  <span>{isRegisteredSeller ? "GSTIN Registered Enterprise" : "Commercial Tax Invoice"}</span>
                </div>
                <div className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-black/5 uppercase text-black border border-black/10">
                  {copyType}
                </div>
              </div>

              {/* Title & Header */}
              <div className="text-center py-2.5 border-b border-black/[0.1] print-avoid-break">
                <h1 className="text-lg sm:text-xl font-black tracking-tight uppercase text-black">
                  TAX INVOICE
                </h1>
                <p className="text-[10px] text-neutral-500 font-medium tracking-wide">
                  (Issued under Section 31 of CGST Act, 2017 read with Rule 46 of CGST Rules)
                </p>
              </div>

              {/* Supplier & Invoice Meta */}
              <div className="grid grid-cols-2 gap-4 py-3 border-b border-black/[0.1] print-avoid-break">
                {/* Supplier (Seller) Details */}
                <div className="flex items-start gap-3">
                  {customLogo ? (
                    <img
                      src={customLogo}
                      alt="Store Logo"
                      className="w-11 h-11 rounded-xl object-contain border border-black/10 shrink-0 p-0.5 bg-white shadow-2xs mt-0.5"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl border border-black/10 shrink-0 p-0.5 bg-[#18191E] text-white flex items-center justify-center font-bold text-lg shadow-2xs mt-0.5">
                      {sellerLegalName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-bold uppercase text-neutral-400">
                      Details of Supplier (Seller)
                    </div>
                    <div className="font-bold text-sm text-black">
                      {sellerLegalName}
                    </div>
                    {effectiveGst.trade_name && effectiveGst.trade_name !== sellerLegalName && (
                      <div className="text-[11px] font-medium text-neutral-600">
                        Trade Name: {effectiveGst.trade_name}
                      </div>
                    )}
                    {settings.address && (
                      <div className="text-neutral-600 leading-snug">
                        {settings.address}
                      </div>
                    )}
                    {(settings.phone || settings.email) && (
                      <div className="text-neutral-600">
                        {settings.phone ? `Tel: ${settings.phone}` : ""}
                        {settings.phone && settings.email ? " · " : ""}
                        {settings.email ? `Email: ${settings.email}` : ""}
                      </div>
                    )}
                    <div className="font-mono font-bold text-black pt-0.5">
                      GSTIN:{" "}
                      <span className="text-black font-semibold">
                        {sellerGstin}
                      </span>
                    </div>
                    <div className="font-mono text-neutral-700">
                      State: {supplierState.name} (Code: {supplierState.code})
                    </div>
                    {effectiveGst.pan && (
                      <div className="font-mono text-neutral-700">
                        PAN: {effectiveGst.pan}
                      </div>
                    )}
                  </div>
                </div>

                {/* Invoice Metadata */}
                <div className="space-y-1 text-right">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">
                    Invoice Details
                  </div>
                  <div className="text-base font-black font-mono text-black">
                    {invoice.invoice_number}
                  </div>
                  <div className="text-neutral-700">
                    Invoice Date: <span className="font-semibold text-black">{invoice.invoice_date}</span>
                  </div>
                  <div className="text-neutral-700">
                    Due Date: <span className="font-semibold text-black">{invoice.due_date}</span>
                  </div>
                  <div className="text-neutral-700">
                    Payment Mode: <span className="font-semibold text-black">{invoice.payment_method}</span>
                  </div>
                  <div className="text-neutral-700 pt-1">
                    Place of Supply (POS):{" "}
                    <span className="font-bold text-black">
                      {posState.name} ({posState.code})
                    </span>
                  </div>
                  <div className="text-neutral-700">
                    Supply Nature:{" "}
                    <span className={`font-bold ${isInterstate ? "text-neutral-900" : "text-emerald-700"}`}>
                      {isInterstate ? "Inter-State Supply (IGST)" : "Intra-State Supply (CGST + SGST)"}
                    </span>
                  </div>
                  <div className="text-neutral-700">
                    Reverse Charge Applicable:{" "}
                    <span className="font-bold text-black">
                      {gst_info.is_reverse_charge ? "Yes" : "No"}
                    </span>
                  </div>
                  {gst_info.eway_bill_no && (
                    <div className="font-mono text-neutral-700">
                      E-Way Bill: {gst_info.eway_bill_no}
                    </div>
                  )}
                </div>
              </div>

              {/* Recipient (Billed To & Shipped To) */}
              <div className="grid grid-cols-2 gap-4 py-2.5 border-b border-black/[0.1] bg-neutral-50/60 p-2.5 rounded-xl mt-2.5 print-avoid-break">
                {/* Billed To */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">
                    Billed To (Recipient / Buyer)
                  </div>
                  <div className="font-bold text-sm text-black">
                    {invoice.party_name || "Cash Walk-in Consumer"}
                  </div>
                  <div className="text-neutral-600">
                    GSTIN / UIN:{" "}
                    <span className="font-mono font-bold text-black">
                      {gst_info.customer_gstin || "Unregistered Consumer"}
                    </span>
                  </div>
                  <div className="text-neutral-600">
                    State: {posState.name} (Code: {posState.code})
                  </div>
                  {invoice.reference && (
                    <div className="text-neutral-600">
                      Customer PO / Ref: <span className="font-mono font-semibold">{invoice.reference}</span>
                    </div>
                  )}
                </div>

                {/* Shipped To */}
                <div className="space-y-1 text-right">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">
                    Shipped To (Consignee)
                  </div>
                  <div className="font-semibold text-neutral-800">
                    {invoice.party_name || "Counter Handover"}
                  </div>
                  <div className="text-neutral-600">
                    Delivery State: {posState.name} (Code: {posState.code})
                  </div>
                  {gst_info.vehicle_no && (
                    <div className="text-neutral-600 font-mono">
                      Vehicle No: {gst_info.vehicle_no}
                    </div>
                  )}
                  {gst_info.transporter_name && (
                    <div className="text-neutral-600">
                      Transporter: {gst_info.transporter_name}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="py-2.5 overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black/[0.15] bg-neutral-100 text-neutral-700 text-[10px] font-bold uppercase">
                      <th className="py-1.5 px-1 text-center w-7">#</th>
                      <th className="py-1.5 px-2 text-left">Description of Goods / Services</th>
                      <th className="py-1.5 px-1 text-center font-mono">HSN/SAC</th>
                      <th className="py-1.5 px-1 text-center">Qty</th>
                      <th className="py-1.5 px-1 text-right">Rate (₹)</th>
                      <th className="py-1.5 px-1 text-right">Taxable (₹)</th>
                      {!isInterstate ? (
                        <>
                          <th className="py-1.5 px-1 text-right">CGST</th>
                          <th className="py-1.5 px-1 text-right">SGST</th>
                        </>
                      ) : (
                        <th className="py-1.5 px-1 text-right">IGST</th>
                      )}
                      <th className="py-1.5 px-2 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.06]">
                    {gst_items.map((item, idx) => {
                      const matchedItem = completeInvoice.items.find((ci) => ci.id === item.id) || completeInvoice.items[idx];
                      const itemName = matchedItem?.item_name || (item.item_id ? "Item" : "Service / Goods Item");

                      return (
                        <tr key={item.id || idx} className="hover:bg-neutral-50/50">
                          <td className="py-1.5 px-1 text-center font-mono text-neutral-400">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-2 font-medium text-black">
                            {itemName}
                          </td>
                          <td className="py-1.5 px-1 text-center font-mono text-neutral-600">
                            {item.hsn_code || "8471"}
                          </td>
                          <td className="py-1.5 px-1 text-center font-mono text-neutral-700 whitespace-nowrap">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-1.5 px-1 text-right font-mono text-neutral-700">
                            {item.rate.toFixed(2)}
                          </td>
                          <td className="py-1.5 px-1 text-right font-mono font-semibold text-black">
                            {item.taxable_amount.toFixed(2)}
                          </td>
                          {!isInterstate ? (
                            <>
                              <td className="py-1.5 px-1 text-right font-mono text-neutral-600">
                                <span>{item.cgst_amount.toFixed(2)}</span>
                                <span className="text-[9px] text-neutral-400 ml-0.5">({item.cgst_rate}%)</span>
                              </td>
                              <td className="py-1.5 px-1 text-right font-mono text-neutral-600">
                                <span>{item.sgst_amount.toFixed(2)}</span>
                                <span className="text-[9px] text-neutral-400 ml-0.5">({item.sgst_rate}%)</span>
                              </td>
                            </>
                          ) : (
                            <td className="py-1.5 px-1 text-right font-mono text-neutral-600">
                              <span>{item.igst_amount.toFixed(2)}</span>
                              <span className="text-[9px] text-neutral-400 ml-0.5">({item.igst_rate}%)</span>
                            </td>
                          )}
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-black">
                            {item.line_total.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* HSN Summary Table & Invoice Totals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t-2 border-black/[0.15] print-avoid-break">
                {/* HSN Tax Summary Table (Mandatory statutory disclosure) */}
                <div className="space-y-2 print-avoid-break">
                  <div className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                    HSN / SAC Tax Summary
                  </div>
                  <table className="w-full text-[10px] border border-black/10 rounded-lg overflow-hidden">
                    <thead className="bg-neutral-100 text-neutral-700 font-bold border-b border-black/10">
                      <tr>
                        <th className="py-1 px-1.5 text-left font-mono">HSN</th>
                        <th className="py-1 px-1.5 text-right">Taxable</th>
                        {!isInterstate ? (
                          <>
                            <th className="py-1 px-1 text-right">CGST</th>
                            <th className="py-1 px-1 text-right">SGST</th>
                          </>
                        ) : (
                          <th className="py-1 px-1 text-right">IGST</th>
                        )}
                        <th className="py-1 px-1.5 text-right">Total Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 font-mono">
                      {hsnSummaryList.map((hsn, idx) => (
                        <tr key={idx}>
                          <td className="py-1 px-1.5 font-bold">{hsn.hsn_code}</td>
                          <td className="py-1 px-1.5 text-right">₹{hsn.taxable.toFixed(2)}</td>
                          {!isInterstate ? (
                            <>
                              <td className="py-1 px-1 text-right">₹{hsn.cgst.toFixed(2)}</td>
                              <td className="py-1 px-1 text-right">₹{hsn.sgst.toFixed(2)}</td>
                            </>
                          ) : (
                            <td className="py-1 px-1 text-right">₹{hsn.igst.toFixed(2)}</td>
                          )}
                          <td className="py-1 px-1.5 text-right font-bold">₹{hsn.totalTax.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Bank Details for Direct Payment (Only shown when configured) */}
                  {(effectiveGst.bank_name || effectiveGst.bank_account_no || effectiveGst.upi_id) && (
                    <div className="pt-2 text-[10px] bg-neutral-50 p-2.5 rounded-xl border border-solid border-black/15 space-y-0.5 print-avoid-break">
                      <div className="font-bold uppercase text-neutral-600 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-neutral-700" />
                        <span>Bank NEFT / RTGS / UPI Details</span>
                      </div>
                      {effectiveGst.bank_name && (
                        <div>Bank: <span className="font-semibold text-black">{effectiveGst.bank_name}</span></div>
                      )}
                      {effectiveGst.bank_account_no && (
                        <div>A/c No: <span className="font-mono font-bold text-black">{effectiveGst.bank_account_no}</span></div>
                      )}
                      {effectiveGst.bank_ifsc && (
                        <div>IFSC Code: <span className="font-mono font-bold text-black">{effectiveGst.bank_ifsc}</span></div>
                      )}
                      {effectiveGst.bank_branch && (
                        <div>Branch: <span className="text-neutral-700">{effectiveGst.bank_branch}</span></div>
                      )}
                      {effectiveGst.upi_id && (
                        <div className="pt-0.5 font-mono text-black">
                          UPI ID: <span className="font-bold">{effectiveGst.upi_id}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Numerical Totals */}
                <div className="space-y-1 text-xs font-mono print-avoid-break">
                  <div className="flex justify-between py-1 text-neutral-600 border-b border-black/[0.06]">
                    <span className="font-sans">
                      {invoice.discount_amount > 0 ? "Gross Subtotal" : "Taxable Value"}
                    </span>
                    <span>₹{invoice.subtotal.toFixed(2)}</span>
                  </div>

                  {invoice.discount_amount > 0 && (
                    <>
                      <div className="flex justify-between py-1 text-emerald-600 border-b border-black/[0.06]">
                        <span className="font-sans">Discount</span>
                        <span>-₹{invoice.discount_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1 text-neutral-700 font-semibold border-b border-black/[0.06]">
                        <span className="font-sans">Net Taxable Value</span>
                        <span>₹{Math.max(0, invoice.subtotal - invoice.discount_amount).toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {!isInterstate ? (
                    <>
                      <div className="flex justify-between py-1 text-neutral-700 border-b border-black/[0.06]">
                        <span className="font-sans">Central Tax (CGST)</span>
                        <span>+₹{gst_info.cgst_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1 text-neutral-700 border-b border-black/[0.06]">
                        <span className="font-sans">State Tax (SGST)</span>
                        <span>+₹{gst_info.sgst_amount.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between py-1 text-neutral-700 border-b border-black/[0.06]">
                      <span className="font-sans">Integrated Tax (IGST)</span>
                      <span>+₹{gst_info.igst_amount.toFixed(2)}</span>
                    </div>
                  )}

                  {gst_info.cess_amount > 0 && (
                    <div className="flex justify-between py-1 text-neutral-700 border-b border-black/[0.06]">
                      <span className="font-sans">Cess Amount</span>
                      <span>+₹{gst_info.cess_amount.toFixed(2)}</span>
                    </div>
                  )}

                  {gst_info.round_off !== 0 && (
                    <div className="flex justify-between py-1 text-neutral-500 border-b border-black/[0.06]">
                      <span className="font-sans">Round Off</span>
                      <span>{gst_info.round_off > 0 ? `+₹${gst_info.round_off.toFixed(2)}` : `-₹${Math.abs(gst_info.round_off).toFixed(2)}`}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 text-base font-black text-black border-b-2 border-black">
                    <span className="font-sans">Total Invoice Amount</span>
                    <span>₹{invoice.total_amount.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between py-1 text-neutral-600">
                    <span className="font-sans">Amount Paid</span>
                    <span className="text-emerald-600 font-bold">₹{invoice.paid_amount.toFixed(2)}</span>
                  </div>

                  {invoice.total_amount - invoice.paid_amount > 0 && (
                    <div className="flex justify-between py-1 text-rose-600 font-bold">
                      <span className="font-sans">Balance Outstanding (Credit Due)</span>
                      <span>₹{(invoice.total_amount - invoice.paid_amount).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount in Words (Mandatory Legal Clause) */}
              <div className="mt-3 p-2.5 bg-neutral-100 rounded-xl border border-black/[0.08] print-avoid-break">
                <div className="text-[10px] font-bold uppercase text-neutral-500">
                  Total Amount in Words
                </div>
                <div className="font-bold text-black text-xs mt-0.5 leading-snug">
                  {wordsRepresentation}
                </div>
              </div>

              {/* Terms & Conditions & Signatory Box */}
              <div className="mt-3 pt-3 border-t border-black/[0.1] grid grid-cols-2 gap-6 items-end print-avoid-break">
                <div className="space-y-0.5 text-[10px] text-neutral-500">
                  <div className="font-bold text-neutral-700 uppercase">
                    Terms & Conditions
                  </div>
                  <p>1. Goods once sold will not be taken back or exchanged without receipt.</p>
                  <p>2. Subject to local municipal jurisdiction only.</p>
                  <p>3. This is a computer generated legal tax invoice under Rule 46 of CGST Act.</p>
                </div>

                <div className="text-right space-y-5">
                  <div className="text-[11px] font-bold text-black">
                    For {sellerLegalName}
                  </div>
                  <div className="text-[10px] font-semibold text-neutral-500 border-t border-dashed border-neutral-400 inline-block pt-1 min-w-[160px] text-center">
                    Authorized Signatory
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FORMAT 2: 80mm GST Thermal Slip */}
          {docFormat === "thermal" && (
            <div
              ref={docRef}
              data-printable="true"
              className="thermal-receipt mx-auto w-[360px] max-w-full bg-white p-6 rounded-2xl shadow-lg border border-black/[0.1] text-black font-mono text-xs space-y-3 select-text my-2"
            >
              <div className="text-center space-y-1 pb-3 border-b border-solid border-black/20">
                {customLogo ? (
                  <div className="flex justify-center pb-1">
                    <img
                      src={customLogo}
                      alt="Store Logo"
                      className="max-h-12 max-w-[120px] object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex justify-center pb-1">
                    <div className="w-10 h-10 rounded-xl bg-[#18191E] text-white flex items-center justify-center font-bold text-lg">
                      {sellerLegalName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className="font-bold text-sm uppercase">
                  {sellerLegalName}
                </div>
                {settings.address && (
                  <div className="text-[10px] text-neutral-600">
                    {settings.address}
                  </div>
                )}
                {isRegisteredSeller && (
                  <div className="text-[10px] font-bold text-black font-mono">
                    GSTIN: {sellerGstin}
                  </div>
                )}
                <div className="text-[10px] text-neutral-600">
                  State: {supplierState.name} ({supplierState.code})
                </div>
                <div className="text-xs font-bold pt-1 border-t border-solid border-black/15 mt-1">
                  *** GST TAX INVOICE ***
                </div>
                <div className="text-[9px] text-neutral-500 uppercase font-sans">
                  {copyType}
                </div>
              </div>

              <div className="space-y-1 text-[11px] pb-2 border-b border-solid border-black/15">
                <div className="flex justify-between">
                  <span className="text-neutral-500">INVOICE #:</span>
                  <span className="font-bold">{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">DATE:</span>
                  <span>{invoice.invoice_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">CUSTOMER:</span>
                  <span className="font-bold truncate max-w-[160px] text-right">
                    {invoice.party_name || "Walk-in Customer"}
                  </span>
                </div>
                {gst_info.customer_gstin && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">CUST GSTIN:</span>
                    <span className="font-bold">{gst_info.customer_gstin}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">POS:</span>
                  <span>{posState.name} ({posState.code})</span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1 py-1">
                <div className="flex justify-between text-[10px] font-bold text-neutral-500 border-b border-solid border-black/20 pb-1">
                  <span>ITEM / HSN / QTY</span>
                  <span>AMOUNT</span>
                </div>
                {gst_items.map((item, idx) => {
                  const matchedItem = completeInvoice.items.find((ci) => ci.id === item.id) || completeInvoice.items[idx];
                  const itemName = matchedItem?.item_name || (item.item_id ? "Item" : "Goods / Service");

                  return (
                    <div key={idx} className="space-y-0.5 text-[11px] border-b border-solid border-black/10 pb-1">
                      <div className="font-bold leading-tight">
                        {itemName}
                      </div>
                      <div className="flex justify-between text-[10px] text-neutral-600">
                        <span>HSN:{item.hsn_code} · {item.quantity} {item.unit} @ ₹{item.rate.toFixed(2)}</span>
                        <span className="font-bold text-black">₹{item.line_total.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="space-y-1 pt-2 border-t border-solid border-black/20 text-[11px]">
                <div className="flex justify-between text-neutral-600">
                  <span>{invoice.discount_amount > 0 ? "Gross Subtotal:" : "Taxable Subtotal:"}</span>
                  <span>₹{invoice.subtotal.toFixed(2)}</span>
                </div>
                {invoice.discount_amount > 0 && (
                  <>
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount:</span>
                      <span>-₹{invoice.discount_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-700 font-semibold">
                      <span>Taxable Value:</span>
                      <span>₹{Math.max(0, invoice.subtotal - invoice.discount_amount).toFixed(2)}</span>
                    </div>
                  </>
                )}
                {!isInterstate ? (
                  <>
                    <div className="flex justify-between text-neutral-600">
                      <span>CGST:</span>
                      <span>₹{gst_info.cgst_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>SGST:</span>
                      <span>₹{gst_info.sgst_amount.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-neutral-600">
                    <span>IGST:</span>
                    <span>₹{gst_info.igst_amount.toFixed(2)}</span>
                  </div>
                )}
                {gst_info.cess_amount > 0 && (
                  <div className="flex justify-between text-neutral-600">
                    <span>Cess:</span>
                    <span>₹{gst_info.cess_amount.toFixed(2)}</span>
                  </div>
                )}
                {Math.abs(gst_info.round_off) >= 0.005 && (
                  <div className="flex justify-between text-neutral-600">
                    <span>Round Off:</span>
                    <span>
                      {gst_info.round_off >= 0 ? "+" : "-"}₹{Math.abs(gst_info.round_off).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-solid border-black/30 text-black">
                  <span>GRAND TOTAL:</span>
                  <span>₹{invoice.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Amount Paid ({invoice.payment_method}):</span>
                  <span>₹{invoice.paid_amount.toFixed(2)}</span>
                </div>
                {invoice.total_amount - invoice.paid_amount > 0 && (
                  <div className="flex justify-between font-bold text-rose-600">
                    <span>Credit Balance Due:</span>
                    <span>₹{(invoice.total_amount - invoice.paid_amount).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Words */}
              <div className="pt-2 text-[9px] text-neutral-600 font-sans border-t border-solid border-black/15">
                <span className="font-bold">Words:</span> {wordsRepresentation}
              </div>

              <div className="text-center text-[10px] text-neutral-500 pt-3 border-t border-solid border-black/15">
                <p>Thank you for your business!</p>
                <div className="text-[9px] text-neutral-400 tracking-wider pt-1">
                  *** 100% LEGAL GST COMPLIANT ***
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

return typeof document !== "undefined"
  ? createPortal(modalContent, document.body)
  : modalContent;
};
