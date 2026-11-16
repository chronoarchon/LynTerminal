import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  RotateCcw,
  X,
  Plus,
  ArrowRight,
} from "lucide-react";
import type {
  Invoice,
  InvoiceDetail,
  Settings,
  Item,
  Party,
  Estimate,
  PurchaseReturn,
  InvoiceItemPayload,
} from "../types";
import { api } from "../services/api";
import { InvoiceDocModal } from "./InvoiceDocModal";
import { AppleSelect } from "./common/AppleSelect";
import { useCurrency } from "../context/CurrencyContext";

interface InvoicesViewProps {
  invoices: Invoice[];
  items?: Item[];
  parties?: Party[];
  settings: Settings;
  onRefresh: () => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  items = [],
  parties = [],
  settings,
  onRefresh,
}) => {
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<"invoices" | "estimates" | "returns">("invoices");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<InvoiceDetail | null>(null);

  // Estimates state
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [isCreateQuoteOpen, setIsCreateQuoteOpen] = useState(false);
  const [quotePartyId, setQuotePartyId] = useState("");
  const [quotePartyName, setQuotePartyName] = useState("");
  const [quoteExpiry, setQuoteExpiry] = useState(
    new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split("T")[0]
  );
  const [quoteItems, setQuoteItems] = useState<InvoiceItemPayload[]>([]);
  const [quoteNotes, setQuoteNotes] = useState("Quotation valid for 15 days from issuance.");
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [isConvertingId, setIsConvertingId] = useState<string | null>(null);

  // Purchase Returns state
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [isCreateReturnOpen, setIsCreateReturnOpen] = useState(false);
  const [returnPartyId, setReturnPartyId] = useState("");
  const [returnPartyName, setReturnPartyName] = useState("");
  const [returnReason, setReturnReason] = useState("Damaged / Defective Stock");
  const [returnItems, setReturnItems] = useState<InvoiceItemPayload[]>([]);
  const [returnNotes, setReturnNotes] = useState("Debit note deducted from vendor payable.");
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Void modal state
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [voidAction, setVoidAction] = useState<"RETURN" | "CANCEL">("RETURN");
  const [voidReason, setVoidReason] = useState("Customer Return / Exchange");
  const [isProcessingVoid, setIsProcessingVoid] = useState(false);

  const loadEstimates = async () => {
    try {
      const data = await api.listEstimates();
      setEstimates(data);
    } catch (e) {
      console.error("Failed to load estimates:", e);
    }
  };

  const loadReturns = async () => {
    try {
      const data = await api.listPurchaseReturns();
      setPurchaseReturns(data);
    } catch (e) {
      console.error("Failed to load purchase returns:", e);
    }
  };

  useEffect(() => {
    if (activeTab === "estimates") {
      loadEstimates();
    } else if (activeTab === "returns") {
      loadReturns();
    }
  }, [activeTab]);

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return invoices.filter((inv) => {
      const matchesType = typeFilter === "ALL" || inv.invoice_type === typeFilter;
      const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
      if (!matchesType || !matchesStatus) return false;
      if (!term) return true;
      return (
        inv.invoice_number.toLowerCase().includes(term) ||
        inv.party_name.toLowerCase().includes(term)
      );
    });
  }, [invoices, typeFilter, statusFilter, searchTerm]);

  const filteredEstimates = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return estimates.filter((e) => {
      if (!term) return true;
      return (
        e.estimate_number.toLowerCase().includes(term) ||
        e.party_name.toLowerCase().includes(term)
      );
    });
  }, [estimates, searchTerm]);

  const filteredReturns = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return purchaseReturns.filter((r) => {
      if (!term) return true;
      return (
        r.return_number.toLowerCase().includes(term) ||
        r.party_name.toLowerCase().includes(term) ||
        r.reason.toLowerCase().includes(term)
      );
    });
  }, [purchaseReturns, searchTerm]);

  const handleOpenInvoice = async (id: string) => {
    try {
      const detail = await api.getInvoice(id);
      setSelectedInvoiceDetail(detail);
    } catch (err) {
      alert("Failed to load invoice: " + err);
    }
  };

  const handleOpenVoidModal = (invoice: Invoice) => {
    setVoidTarget(invoice);
    setVoidAction("RETURN");
    setVoidReason("Customer requested return / refund");
  };

  const handleExecuteVoid = async () => {
    if (!voidTarget) return;

    try {
      setIsProcessingVoid(true);
      await api.voidOrDeleteInvoice(voidTarget.id, voidAction, voidReason.trim() || "Voided");
      setVoidTarget(null);
      onRefresh();
    } catch (err) {
      alert("Error processing invoice: " + err);
    } finally {
      setIsProcessingVoid(false);
    }
  };

  const handleConvertEstimate = async (estimateId: string) => {
    if (confirm("Convert this quotation into a completed sale? Stock will be deducted automatically.")) {
      try {
        setIsConvertingId(estimateId);
        const inv = await api.convertEstimateToInvoice(estimateId, "CASH");
        alert(`Converted into Invoice #${inv.invoice_number}`);
        await loadEstimates();
        onRefresh();
      } catch (e) {
        alert("Conversion failed: " + e);
      } finally {
        setIsConvertingId(null);
      }
    }
  };

  const handleAddQuoteItem = (itemId: string) => {
    const found = items.find((i) => i.id === itemId);
    if (!found) return;
    setQuoteItems((prev) => [
      ...prev,
      {
        item_id: found.id,
        item_name: found.name,
        quantity: 1,
        unit: found.unit,
        unit_price: found.sale_price,
        discount_percent: 0,
        tax_rate: settings.default_tax_rate,
        line_total: found.sale_price,
      },
    ]);
  };

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quoteItems.length === 0) {
      alert("Please add at least one line item.");
      return;
    }
    if (!quotePartyName.trim()) {
      alert("Please enter customer name.");
      return;
    }

    try {
      setIsSubmittingQuote(true);
      await api.createEstimate({
        party_id: quotePartyId || null,
        party_name: quotePartyName.trim(),
        estimate_date: new Date().toISOString().split("T")[0],
        expiry_date: quoteExpiry,
        items: quoteItems,
        notes: quoteNotes,
      });
      setIsCreateQuoteOpen(false);
      setQuoteItems([]);
      await loadEstimates();
    } catch (err) {
      alert("Failed to create quotation: " + err);
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  const handleAddReturnItem = (itemId: string) => {
    const found = items.find((i) => i.id === itemId);
    if (!found) return;
    setReturnItems((prev) => [
      ...prev,
      {
        item_id: found.id,
        item_name: found.name,
        quantity: 1,
        unit: found.unit,
        unit_price: found.purchase_price || found.sale_price,
        discount_percent: 0,
        tax_rate: 0,
        line_total: found.purchase_price || found.sale_price,
      },
    ]);
  };

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (returnItems.length === 0) {
      alert("Please add at least one item to return.");
      return;
    }
    if (!returnPartyName.trim()) {
      alert("Please enter supplier name.");
      return;
    }

    try {
      setIsSubmittingReturn(true);
      await api.createPurchaseReturn({
        party_id: returnPartyId || null,
        party_name: returnPartyName.trim(),
        return_date: new Date().toISOString().split("T")[0],
        reason: returnReason,
        notes: returnNotes,
        items: returnItems,
      });
      setIsCreateReturnOpen(false);
      setReturnItems([]);
      await loadReturns();
      onRefresh();
    } catch (err) {
      alert("Failed to create debit note: " + err);
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto select-none">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.07]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Sales & Invoices
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Audit history of completed sales, purchase orders, quotations, and returns
          </p>
        </div>

        {/* Action Button depending on tab */}
        <div className="flex items-center gap-2">
          {activeTab === "estimates" && (
            <button
              onClick={() => {
                setQuotePartyId("");
                setQuotePartyName("");
                setQuoteItems([]);
                setIsCreateQuoteOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Quotation</span>
            </button>
          )}

          {activeTab === "returns" && (
            <button
              onClick={() => {
                setReturnPartyId("");
                setReturnPartyName("");
                setReturnItems([]);
                setIsCreateReturnOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FF3B30] hover:bg-[#E02E24] text-white text-xs font-semibold shadow-xs transition apple-press"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Record Return</span>
            </button>
          )}
        </div>
      </div>

      {/* Segmented Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl apple-card shrink-0">
        <div className="flex items-center p-0.5 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs">
          <button
            onClick={() => setActiveTab("invoices")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              activeTab === "invoices"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Invoices ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab("estimates")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              activeTab === "estimates"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Quotations ({estimates.length})
          </button>
          <button
            onClick={() => setActiveTab("returns")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              activeTab === "returns"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Purchase Returns ({purchaseReturns.length})
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2">
          {activeTab === "invoices" && (
            <>
              <AppleSelect
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: "ALL", label: "All Types" },
                  { value: "SALE", label: "Sales" },
                  { value: "PURCHASE", label: "Purchases" },
                  { value: "RETURN", label: "Returns" },
                ]}
                className="w-32"
                buttonClassName="bg-[#F5F5F7] py-1.5"
              />

              <AppleSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "ALL", label: "All Status" },
                  { value: "PAID", label: "Paid" },
                  { value: "PARTIAL", label: "Partial" },
                  { value: "UNPAID", label: "Unpaid" },
                  { value: "RETURNED", label: "Returned" },
                ]}
                className="w-32"
                buttonClassName="bg-[#F5F5F7] py-1.5"
              />
            </>
          )}

          <div className="relative min-w-[180px]">
            <Search className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl pl-10 pr-3 py-1.5 text-xs text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3]"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: Invoices Table */}
      {activeTab === "invoices" && (
        <>
          <div className="hidden md:block apple-card rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-black/[0.06] bg-[#FBFBFC] text-[#86868B] font-semibold text-[11px]">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Customer / Supplier</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Receipt & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {filteredInvoices.map((inv) => {
                  const isPaid = inv.status === "PAID";
                  const isReturn = inv.status === "RETURNED";

                  return (
                    <tr key={inv.id} className="hover:bg-[#FBFBFC] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-xs text-[#1D1D1F]">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3.5 px-3 text-[#6E6E73] text-[11px]">
                        {inv.invoice_date}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            inv.invoice_type === "SALE"
                              ? "bg-[#34C759]/10 text-[#34C759]"
                              : "bg-[#0071E3]/10 text-[#0071E3]"
                          }`}
                        >
                          {inv.invoice_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-[#1D1D1F]">
                        {inv.party_name}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-[#1D1D1F]">
                        {formatCurrency(inv.total_amount)}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            isReturn
                              ? "bg-black/[0.06] text-[#86868B] line-through"
                              : isPaid
                              ? "bg-[#34C759]/10 text-[#34C759]"
                              : "bg-[#FF9500]/10 text-[#FF9500]"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenInvoice(inv.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#1D1D1F] hover:bg-black text-white text-[11px] font-medium transition apple-press"
                          >
                            Receipt
                          </button>
                          {!isReturn && (
                            <button
                              onClick={() => handleOpenVoidModal(inv)}
                              title="Process Return / Refund"
                              className="p-1 rounded-lg text-[#86868B] hover:text-[#FF3B30] hover:bg-black/[0.05]"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (< md) */}
          <div className="md:hidden space-y-2.5">
            {filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className="apple-card p-3.5 rounded-2xl flex flex-col gap-2 shadow-2xs"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-xs font-mono text-[#1D1D1F]">
                      {inv.invoice_number}
                    </div>
                    <div className="text-[11px] font-medium text-[#6E6E73] mt-0.5">
                      {inv.party_name}
                    </div>
                  </div>
                  <span className="font-bold font-mono text-sm text-[#1D1D1F]">
                    {formatCurrency(inv.total_amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-black/[0.04] text-[11px] text-[#86868B]">
                  <span>{inv.invoice_date} · {inv.payment_method}</span>
                  <button
                    onClick={() => handleOpenInvoice(inv.id)}
                    className="px-2.5 py-1 rounded-lg bg-[#1D1D1F] text-white text-[10px] font-semibold"
                  >
                    View Bill
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* TAB 2: Quotations Table */}
      {activeTab === "estimates" && (
        <div className="apple-card rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black/[0.06] bg-[#FBFBFC] text-[#86868B] font-semibold text-[11px]">
                <th className="py-3 px-4">Quote #</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3 text-right">Total</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Convert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {filteredEstimates.map((est) => (
                <tr key={est.id} className="hover:bg-[#FBFBFC] transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-xs text-[#1D1D1F]">
                    {est.estimate_number}
                  </td>
                  <td className="py-3.5 px-3 text-[#6E6E73] text-[11px]">
                    {est.estimate_date}
                  </td>
                  <td className="py-3.5 px-3 font-medium text-[#1D1D1F]">
                    {est.party_name}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-[#1D1D1F]">
                    {formatCurrency(est.total_amount)}
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        est.status === "CONVERTED"
                          ? "bg-[#34C759]/10 text-[#34C759]"
                          : "bg-[#FF9500]/10 text-[#FF9500]"
                      }`}
                    >
                      {est.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {est.status !== "CONVERTED" && (
                      <button
                        onClick={() => handleConvertEstimate(est.id)}
                        disabled={isConvertingId === est.id}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#0071E3] hover:bg-[#0077ED] text-white text-[11px] font-semibold transition apple-press"
                      >
                        <span>Convert to Sale</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: Purchase Returns Table */}
      {activeTab === "returns" && (
        <div className="apple-card rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black/[0.06] bg-[#FBFBFC] text-[#86868B] font-semibold text-[11px]">
                <th className="py-3 px-4">Debit Note #</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Supplier</th>
                <th className="py-3 px-3">Reason</th>
                <th className="py-3 px-4 text-right">Amount Credited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {filteredReturns.map((ret) => (
                <tr key={ret.id} className="hover:bg-[#FBFBFC] transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-xs text-[#FF3B30]">
                    {ret.return_number}
                  </td>
                  <td className="py-3.5 px-3 text-[#6E6E73] text-[11px]">
                    {ret.return_date}
                  </td>
                  <td className="py-3.5 px-3 font-medium text-[#1D1D1F]">
                    {ret.party_name}
                  </td>
                  <td className="py-3.5 px-3 text-[#6E6E73] text-[11px]">
                    {ret.reason}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-[#FF3B30]">
                    {formatCurrency(ret.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VOID / RETURN MODAL */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-black/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFC]">
              <div>
                <h3 className="text-sm font-semibold text-[#1D1D1F]">
                  Process Return / Refund
                </h3>
                <p className="text-[11px] text-[#86868B]">{voidTarget.invoice_number}</p>
              </div>
              <button
                onClick={() => setVoidTarget(null)}
                className="w-7 h-7 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.06] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="p-3 rounded-xl bg-[#F5F5F7] text-xs space-y-1">
                <div className="flex justify-between text-[#6E6E73]">
                  <span>Amount to Refund:</span>
                  <span className="font-mono font-bold text-[#FF3B30]">
                    {formatCurrency(voidTarget.total_amount)}
                  </span>
                </div>
                <div className="text-[10px] text-[#86868B]">
                  Stock items will be restored to inventory and audit entry recorded.
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Return Reason
                </label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-black/[0.08] text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteVoid}
                  disabled={isProcessingVoid}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF3B30] hover:bg-[#E02E24] text-white text-xs font-semibold shadow-xs transition apple-press"
                >
                  {isProcessingVoid ? "Processing..." : "Confirm Refund"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE QUOTATION MODAL */}
      {isCreateQuoteOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-black/[0.08] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFC]">
              <div>
                <h3 className="text-sm font-semibold text-[#1D1D1F]">
                  Issue Price Quotation
                </h3>
                <p className="text-[11px] text-[#86868B]">
                  Formal price estimate for customer approval
                </p>
              </div>
              <button
                onClick={() => setIsCreateQuoteOpen(false)}
                className="w-7 h-7 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.06] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="p-5 space-y-3.5 flex-1 overflow-y-auto">
              {parties.length > 0 && (
                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Select Existing Contact
                  </label>
                  <AppleSelect
                    value={quotePartyId}
                    onChange={(val) => {
                      const p = parties.find((pty) => pty.id === val);
                      if (p) {
                        setQuotePartyId(p.id);
                        setQuotePartyName(p.name);
                      }
                    }}
                    placeholder="-- Choose Contact (or enter below) --"
                    options={[
                      { value: "", label: "-- Choose Contact (or enter below) --" },
                      ...parties.map((p) => ({
                        value: p.id,
                        label: `${p.name} (${p.party_type})`,
                      })),
                    ]}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={quotePartyName}
                    onChange={(e) => setQuotePartyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={quoteExpiry}
                    onChange={(e) => setQuoteExpiry(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Add Item from Catalog
                </label>
                <AppleSelect
                  value=""
                  onChange={(val) => {
                    if (val) handleAddQuoteItem(val);
                  }}
                  placeholder="-- Tap to Select Product --"
                  options={[
                    { value: "", label: "-- Tap to Select Product --" },
                    ...items.map((i) => ({
                      value: i.id,
                      label: `${i.name} (${formatCurrency(i.sale_price)})`,
                    })),
                  ]}
                />
              </div>

              {quoteItems.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-black/[0.06]">
                  {quoteItems.map((qi, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[#F5F5F7] flex items-center justify-between text-xs"
                    >
                      <div className="font-medium text-[#1D1D1F]">{qi.item_name}</div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#6E6E73]">
                          {qi.quantity} {qi.unit} × {formatCurrency(qi.unit_price)}
                        </span>
                        <span className="font-mono font-bold text-[#1D1D1F]">
                          {formatCurrency(qi.line_total)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuoteItems(quoteItems.filter((_, i) => i !== idx))}
                          className="text-[#86868B] hover:text-[#FF3B30] ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Quotation Notes
                </label>
                <input
                  type="text"
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsCreateQuoteOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-black/[0.08] text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuote || quoteItems.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press"
                >
                  {isSubmittingQuote ? "Creating..." : "Issue Quotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PURCHASE RETURN MODAL */}
      {isCreateReturnOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-black/[0.08] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFC]">
              <div>
                <h3 className="text-sm font-semibold text-[#1D1D1F]">
                  Record Purchase Return (Debit Note)
                </h3>
                <p className="text-[11px] text-[#86868B]">
                  Return defective inventory to vendor
                </p>
              </div>
              <button
                onClick={() => setIsCreateReturnOpen(false)}
                className="w-7 h-7 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.06] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReturn} className="p-5 space-y-3.5 flex-1 overflow-y-auto">
              {parties.filter((p) => p.party_type === "VENDOR").length > 0 && (
                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Select Supplier
                  </label>
                  <AppleSelect
                    value={returnPartyId}
                    onChange={(val) => {
                      const p = parties.find((pty) => pty.id === val);
                      if (p) {
                        setReturnPartyId(p.id);
                        setReturnPartyName(p.name);
                      }
                    }}
                    placeholder="-- Choose Supplier (or enter below) --"
                    options={[
                      { value: "", label: "-- Choose Supplier (or enter below) --" },
                      ...parties
                        .filter((p) => p.party_type === "VENDOR")
                        .map((p) => ({
                          value: p.id,
                          label: p.name,
                        })),
                    ]}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Supplies"
                    value={returnPartyName}
                    onChange={(e) => setReturnPartyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Return Reason
                  </label>
                  <input
                    type="text"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Add Item from Catalog
                </label>
                <AppleSelect
                  value=""
                  onChange={(val) => {
                    if (val) handleAddReturnItem(val);
                  }}
                  placeholder="-- Tap to Select Product to Return --"
                  options={[
                    { value: "", label: "-- Tap to Select Product to Return --" },
                    ...items.map((i) => ({
                      value: i.id,
                      label: `${i.name} (${formatCurrency(i.purchase_price ? i.purchase_price : i.sale_price)})`,
                    })),
                  ]}
                />
              </div>

              {returnItems.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-black/[0.06]">
                  {returnItems.map((ri, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[#F5F5F7] flex items-center justify-between text-xs"
                    >
                      <div className="font-medium text-[#1D1D1F]">{ri.item_name}</div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#6E6E73]">
                          {ri.quantity} {ri.unit} × {formatCurrency(ri.unit_price)}
                        </span>
                        <span className="font-mono font-bold text-[#FF3B30]">
                          {formatCurrency(ri.line_total)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setReturnItems(returnItems.filter((_, i) => i !== idx))}
                          className="text-[#86868B] hover:text-[#FF3B30] ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsCreateReturnOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-black/[0.08] text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn || returnItems.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF3B30] hover:bg-[#E02E24] text-white text-xs font-semibold shadow-xs transition apple-press"
                >
                  {isSubmittingReturn ? "Recording..." : "Issue Debit Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Details / Receipt Modal */}
      {selectedInvoiceDetail && (
        <InvoiceDocModal
          invoiceDetail={selectedInvoiceDetail}
          settings={settings}
          onClose={() => setSelectedInvoiceDetail(null)}
        />
      )}
    </div>
  );
};
