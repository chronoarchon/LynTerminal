import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  Edit2,
  Trash2,
  X,
  Printer,
  Check,
  Copy,
  Users,
} from "lucide-react";
import type { Party, Settings, Payment, CustomerAging } from "../types";
import { api } from "../services/api";
import { useAppleDialog } from "./common/AppleDialog";
import { AppleSelect } from "./common/AppleSelect";
import { useCurrency } from "../context/CurrencyContext";

interface PartiesViewProps {
  parties: Party[];
  settings: Settings;
  onRefresh: () => void;
}

export const PartiesView: React.FC<PartiesViewProps> = ({
  parties,
  settings,
  onRefresh,
}) => {
  const { currencySymbol, formatCurrency } = useCurrency();
  const currency = currencySymbol || settings.currency_symbol || "$";
  const { alert, confirm, toast } = useAppleDialog();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "CUSTOMER" | "VENDOR">("ALL");

  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);

  const [activeParty, setActiveParty] = useState<Party | null>(null);
  const [partyPayments, setPartyPayments] = useState<Payment[]>([]);

  // Aging State
  const [agingList, setAgingList] = useState<CustomerAging[]>([]);
  const [selectedAging, setSelectedAging] = useState<CustomerAging | null>(null);
  const [copiedReminder, setCopiedReminder] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"CUSTOMER" | "VENDOR">("CUSTOMER");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formTaxNumber, setFormTaxNumber] = useState("");
  const [formOpeningBalance, setFormOpeningBalance] = useState("0");

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const loadAging = async () => {
    try {
      const data = await api.getCustomerAgingAnalysis();
      setAgingList(data);
    } catch (err) {
      console.error("Failed to load aging analysis:", err);
    }
  };

  useEffect(() => {
    loadAging();
  }, [parties]);

  const agingMap = useMemo(() => {
    return new Map<string, CustomerAging>(agingList.map((a) => [a.party_id, a]));
  }, [agingList]);

  const totalReceivable = useMemo(() => {
    return parties
      .filter((p) => p.party_type === "CUSTOMER" && p.current_balance > 0)
      .reduce((sum, p) => sum + p.current_balance, 0);
  }, [parties]);

  const totalPayable = useMemo(() => {
    return parties
      .filter((p) => p.party_type === "VENDOR" && p.current_balance < 0)
      .reduce((sum, p) => sum + Math.abs(p.current_balance), 0);
  }, [parties]);

  const filteredParties = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return parties.filter((p) => {
      const matchesTab = activeTab === "ALL" || p.party_type === activeTab;
      if (!matchesTab) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        p.phone.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term)
      );
    });
  }, [parties, activeTab, searchTerm]);

  const openCreateParty = () => {
    setActiveParty(null);
    setFormName("");
    setFormType("CUSTOMER");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormTaxNumber("");
    setFormOpeningBalance("0");
    setIsPartyModalOpen(true);
  };

  const openEditParty = (party: Party) => {
    setActiveParty(party);
    setFormName(party.name);
    setFormType(party.party_type as "CUSTOMER" | "VENDOR");
    setFormPhone(party.phone);
    setFormEmail(party.email);
    setFormAddress(party.address);
    setFormTaxNumber(party.tax_number);
    setFormOpeningBalance(party.opening_balance.toString());
    setIsPartyModalOpen(true);
  };

  const openPaymentModal = (party: Party) => {
    setActiveParty(party);
    setPaymentAmount(Math.abs(party.current_balance).toString());
    setPaymentMethod("CASH");
    setPaymentRef("");
    setPaymentNotes("");
    setIsPaymentModalOpen(true);
  };

  const openLedgerModal = async (party: Party) => {
    setActiveParty(party);
    try {
      const payments = await api.listPayments(party.id);
      setPartyPayments(payments);
      setIsLedgerModalOpen(true);
    } catch (err) {
      alert("Failed to load ledger: " + err);
    }
  };

  const openReminderModal = (aging: CustomerAging, party: Party) => {
    setSelectedAging(aging);
    setActiveParty(party);
    setCopiedReminder(false);
    setIsReminderModalOpen(true);
  };

  const handleSaveParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      const partyData: Party = {
        id: activeParty ? activeParty.id : "",
        name: formName.trim(),
        party_type: formType,
        phone: formPhone.trim(),
        email: formEmail.trim(),
        address: formAddress.trim(),
        tax_number: formTaxNumber.trim(),
        opening_balance: parseFloat(formOpeningBalance) || 0,
        current_balance: activeParty
          ? activeParty.current_balance
          : parseFloat(formOpeningBalance) || 0,
        created_at: activeParty ? activeParty.created_at : "",
      };

      await api.saveParty(partyData);
      setIsPartyModalOpen(false);
      onRefresh();
    } catch (err) {
      alert("Failed to save contact: " + err);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeParty) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    const isCustomer = activeParty.party_type === "CUSTOMER";
    const paymentType = isCustomer ? "IN" : "OUT";

    try {
      setIsSubmittingPayment(true);
      await api.recordPayment({
        id: "",
        invoice_id: null,
        party_id: activeParty.id,
        party_name: activeParty.name,
        amount,
        payment_type: paymentType,
        payment_method: paymentMethod,
        payment_date: new Date().toISOString().split("T")[0],
        reference: paymentRef,
        notes: paymentNotes || (isCustomer ? "Customer payment received" : "Supplier settlement"),
      });

      setIsPaymentModalOpen(false);
      onRefresh();
    } catch (err) {
      alert("Payment failed: " + err);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleDeleteParty = async (id: string, name: string) => {
    const ok = await confirm({
      title: "Delete Contact",
      message: `Are you sure you want to delete ${name}? This will remove them from your active contacts list.`,
      confirmText: "Delete",
      isDestructive: true,
    });
    if (ok) {
      try {
        await api.deleteParty(id);
        toast({ message: `Contact "${name}" deleted`, type: "success" });
        onRefresh();
      } catch (err) {
        alert({ title: "Delete Failed", message: String(err), type: "error" });
      }
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto select-none">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.07]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Customers & Vendors
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Directory of client accounts, credit ledgers, and supplier payables
          </p>
        </div>

        <button
          onClick={openCreateParty}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-black text-xs font-semibold shadow-xs transition apple-press cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Contact</span>
        </button>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="apple-card p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#86868B]">
              Total Receivables (Customers Owe You)
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-[#0071E3] mt-0.5">
              {formatCurrency(totalReceivable)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </div>

        <div className="apple-card p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#86868B]">
              Total Payables (You Owe Suppliers)
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-[#FF3B30] mt-0.5">
              {formatCurrency(totalPayable)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar & Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl apple-card shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search contacts by name, phone or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl pl-10 pr-3 py-1.5 text-xs text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3]"
          />
        </div>

        {/* Segmented Control */}
        <div className="flex items-center p-0.5 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs">
          {(["ALL", "CUSTOMER", "VENDOR"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                activeTab === tab
                  ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              {tab === "ALL" ? "All Contacts" : tab === "CUSTOMER" ? "Customers" : "Suppliers"}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block apple-card rounded-2xl overflow-hidden shadow-2xs">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-black/[0.06] bg-[#FBFBFC] text-[#86868B] font-semibold text-[11px]">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-3">Type</th>
              <th className="py-3 px-3">Contact Details</th>
              <th className="py-3 px-3 text-right">Running Balance</th>
              <th className="py-3 px-3 text-center">Aging Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {filteredParties.map((party) => {
              const isCust = party.party_type === "CUSTOMER";
              const aging = agingMap.get(party.id);
              const hasBalance = party.current_balance !== 0;

              return (
                <tr key={party.id} className="hover:bg-[#FBFBFC] transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-[#1D1D1F]">{party.name}</div>
                    {party.tax_number && (
                      <div className="text-[10px] text-[#86868B]">Tax ID: {party.tax_number}</div>
                    )}
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isCust
                          ? "bg-[#0071E3]/10 text-[#0071E3]"
                          : "bg-[#FF9500]/10 text-[#FF9500]"
                      }`}
                    >
                      {isCust ? "Customer" : "Supplier"}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-[#6E6E73] text-[11px]">
                    <div>{party.phone || "—"}</div>
                    {party.email && <div className="text-[10px] text-[#86868B]">{party.email}</div>}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-xs">
                    {party.current_balance === 0 ? (
                      <span className="text-[#86868B] font-normal">Settled</span>
                    ) : (
                      <span
                        className={
                          isCust
                            ? party.current_balance > 0
                              ? "text-[#0071E3]"
                              : "text-[#34C759]"
                            : party.current_balance < 0
                            ? "text-[#FF3B30]"
                            : "text-[#34C759]"
                        }
                      >
                        {formatCurrency(Math.abs(party.current_balance))}
                        <span className="text-[10px] ml-1 font-normal">
                          {isCust
                            ? party.current_balance > 0
                              ? "Due"
                              : "Advance"
                            : party.current_balance < 0
                            ? "Payable"
                            : "Advance"}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    {aging && aging.total_due > 0 ? (
                      <button
                        onClick={() => openReminderModal(aging, party)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition ${
                          aging.over_90 > 0
                            ? "bg-[#FF3B30]/10 text-[#FF3B30]"
                            : aging.days_60 > 0
                            ? "bg-[#FF9500]/10 text-[#FF9500]"
                            : "bg-[#0071E3]/10 text-[#0071E3]"
                        }`}
                      >
                        {aging.over_90 > 0 ? "90d+ Overdue" : aging.days_60 > 0 ? "60d Due" : "Current"}
                      </button>
                    ) : (
                      <span className="text-[#86868B] text-[10px]">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      {hasBalance && (
                        <button
                          onClick={() => openPaymentModal(party)}
                          className="px-2 py-1 rounded-lg bg-[#1D1D1F] text-white hover:bg-black text-[11px] font-semibold transition apple-press"
                        >
                          {isCust ? "Collect" : "Pay"}
                        </button>
                      )}
                      <button
                        onClick={() => openLedgerModal(party)}
                        title="View Statement"
                        className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05]"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEditParty(party)}
                        title="Edit Contact"
                        className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#0071E3] hover:bg-black/[0.05]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteParty(party.id, party.name)}
                        title="Delete Contact"
                        className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#FF3B30] hover:bg-black/[0.05]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View (< md) */}
      <div className="md:hidden space-y-2.5">
        {filteredParties.map((party) => {
          const isCust = party.party_type === "CUSTOMER";
          const hasBalance = party.current_balance !== 0;

          return (
            <div
              key={party.id}
              className="apple-card p-3.5 rounded-2xl flex flex-col gap-2.5 shadow-2xs"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-xs text-[#1D1D1F]">{party.name}</div>
                  <div className="text-[10px] text-[#86868B] mt-0.5">{party.phone || "No phone"}</div>
                </div>
                <span
                  className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                    isCust ? "bg-[#0071E3]/10 text-[#0071E3]" : "bg-[#FF9500]/10 text-[#FF9500]"
                  }`}
                >
                  {isCust ? "Customer" : "Supplier"}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-black/[0.04] text-xs">
                <div>
                  <span className="text-[10px] text-[#86868B] block">Balance</span>
                  <span className="font-bold font-mono text-[#1D1D1F]">
                    {party.current_balance === 0
                      ? "Settled"
                      : formatCurrency(Math.abs(party.current_balance))}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasBalance && (
                    <button
                      onClick={() => openPaymentModal(party)}
                      className="px-2.5 py-1 rounded-lg bg-[#1D1D1F] text-white text-[11px] font-semibold"
                    >
                      {isCust ? "Collect" : "Pay"}
                    </button>
                  )}
                  <button
                    onClick={() => openLedgerModal(party)}
                    className="p-1.5 rounded-lg text-[#6E6E73]"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => openEditParty(party)}
                    className="p-1.5 rounded-lg text-[#6E6E73]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredParties.length === 0 && (
        <div className="py-16 text-center text-[#86868B]">
          <Users className="w-8 h-8 mx-auto text-[#86868B]/40 mb-2" />
          <p className="text-xs font-semibold text-[#1D1D1F]">No contacts found</p>
          <p className="text-[11px] text-[#86868B] mt-0.5">
            Press "+ New Contact" to register a customer or supplier account
          </p>
        </div>
      )}

      {/* CREATE / EDIT CONTACT MODAL */}
      {isPartyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB]">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  {activeParty ? "Edit Party" : "New Party"}
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Customer or supplier record
                </p>
              </div>
              <button
                onClick={() => setIsPartyModalOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveParty} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Party Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType("CUSTOMER")}
                    className={`py-2 rounded-full border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      formType === "CUSTOMER"
                        ? "bg-white text-black border-white shadow-sm"
                        : "bg-[#F9FAFB] text-neutral-400 border-black/[0.08] hover:text-black"
                    }`}
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("VENDOR")}
                    className={`py-2 rounded-full border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      formType === "VENDOR"
                        ? "bg-white text-black border-white shadow-sm"
                        : "bg-[#F9FAFB] text-neutral-400 border-black/[0.08] hover:text-black"
                    }`}
                  >
                    Supplier
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Coffee Roasters"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Tax / GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder="27AABCU9603R1ZM"
                    value={formTaxNumber}
                    onChange={(e) => setFormTaxNumber(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="billing@company.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              {!activeParty && (
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Opening Balance ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formOpeningBalance}
                    onChange={(e) => setFormOpeningBalance(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPartyModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/[0.08] text-xs font-semibold text-neutral-300 bg-[#F9FAFB] hover:bg-[#20232c] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  Save Party
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && activeParty && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-black/[0.08] overflow-visible animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB] rounded-t-3xl">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  {activeParty.party_type === "CUSTOMER" ? "Receive Payment" : "Settle Supplier"}
                </h3>
                <p className="text-[11px] text-neutral-400">{activeParty.name}</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-3.5">
              <div className="p-3 rounded-xl bg-white border border-black/[0.08] text-xs flex justify-between items-center">
                <span className="text-neutral-400">Balance:</span>
                <span className="font-mono font-bold text-black">
                  {formatCurrency(Math.abs(activeParty.current_balance))}
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Amount ({currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Method
                </label>
                <AppleSelect
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  options={[
                    { value: "CASH", label: "Cash" },
                    { value: "BANK", label: "Bank Transfer / UPI" },
                    { value: "CARD", label: "Credit / Debit Card" },
                    { value: "CHECK", label: "Cheque" },
                  ]}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Reference
                </label>
                <input
                  type="text"
                  placeholder="Optional note"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/[0.08] text-xs font-semibold text-neutral-300 bg-[#F9FAFB] hover:bg-[#20232c] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="flex-1 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  {isSubmittingPayment ? "Recording..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCOUNT STATEMENT LEDGER MODAL */}
      {isLedgerModalOpen && activeParty && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-black/[0.08] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB]">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  Statement
                </h3>
                <p className="text-[11px] text-neutral-400">{activeParty.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsLedgerModalOpen(false)}
                  className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2.5 select-text">
              {partyPayments.map((pmt) => (
                <div
                  key={pmt.id}
                  className="p-3 rounded-xl border border-black/[0.08] bg-white flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-black">
                      {pmt.payment_type === "IN" ? "Payment Received" : "Payment Disbursed"} · {pmt.payment_method}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      {pmt.payment_date} · {pmt.notes}
                    </div>
                  </div>
                  <span
                    className={`font-mono font-bold text-xs ${
                      pmt.payment_type === "IN" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {pmt.payment_type === "IN" ? "+" : "-"}{formatCurrency(pmt.amount)}
                  </span>
                </div>
              ))}

              {partyPayments.length === 0 && (
                <div className="text-center py-12 text-neutral-400 text-xs">
                  No payment records found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FRIENDLY OVERDUE REMINDER MODAL */}
      {isReminderModalOpen && activeParty && selectedAging && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB]">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  Statement Notice
                </h3>
                <p className="text-[11px] text-neutral-400">{activeParty.name}</p>
              </div>
              <button
                onClick={() => setIsReminderModalOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-white border border-black/[0.08] space-y-1 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Total Outstanding:</span>
                  <span className="font-mono font-bold text-black">
                    {formatCurrency(selectedAging.total_due)}
                  </span>
                </div>
                {selectedAging.over_90 > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Overdue &gt; 90 days:</span>
                    <span className="font-mono font-bold">
                      {formatCurrency(selectedAging.over_90)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300 block">
                  Copyable Message:
                </label>
                <textarea
                  readOnly
                  rows={4}
                  value={`Dear ${activeParty.name},\nThis is a friendly statement update from ${settings.business_name}. Your account has an outstanding balance of ${formatCurrency(selectedAging.total_due)}. Please arrange for settlement at your earliest convenience.\nThank you!`}
                  className="w-full p-3 rounded-xl border border-black/[0.08] bg-white text-xs text-black font-mono leading-relaxed select-text resize-none"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Dear ${activeParty.name},\nThis is a friendly statement update from ${settings.business_name}. Your account has an outstanding balance of ${formatCurrency(selectedAging.total_due)}. Please arrange for settlement at your earliest convenience.\nThank you!`
                  );
                  setCopiedReminder(true);
                  setTimeout(() => setCopiedReminder(false), 2000);
                }}
                className="w-full py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedReminder ? (
                  <>
                    <Check className="w-4 h-4 text-black" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-black" />
                    <span>Copy Notice</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
