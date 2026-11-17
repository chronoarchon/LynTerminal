import React, { useState, useEffect } from "react";
import {
  X,
  Coins,
  ArrowDownLeft,
  ArrowLeftRight,
  Sliders,
  Wallet,
  Landmark,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import type { Settings, DashboardSummary, BankAccount } from "../types";
import { api } from "../services/api";

interface ManageMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "deposit" | "transfer" | "manage";
  initialDepositDestination?: "CASH" | "BANK" | "CAPITAL";
  settings: Settings;
  summary: DashboardSummary | null;
  onSuccess: () => void;
}

export function ManageMoneyModal({
  isOpen,
  onClose,
  initialTab = "deposit",
  initialDepositDestination = "CASH",
  settings,
  summary,
  onSuccess,
}: ManageMoneyModalProps) {
  const [activeTab, setActiveTab] = useState<"deposit" | "transfer" | "manage">(initialTab);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const currencySymbol = settings?.currency_symbol || "$";
  const cashInHand = summary?.cash_in_hand ?? 0;
  const cashInBank = summary?.cash_in_bank ?? 0;

  // Deposit Form State
  const [depositDestination, setDepositDestination] = useState<"CASH" | "BANK" | "CAPITAL">(
    initialDepositDestination
  );
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositSource, setDepositSource] = useState<string>("Cash Float Addition");
  const [depositReference, setDepositReference] = useState<string>("");
  const [depositDate, setDepositDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [depositBankAccountId, setDepositBankAccountId] = useState<string>("");
  const [depositNotes, setDepositNotes] = useState<string>("");

  // Transfer Form State
  const [transferDirection, setTransferDirection] = useState<"CASH_TO_BANK" | "BANK_TO_CASH">(
    "CASH_TO_BANK"
  );
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [transferBankAccountId, setTransferBankAccountId] = useState<string>("");
  const [transferNotes, setTransferNotes] = useState<string>("");

  // Manage Balances Form State
  const [manageOpeningCash, setManageOpeningCash] = useState<number>(settings?.opening_cash ?? 0);
  const [manageOpeningBank, setManageOpeningBank] = useState<number>(settings?.opening_bank ?? 0);
  const [manageCapitalCash, setManageCapitalCash] = useState<number>(settings?.capital_cash ?? 0);
  const [manageCapitalBank, setManageCapitalBank] = useState<number>(settings?.capital_bank ?? 0);
  const [manageBalanceMode, setManageBalanceMode] = useState<"CASH" | "BANK" | "SPLIT">(
    settings?.opening_balance_mode || "CASH"
  );
  const [manageCapitalMode, setManageCapitalMode] = useState<"CASH" | "BANK" | "SPLIT">(
    settings?.capital_mode || "CASH"
  );

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setDepositDestination(initialDepositDestination);
      setFeedback(null);
      setDepositAmount("");
      setTransferAmount("");
      setDepositReference("");
      setDepositNotes("");
      setTransferNotes("");

      // Sync settings values
      setManageOpeningCash(settings?.opening_cash ?? 0);
      setManageOpeningBank(settings?.opening_bank ?? 0);
      setManageCapitalCash(settings?.capital_cash ?? 0);
      setManageCapitalBank(settings?.capital_bank ?? 0);
      setManageBalanceMode(settings?.opening_balance_mode || "CASH");
      setManageCapitalMode(settings?.capital_mode || "CASH");

      // Load connected bank accounts
      api.listBankAccounts()
        .then((accounts) => {
          setBankAccounts(accounts);
          const primary = accounts.find((a) => a.is_primary) || accounts[0];
          if (primary) {
            setDepositBankAccountId(primary.id);
            setTransferBankAccountId(primary.id);
          }
        })
        .catch((e) => console.error("Failed to load bank accounts:", e));
    }
  }, [isOpen, initialTab, initialDepositDestination, settings]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 1. Submit Deposit
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(depositAmount);
    if (!amountNum || amountNum <= 0) {
      setFeedback({ type: "error", message: "Please enter a valid deposit amount greater than zero." });
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);
      await api.recordDeposit({
        destination: depositDestination,
        amount: amountNum,
        source: depositSource || "Owner Deposit",
        reference: depositReference.trim(),
        date: depositDate,
        bank_account_id: depositDestination === "BANK" ? depositBankAccountId : null,
        notes: depositNotes.trim(),
      });

      setFeedback({
        type: "success",
        message: `Successfully deposited ${currencySymbol}${amountNum.toFixed(2)} to ${
          depositDestination === "CASH"
            ? "Cash Drawer"
            : depositDestination === "BANK"
            ? "Bank Account"
            : "Owner Capital"
        }!`,
      });
      setDepositAmount("");
      setDepositNotes("");
      setDepositReference("");
      onSuccess();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: "error", message: errMsg || "Failed to record deposit." });
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Contra Transfer
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(transferAmount);
    if (!amountNum || amountNum <= 0) {
      setFeedback({ type: "error", message: "Please enter a valid transfer amount greater than zero." });
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);
      await api.transferCashBank(
        transferDirection,
        transferBankAccountId || "BANK-PRIMARY",
        amountNum,
        transferNotes.trim() ||
          (transferDirection === "CASH_TO_BANK" ? "Cash drawer deposit to bank" : "Bank cash withdrawal to drawer")
      );

      setFeedback({
        type: "success",
        message: `Successfully transferred ${currencySymbol}${amountNum.toFixed(2)} (${
          transferDirection === "CASH_TO_BANK" ? "Cash Drawer ➔ Bank Account" : "Bank Account ➔ Cash Drawer"
        })!`,
      });
      setTransferAmount("");
      setTransferNotes("");
      onSuccess();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: "error", message: errMsg || "Failed to execute transfer." });
    } finally {
      setLoading(false);
    }
  };

  // 3. Submit Manage Balances
  const handleManageBalancesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setFeedback(null);
      await api.updateOpeningCapital({
        opening_cash: Number(manageOpeningCash) || 0,
        opening_bank: Number(manageOpeningBank) || 0,
        opening_balance_mode: manageBalanceMode,
        capital_cash: Number(manageCapitalCash) || 0,
        capital_bank: Number(manageCapitalBank) || 0,
        capital_mode: manageCapitalMode,
      });

      setFeedback({
        type: "success",
        message: "Successfully calibrated opening balances and owner capital equity!",
      });
      onSuccess();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: "error", message: errMsg || "Failed to update balances." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-black/[0.08] flex flex-col max-h-[92vh] overflow-hidden apple-animate-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-black/[0.06] bg-[#FAFAFC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#1D1D1F] tracking-tight">
                Manage Money & Capital Liquidity
              </h2>
              <p className="text-[11px] text-[#86868B]">
                Deposit funds, 1-click contra transfers, and capital balance adjustments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.05] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Liquidity Status Bar */}
        <div className="px-5 sm:px-6 py-2.5 bg-black/[0.02] border-b border-black/[0.05] grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded-xl bg-white border border-black/[0.05] shadow-2xs">
            <div className="text-[10px] font-medium text-[#86868B] flex items-center justify-center gap-1">
              <Wallet className="w-3 h-3 text-[#34C759]" />
              <span>Cash Drawer</span>
            </div>
            <div className="font-mono font-bold text-[#1D1D1F] text-xs sm:text-sm mt-0.5">
              {currencySymbol}{cashInHand.toFixed(2)}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-white border border-black/[0.05] shadow-2xs">
            <div className="text-[10px] font-medium text-[#86868B] flex items-center justify-center gap-1">
              <Landmark className="w-3 h-3 text-[#00C7BE]" />
              <span>Bank Balance</span>
            </div>
            <div className="font-mono font-bold text-[#1D1D1F] text-xs sm:text-sm mt-0.5">
              {currencySymbol}{cashInBank.toFixed(2)}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-white border border-black/[0.05] shadow-2xs">
            <div className="text-[10px] font-medium text-[#86868B] flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 text-[#0071E3]" />
              <span>Net Liquidity</span>
            </div>
            <div className="font-mono font-bold text-[#0071E3] text-xs sm:text-sm mt-0.5">
              {currencySymbol}{(cashInHand + cashInBank).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 sm:px-6 pt-3 pb-2 border-b border-black/[0.06]">
          <div className="grid grid-cols-3 gap-1 p-1 bg-black/[0.04] rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab("deposit");
                setFeedback(null);
              }}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === "deposit"
                  ? "bg-white text-[#1D1D1F] shadow-xs font-bold"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-[#34C759]" />
              <span>Deposit</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("transfer");
                setFeedback(null);
              }}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === "transfer"
                  ? "bg-white text-[#1D1D1F] shadow-xs font-bold"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-[#00C7BE]" />
              <span>Transfer</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("manage");
                setFeedback(null);
              }}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === "manage"
                  ? "bg-white text-[#1D1D1F] shadow-xs font-bold"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>Balances</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-5 sm:mx-6 mt-3 p-3 rounded-xl flex items-center gap-2 text-xs font-medium animate-in fade-in duration-150 ${
              feedback.type === "success"
                ? "bg-[#34C759]/10 text-[#248A3D] border border-[#34C759]/20"
                : "bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1">{feedback.message}</span>
          </div>
        )}

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {/* TAB 1: DEPOSIT */}
          {activeTab === "deposit" && (
            <form onSubmit={handleDepositSubmit} className="space-y-4">
              {/* Destination Selector */}
              <div>
                <label className="text-[11px] font-bold text-[#1D1D1F] block mb-1.5">
                  Select Deposit Destination
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositDestination("CASH")}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      depositDestination === "CASH"
                        ? "border-[#34C759] bg-[#34C759]/5 shadow-2xs"
                        : "border-black/[0.08] hover:border-black/[0.15] bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Wallet className="w-4 h-4 text-[#34C759]" />
                      {depositDestination === "CASH" && (
                        <span className="w-2 h-2 rounded-full bg-[#34C759]" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-[#1D1D1F]">Cash Drawer</div>
                    <div className="text-[10px] text-[#86868B] mt-0.5">Physical Float</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDepositDestination("BANK")}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      depositDestination === "BANK"
                        ? "border-[#00C7BE] bg-[#00C7BE]/5 shadow-2xs"
                        : "border-black/[0.08] hover:border-black/[0.15] bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Landmark className="w-4 h-4 text-[#00C7BE]" />
                      {depositDestination === "BANK" && (
                        <span className="w-2 h-2 rounded-full bg-[#00C7BE]" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-[#1D1D1F]">Bank Account</div>
                    <div className="text-[10px] text-[#86868B] mt-0.5">Direct Liquidity</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDepositDestination("CAPITAL")}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      depositDestination === "CAPITAL"
                        ? "border-[#0071E3] bg-[#0071E3]/5 shadow-2xs"
                        : "border-black/[0.08] hover:border-black/[0.15] bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Coins className="w-4 h-4 text-[#0071E3]" />
                      {depositDestination === "CAPITAL" && (
                        <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-[#1D1D1F]">Owner Capital</div>
                    <div className="text-[10px] text-[#86868B] mt-0.5">Equity Injection</div>
                  </button>
                </div>
              </div>

              {/* Bank Account Selection (if Destination is BANK) */}
              {depositDestination === "BANK" && bankAccounts.length > 0 && (
                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Select Target Bank Account
                  </label>
                  <select
                    value={depositBankAccountId}
                    onChange={(e) => setDepositBankAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                  >
                    {bankAccounts.map((acct) => (
                      <option key={acct.id} value={acct.id}>
                        {acct.account_name} ({acct.bank_name} - {acct.account_number}) · Balance: {currencySymbol}{acct.current_balance.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Amount Input with quick amounts */}
              <div>
                <label className="text-[11px] font-bold text-[#1D1D1F] block mb-1">
                  Deposit Amount ({currencySymbol}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#86868B]">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-black/[0.08] bg-white text-base font-bold font-mono text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                  />
                </div>

                <div className="flex items-center gap-1.5 mt-2">
                  {[100, 500, 1000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDepositAmount(String(amt))}
                      className="px-2.5 py-1 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-[11px] font-mono font-semibold text-[#1D1D1F] transition cursor-pointer"
                    >
                      +{currencySymbol}{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Funding Source / Purpose
                  </label>
                  <input
                    type="text"
                    value={depositSource}
                    onChange={(e) => setDepositSource(e.target.value)}
                    placeholder="e.g. Owner Investment, Float Top-up"
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Reference / Slip # (Optional)
                  </label>
                  <input
                    type="text"
                    value={depositReference}
                    onChange={(e) => setDepositReference(e.target.value)}
                    placeholder="e.g. SLIP-1042, DEP-001"
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                  />
                </div>
              </div>

              {/* Date & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Notes / Description
                  </label>
                  <input
                    type="text"
                    value={depositNotes}
                    onChange={(e) => setDepositNotes(e.target.value)}
                    placeholder="Additional details..."
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold shadow-xs transition apple-press cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>{loading ? "Recording Deposit..." : "Record Deposit"}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CONTRA TRANSFER */}
          {activeTab === "transfer" && (
            <form onSubmit={handleTransferSubmit} className="space-y-4">
              {/* Direction Selector */}
              <div>
                <label className="text-[11px] font-bold text-[#1D1D1F] block mb-1.5">
                  Transfer Direction (1-Click Contra)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferDirection("CASH_TO_BANK")}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      transferDirection === "CASH_TO_BANK"
                        ? "border-[#0071E3] bg-[#0071E3]/5 shadow-2xs"
                        : "border-black/[0.08] hover:border-black/[0.15] bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="w-4 h-4 text-[#34C759]" />
                      <ArrowLeftRight className="w-3.5 h-3.5 text-[#0071E3]" />
                      <Landmark className="w-4 h-4 text-[#00C7BE]" />
                    </div>
                    <div className="text-xs font-bold text-[#1D1D1F]">Cash to Bank</div>
                    <div className="text-[10px] text-[#86868B] mt-0.5">Deposit drawer cash into bank</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransferDirection("BANK_TO_CASH")}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      transferDirection === "BANK_TO_CASH"
                        ? "border-[#0071E3] bg-[#0071E3]/5 shadow-2xs"
                        : "border-black/[0.08] hover:border-black/[0.15] bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Landmark className="w-4 h-4 text-[#00C7BE]" />
                      <ArrowLeftRight className="w-3.5 h-3.5 text-[#0071E3]" />
                      <Wallet className="w-4 h-4 text-[#34C759]" />
                    </div>
                    <div className="text-xs font-bold text-[#1D1D1F]">Bank to Cash</div>
                    <div className="text-[10px] text-[#86868B] mt-0.5">Withdraw bank funds to drawer</div>
                  </button>
                </div>
              </div>

              {/* Dynamic Flow Summary */}
              <div className="p-3 rounded-xl bg-black/[0.02] border border-black/[0.05] text-xs flex items-center justify-between">
                <span className="text-[#86868B]">Transaction Effect:</span>
                <span className="font-semibold text-[#1D1D1F]">
                  {transferDirection === "CASH_TO_BANK" ? (
                    <span className="text-[#0071E3]">
                      Drawer Cash ↓ &nbsp;·&nbsp; Bank Liquidity ↑
                    </span>
                  ) : (
                    <span className="text-[#0071E3]">
                      Bank Liquidity ↓ &nbsp;·&nbsp; Drawer Cash ↑
                    </span>
                  )}
                </span>
              </div>

              {/* Connected Bank Account */}
              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Operating Bank Account
                </label>
                <select
                  value={transferBankAccountId}
                  onChange={(e) => setTransferBankAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                >
                  {bankAccounts.length > 0 ? (
                    bankAccounts.map((acct) => (
                      <option key={acct.id} value={acct.id}>
                        {acct.account_name} ({acct.bank_name}) · Current: {currencySymbol}{acct.current_balance.toFixed(2)}
                      </option>
                    ))
                  ) : (
                    <option value="BANK-PRIMARY">Primary Operating Account</option>
                  )}
                </select>
              </div>

              {/* Transfer Amount */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-[#1D1D1F]">
                    Transfer Amount ({currencySymbol}) *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const maxAvailable =
                        transferDirection === "CASH_TO_BANK" ? Math.max(0, cashInHand) : Math.max(0, cashInBank);
                      setTransferAmount(String(maxAvailable.toFixed(2)));
                    }}
                    className="text-[10px] font-semibold text-[#0071E3] hover:underline cursor-pointer"
                  >
                    Fill Max Available ({currencySymbol}
                    {(transferDirection === "CASH_TO_BANK" ? cashInHand : cashInBank).toFixed(2)})
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#86868B]">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-black/[0.08] bg-white text-base font-bold font-mono text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Transfer Reference / Note
                </label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. Daily sales deposit into night safe"
                  className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold shadow-xs transition apple-press cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>{loading ? "Executing Transfer..." : "Execute Contra Transfer"}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: MANAGE BALANCES */}
          {activeTab === "manage" && (
            <form onSubmit={handleManageBalancesSubmit} className="space-y-4">
              <div className="p-3 rounded-2xl bg-[#FAFAFC] border border-black/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#1D1D1F]">
                    Starting Opening Float Calibration
                  </h3>
                  <span className="text-[11px] font-mono font-bold text-[#0071E3] bg-[#0071E3]/10 px-2 py-0.5 rounded-lg">
                    Total: {currencySymbol}{(Number(manageOpeningCash || 0) + Number(manageOpeningBank || 0)).toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 p-1 bg-black/[0.04] rounded-xl text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      const total = Number(manageOpeningCash || 0) + Number(manageOpeningBank || 0);
                      setManageBalanceMode("CASH");
                      setManageOpeningCash(total);
                      setManageOpeningBank(0);
                    }}
                    className={`py-1 rounded-lg text-center transition cursor-pointer ${
                      manageBalanceMode === "CASH"
                        ? "bg-white text-[#1D1D1F] font-semibold shadow-2xs"
                        : "text-[#86868B] hover:text-[#1D1D1F]"
                    }`}
                  >
                    Cash Only
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const total = Number(manageOpeningCash || 0) + Number(manageOpeningBank || 0);
                      setManageBalanceMode("BANK");
                      setManageOpeningCash(0);
                      setManageOpeningBank(total);
                    }}
                    className={`py-1 rounded-lg text-center transition cursor-pointer ${
                      manageBalanceMode === "BANK"
                        ? "bg-white text-[#1D1D1F] font-semibold shadow-2xs"
                        : "text-[#86868B] hover:text-[#1D1D1F]"
                    }`}
                  >
                    Bank Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setManageBalanceMode("SPLIT")}
                    className={`py-1 rounded-lg text-center transition cursor-pointer ${
                      manageBalanceMode === "SPLIT"
                        ? "bg-white text-[#1D1D1F] font-semibold shadow-2xs"
                        : "text-[#86868B] hover:text-[#1D1D1F]"
                    }`}
                  >
                    Split
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(manageBalanceMode === "CASH" || manageBalanceMode === "SPLIT") && (
                    <div className={manageBalanceMode === "CASH" ? "sm:col-span-2" : ""}>
                      <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                        Opening Cash Float ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={manageOpeningCash}
                        onChange={(e) => setManageOpeningCash(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium focus:outline-none focus:border-[#0071E3]"
                      />
                    </div>
                  )}

                  {(manageBalanceMode === "BANK" || manageBalanceMode === "SPLIT") && (
                    <div className={manageBalanceMode === "BANK" ? "sm:col-span-2" : ""}>
                      <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                        Opening Bank Funds ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={manageOpeningBank}
                        onChange={(e) => setManageOpeningBank(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium focus:outline-none focus:border-[#0071E3]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Owner Capital & Equity */}
              <div className="p-3 rounded-2xl bg-[#FAFAFC] border border-black/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#1D1D1F]">
                    Owner Capital & Equity Injections
                  </h3>
                  <span className="text-[11px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/50">
                    Total: {currencySymbol}{(Number(manageCapitalCash || 0) + Number(manageCapitalBank || 0)).toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                      Capital Allocated to Cash ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={manageCapitalCash}
                      onChange={(e) => setManageCapitalCash(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                      Capital Allocated to Bank ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={manageCapitalBank}
                      onChange={(e) => setManageCapitalBank(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="p-3 rounded-xl bg-black/[0.02] border border-black/[0.05] text-xs flex items-center justify-between">
                <span className="text-[#86868B]">Calibrated Total Net Equity:</span>
                <span className="font-mono font-bold text-[#0071E3]">
                  {currencySymbol}
                  {(
                    Number(manageOpeningCash || 0) +
                    Number(manageOpeningBank || 0) +
                    Number(manageCapitalCash || 0) +
                    Number(manageCapitalBank || 0)
                  ).toFixed(2)}
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold shadow-xs transition apple-press cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Sliders className="w-4 h-4" />
                  <span>{loading ? "Updating Balances..." : "Save Balances & Capital"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
