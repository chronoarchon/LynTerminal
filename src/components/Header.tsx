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
  const [customLogo, setCustomLogo] = React.useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("lynterminal_custom_logo");
    }
    return null;
  });

  React.useEffect(() => {
    const handleLogoUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      setCustomLogo(customEvent.detail || null);
    };
    window.addEventListener("lynterminal_logo_updated", handleLogoUpdate);
    return () => window.removeEventListener("lynterminal_logo_updated", handleLogoUpdate);
  }, []);

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

        <div
          className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#F5F5F7] border border-black/[0.05] group transition cursor-pointer hover:bg-neutral-200/70"
          title="Store Profile & Logo Active (Ctrl+V anywhere to paste image)"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("lynterminal_open_image_paste"));
          }}
        >
          <div className="w-2 h-2 rounded-full bg-[#34C759]" />
          {customLogo ? (
            <img
              src={customLogo}
              alt="Store Logo"
              className="w-4 h-4 rounded-md object-cover border border-black/10 shrink-0 shadow-2xs"
            />
          ) : (
            <Store className="w-3.5 h-3.5 text-[#6E6E73] shrink-0" />
          )}
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
        {/* Trial & License Badge — hidden on Linux (community edition is free) */}
        {licenseStatus && licenseStatus.platform !== "linux" && (
          <button
            onClick={onOpenLicenseModal}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition apple-press cursor-pointer ${
              licenseStatus.is_licensed
                ? "bg-white text-emerald-600 border-emerald-200 hover:bg-neutral-50 shadow-2xs"
                : licenseStatus.is_expired
                ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                : "bg-white text-black border-black/10 hover:bg-neutral-50 shadow-2xs"
            }`}
            title="Commercial License"
          >
            {licenseStatus.is_licensed ? (
              <>
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Licensed</span>
              </>
            ) : licenseStatus.is_expired ? (
              <>
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <span>Trial Expired</span>
              </>
            ) : (
              <>
                <Key className="w-3 h-3 text-neutral-600" />
                <span>Trial · {licenseStatus.days_remaining}d Left</span>
              </>
            )}
          </button>
        )}

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-500 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold uppercase tracking-wider shadow-xs transition apple-press cursor-pointer"
          title="Open Register (F2)"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Sale</span>
          <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[9px] font-mono text-white">
            F2
          </kbd>
        </button>
      </div>
    </header>
  );
};

