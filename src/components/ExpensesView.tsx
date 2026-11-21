import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  RefreshCw,
  Repeat,
} from "lucide-react";
import type { Expense, Settings, RecurringBill } from "../types";
import { api } from "../services/api";
import { AppleSelect } from "./common/AppleSelect";
import { useCurrency } from "../context/CurrencyContext";

interface ExpensesViewProps {
  settings: Settings | null;
  onRefreshSummary: () => void;
}

const CATEGORIES = [
  "Rent & Lease",
  "Salaries & Wages",
  "Utilities & Electricity",
  "Inventory & Logistics",
  "Packaging & Supplies",
  "Repairs & Maintenance",
  "Software & Subscriptions",
  "Marketing & Advertising",
  "Taxes & Government",
  "Miscellaneous",
];

const RECURRING_CATEGORIES = [
  "RENT",
  "ELECTRICITY",
  "INTERNET",
  "SUBSCRIPTION",
  "MAINTENANCE",
  "SUPPLIES",
  "OTHER",
];

const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Credit Card",
  "Debit Card",
  "Cheque",
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  settings,
  onRefreshSummary,
}) => {
  const { currencySymbol, formatCurrency } = useCurrency();
  const currency = currencySymbol || settings?.currency_symbol || "$";
  const [activeSubTab, setActiveSubTab] = useState<"EXPENSES" | "RECURRING">("EXPENSES");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Expense Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [formData, setFormData] = useState<Partial<Expense>>({
    title: "",
    category: CATEGORIES[0],
    amount: 0,
    expense_date: new Date().toISOString().split("T")[0],
    payment_method: "Cash",
    notes: "",
  });

  // Recurring Bills State
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [isPayBillModalOpen, setIsPayBillModalOpen] = useState(false);
  const [selectedBillToPay, setSelectedBillToPay] = useState<RecurringBill | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paySource, setPaySource] = useState<"CASH" | "BANK">("CASH");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Add Recurring Bill Modal State
  const [isAddBillModalOpen, setIsAddBillModalOpen] = useState(false);
  const [newBillTitle, setNewBillTitle] = useState("");
  const [newBillCategory, setNewBillCategory] = useState("RENT");
  const [newBillDueDay, setNewBillDueDay] = useState(1);
  const [newBillEstimated, setNewBillEstimated] = useState("");
  const [newBillNotes, setNewBillNotes] = useState("");

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const data = await api.listExpenses(
        selectedCategory === "ALL" ? undefined : selectedCategory
      );
      setExpenses(data);
    } catch (err) {
      console.error("Failed to load expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecurringBills = async () => {
    try {
      const data = await api.listRecurringBills();
      setRecurringBills(data);
    } catch (err) {
      console.error("Failed to load recurring bills:", err);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [selectedCategory]);

  useEffect(() => {
    loadRecurringBills();
  }, []);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setFormData({
      title: "",
      category: CATEGORIES[0],
      amount: 0,
      expense_date: new Date().toISOString().split("T")[0],
      payment_method: "Cash",
      notes: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      expense_date: expense.expense_date,
      payment_method: expense.payment_method,
      notes: expense.notes,
    });
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim() || !formData.amount || formData.amount <= 0) {
      alert("Please enter a valid expense title and amount.");
      return;
    }

    try {
      await api.saveExpense({
        id: editingExpense ? editingExpense.id : "",
        title: formData.title.trim(),
        category: formData.category || CATEGORIES[0],
        amount: Number(formData.amount),
        expense_date: formData.expense_date || new Date().toISOString().split("T")[0],
        payment_method: formData.payment_method || "Cash",
        notes: formData.notes?.trim() || "",
      });

      setIsModalOpen(false);
      await loadExpenses();
      onRefreshSummary();
    } catch (err) {
      alert("Failed to save expense: " + err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense entry?")) return;
    try {
      await api.deleteExpense(id);
      await loadExpenses();
      onRefreshSummary();
    } catch (err) {
      alert("Failed to delete expense: " + err);
    }
  };

  const handleOpenPayBill = (bill: RecurringBill) => {
    setSelectedBillToPay(bill);
    setPayAmount(
      bill.estimated_amount && bill.estimated_amount > 0
        ? bill.estimated_amount.toString()
        : ""
    );
    setPaySource("CASH");
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayRef("");
    setPayNotes(`Settlement for ${bill.title}`);
    setIsPayBillModalOpen(true);
  };

  const handleExecutePayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBillToPay) return;
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    try {
      setIsSubmittingPayment(true);
      await api.payRecurringBill({
        bill_id: selectedBillToPay.id,
        amount: amt,
        payment_source: paySource,
        payment_date: payDate,
        reference: payRef.trim(),
        notes: payNotes.trim(),
      });

      setIsPayBillModalOpen(false);
      setSelectedBillToPay(null);
      await loadRecurringBills();
      await loadExpenses();
      onRefreshSummary();
    } catch (err) {
      alert("Failed to pay bill: " + err);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleCreateRecurringBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBillTitle.trim()) return;

    try {
      await api.saveRecurringBill({
        title: newBillTitle.trim(),
        category: newBillCategory,
        due_day: newBillDueDay,
        estimated_amount: newBillEstimated ? parseFloat(newBillEstimated) : null,
        notes: newBillNotes.trim(),
      });

      setIsAddBillModalOpen(false);
      setNewBillTitle("");
      setNewBillCategory("RENT");
      setNewBillEstimated("");
      setNewBillNotes("");
      await loadRecurringBills();
    } catch (err) {
      alert("Failed to create bill: " + err);
    }
  };

  const filteredExpenses = useMemo(() => {
    const term = search.toLowerCase().trim();
    return expenses.filter((item) => {
      if (!term) return true;
      return (
        item.title.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        (item.notes && item.notes.toLowerCase().includes(term))
      );
    });
  }, [expenses, search]);

  const totalExpenseAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [filteredExpenses]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.07]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Operating Expenses
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Log store premises costs, utilities, inventory supplies, and recurring leases
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === "EXPENSES" ? (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Expense</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAddBillModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Monthly Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-[#E8E8ED] rounded-xl">
          <button
            onClick={() => setActiveSubTab("EXPENSES")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              activeSubTab === "EXPENSES"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Expenses Log ({expenses.length})
          </button>
          <button
            onClick={() => setActiveSubTab("RECURRING")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              activeSubTab === "RECURRING"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Monthly Bills ({recurringBills.length})
          </button>
        </div>

        {activeSubTab === "EXPENSES" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#86868B]">Total Logged:</span>
            <span className="text-sm font-bold font-mono text-[#FF3B30]">
              {formatCurrency(totalExpenseAmount)}
            </span>
          </div>
        )}
      </div>

      {/* TAB 1: Expenses Log */}
      {activeSubTab === "EXPENSES" && (
        <>
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl apple-card shrink-0">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search expenses by title or note..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl pl-10 pr-3 py-1.5 text-xs text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-black"
              />
            </div>

            <AppleSelect
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={[{ value: "ALL", label: "All Categories" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
              className="w-44 shrink-0"
              buttonClassName="bg-[#F5F5F7] py-1.5"
            />
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block apple-card rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-black/[0.06] bg-[#FBFBFC] text-[#86868B] font-semibold text-[11px]">
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Payment Source</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#86868B]">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-black" />
                      Loading expenses...
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#86868B]">
                      No expenses found matching the current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-[#FBFBFC] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#1D1D1F]">{exp.title}</div>
                        {exp.notes && (
                          <div className="text-[10px] text-[#86868B] line-clamp-1">{exp.notes}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-black/[0.04] text-[11px] font-medium text-[#6E6E73]">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-[#6E6E73] text-[11px]">
                        {exp.expense_date}
                      </td>
                      <td className="py-3.5 px-3 text-[#6E6E73] text-[11px]">
                        {exp.payment_method}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-[#FF3B30]">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(exp)}
                            className="p-1.5 rounded-lg text-[#6E6E73] hover:text-black hover:bg-black/[0.05]"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#FF3B30] hover:bg-black/[0.05]"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (< md) */}
          <div className="md:hidden space-y-2.5">
            {filteredExpenses.map((exp) => (
              <div
                key={exp.id}
                className="apple-card p-3.5 rounded-2xl flex flex-col gap-2 shadow-2xs"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-xs text-[#1D1D1F]">{exp.title}</div>
                    <div className="text-[10px] text-[#86868B]">{exp.category}</div>
                  </div>
                  <span className="font-bold font-mono text-xs text-[#FF3B30]">
                    {formatCurrency(exp.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#86868B] pt-2 border-t border-black/[0.04]">
                  <span>{exp.expense_date} · {exp.payment_method}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(exp)}
                      className="text-black font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="text-[#FF3B30] font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* TAB 2: Monthly Recurring Bills */}
      {activeSubTab === "RECURRING" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {recurringBills.map((bill) => (
            <div
              key={bill.id}
              className="apple-card p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-2xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-black/5 text-black flex items-center justify-center shrink-0">
                      <Repeat className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-xs text-[#1D1D1F] line-clamp-1">
                        {bill.title}
                      </h3>
                      <div className="text-[10px] text-[#86868B]">
                        Due Day {bill.due_day} · {bill.category}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      bill.status === "PAID"
                        ? "bg-[#34C759]/10 text-[#34C759]"
                        : "bg-[#FF9500]/10 text-[#FF9500]"
                    }`}
                  >
                    {bill.status}
                  </span>
                </div>

                {bill.notes && (
                  <p className="text-[11px] text-[#86868B] line-clamp-1 mt-2">{bill.notes}</p>
                )}
              </div>

              <div className="flex items-end justify-between pt-2 border-t border-black/[0.04]">
                <div>
                  <span className="text-[10px] text-[#86868B] block">Estimate</span>
                  <span className="font-mono font-bold text-xs text-[#1D1D1F]">
                    {bill.estimated_amount !== null && bill.estimated_amount !== undefined
                      ? formatCurrency(bill.estimated_amount)
                      : "Variable"}
                  </span>
                </div>

                <button
                  onClick={() => handleOpenPayBill(bill)}
                  className="px-3 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
                >
                  Pay Bill
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RECORD / EDIT EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.08] overflow-visible animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB] rounded-t-3xl">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  {editingExpense ? "Edit Expense" : "New Expense"}
                </h3>
                <p className="text-[11px] text-neutral-400">Store operational expense</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Title / Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electricity Bill"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Category
                  </label>
                  <AppleSelect
                    value={formData.category}
                    onChange={(val) => setFormData({ ...formData, category: val })}
                    options={CATEGORIES}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Amount ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expense_date}
                    onChange={(e) =>
                      setFormData({ ...formData, expense_date: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Payment Method
                  </label>
                  <AppleSelect
                    value={formData.payment_method}
                    onChange={(val) =>
                      setFormData({ ...formData, payment_method: val })
                    }
                    options={PAYMENT_METHODS}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional memo..."
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/[0.1] text-xs font-semibold text-black bg-white hover:bg-neutral-100 cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  {editingExpense ? "Save Expense" : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAY RECURRING BILL MODAL */}
      {isPayBillModalOpen && selectedBillToPay && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-black/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB]">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  Pay Bill
                </h3>
                <p className="text-[11px] text-neutral-400">{selectedBillToPay.title}</p>
              </div>
              <button
                onClick={() => setIsPayBillModalOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecutePayBill} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Amount ({currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Payment Source
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaySource("CASH")}
                    className={`py-2 rounded-full border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      paySource === "CASH"
                        ? "bg-white text-black border-white shadow-sm"
                        : "bg-[#F9FAFB] text-neutral-400 border-black/[0.08] hover:text-black"
                    }`}
                  >
                    Cash Drawer
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaySource("BANK")}
                    className={`py-2 rounded-full border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      paySource === "BANK"
                        ? "bg-white text-black border-white shadow-sm"
                        : "bg-[#F9FAFB] text-neutral-400 border-black/[0.08] hover:text-black"
                    }`}
                  >
                    Bank
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Ref #
                  </label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPayBillModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/[0.1] text-xs font-semibold text-black bg-white hover:bg-neutral-100 cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="flex-1 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  {isSubmittingPayment ? "Paying..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE RECURRING BILL MODAL */}
      {isAddBillModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-black/[0.08] overflow-visible animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB] rounded-t-3xl">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  New Recurring Bill
                </h3>
                <p className="text-[11px] text-neutral-400">Monthly schedule</p>
              </div>
              <button
                onClick={() => setIsAddBillModalOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRecurringBill} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shop Rent"
                  value={newBillTitle}
                  onChange={(e) => setNewBillTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Category
                </label>
                <AppleSelect
                  value={newBillCategory}
                  onChange={setNewBillCategory}
                  options={RECURRING_CATEGORIES}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Due Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={newBillDueDay}
                    onChange={(e) => setNewBillDueDay(parseInt(e.target.value) || 1)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Amount ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Estimated"
                    value={newBillEstimated}
                    onChange={(e) => setNewBillEstimated(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional memo..."
                  value={newBillNotes}
                  onChange={(e) => setNewBillNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddBillModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/[0.1] text-xs font-semibold text-black bg-white hover:bg-neutral-100 cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  Save Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
