import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  CreditCard,
  Banknote,
  Building,
  Lock,
  ExternalLink,
} from "lucide-react";
import type { Item, Party, Settings, LicenseStatus } from "../../types";
import type {
  GstSettings,
  CompleteGstInvoice,
  CreateGstInvoicePayload,
  CreateGstItemPayload,
} from "./gstTypes";
import { gstApi } from "./gstApi";
import {
  INDIAN_STATES,
  calculateGstBreakdown,
  amountToIndianWords,
} from "./gstUtils";
import { GSTTaxInvoiceModal } from "./GSTTaxInvoiceModal";
import { useAppleDialog } from "../../components/common/AppleDialog";

interface GSTPOSBillingProps {
  settings: Settings;
  gstSettings: GstSettings;
  items: Item[];
  parties: Party[];
  licenseStatus?: LicenseStatus | null;
  onInvoiceCreated: () => void;
  onRefreshData: () => void;
  onOpenLicenseModal?: () => void;
}


interface GSTCartItem {
  item_id?: string;
  item_name: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_amount: number;
  tax_rate: number; // 0, 5, 12, 18, 28
}

export const GSTPOSBilling: React.FC<GSTPOSBillingProps> = ({
  settings,
  gstSettings,
  items,
  parties,
  licenseStatus,
  onInvoiceCreated,
  onRefreshData,
  onOpenLicenseModal,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState<GSTCartItem[]>([]);

  // Party Selection
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [customCustomerName, setCustomCustomerName] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");

  // Place of Supply (POS) - defaults to supplier state
  const [posStateCode, setPosStateCode] = useState<string>(gstSettings.state_code || "27");

  // Payment & Credit Mode
  const [paymentType, setPaymentType] = useState<
    "CREDIT" | "CASH" | "UPI" | "CARD" | "BANK"
  >("CASH");
  const [paidAmountStr, setPaidAmountStr] = useState<string>("");
  const [refNumber, setRefNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [billRefType, setBillRefType] = useState<string>("New Ref");

  // Credit Period in Days & Credit Limit
  const [creditDays, setCreditDays] = useState<number>(30);
  const [partyCreditLimit, setPartyCreditLimit] = useState<number>(0);

  // Completed Invoice Modal
  const [completedInvoice, setCompletedInvoice] = useState<CompleteGstInvoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { alert, toast } = useAppleDialog();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Sync customer details when selecting party
  const selectedParty = useMemo(() => {
    return parties.find((p) => p.id === selectedPartyId) || null;
  }, [parties, selectedPartyId]);

  useEffect(() => {
    if (selectedParty) {
      if (selectedParty.tax_number) {
        setCustomerGstin(selectedParty.tax_number);
        // If 15-char GSTIN, extract state code
        if (selectedParty.tax_number.length === 15) {
          const sc = selectedParty.tax_number.substring(0, 2);
          setPosStateCode(sc);
        }
      }
      // Check party GST profile for credit terms
      gstApi.getPartyGstProfile(selectedParty.id).then((prof) => {
        if (prof) {
          if (prof.gstin) setCustomerGstin(prof.gstin);
          if (prof.state_code) setPosStateCode(prof.state_code);
          if (prof.credit_period_days) setCreditDays(prof.credit_period_days);
          if (prof.credit_limit) setPartyCreditLimit(prof.credit_limit);
        }
      }).catch(() => {});
    } else {
      setPartyCreditLimit(0);
    }
  }, [selectedParty]);

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(items.map((i) => i.category))).filter(Boolean)];
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return items.filter((item) => {
      const matchCat = selectedCategory === "All" || item.category === selectedCategory;
      if (!matchCat) return false;
      if (!term) return true;
      return (
        item.name.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term) ||
        item.barcode.includes(term)
      );
    });
  }, [items, searchTerm, selectedCategory]);

  const addToCart = (item: Item) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item_id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item_id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [
        ...prev,
        {
          item_id: item.id,
          item_name: item.name,
          hsn_code: "8471",
          quantity: 1,
          unit: item.unit || "PCS",
          rate: item.sale_price,
          discount_amount: 0,
          tax_rate: item.tax_rate ?? 18,
        },
      ];
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci, idx) => {
          if (idx === index) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as GSTCartItem[]
    );
  };

  const updateTaxRate = (index: number, rate: number) => {
    setCart((prev) =>
      prev.map((ci, idx) => (idx === index ? { ...ci, tax_rate: rate } : ci))
    );
  };

  const updateHsn = (index: number, hsn: string) => {
    setCart((prev) =>
      prev.map((ci, idx) => (idx === index ? { ...ci, hsn_code: hsn } : ci))
    );
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedPartyId("");
    setCustomCustomerName("");
    setCustomerGstin("");
    setPaidAmountStr("");
    setRefNumber("");
    setNotes("");
    setPartyCreditLimit(0);
  };

  // Calculations with Place of Supply logic
  const supplierCode = gstSettings.state_code || "27";
  const posCode = posStateCode || supplierCode;
  const isInterstate = supplierCode !== posCode;

  const lineCalculations = useMemo(() => {
    return cart.map((item) => {
      const gross = item.rate * item.quantity;
      const taxable = Math.max(0, gross - item.discount_amount);
      const breakdown = calculateGstBreakdown(taxable, item.tax_rate, supplierCode, posCode);
      return {
        ...item,
        taxable_amount: taxable,
        ...breakdown,
      };
    });
  }, [cart, supplierCode, posCode]);

  const subtotalTaxable = lineCalculations.reduce((sum, l) => sum + l.taxable_amount, 0);
  const totalCgst = lineCalculations.reduce((sum, l) => sum + l.cgstAmount, 0);
  const totalSgst = lineCalculations.reduce((sum, l) => sum + l.sgstAmount, 0);
  const totalIgst = lineCalculations.reduce((sum, l) => sum + l.igstAmount, 0);
  const totalTax = totalCgst + totalSgst + totalIgst;
  const rawTotal = subtotalTaxable + totalTax;

  // Indian Round-Off to nearest rupee
  const roundedGrandTotal = Math.round(rawTotal);
  const roundOff = Math.round((roundedGrandTotal - rawTotal) * 100) / 100;

  // Default paid amount based on payment type
  const effectivePaidAmount =
    paymentType === "CREDIT"
      ? parseFloat(paidAmountStr) || 0
      : roundedGrandTotal;

  const dueBalance = Math.max(0, roundedGrandTotal - effectivePaidAmount);

  // Credit Limit Warning Check
  const isCreditOverLimit = useMemo(() => {
    if (!selectedParty || paymentType !== "CREDIT") return false;
    if (partyCreditLimit <= 0) return false;
    // Current outstanding balance plus new unpaid credit
    const futureOutstanding = selectedParty.current_balance + dueBalance;
    return futureOutstanding > partyCreditLimit;
  }, [selectedParty, paymentType, dueBalance, partyCreditLimit]);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert({ title: "Cart Empty", message: "Please add products to the bill", type: "warning" });
      return;
    }

    if (licenseStatus?.is_expired) {
      onOpenLicenseModal?.();
      alert({
        title: "14-Day Free Trial Expired",
        message: "Your evaluation trial has ended. Please activate your commercial license to complete checkout and issue new GST bills.",
        type: "warning",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const todayStr = new Date().toISOString().split("T")[0];

      // Calculate due date based on credit terms
      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + (paymentType === "CREDIT" ? creditDays : 0));
      const dueDateStr = dueDateObj.toISOString().split("T")[0];

      const partyName = selectedParty
        ? selectedParty.name
        : customCustomerName.trim() || "Cash Walk-in Consumer";

      const selectedStateObj = INDIAN_STATES.find((s) => s.code === posCode);
      const posStateName = selectedStateObj ? selectedStateObj.name : "Maharashtra";
      const placeOfSupplyDesc = `${posCode}-${posStateName}`;

      const itemsPayload: CreateGstItemPayload[] = lineCalculations.map((l) => ({
        item_id: l.item_id || null,
        item_name: l.item_name,
        hsn_code: l.hsn_code || "8471",
        quantity: l.quantity,
        unit: l.unit,
        rate: l.rate,
        discount_amount: l.discount_amount,
        taxable_amount: l.taxable_amount,
        tax_rate: l.tax_rate,
        cgst_rate: l.cgstRate,
        cgst_amount: l.cgstAmount,
        sgst_rate: l.sgstRate,
        sgst_amount: l.sgstAmount,
        igst_rate: l.igstRate,
        igst_amount: l.igstAmount,
        cess_rate: 0,
        cess_amount: 0,
        line_total: l.lineTotal,
      }));

      const payload: CreateGstInvoicePayload = {
        invoice_type: "SALE",
        party_id: selectedPartyId ? selectedPartyId : null,
        party_name: partyName,
        invoice_date: todayStr,
        due_date: dueDateStr,
        subtotal: subtotalTaxable,
        discount_amount: 0,
        total_tax: totalTax,
        cgst_amount: totalCgst,
        sgst_amount: totalSgst,
        igst_amount: totalIgst,
        cess_amount: 0,
        round_off: roundOff,
        total_amount: roundedGrandTotal,
        paid_amount: effectivePaidAmount,
        payment_method:
          paymentType === "CREDIT"
            ? `Credit (${creditDays} Days)`
            : paymentType,
        notes: notes || (paymentType === "CREDIT" ? "Credit Tax Invoice" : "GST POS Cash Sale"),
        reference: refNumber.trim() || null,
        place_of_supply: placeOfSupplyDesc,
        pos_state_code: posCode,
        pos_state_name: posStateName,
        customer_gstin: customerGstin.trim().toUpperCase(),
        is_interstate: isInterstate,
        is_reverse_charge: false,
        eway_bill_no: null,
        vehicle_no: null,
        transporter_name: null,
        bill_reference_type: billRefType,
        items: itemsPayload,
      };

      const result = await gstApi.createGstInvoice(payload);

      setCompletedInvoice(result);
      clearCart();
      onInvoiceCreated();
      onRefreshData();

      toast({
        message: `GST Tax Invoice #${result.invoice.invoice_number} created successfully`,
        type: "success",
      });
    } catch (err) {
      alert({
        title: "Billing Error",
        message: "Failed to generate GST Tax Invoice: " + String(err),
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-hidden">
      {/* 14-Day Free Trial Expired Warning Banner */}
      {licenseStatus?.is_expired && (
        <div className="w-full bg-rose-50 border border-rose-200 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 z-30 shrink-0">
          <div className="flex items-center gap-2 text-xs text-rose-800 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>14-Day Free Trial Expired — GST counter billing is locked until activated. Past invoices and reports remain safe.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://lynterminal.wintershogun.tech/pricing?checkout=windows"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3.5 py-1 rounded-full bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
            >
              <span>Buy Commercial License</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={onOpenLicenseModal}
              className="px-3.5 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
            >
              Activate Key
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">

      {/* LEFT COLUMN: Product Catalog & Quick HSN Picker */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-black/[0.08] shadow-xs overflow-hidden min-w-0">
        {/* Search & Categories Bar */}
        <div className="p-3 border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-3 bg-[#FAFAFA]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search items by name, SKU or barcode..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-white border border-black/[0.08] focus:outline-hidden focus:border-black transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#1D1D1F] text-white shadow-xs"
                    : "bg-white border border-black/[0.08] text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => addToCart(item)}
              className="p-3 rounded-2xl border border-black/[0.08] hover:border-black hover:shadow-md transition apple-press cursor-pointer flex flex-col justify-between bg-white group"
            >
              <div>
                <div className="flex justify-between items-start gap-1">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">
                    {item.category}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/5 text-black border border-black/10">
                    {item.tax_rate ?? 18}% GST
                  </span>
                </div>
                <h4 className="font-semibold text-xs text-black mt-1 leading-snug line-clamp-2 group-hover:text-black transition">
                  {item.name}
                </h4>
              </div>

              <div className="mt-3 pt-2 border-t border-black/[0.04] flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-neutral-400">Sale Rate</div>
                  <div className="font-mono font-bold text-sm text-black">
                    ₹{item.sale_price.toFixed(2)}
                  </div>
                </div>
                <span className="text-[10px] text-neutral-500 font-mono">
                  Stock: {item.stock_quantity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN: GST Tax Invoice Register & Credit Checkout */}
      <div className="w-full lg:w-[440px] flex flex-col h-full bg-white rounded-2xl border border-black/[0.08] shadow-md overflow-hidden shrink-0">
        
        {/* Register Header */}
        <div className="p-3.5 bg-[#FAFAFA] border-b border-black/[0.06] space-y-2 shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 font-bold text-xs text-black">
              <Receipt className="w-4 h-4 text-black" />
              <span>GST Tax Bill Register</span>
            </div>
            <div className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#34C759]/10 text-[#34C759]">
              {isInterstate ? "Inter-State (IGST)" : "Intra-State (CGST + SGST)"}
            </div>
          </div>

          {/* Party Selector & Place of Supply */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-0.5">
                Sundry Debtor (Customer)
              </label>
              <select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white border border-black/[0.12] text-black focus:outline-hidden"
              >
                <option value="">Walk-in Consumer</option>
                {parties
                  .filter((p) => p.party_type === "CUSTOMER")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.current_balance > 0 ? `(Due: ₹${p.current_balance.toFixed(0)})` : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-0.5">
                Place of Supply (State)
              </label>
              <select
                value={posStateCode}
                onChange={(e) => setPosStateCode(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white border border-black/[0.12] text-black focus:outline-hidden"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer GSTIN input if walk-in or manual */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customerGstin}
              onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
              placeholder="Customer GSTIN (e.g. 27AABCR9999R1ZZ)"
              className="flex-1 text-[11px] font-mono px-2 py-1 rounded-lg bg-white border border-black/[0.08] focus:outline-hidden"
            />
            {customerGstin && (
              <span className="text-[10px] font-bold text-[#34C759]">
                B2B Tax Bill
              </span>
            )}
          </div>
        </div>

        {/* Cart Itemized Rows */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {cart.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-400">
              No items in cart. Click on products to add to bill.
            </div>
          ) : (
            lineCalculations.map((line, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl border border-black/[0.06] bg-[#FAFAFA] space-y-1.5 text-xs"
              >
                <div className="flex justify-between items-start">
                  <div className="font-semibold text-black leading-snug">
                    {line.item_name}
                  </div>
                  <button
                    onClick={() => removeFromCart(idx)}
                    className="text-neutral-400 hover:text-[#FF3B30] transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-neutral-400">HSN:</span>
                    <input
                      type="text"
                      value={line.hsn_code}
                      onChange={(e) => updateHsn(idx, e.target.value)}
                      className="w-16 font-mono text-[10px] px-1 py-0.5 rounded bg-white border border-black/10 text-center"
                    />
                  </div>

                  {/* GST Slab Selector (0%, 5%, 12%, 18%, 28%) */}
                  <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-black/[0.08] text-[9px]">
                    {[0, 5, 12, 18, 28].map((slab) => (
                      <button
                        key={slab}
                        onClick={() => updateTaxRate(idx, slab)}
                        className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition ${
                          line.tax_rate === slab
                            ? "bg-black text-white"
                            : "text-neutral-500 hover:text-black"
                        }`}
                      >
                        {slab}%
                      </button>
                    ))}
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      className="w-5 h-5 rounded-md bg-white border border-black/10 flex items-center justify-center hover:bg-neutral-100"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold w-4 text-center">
                      {line.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      className="w-5 h-5 rounded-md bg-white border border-black/10 flex items-center justify-center hover:bg-neutral-100"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Line Tax Math */}
                <div className="flex justify-between items-center text-[10px] pt-1 border-t border-black/[0.04] text-neutral-500 font-mono">
                  <span>
                    Taxable: ₹{line.taxable_amount.toFixed(2)} + Tax: ₹{line.totalTax.toFixed(2)}
                  </span>
                  <span className="font-bold text-black text-xs">
                    ₹{line.lineTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Register Footer: Payment Mode & Checkouts */}
        <div className="border-t border-black/[0.08] bg-[#FAFAFA] flex flex-col shrink-0 min-h-0">
          <div className="p-3.5 space-y-2.5 overflow-y-auto max-h-[46vh]">
            {/* Payment Method Selector */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase text-neutral-500">
              Payment Settlement Mode
            </label>
            <div className="grid grid-cols-5 gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setPaymentType("CASH")}
                className={`py-1.5 rounded-lg font-bold flex flex-col items-center gap-0.5 transition cursor-pointer ${
                  paymentType === "CASH"
                    ? "bg-[#1D1D1F] text-white shadow-xs"
                    : "bg-white border border-black/[0.08] text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType("UPI")}
                className={`py-1.5 rounded-lg font-bold flex flex-col items-center gap-0.5 transition cursor-pointer ${
                  paymentType === "UPI"
                    ? "bg-black text-white shadow-xs"
                    : "bg-white border border-black/[0.08] text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>UPI</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType("CARD")}
                className={`py-1.5 rounded-lg font-bold flex flex-col items-center gap-0.5 transition cursor-pointer ${
                  paymentType === "CARD"
                    ? "bg-[#5856D6] text-white shadow-xs"
                    : "bg-white border border-black/[0.08] text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType("BANK")}
                className={`py-1.5 rounded-lg font-bold flex flex-col items-center gap-0.5 transition cursor-pointer ${
                  paymentType === "BANK"
                    ? "bg-[#34C759] text-white shadow-xs"
                    : "bg-white border border-black/[0.08] text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>NEFT</span>
              </button>

              {/* CREDIT SALE (SUNDRY DEBTOR) */}
              <button
                type="button"
                onClick={() => setPaymentType("CREDIT")}
                className={`py-1.5 rounded-lg font-bold flex flex-col items-center gap-0.5 transition cursor-pointer ${
                  paymentType === "CREDIT"
                    ? "bg-[#FF9500] text-white shadow-xs"
                    : "bg-white border border-black/[0.08] text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Credit</span>
              </button>
            </div>
          </div>

          {/* Credit Sale Customization */}
          {paymentType === "CREDIT" && (
            <div className="p-2.5 bg-[#FFF9F2] rounded-xl border border-[#FF9500]/30 space-y-2 text-xs">
              <div className="flex justify-between items-center text-[10px] font-bold text-[#FF9500] uppercase">
                <span>Sundry Debtor Credit Sale</span>
                <span>Terms: {creditDays} Days</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-neutral-600 font-semibold mb-0.5">
                    Advance Paid (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paidAmountStr}
                    onChange={(e) => setPaidAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs font-mono font-bold px-2 py-1 rounded bg-white border border-black/10 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-600 font-semibold mb-0.5">
                    Credit Period (Days)
                  </label>
                  <select
                    value={creditDays}
                    onChange={(e) => setCreditDays(parseInt(e.target.value))}
                    className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white border border-black/[0.12] text-black focus:outline-hidden"
                  >
                    <option value={15}>15 Days Credit</option>
                    <option value={30}>30 Days Credit</option>
                    <option value={45}>45 Days Credit</option>
                    <option value={60}>60 Days Credit</option>
                    <option value={90}>90 Days Credit</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] text-neutral-600 font-semibold mb-0.5">
                    Tally Bill Reference Type
                  </label>
                  <select
                    value={billRefType}
                    onChange={(e) => setBillRefType(e.target.value)}
                    className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white border border-black/[0.12] text-black focus:outline-hidden"
                  >
                    <option value="New Ref">New Ref (Default for new invoice)</option>
                    <option value="Agst Ref">Agst Ref (Against order / invoice)</option>
                    <option value="Advance">Advance (Pre-billing adjustment)</option>
                    <option value="On Account">On Account (Lump-sum adjustment)</option>
                  </select>
                </div>
              </div>

              {isCreditOverLimit && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#FF3B30]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Warning: Bill pushes customer balance over ₹50,000 credit limit</span>
                </div>
              )}
            </div>
          )}

          {/* Totals Breakdown */}
          <div className="space-y-1 font-mono text-xs pt-1 border-t border-black/[0.06]">
            <div className="flex justify-between text-neutral-500 text-[11px]">
              <span className="font-sans">Taxable Subtotal:</span>
              <span>₹{subtotalTaxable.toFixed(2)}</span>
            </div>

            {!isInterstate ? (
              <>
                <div className="flex justify-between text-neutral-600 text-[11px]">
                  <span className="font-sans">CGST (50%):</span>
                  <span>+₹{totalCgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-600 text-[11px]">
                  <span className="font-sans">SGST (50%):</span>
                  <span>+₹{totalSgst.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-neutral-600 text-[11px]">
                <span className="font-sans">Integrated IGST:</span>
                <span>+₹{totalIgst.toFixed(2)}</span>
              </div>
            )}

            {roundOff !== 0 && (
              <div className="flex justify-between text-neutral-400 text-[10px]">
                <span className="font-sans">Round Off:</span>
                <span>{roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
              </div>
            )}

            <div className="flex justify-between text-base font-black text-black pt-1 border-t border-black/[0.08]">
              <span className="font-sans">Grand Total:</span>
              <span>₹{roundedGrandTotal.toFixed(2)}</span>
            </div>

            {/* Indian Words Preview */}
            <div className="text-[10px] font-sans text-neutral-400 pt-0.5 italic truncate">
              {amountToIndianWords(roundedGrandTotal)}
            </div>
          </div>
          </div>

          {/* Pinned Checkout Button */}
          <div className="p-3 pt-2 bg-white border-t border-black/[0.05] shrink-0">
            <button
              onClick={handleCheckout}
              disabled={isSubmitting || cart.length === 0}
              className={`w-full py-3 rounded-xl text-white text-xs font-bold shadow-md transition apple-press cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 ${
                licenseStatus?.is_expired
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-black hover:bg-neutral-800"
              }`}
            >
              {licenseStatus?.is_expired ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Trial Expired — Commercial License Required (₹{roundedGrandTotal.toFixed(2)})</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? "Generating GST Tax Invoice..."
                      : `Generate GST Bill (₹${roundedGrandTotal.toFixed(2)})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Completed Rule 46 Tax Invoice Modal */}
      {completedInvoice && (
        <GSTTaxInvoiceModal
          completeInvoice={completedInvoice}
          settings={settings}
          gstSettings={gstSettings}
          onClose={() => setCompletedInvoice(null)}
        />
      )}
    </div>
  );
};
