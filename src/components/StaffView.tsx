import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Search,
  CheckCircle2,
  Printer,
  X,
  Wallet,
  Edit2,
  Trash2,
} from "lucide-react";
import type {
  Employee,
  EmployeePayload,
  EmployeeAttendance,
  RecordAttendancePayload,
  SalaryPayment,
  PaySalaryPayload,
  StaffSummaryStats,
  Settings,
  BankAccount,
} from "../types";
import { formatLocalDate } from "../utils/dateUtils";
import { printSection } from "../utils/printSection";
import { api } from "../services/api";
import { AppleSelect } from "./common/AppleSelect";
import { useAppleDialog } from "./common/AppleDialog";
import { useCurrency } from "../context/CurrencyContext";

interface StaffViewProps {
  settings: Settings | null;
  onRefreshAll?: () => void;
}

export const StaffView: React.FC<StaffViewProps> = ({ settings, onRefreshAll }) => {
  const { currencySymbol, formatCurrency } = useCurrency();
  const { confirm: appleConfirm } = useAppleDialog();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [subTab, setSubTab] = useState<"attendance" | "employees" | "vouchers">("attendance");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceList, setAttendanceList] = useState<EmployeeAttendance[]>([]);
  const [vouchers, setVouchers] = useState<SalaryPayment[]>([]);
  const [stats, setStats] = useState<StaffSummaryStats | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(
    formatLocalDate()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");

  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState<EmployeePayload>({
    name: "",
    role: "",
    phone: "",
    email: "",
    monthly_salary: 0,
    salary_type: "MONTHLY",
    status: "ACTIVE",
    joining_date: formatLocalDate(),
    notes: "",
  });

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payForm, setPayForm] = useState<PaySalaryPayload>({
    employee_id: "",
    amount: 0,
    payment_source: "CASH",
    payment_date: formatLocalDate(),
    for_month: formatLocalDate().slice(0, 7),
    days_present: 30,
    bonus: 0,
    deductions: 0,
    reference: "",
    notes: "",
  });

  const [viewingVoucher, setViewingVoucher] = useState<SalaryPayment | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [empData, attData, vouchData, statsData, banks] = await Promise.all([
        api.listEmployees(true).catch(() => []),
        api.listAttendance(selectedDate).catch(() => []),
        api.listSalaryPayments().catch(() => []),
        api.getStaffStats().catch(() => null),
        api.listBankAccounts().catch(() => []),
      ]);

      setEmployees(empData);
      setAttendanceList(attData);
      setVouchers(vouchData);
      setStats(statsData);
      setBankAccounts(banks);
    } catch (err) {
      console.error("Failed to load staff data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, EmployeeAttendance>();
    for (const att of attendanceList) {
      map.set(att.employee_id, att);
    }
    return map;
  }, [attendanceList]);

  const handleSetAttendance = async (
    employeeId: string,
    status: "PRESENT" | "HALF_DAY" | "ABSENT" | "ON_LEAVE"
  ) => {
    try {
      const payload: RecordAttendancePayload = {
        employee_id: employeeId,
        attendance_date: selectedDate,
        status,
        notes: "",
      };
      await api.recordAttendance(payload);
      const [attData, statsData] = await Promise.all([
        api.listAttendance(selectedDate),
        api.getStaffStats(),
      ]);
      setAttendanceList(attData);
      setStats(statsData);
      if (onRefreshAll) onRefreshAll();
    } catch (err) {
      alert("Error recording attendance: " + err);
    }
  };

  const handleMarkAllPresent = async () => {
    const activeStaff = employees.filter((e) => e.status === "ACTIVE");
    if (activeStaff.length === 0) return;

    try {
      setLoading(true);
      for (const emp of activeStaff) {
        await api.recordAttendance({
          employee_id: emp.id,
          attendance_date: selectedDate,
          status: "PRESENT",
          notes: "Quick Bulk Check-in",
        });
      }
      const [attData, statsData] = await Promise.all([
        api.listAttendance(selectedDate),
        api.getStaffStats(),
      ]);
      setAttendanceList(attData);
      setStats(statsData);
      if (onRefreshAll) onRefreshAll();
    } catch (err) {
      console.error("Bulk attendance failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddEmployee = () => {
    setEditingEmployee(null);
    setEmpForm({
      name: "",
      role: "",
      phone: "",
      email: "",
      monthly_salary: 0,
      salary_type: "MONTHLY",
      status: "ACTIVE",
      joining_date: formatLocalDate(),
      notes: "",
    });
    setIsEmployeeModalOpen(true);
  };

  const handleOpenEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpForm({
      id: emp.id,
      name: emp.name,
      role: emp.role,
      phone: emp.phone,
      email: emp.email,
      monthly_salary: emp.monthly_salary,
      salary_type: emp.salary_type,
      status: emp.status,
      joining_date: emp.joining_date,
      notes: emp.notes,
    });
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.name.trim()) return;

    try {
      await api.saveEmployee({
        ...empForm,
        id: editingEmployee ? editingEmployee.id : null,
      });
      setIsEmployeeModalOpen(false);
      await loadData();
      if (onRefreshAll) onRefreshAll();
    } catch (err) {
      alert("Failed to save employee: " + err);
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    const ok = await appleConfirm({
      title: "Remove Employee",
      message: `Remove employee ${name}?`,
      confirmText: "Remove",
      isDestructive: true,
    });
    if (ok) {
      try {
        await api.deleteEmployee(id);
        await loadData();
        if (onRefreshAll) onRefreshAll();
      } catch (err) {
        alert("Failed to delete employee: " + err);
      }
    }
  };

  const handleOpenPaySalary = (emp?: Employee) => {
    const activeEmployees = employees.filter((e) => e.status === "ACTIVE");
    const target = emp || activeEmployees[0] || employees[0];
    if (!target) return;

    const primaryBank = bankAccounts.find((b) => b.is_primary) || bankAccounts[0];
    setPayForm({
      employee_id: target.id,
      amount: target.monthly_salary,
      payment_source: "CASH",
      bank_account_id: primaryBank?.id || null,
      payment_date: formatLocalDate(),
      for_month: formatLocalDate().slice(0, 7),
      days_present: 30,
      bonus: 0,
      deductions: 0,
      reference: "",
      notes: `Salary for ${target.name}`,
    });
    setIsPayModalOpen(true);
  };

  const handleConfirmPaySalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.employee_id) return;
    const finalAmount = payForm.amount + (payForm.bonus || 0) - (payForm.deductions || 0);
    if (finalAmount <= 0) {
      alert("Net payable salary must be greater than zero.");
      return;
    }

    try {
      const voucher = await api.paySalary({
        ...payForm,
        amount: finalAmount,
      });

      setIsPayModalOpen(false);
      setViewingVoucher(voucher);
      await loadData();
      if (onRefreshAll) onRefreshAll();
    } catch (err) {
      alert("Payroll error: " + err);
    }
  };

  const filteredEmployees = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    return employees.filter((e) => {
      const matchesRole = filterRole === "ALL" || e.role === filterRole;
      if (!matchesRole) return false;
      if (!term) return true;
      return (
        e.name.toLowerCase().includes(term) ||
        e.role.toLowerCase().includes(term) ||
        e.phone.toLowerCase().includes(term)
      );
    });
  }, [employees, filterRole, searchQuery]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto select-none">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.07]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Staff & Payroll
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Daily attendance check-ins, employee roster, and salary disbursements
          </p>
        </div>

        <div className="flex items-center gap-2">
          {subTab === "attendance" && (
            <button
              onClick={handleMarkAllPresent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold shadow-2xs transition apple-press"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#34C759]" />
              <span>Mark All Present</span>
            </button>
          )}

          {subTab === "employees" && (
            <button
              onClick={handleOpenAddEmployee}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ New Employee</span>
            </button>
          )}

          <button
            onClick={() => handleOpenPaySalary()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Pay Salary</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="apple-card p-4 rounded-2xl">
          <div className="text-[11px] font-medium text-[#86868B]">Active Staff</div>
          <div className="text-xl font-bold font-mono text-[#1D1D1F] mt-0.5">
            {stats?.total_active_employees ?? employees.filter((e) => e.status === "ACTIVE").length}
          </div>
        </div>

        <div className="apple-card p-4 rounded-2xl">
          <div className="text-[11px] font-medium text-[#86868B]">Present Today</div>
          <div className="text-xl font-bold font-mono text-[#34C759] mt-0.5">
            {stats?.present_today ?? attendanceList.filter((a) => a.status === "PRESENT").length}
          </div>
        </div>

        <div className="apple-card p-4 rounded-2xl">
          <div className="text-[11px] font-medium text-[#86868B]">Monthly Payroll</div>
          <div className="text-xl font-bold font-mono text-[#1D1D1F] mt-0.5">
            {formatCurrency(stats?.total_monthly_payroll_due ?? 0)}
          </div>
        </div>

        <div className="apple-card p-4 rounded-2xl">
          <div className="text-[11px] font-medium text-[#86868B]">Vouchers Issued</div>
          <div className="text-xl font-bold font-mono text-[#1D1D1F] mt-0.5">
            {vouchers.length}
          </div>
        </div>
      </div>

      {/* Segmented Switcher & Date Picker */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl apple-card shrink-0">
        <div className="flex items-center p-0.5 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs">
          <button
            onClick={() => setSubTab("attendance")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              subTab === "attendance"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Attendance
          </button>
          <button
            onClick={() => setSubTab("employees")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              subTab === "employees"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Roster ({employees.length})
          </button>
          <button
            onClick={() => setSubTab("vouchers")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              subTab === "vouchers"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Payroll Vouchers ({vouchers.length})
          </button>
        </div>

        {subTab === "attendance" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#86868B] font-medium">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-black"
            />
          </div>
        )}

        {subTab === "employees" && (
          <div className="flex items-center gap-2">
            <div className="relative min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl pl-8 pr-2.5 py-1 text-xs text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-black"
              />
            </div>
            <AppleSelect
              value={filterRole}
              onChange={setFilterRole}
              options={[
                { value: "ALL", label: "All Roles" },
                ...Array.from(new Set(employees.map((e) => e.role.trim()).filter(Boolean))).map((r) => ({
                  value: r,
                  label: r,
                })),
              ]}
              className="w-32"
              buttonClassName="bg-[#F5F5F7] py-1"
            />
          </div>
        )}
      </div>

      {/* SUBTAB 1: Attendance Roster */}
      {subTab === "attendance" && (
        <div className="apple-card rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black/[0.06] bg-[#FBFBFC] text-[#86868B] font-semibold text-[11px]">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Status for {selectedDate}</th>
                <th className="py-3 px-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#86868B] text-xs">
                    Loading attendance records...
                  </td>
                </tr>
              ) : (
                employees
                  .filter((e) => e.status === "ACTIVE")
                  .map((emp) => {
                  const record = attendanceMap.get(emp.id);
                  const status = record?.status || "NOT_RECORDED";

                  return (
                    <tr key={emp.id} className="hover:bg-[#FBFBFC] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#1D1D1F]">
                        {emp.name}
                      </td>
                      <td className="py-3.5 px-3 text-[#6E6E73]">
                        {emp.role}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            status === "PRESENT"
                              ? "bg-[#34C759]/10 text-[#34C759]"
                              : status === "HALF_DAY"
                              ? "bg-[#FF9500]/10 text-[#FF9500]"
                              : status === "ABSENT"
                              ? "bg-[#FF3B30]/10 text-[#FF3B30]"
                              : "bg-black/[0.04] text-[#86868B]"
                          }`}
                        >
                          {status === "NOT_RECORDED" ? "Pending Check-in" : status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleSetAttendance(emp.id, "PRESENT")}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                              status === "PRESENT"
                                ? "bg-[#34C759] text-black"
                                : "bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]"
                            }`}
                          >
                            Present
                          </button>
                          <button
                            onClick={() => handleSetAttendance(emp.id, "HALF_DAY")}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                              status === "HALF_DAY"
                                ? "bg-[#FF9500] text-black"
                                : "bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]"
                            }`}
                          >
                            Half-Day
                          </button>
                          <button
                            onClick={() => handleSetAttendance(emp.id, "ABSENT")}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                              status === "ABSENT"
                                ? "bg-[#FF3B30] text-white"
                                : "bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]"
                            }`}
                          >
                            Absent
                          </button>
                          <button
                            onClick={() => handleSetAttendance(emp.id, "ON_LEAVE")}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                              status === "ON_LEAVE"
                                ? "bg-[#0071E3] text-white"
                                : "bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]"
                            }`}
                          >
                            Leave
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBTAB 2: Employee List */}
      {subTab === "employees" && (
        <div className="apple-card rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black/[0.06] bg-[#FBFBFC] text-[#86868B] font-semibold text-[11px]">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Phone</th>
                <th className="py-3 px-3 text-right">Monthly Base</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-[#FBFBFC] transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-[#1D1D1F]">
                    {emp.name}
                  </td>
                  <td className="py-3.5 px-3 text-[#6E6E73]">
                    {emp.role}
                  </td>
                  <td className="py-3.5 px-3 text-[#6E6E73]">
                    {emp.phone || "—"}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-[#1D1D1F]">
                    {formatCurrency(emp.monthly_salary)}
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        emp.status === "ACTIVE"
                          ? "bg-[#34C759]/10 text-[#34C759]"
                          : "bg-black/[0.05] text-[#86868B]"
                      }`}
                    >
                      {emp.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenPaySalary(emp)}
                        className="px-2.5 py-1 rounded-lg bg-[#0071E3] text-white hover:bg-[#0077ED] text-[11px] font-semibold transition apple-press"
                      >
                        Disburse
                      </button>
                      <button
                        onClick={() => handleOpenEditEmployee(emp)}
                        className="p-1.5 rounded-lg text-[#6E6E73] hover:text-black"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                        className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#FF3B30]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBTAB 3: Payroll Vouchers */}
      {subTab === "vouchers" && (
        <div className="apple-card rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black/[0.06] bg-[#FBFBFC] text-[#86868B] font-semibold text-[11px]">
                <th className="py-3 px-4">Voucher #</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Employee</th>
                <th className="py-3 px-3">Month</th>
                <th className="py-3 px-3 text-right">Net Amount</th>
                <th className="py-3 px-4 text-right">Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {vouchers.map((v) => (
                <tr key={v.id} className="hover:bg-[#FBFBFC] transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#1D1D1F]">
                    {v.voucher_number}
                  </td>
                  <td className="py-3.5 px-3 text-[#6E6E73]">
                    {v.payment_date}
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-[#1D1D1F]">
                    {v.employee_name}
                  </td>
                  <td className="py-3.5 px-3 text-[#6E6E73]">
                    {v.for_month}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-[#34C759]">
                    {formatCurrency(v.amount)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setViewingVoucher(v)}
                      className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#EBEBED] text-[11px] font-medium"
                    >
                      Print Slip
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE / EDIT EMPLOYEE MODAL */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB]">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  {editingEmployee ? "Edit Staff" : "New Staff"}
                </h3>
                <p className="text-[11px] text-neutral-400">Employee profile &amp; payroll</p>
              </div>
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marcus Vance"
                  value={empForm.name}
                  onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Role / Position
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cashier"
                    value={empForm.role}
                    onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Base Salary ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={empForm.monthly_salary}
                    onChange={(e) => setEmpForm({ ...empForm, monthly_salary: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={empForm.phone}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    value={empForm.joining_date}
                    onChange={(e) => setEmpForm({ ...empForm, joining_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Salary Type
                  </label>
                  <select
                    value={empForm.salary_type}
                    onChange={(e) => setEmpForm({ ...empForm, salary_type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Status
                  </label>
                  <select
                    value={empForm.status}
                    onChange={(e) => setEmpForm({ ...empForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="staff@company.com"
                    value={empForm.email}
                    onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Optional notes"
                    value={empForm.notes}
                    onChange={(e) => setEmpForm({ ...empForm, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/[0.1] text-xs font-semibold text-black bg-white hover:bg-neutral-100 cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  Save Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISBURSE SALARY MODAL */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.08] overflow-visible animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB] rounded-t-3xl">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  Disburse Salary
                </h3>
                <p className="text-[11px] text-neutral-400">Payroll settlement</p>
              </div>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPaySalary} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Employee *
                </label>
                <AppleSelect
                  value={payForm.employee_id}
                  onChange={(val) => {
                    const found = employees.find((x) => x.id === val);
                    setPayForm({
                      ...payForm,
                      employee_id: val,
                      amount: found ? found.monthly_salary : 0,
                    });
                  }}
                  options={employees
                    .filter((e) => e.status === "ACTIVE")
                    .map((e) => ({
                      value: e.id,
                      label: `${e.name} (${e.role} - Base: ${formatCurrency(e.monthly_salary)})`,
                    }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Month
                  </label>
                  <input
                    type="month"
                    value={payForm.for_month}
                    onChange={(e) => setPayForm({ ...payForm, for_month: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Salary ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Days Present
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={payForm.days_present}
                    onChange={(e) => setPayForm({ ...payForm, days_present: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Bonus ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payForm.bonus}
                    onChange={(e) => setPayForm({ ...payForm, bonus: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Deductions ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payForm.deductions}
                    onChange={(e) => setPayForm({ ...payForm, deductions: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono text-black focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={payForm.payment_date}
                    onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Reference
                  </label>
                  <input
                    type="text"
                    placeholder="Ref / Txn #"
                    value={payForm.reference}
                    onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs text-black focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional voucher notes"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs text-black focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Payment Source
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayForm({ ...payForm, payment_source: "CASH" })}
                    className={`py-2 rounded-full border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      payForm.payment_source === "CASH"
                        ? "bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-sm"
                        : "bg-[#F9FAFB] text-neutral-600 border-black/[0.08] hover:text-black"
                    }`}
                  >
                    Cash Drawer
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayForm({ ...payForm, payment_source: "BANK" })}
                    className={`py-2 rounded-full border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      payForm.payment_source === "BANK"
                        ? "bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-sm"
                        : "bg-[#F9FAFB] text-neutral-600 border-black/[0.08] hover:text-black"
                    }`}
                  >
                    Bank
                  </button>
                </div>
                {payForm.payment_source === "BANK" && bankAccounts.length > 0 && (
                  <div className="mt-2">
                    <AppleSelect
                      value={payForm.bank_account_id || ""}
                      onChange={(val) => setPayForm({ ...payForm, bank_account_id: val || null })}
                      options={bankAccounts.map((b) => ({
                        value: b.id,
                        label: `${b.account_name} (${formatCurrency(b.current_balance)})`,
                      }))}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/[0.1] text-xs font-semibold text-black bg-white hover:bg-neutral-100 cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  Issue Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE SALARY SLIP MODAL */}
      {viewingVoucher && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div data-printable="true" className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-black/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB] no-print">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  Salary Voucher
                </h3>
                <p className="text-[11px] text-neutral-400 font-mono">{viewingVoucher.voucher_number}</p>
              </div>
              <button
                onClick={() => setViewingVoucher(null)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3 select-text font-mono text-xs">
              <div className="text-center pb-2 border-b border-black/[0.08]">
                <div className="font-bold text-sm font-sans text-black">{settings?.business_name || "LynTerminal"}</div>
                <div className="text-[10px] text-neutral-400">Salary Payment Voucher</div>
              </div>

              <div className="space-y-1 text-[11px] text-neutral-600">
                <div className="flex justify-between">
                  <span>VOUCHER:</span>
                  <span className="font-bold text-black">{viewingVoucher.voucher_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>EMPLOYEE:</span>
                  <span className="font-semibold text-black">{viewingVoucher.employee_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>MONTH:</span>
                  <span>{viewingVoucher.for_month}</span>
                </div>
                <div className="flex justify-between">
                  <span>SOURCE:</span>
                  <span>{viewingVoucher.payment_source}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-black/[0.08] flex justify-between items-baseline font-bold text-sm">
                <span>NET PAID:</span>
                <span className="text-base text-emerald-600 font-mono">
                  {formatCurrency(viewingVoucher.amount)}
                </span>
              </div>

              <div className="pt-4 flex gap-2 no-print">
                <button
                  onClick={() => printSection()}
                  className="flex-1 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  onClick={() => setViewingVoucher(null)}
                  className="flex-1 py-2.5 rounded-full border border-black/[0.1] text-xs font-semibold text-black bg-white hover:bg-neutral-100 cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
