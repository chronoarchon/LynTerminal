import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Clock,
  Printer,
  X,
  Building,
  RefreshCw,
  Eye,
} from "lucide-react";
import type { PartyCreditAging, PendingBill, BillSettlementPayload } from "./gstTypes";
import type { Party, Settings } from "../../types";
import { gstApi } from "./gstApi";
import { useAppleDialog } from "../../components/common/AppleDialog";
import { amountToIndianWords } from "./gstUtils";

interface CreditManagementViewProps {
  settings: Settings;
  parties: Party[];
  onRefresh: () => void;
}

export const CreditManagementView: React.FC<CreditManagementViewProps> = ({
  settings,
  parties,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<"debtors" | "creditors">("debtors");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const [debtorsAging, setDebtorsAging] = useState<PartyCreditAging[]>([]);
  const [creditorsAging, setCreditorsAging] = useState<PartyCreditAging[]>([]);

  // Settle Bill Modal
  const [settleParty, setSettleParty] = useState<PartyCreditAging | null>(null);
  const [pendingBills, setPendingBills] = useState<PendingBill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState<string>("");
  const [settlementMethod, setSettlementMethod] = useState<string>("UPI");
  const [settlementDate, setSettlementDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [settlementRef, setSettlementRef] = useState<string>("");
  const [settlementNotes, setSettlementNotes] = useState<string>("");
  const [allocations, setAllocations] = useState<{ [invoiceId: string]: number }>({});
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);

  // Statement / Ledger Modal
  const [statementParty, setStatementParty] = useState<PartyCreditAging | null>(null);
  const [partyBillsForStatement, setPartyBillsForStatement] = useState<PendingBill[]>([]);

  const { alert, toast } = useAppleDialog();

  const loadData = async () => {
    try {
      setLoading(true);
      const [debtors, creditors] = await Promise.all([
        gstApi.getSundryDebtorsAging(),
        gstApi.getSundryCreditorsAging(),
      ]);
      setDebtorsAging(debtors);
      setCreditorsAging(creditors);
    } catch (err) {
      console.error("Failed to load aging data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [parties]);

  const activeList = activeTab === "debtors" ? debtorsAging : creditorsAging;

  const filteredList = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return activeList.filter((p) => {
      if (!term) return true;
      return (
        p.party_name.toLowerCase().includes(term) ||
        p.phone.includes(term) ||
        p.gstin.toLowerCase().includes(term) ||
        p.state_name.toLowerCase().includes(term)
      );
    });
  }, [activeList, searchTerm]);

  // Aggregate Metrics
  const totalReceivables = useMemo(() => {
    return debtorsAging.reduce((sum, d) => sum + Math.max(0, d.total_outstanding), 0);
  }, [debtorsAging]);

  const totalPayables = useMemo(() => {
    return creditorsAging.reduce((sum, c) => sum + Math.max(0, c.total_outstanding), 0);
  }, [creditorsAging]);

  const totalDebtorsOverdue = useMemo(() => {
    return debtorsAging.reduce(
      (sum, d) => sum + d.days_60 + d.days_90 + d.over_90,
      0
    );
  }, [debtorsAging]);

  const totalCreditorsOverdue = useMemo(() => {
    return creditorsAging.reduce(
      (sum, c) => sum + c.days_60 + c.days_90 + c.over_90,
      0
    );
  }, [creditorsAging]);

  const openSettleModal = async (party: PartyCreditAging) => {
    setSettleParty(party);
    setSettlementAmount(party.total_outstanding.toFixed(2));
    setSettlementMethod(activeTab === "debtors" ? "UPI" : "Bank Transfer");
    setSettlementDate(new Date().toISOString().split("T")[0]);
    setSettlementRef(activeTab === "debtors" ? "UPI-RCV" : "NEFT-PAY");
    setSettlementNotes(
      activeTab === "debtors"
        ? "Receipt voucher from Sundry Debtor"
        : "Payment voucher to Sundry Creditor"
    );

    try {
      setLoadingBills(true);
      const bills = await gstApi.getPartyPendingBills(party.party_id);
      setPendingBills(bills);

      // Auto FIFO allocate
      const initialAlloc: { [id: string]: number } = {};
      let remaining = party.total_outstanding;
      for (const bill of bills) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, bill.balance_due);
        initialAlloc[bill.invoice_id] = take;
        remaining -= take;
      }
      setAllocations(initialAlloc);
    } catch (err) {
      alert({
        title: "Error",
        message: "Failed to load pending bills: " + String(err),
        type: "error",
      });
    } finally {
      setLoadingBills(false);
    }
  };

  const handleAmountChange = (newAmountStr: string) => {
    setSettlementAmount(newAmountStr);
    const totalVal = parseFloat(newAmountStr) || 0;
    let rem = totalVal;
    const newAlloc: { [id: string]: number } = {};
    for (const bill of pendingBills) {
      if (rem <= 0) break;
      const take = Math.min(rem, bill.balance_due);
      newAlloc[bill.invoice_id] = take;
      rem -= take;
    }
    setAllocations(newAlloc);
  };

  const handleExecuteSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleParty) return;

    const totalVal = parseFloat(settlementAmount) || 0;
    if (totalVal <= 0) {
      alert({
        title: "Invalid Amount",
        message: "Please enter a valid payment amount",
        type: "warning",
      });
      return;
    }

    try {
      setIsSubmittingSettlement(true);

      const allocationList = Object.entries(allocations)
        .map(([invId, amt]) => ({
          invoice_id: invId,
          amount: amt,
        }))
        .filter((a) => a.amount > 0);

      const payload: BillSettlementPayload = {
        party_id: settleParty.party_id,
        party_name: settleParty.party_name,
        total_amount: totalVal,
        payment_type: activeTab === "debtors" ? "IN" : "OUT",
        payment_method: settlementMethod,
        payment_date: settlementDate,
        reference: settlementRef || "SETTLE-VOUCHER",
        notes: settlementNotes,
        allocations: allocationList,
      };

      await gstApi.settleBillByBill(payload);

      toast({
        message: `Successfully settled ₹${totalVal.toFixed(2)} against ${allocationList.length} bill(s)`,
        type: "success",
      });

      setSettleParty(null);
      await loadData();
      onRefresh();
    } catch (err) {
      alert({
        title: "Settlement Error",
        message: "Failed to settle bills: " + String(err),
        type: "error",
      });
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  const openStatement = async (party: PartyCreditAging) => {
    setStatementParty(party);
    try {
      const bills = await gstApi.getPartyPendingBills(party.party_id);
      setPartyBillsForStatement(bills);
    } catch (e) {
      console.error("Failed to load statement bills:", e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
              Credit & Outstanding Management
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] uppercase tracking-wide">
              Tally Bill-by-Bill
            </span>
          </div>
          <p className="text-xs text-[#86868B] mt-0.5">
            Sundry Debtors (Customers) & Sundry Creditors (Suppliers) Aging Analysis, Credit Limits & Bill Allocations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold shadow-xs transition apple-press cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Aging</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sundry Debtors Card */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-xs font-medium">Sundry Debtors (Receivable)</span>
            <ArrowDownRight className="w-4 h-4 text-[#34C759]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#1D1D1F]">
            ₹{totalReceivables.toFixed(2)}
          </div>
          <div className="text-[10px] text-neutral-400 mt-1">
            {debtorsAging.length} customer accounts tracked
          </div>
        </div>

        {/* Debtors Overdue Card */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-xs font-medium">Overdue Debtors (&gt;30 Days)</span>
            <AlertTriangle className="w-4 h-4 text-[#FF3B30]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#FF3B30]">
            ₹{totalDebtorsOverdue.toFixed(2)}
          </div>
          <div className="text-[10px] text-neutral-400 mt-1">
            Critical collection attention required
          </div>
        </div>

        {/* Sundry Creditors Card */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-xs font-medium">Sundry Creditors (Payable)</span>
            <ArrowUpRight className="w-4 h-4 text-[#FF9500]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#1D1D1F]">
            ₹{totalPayables.toFixed(2)}
          </div>
          <div className="text-[10px] text-neutral-400 mt-1">
            {creditorsAging.length} vendor accounts tracked
          </div>
        </div>

        {/* Creditors Overdue Card */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-xs font-medium">Overdue Payables (&gt;30 Days)</span>
            <Clock className="w-4 h-4 text-[#5856D6]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#5856D6]">
            ₹{totalCreditorsOverdue.toFixed(2)}
          </div>
          <div className="text-[10px] text-neutral-400 mt-1">
            Bills past vendor credit terms
          </div>
        </div>
      </div>

      {/* Segmented Tab Filter & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-black/[0.06] shadow-xs">
        <div className="flex items-center p-0.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] text-xs">
          <button
            onClick={() => setActiveTab("debtors")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "debtors"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Sundry Debtors ({debtorsAging.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("creditors")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "creditors"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Sundry Creditors ({creditorsAging.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search party, phone, GSTIN..."
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:outline-hidden focus:border-[#0071E3] transition"
          />
        </div>
      </div>

      {/* Aging Table */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-black/[0.08] bg-[#FAFAFA] text-neutral-500 font-semibold text-[11px]">
                <th className="py-3 px-4 text-left">Party Name & GSTIN</th>
                <th className="py-3 px-3 text-right">Credit Limit</th>
                <th className="py-3 px-3 text-right">Total Outstanding</th>
                <th className="py-3 px-3 text-right text-[#34C759]">0 - 30 Days</th>
                <th className="py-3 px-3 text-right text-[#FF9500]">31 - 60 Days</th>
                <th className="py-3 px-3 text-right text-[#FF3B30]">61 - 90 Days</th>
                <th className="py-3 px-3 text-right text-[#AF52DE]">&gt; 90 Days</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    No parties found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredList.map((party) => (
                  <tr key={party.party_id} className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                        <span>{party.party_name}</span>
                        {party.is_over_limit && (
                          <span
                            title="Exceeded Credit Limit"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] text-[9px] font-bold"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Over Limit
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-2 mt-0.5">
                        {party.gstin ? (
                          <span className="font-bold text-[#0071E3]">{party.gstin}</span>
                        ) : (
                          <span>Unregistered</span>
                        )}
                        <span>·</span>
                        <span>{party.state_name}</span>
                        {party.phone && (
                          <>
                            <span>·</span>
                            <span>{party.phone}</span>
                          </>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-neutral-600">
                      {party.credit_limit > 0 ? (
                        <span>₹{party.credit_limit.toFixed(2)}</span>
                      ) : (
                        <span className="text-neutral-400">No Limit</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-[#1D1D1F]">
                      ₹{party.total_outstanding.toFixed(2)}
                      {party.pending_bills_count > 0 && (
                        <div className="text-[10px] font-normal text-neutral-400">
                          {party.pending_bills_count} bill(s)
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-semibold text-[#34C759]">
                      ₹{party.current_30.toFixed(2)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-semibold text-[#FF9500]">
                      ₹{party.days_60.toFixed(2)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-semibold text-[#FF3B30]">
                      ₹{party.days_90.toFixed(2)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-[#AF52DE]">
                      ₹{party.over_90.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openSettleModal(party)}
                          className="px-2.5 py-1 rounded-lg bg-[#0071E3] text-black hover:bg-[#0077ED] text-[11px] font-semibold transition apple-press cursor-pointer shadow-xs"
                        >
                          {activeTab === "debtors" ? "Receive Payment" : "Pay Supplier"}
                        </button>
                        <button
                          onClick={() => openStatement(party)}
                          title="View Ledger Statement"
                          className="p-1 rounded-lg border border-black/[0.08] hover:bg-neutral-100 text-neutral-600 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settle Bill Modal */}
      {settleParty && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-black/[0.08] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-6 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB]">
              <div>
                <h3 className="text-base font-bold text-black tracking-tight">
                  {activeTab === "debtors" ? "Settle Receipt" : "Settle Payment"}
                </h3>
                <p className="text-xs text-neutral-400">
                  {settleParty.party_name} · Due: ₹{settleParty.total_outstanding.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setSettleParty(null)}
                className="w-8 h-8 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteSettlement} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={settlementAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    required
                    className="w-full text-sm font-mono font-bold px-3.5 py-2.5 rounded-xl bg-white border border-black/[0.08] text-black focus:outline-none focus:border-black"
                  />
                  <div className="text-[10px] text-neutral-500 mt-1 font-sans">
                    {amountToIndianWords(parseFloat(settlementAmount) || 0)}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={settlementMethod}
                    onChange={(e) => setSettlementMethod(e.target.value)}
                    className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-white border border-black/[0.08] text-black focus:outline-none focus:border-black"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank NEFT">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Card</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Settlement Date
                  </label>
                  <input
                    type="date"
                    value={settlementDate}
                    onChange={(e) => setSettlementDate(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-white border border-black/[0.08] text-black focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Reference / UTR
                  </label>
                  <input
                    type="text"
                    value={settlementRef}
                    onChange={(e) => setSettlementRef(e.target.value)}
                    placeholder="e.g. UTR-9821374"
                    className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl bg-white border border-black/[0.08] text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
              </div>

              {/* Pending Bills Allocation Table */}
              <div className="space-y-1.5 pt-2">
                <div className="text-xs font-bold text-neutral-300 flex justify-between items-center">
                  <span>Bill Allocation</span>
                  <span className="text-[11px] text-neutral-400 font-normal">
                    {pendingBills.length} pending bill(s)
                  </span>
                </div>

                {loadingBills ? (
                  <div className="py-6 text-center text-xs text-neutral-400">
                    Loading pending invoices...
                  </div>
                ) : pendingBills.length === 0 ? (
                  <div className="p-4 bg-white rounded-xl text-center text-xs text-neutral-400 border border-black/[0.08]">
                    No pending bills found. Payment credited on-account.
                  </div>
                ) : (
                  <div className="border border-black/[0.08] rounded-xl overflow-hidden max-h-52 overflow-y-auto bg-white">
                    <table className="w-full text-xs">
                      <thead className="bg-[#F9FAFB] text-neutral-400 font-semibold text-[10px]">
                        <tr>
                          <th className="py-2 px-3 text-left">Bill &amp; Date</th>
                          <th className="py-2 px-2 text-right">Total</th>
                          <th className="py-2 px-2 text-right">Balance</th>
                          <th className="py-2 px-3 text-right">Allocated (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10 text-neutral-300">
                        {pendingBills.map((b) => (
                          <tr key={b.invoice_id} className="hover:bg-white/5">
                            <td className="py-2 px-3">
                              <div className="font-mono font-semibold text-black">{b.invoice_number}</div>
                              <div className="text-[10px] text-neutral-500">
                                {b.invoice_date} {b.overdue_days > 0 ? `(${b.overdue_days}d overdue)` : ""}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-neutral-400">
                              ₹{b.total_amount.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-red-400">
                              ₹{b.balance_due.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              <input
                                type="number"
                                step="0.01"
                                max={b.balance_due}
                                value={allocations[b.invoice_id] || ""}
                                onChange={(e) => {
                                  const val = Math.max(0, Math.min(b.balance_due, parseFloat(e.target.value) || 0));
                                  setAllocations((prev) => {
                                    const updated = {
                                      ...prev,
                                      [b.invoice_id]: val,
                                    };
                                    const sumAlloc = Object.values(updated).reduce((s, a) => s + a, 0);
                                    setSettlementAmount(sumAlloc.toFixed(2));
                                    return updated;
                                  });
                                }}
                                className="w-24 text-right font-mono text-xs px-2 py-1 rounded bg-[#F9FAFB] border border-black/[0.08] text-black focus:outline-none"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-black/[0.08]">
                <button
                  type="button"
                  onClick={() => setSettleParty(null)}
                  className="px-4 py-2 rounded-full border border-black/[0.08] text-xs font-semibold text-neutral-300 bg-[#F9FAFB] hover:bg-[#20232c] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSettlement}
                  className="px-5 py-2 rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingSettlement ? "Processing..." : "Confirm Settle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Statement of Account Modal */}
      {statementParty && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-black/[0.08] p-6 space-y-4 max-h-[90vh] overflow-y-auto text-black">
            <div className="flex justify-between items-start border-b border-black/[0.08] pb-4">
              <div>
                <h3 className="text-lg font-bold text-black tracking-tight">
                  {settings.business_name || "Store"} · Statement
                </h3>
                <p className="text-xs text-neutral-400">
                  {statementParty.tally_ledger_group} · {statementParty.party_name}
                </p>
                <div className="text-[11px] font-mono text-neutral-500 mt-1">
                  GSTIN: {statementParty.gstin || "Unregistered"} · State: {statementParty.state_name}
                </div>
              </div>
              <button
                onClick={() => setStatementParty(null)}
                className="w-8 h-8 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-black/[0.08] flex justify-between items-center">
              <div>
                <span className="text-xs text-neutral-400 font-medium">Net Balance Due</span>
                <div className="text-xl font-bold font-mono text-black mt-0.5">
                  ₹{statementParty.total_outstanding.toFixed(2)}
                </div>
              </div>
              <div className="text-right text-xs">
                <span className="text-neutral-400">Credit Terms:</span>
                <div className="font-semibold text-black">
                  {statementParty.credit_period_days} Days
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-neutral-300">
                Pending Vouchers
              </div>
              <div className="border border-black/[0.08] rounded-xl overflow-hidden bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-[#F9FAFB] text-neutral-400 font-semibold text-[10px]">
                    <tr>
                      <th className="py-2 px-3 text-left">Date</th>
                      <th className="py-2 px-2 text-left">Voucher #</th>
                      <th className="py-2 px-2 text-right">Debit (Dr)</th>
                      <th className="py-2 px-2 text-right">Credit (Cr)</th>
                      <th className="py-2 px-3 text-right">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-neutral-300">
                    {partyBillsForStatement.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-neutral-500">
                          Zero pending vouchers.
                        </td>
                      </tr>
                    ) : (
                      partyBillsForStatement.map((b) => (
                        <tr key={b.invoice_id} className="hover:bg-white/5">
                          <td className="py-2 px-3">{b.invoice_date}</td>
                          <td className="py-2 px-2 font-mono font-semibold text-black">{b.invoice_number}</td>
                          <td className="py-2 px-2 text-right font-mono">
                            {b.invoice_type === "SALE" ? `₹${b.total_amount.toFixed(2)}` : "-"}
                          </td>
                          <td className="py-2 px-2 text-right font-mono">
                            {b.invoice_type === "PURCHASE" ? `₹${b.total_amount.toFixed(2)}` : "-"}
                          </td>
                          <td className="py-2 px-3 text-right text-neutral-500">{b.due_date}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-black/[0.08]">
              <span className="text-[10px] text-neutral-500 font-mono">
                LynTerminal Statement
              </span>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Statement</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
