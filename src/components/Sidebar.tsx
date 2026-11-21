import React from "react";
import {
  Zap,
  Package,
  Users,
  Receipt,
  Wallet,
  BarChart3,
  ShieldCheck,
  Settings as SettingsIcon,
  UserCheck,
  LayoutDashboard,
  HardDrive,
  Building2,
  FileSpreadsheet,
  Scale,
  ReceiptText,
  Key,
  AlertTriangle,
} from "lucide-react";
import { Logo } from "./Logo";
import type { LicenseStatus } from "../types";

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  lowStockCount?: number;
  showGst?: boolean;
  licenseStatus?: LicenseStatus | null;
  onOpenLicenseModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  lowStockCount = 0,
  showGst = false,
  licenseStatus,
  onOpenLicenseModal,
}) => {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, key: "1" },
    { id: "pos", label: "Register (POS)", icon: Zap, key: "F2", highlight: true },
    {
      id: "inventory",
      label: "Inventory",
      icon: Package,
      key: "3",
      count: lowStockCount > 0 ? lowStockCount : undefined,
    },
    { id: "parties", label: "Customers & Vendors", icon: Users, key: "4" },
    { id: "invoices", label: "Sales & Invoices", icon: Receipt, key: "5" },
    { id: "expenses", label: "Expenses", icon: Wallet, key: "6" },
    { id: "staff", label: "Staff & Payroll", icon: UserCheck, key: "7" },
    { id: "reports", label: "Financial Reports", icon: BarChart3, key: "8" },
    { id: "audit", label: "System & Audit", icon: ShieldCheck, key: "9" },
    { id: "settings", label: "Settings", icon: SettingsIcon, key: "0" },
  ];

  const gstNavItems = [
    { id: "gst_hub", label: "Tally ERP Hub", icon: Building2, key: "F1" },
    { id: "gst_pos", label: "GST POS Billing", icon: ReceiptText, key: "F8" },
    { id: "gst_credit", label: "Debtors & Creditors", icon: Users, key: "F6" },
    { id: "gstr1", label: "GSTR-1 Audit", icon: FileSpreadsheet, key: "G1" },
    { id: "gstr3b", label: "GSTR-3B Return", icon: Scale, key: "G3" },
  ];

  return (
    <aside className="hidden lg:flex w-64 bg-[#161618] border-r border-white/[0.08] flex-col justify-between shrink-0 select-none text-[#F5F5F7]">
      <div>
        {/* Top Brand header */}
        <div className="h-14 px-5 flex items-center border-b border-white/[0.08]">
          <Logo />
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-8.5rem)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all apple-press cursor-pointer ${
                  isActive
                    ? "bg-white text-black shadow-md font-bold"
                    : "text-[#A1A1A6] hover:text-[#F5F5F7] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? "text-black stroke-[2.5]" : "text-[#86868B]"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.count !== undefined && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white">
                      {item.count}
                    </span>
                  )}
                  <kbd
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                      isActive
                        ? "bg-black/10 text-black font-bold"
                        : "bg-white/[0.06] text-[#86868B]"
                    }`}
                  >
                    {item.key}
                  </kbd>
                </div>
              </button>
            );
          })}

          {/* India GST & Tally Section (Conditional: INR currency & GST Enabled) */}
          {showGst && (
            <>
              <div className="pt-3 pb-1 px-3 flex items-center justify-between border-t border-white/[0.08] mt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
                  India GST & Tally
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/10">
                  GST
                </span>
              </div>

              {gstNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all apple-press cursor-pointer ${
                      isActive
                        ? "bg-white text-black shadow-md font-bold"
                        : "text-[#A1A1A6] hover:text-[#F5F5F7] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive ? "text-black stroke-[2.5]" : "text-[#86868B]"
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>

                    <kbd
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        isActive
                          ? "bg-black/10 text-black font-bold"
                          : "bg-white/[0.06] text-[#86868B]"
                      }`}
                    >
                      {item.key}
                    </kbd>
                  </button>
                );
              })}
            </>
          )}
        </nav>
      </div>

      {/* Terminal Info Footer & License Badge */}
      <div className="p-3.5 border-t border-white/[0.08] bg-black/20 space-y-2">
        {licenseStatus && licenseStatus.platform !== "linux" && (
          <button
            onClick={onOpenLicenseModal}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition apple-press cursor-pointer ${
              licenseStatus.is_licensed
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                : licenseStatus.is_expired
                ? "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25 animate-pulse"
                : "bg-white/10 text-white border-white/15 hover:bg-white/20"
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {licenseStatus.is_licensed ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Licensed</span>
                </>
              ) : licenseStatus.is_expired ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="truncate">Expired</span>
                </>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5 text-white shrink-0" />
                  <span className="truncate">Trial</span>
                </>
              )}
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 shrink-0">
              {licenseStatus.is_licensed ? "ACTIVE" : `${licenseStatus.days_remaining}d`}
            </span>
          </button>
        )}

        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-8 h-8 rounded-xl bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-[#86868B]">
            <HardDrive className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-[#F5F5F7] truncate">
              Local SQLite Engine
            </span>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              100% Offline & Private
            </span>
          </div>
        </div>
      </div>

    </aside>
  );
};
