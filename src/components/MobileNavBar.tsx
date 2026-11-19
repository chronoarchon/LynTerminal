import React, { useState } from "react";
import {
  Zap,
  Package,
  Receipt,
  Users,
  Grid,
  Wallet,
  UserCheck,
  BarChart3,
  ShieldCheck,
  Settings as SettingsIcon,
  X,
  Store,
  Building2,
  FileSpreadsheet,
  Scale,
} from "lucide-react";

interface MobileNavBarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  lowStockCount?: number;
  showGst?: boolean;
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({
  activeTab,
  onSelectTab,
  lowStockCount = 0,
  showGst = false,
}) => {
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  const mainTabs = [
    { id: "pos", label: "Register", icon: Zap },
    {
      id: "inventory",
      label: "Inventory",
      icon: Package,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    { id: "invoices", label: "Invoices", icon: Receipt },
    { id: "parties", label: "Contacts", icon: Users },
  ];

  const secondaryModules = [
    {
      id: "dashboard",
      label: "Dashboard",
      description: "Overview, cash balances & store KPIs",
      icon: Store,
    },
    {
      id: "expenses",
      label: "Expenses",
      description: "Store operating expenses & recurring bills",
      icon: Wallet,
    },
    {
      id: "staff",
      label: "Staff & Payroll",
      description: "Daily attendance, staff roster & salary vouchers",
      icon: UserCheck,
    },
    {
      id: "reports",
      label: "Financial Reports",
      description: "Daily cash daybook, P&L statement, stock valuation",
      icon: BarChart3,
    },
    {
      id: "audit",
      label: "System & Backups",
      description: "Audit trail, database maintenance & snapshots",
      icon: ShieldCheck,
    },
    {
      id: "settings",
      label: "Store Settings",
      description: "Business profile, currencies, tax presets & printer",
      icon: SettingsIcon,
    },
    ...(showGst
      ? [
          {
            id: "gst_hub",
            label: "Tally Gateway Hub",
            description: "F4-F9 accounting vouchers & GST duties ledger",
            icon: Building2,
          },
          {
            id: "gst_pos",
            label: "GST POS Billing",
            description: "Rule 46 CGST/SGST/IGST tax invoices",
            icon: Zap,
          },
          {
            id: "gst_credit",
            label: "Debtors & Creditors",
            description: "Sundry aging & bill-by-bill reconciliation",
            icon: Users,
          },
          {
            id: "gstr1",
            label: "GSTR-1 Monthly Return",
            description: "Outward supply return & GSTN portal JSON",
            icon: FileSpreadsheet,
          },
          {
            id: "gstr3b",
            label: "GSTR-3B Self-Return",
            description: "Monthly return with Input Tax Credit set-off",
            icon: Scale,
          },
        ]
      : []),
  ];

  const isMoreActive = [
    "dashboard",
    "expenses",
    "staff",
    "reports",
    "audit",
    "settings",
    "gst_hub",
    "gst_pos",
    "gst_credit",
    "gstr1",
    "gstr3b",
  ].includes(activeTab);

  return (
    <>
      {/* Bottom Tab Bar (iOS Apple HIG style) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-black/[0.08] safe-bottom select-none">
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-2">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  onSelectTab(tab.id);
                  setIsMoreSheetOpen(false);
                }}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition apple-press relative ${
                  isActive ? "text-[#0071E3]" : "text-[#86868B]"
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isActive ? "scale-105 stroke-[2.3]" : "stroke-[1.8]"
                    }`}
                  />
                  {tab.badge !== undefined && (
                    <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-[#FF3B30] text-black text-[9px] font-bold flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-0.5 tracking-tight ${
                    isActive ? "font-semibold" : "font-normal"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* More Sheet Trigger */}
          <button
            onClick={() => setIsMoreSheetOpen(!isMoreSheetOpen)}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition apple-press relative ${
              isMoreActive ? "text-[#0071E3]" : "text-[#86868B]"
            }`}
          >
            <Grid
              className={`w-5 h-5 transition-transform ${
                isMoreActive ? "scale-105 stroke-[2.3]" : "stroke-[1.8]"
              }`}
            />
            <span
              className={`text-[10px] mt-0.5 tracking-tight ${
                isMoreActive ? "font-semibold" : "font-normal"
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* Obsidian Luxury Bottom Sheet for "More" Navigation */}
      {isMoreSheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col justify-end"
          onClick={() => setIsMoreSheetOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto border-t border-black/[0.08] shadow-2xl p-5 pb-8 safe-bottom animate-in slide-in-from-bottom duration-200 text-black"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4 px-1">
              <div>
                <h3 className="text-base font-bold text-black tracking-tight">
                  Modules
                </h3>
                <p className="text-xs text-neutral-400">
                  Store sections
                </p>
              </div>
              <button
                onClick={() => setIsMoreSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-neutral-400 hover:text-black hover:bg-black/5 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {secondaryModules.map((mod) => {
                const Icon = mod.icon;
                const isActive = activeTab === mod.id;

                return (
                  <button
                    key={mod.id}
                    onClick={() => {
                      onSelectTab(mod.id);
                      setIsMoreSheetOpen(false);
                    }}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl text-left border transition cursor-pointer ${
                      isActive
                        ? "bg-white text-black border-white shadow-md font-bold"
                        : "bg-white text-black border-black/[0.08] hover:border-white/30"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-black text-white"
                          : "bg-[#F9FAFB] text-black"
                      }`}
                    >
                      <Icon className="w-4 h-4 stroke-[2]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs tracking-tight">
                        {mod.label}
                      </div>
                      <div
                        className={`text-[11px] mt-0.5 line-clamp-1 ${
                          isActive ? "text-neutral-700" : "text-neutral-400"
                        }`}
                      >
                        {mod.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
