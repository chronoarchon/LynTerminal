import React from "react";
import {
  Plus,
  Store,
  Calendar,
  CheckCircle2,
  Lock,
  Key,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import type { Settings, LicenseStatus } from "../types";
import { Logo } from "./Logo";
import { useCurrency } from "../context/CurrencyContext";

interface HeaderProps {
  settings: Settings | null;
  licenseStatus?: LicenseStatus | null;
  onOpenQuickSale: () => void;
  onLockApp?: () => void;
  onOpenLicenseModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  licenseStatus,
  onOpenQuickSale,
  onLockApp,
  onOpenLicenseModal,
}) => {
  const { currencyCode } = useCurrency();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="h-14 border-b border-black/[0.07] bg-white px-4 sm:px-6 flex items-center justify-between select-none shrink-0 z-20">
      {/* Left: Mobile Brand / Store Identifier */}
      <div className="flex items-center gap-3">
        <div className="lg:hidden">
          <Logo showText={false} size={28} light />
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#F5F5F7] border border-black/[0.05]">
          <div className="w-2 h-2 rounded-full bg-[#34C759] shadow-[0_0_6px_rgba(52,199,89,0.6)]" />
          <Store className="w-3.5 h-3.5 text-[#6E6E73]" />
          <span className="text-xs font-semibold text-[#1D1D1F] max-w-[140px] sm:max-w-[200px] truncate">
            {settings?.business_name || "LynTerminal Store"}
          </span>
          <span className="text-[10px] text-[#6E6E73] font-mono font-medium bg-white px-1.5 py-0.5 rounded border border-black/[0.06]">
            {currencyCode || settings?.currency_code || "USD"}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-xs text-[#86868B] font-medium ml-2">
          <Calendar className="w-3.5 h-3.5 text-[#86868B]" />
          <span>{today}</span>
        </div>
      </div>

      {/* Right Controls: Trial / License Badge + Offline Status + Actions */}
      <div className="flex items-center gap-2.5">
        {/* Trial & License Badge */}
        {licenseStatus && (
          <button
            onClick={onOpenLicenseModal}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition apple-press cursor-pointer ${
              licenseStatus.is_licensed
                ? "bg-[#13151a] text-emerald-400 border-emerald-500/30 hover:bg-[#181a21]"
                : licenseStatus.is_expired
                ? "bg-[#181a21] text-red-400 border-red-500/40 animate-pulse"
                : "bg-[#13151a] text-white border-white/20 hover:bg-[#181a21]"
            }`}
            title="Commercial License"
          >
            {licenseStatus.is_licensed ? (
              <>
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Licensed</span>
              </>
            ) : licenseStatus.is_expired ? (
              <>
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <span>Trial Expired</span>
              </>
            ) : (
              <>
                <Key className="w-3 h-3 text-neutral-400" />
                <span>Trial · {licenseStatus.days_remaining}d Left</span>
              </>
            )}
          </button>
        )}

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-500 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Offline & Private</span>
        </div>

        {onLockApp && (
          <button
            onClick={onLockApp}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
            title="Lock Workstation (Ctrl+L)"
          >
            <Lock className="w-3.5 h-3.5 text-neutral-600" />
            <span className="hidden sm:inline">Lock</span>
            <kbd className="hidden md:inline-block ml-0.5 px-1 py-0.5 bg-black/[0.05] rounded text-[9px] font-mono text-neutral-500">
              Ctrl+L
            </kbd>
          </button>
        )}

        <button
          onClick={onOpenQuickSale}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold uppercase tracking-wider shadow-sm transition apple-press cursor-pointer"
          title="Open Register (F2)"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Sale</span>
          <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 bg-black/10 rounded text-[9px] font-mono text-black">
            F2
          </kbd>
        </button>
      </div>
    </header>
  );
};

