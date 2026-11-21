import React, { useState } from "react";
import {
  Key,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";
import { api } from "../services/api";
import type { LicenseStatus } from "../types";

interface TrialActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenseStatus: LicenseStatus | null;
  onActivated: (updated: LicenseStatus) => void;
}

export const TrialActivationModal: React.FC<TrialActivationModalProps> = ({
  isOpen,
  onClose,
  licenseStatus,
  onActivated,
}) => {
  const [licenseKeyInput, setLicenseKeyInput] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("key_input");
      if (p) return p;
    }
    return "";
  });
  const [customerEmail, setCustomerEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  if (!isOpen) return null;

  const isExpired = licenseStatus?.is_expired ?? false;
  const isLicensed = licenseStatus?.is_licensed ?? false;
  const daysRemaining = licenseStatus?.days_remaining ?? 14;
  const daysElapsed = licenseStatus?.days_elapsed ?? 0;

  const handleOpenStore = async () => {
    const url = "https://lynterminal.wintershogun.tech/pricing?checkout=windows";
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = licenseKeyInput.trim().toUpperCase().replace(/ /g, "-");
    if (!key) {
      setErrorMessage("Please enter your commercial license key.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await api.activateLicense(key, customerEmail.trim() || undefined);
      if (updated.is_licensed) {
        setSuccessMessage("Perpetual Commercial License successfully activated offline!");
        onActivated(updated);
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setErrorMessage("License could not be verified. Please check the characters.");
      }
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.message || "Failed to activate license key.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyExistingKey = () => {
    if (licenseStatus?.license_key) {
      navigator.clipboard.writeText(licenseStatus.license_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-black/[0.08] text-black overflow-hidden max-h-[92vh] flex flex-col lux-modal-card">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-black rounded-full bg-black/5 hover:bg-black/10 transition-colors cursor-pointer"
          title="Close"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="overflow-y-auto pr-1">
          {/* Header Status Crest */}
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                isLicensed
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                  : isExpired
                  ? "bg-red-50 text-red-600 border-red-200"
                  : "bg-black/5 text-black border-black/10"
              }`}
            >
              {isLicensed ? (
                <ShieldCheck className="w-5 h-5" />
              ) : isExpired ? (
                <Lock className="w-5 h-5" />
              ) : (
                <Key className="w-5 h-5" />
              )}
            </div>

            <div>
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isLicensed
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : isExpired
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-black/5 text-black border-black/10"
                }`}
              >
                {isLicensed
                  ? "COMMERCIAL LICENSE ACTIVE"
                  : isExpired
                  ? "TRIAL EXPIRED"
                  : `14-DAY TRIAL • ${daysRemaining} DAYS LEFT`}
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-black tracking-tight mt-0.5">
                {isLicensed
                  ? "Commercial License Active"
                  : isExpired
                  ? "Trial Expired"
                  : "14-Day Free Trial"}
              </h2>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed mb-5">
            {isLicensed
              ? "Perpetual commercial license active on this workstation. Unlimited offline access."
              : isExpired
              ? "Trial expired. Enter license key to unlock billing."
              : `Day ${daysElapsed + 1} of 14. All features unlocked.`}
          </p>

          {/* Notice Banner */}
          {isExpired && !isLicensed && (
            <div className="mb-5 rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-semibold text-black">Billing Locked:</strong> Enter license key below to resume. Past invoices remain safe.
              </div>
            </div>
          )}

          {/* Already Licensed Info Box */}
          {isLicensed ? (
            <div className="rounded-2xl bg-[#F9FAFB] border border-black/[0.06] p-4 sm:p-5 mb-5 space-y-3 font-mono text-xs text-black">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 text-[11px]">TIER:</span>
                <span className="font-bold text-black text-[11px]">
                  {licenseStatus?.license_tier || "Commercial Lifetime"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 text-[11px]">LICENSE KEY:</span>
                <div className="flex items-center gap-1.5 font-bold text-black">
                  <span>{licenseStatus?.license_key || "LYN-COMM-XXXX-XXXX-XXXX-XXXX"}</span>
                  <button
                    onClick={handleCopyExistingKey}
                    className="p-1 rounded bg-black/5 hover:bg-black/10 border border-black/10 text-black cursor-pointer"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-500">
                <span>VERIFICATION:</span>
                <span className="text-emerald-600 font-semibold">100% Offline SHA-256</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Option A: Buy License on Website */}
              <div className="rounded-2xl bg-[#F9FAFB] border border-black/[0.06] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500 block mb-0.5">
                    COMMERCIAL LICENSE
                  </span>
                  <h3 className="text-sm font-bold text-black">
                    Buy License (₹1,800 / $20)
                  </h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    One-time payment. Instant key sent to your email.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenStore}
                  className="w-full sm:w-auto h-10 px-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold uppercase tracking-wider text-xs inline-flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <span>Buy Online</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Option B: Enter Existing Key */}
              <div className="rounded-2xl border border-black/[0.06] p-4 sm:p-5 bg-[#F9FAFB]">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-black block mb-1">
                  Activate License
                </span>
                <p className="text-[11px] text-neutral-500 mb-3">
                  Enter the key from your purchase receipt.
                </p>

                <form onSubmit={handleActivate} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      License Key *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="LYN-COMM-XXXX-XXXX-XXXX-XXXX"
                      value={licenseKeyInput}
                      onChange={(e) => {
                        setLicenseKeyInput(e.target.value.toUpperCase());
                        setErrorMessage(null);
                      }}
                      className="w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-xs font-mono text-black placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-black focus:ring-1 focus:ring-black/20 bg-white transition-colors uppercase tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      Owner Email <span className="text-neutral-500 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="store@business.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full rounded-xl border border-black/10 px-3.5 py-2 text-xs text-black placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-black focus:ring-1 focus:ring-black/20 bg-white transition-colors"
                    />
                  </div>

                  {errorMessage && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs flex items-center gap-2 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 cursor-pointer shadow-md mt-2"
                  >
                    {isSubmitting ? (
                      <span>Verifying Key...</span>
                    ) : (
                      <>
                        <span>Activate License</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-black/[0.06] flex items-center justify-between text-[11px] text-neutral-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Offline SHA-256 Verification</span>
          </div>
          <div>
            Support: <a href="mailto:support@wintershogun.tech" className="text-black hover:underline">support@wintershogun.tech</a>
          </div>
        </div>
      </div>
    </div>
  );
};
