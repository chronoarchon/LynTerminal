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
  Sparkles,
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
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-black/[0.08] text-[#1D1D1F] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-[#86868B] hover:text-[#1D1D1F] rounded-full bg-black/[0.04] hover:bg-black/[0.08] transition-colors cursor-pointer"
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
                  ? "bg-rose-50 text-rose-600 border-rose-200"
                  : "bg-blue-50 text-[#0071E3] border-blue-200"
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
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : isExpired
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-blue-50 text-[#0071E3] border-blue-200"
                }`}
              >
                {isLicensed
                  ? "Active Commercial License"
                  : isExpired
                  ? "14-Day Trial Expired"
                  : `14-Day Free Trial • ${daysRemaining} Days Left`}
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#1D1D1F] tracking-tight mt-0.5">
                {isLicensed
                  ? "Commercial License Active"
                  : isExpired
                  ? "Trial Expired — Activate License"
                  : "LynTerminal Evaluation Period"}
              </h2>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-[#515154] leading-relaxed mb-5">
            {isLicensed
              ? "Your perpetual commercial license is registered locally in SQLite WAL on this workstation. Enjoy unrestricted offline billing, inventory management, and reports with zero monthly rent forever."
              : isExpired
              ? "Your 14-day free trial has concluded. In order to continue issuing sales receipts, creating invoices, and managing inventory, please activate your perpetual commercial license below."
              : `You are currently on day ${daysElapsed + 1} of your 14-day unrestricted evaluation trial. All POS features, GST invoices, and reports are fully unlocked. You may activate your permanent license key at any time.`}
          </p>

          {/* Notice Banner */}
          {isExpired && !isLicensed && (
            <div className="mb-5 rounded-2xl bg-rose-50/80 border border-rose-200 p-4 text-xs text-rose-900 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>New Counter Billing Locked:</strong> Past receipts and financial reports remain completely accessible and safe. To unlock instant register billing, enter your offline key below.
              </div>
            </div>
          )}

          {/* Already Licensed Info Box */}
          {isLicensed ? (
            <div className="rounded-2xl bg-[#F5F5F7] border border-black/[0.08] p-4 sm:p-5 mb-5 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#86868B] text-[11px]">LICENSE TIER:</span>
                <span className="font-bold text-[#1D1D1F] text-[11px]">
                  {licenseStatus?.license_tier || "Commercial Windows Lifetime"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#86868B] text-[11px]">LICENSE KEY:</span>
                <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                  <span>{licenseStatus?.license_key || "LYN-COMM-XXXX-XXXX-XXXX-XXXX"}</span>
                  <button
                    onClick={handleCopyExistingKey}
                    className="p-1 rounded bg-white hover:bg-black/[0.05] border border-black/[0.06] text-[#515154] cursor-pointer"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#86868B]">
                <span>VERIFICATION:</span>
                <span className="text-emerald-600 font-semibold">100% Offline Cryptographic SHA256</span>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Option A: Buy License on Website */}
              <div className="rounded-2xl bg-[#F5F5F7] border border-black/[0.08] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0071E3] block mb-0.5">
                    Need a License Key?
                  </span>
                  <h3 className="text-sm font-bold text-[#1D1D1F]">
                    Acquire Commercial License (₹1,800 / $20)
                  </h3>
                  <p className="text-[11px] text-[#6E6E73] mt-0.5">
                    One-time payment • Pay once, own forever • Instant key sent to your email.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenStore}
                  className="w-full sm:w-auto h-10 px-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <span>Buy on Website</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Option B: Enter Existing Key */}
              <div className="rounded-2xl border border-black/[0.08] p-4 sm:p-5 bg-white">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#1D1D1F] block mb-1">
                  Activate with Existing Key
                </span>
                <p className="text-[11px] text-[#6E6E73] mb-3">
                  Enter the key you received after checkout on wintershogun.tech. It verifies mathematically without cloud connectivity.
                </p>

                <form onSubmit={handleActivate} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1D1D1F] mb-1">
                      Commercial License Key <span className="text-[#0071E3]">*</span>
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
                      className="w-full rounded-xl border border-black/[0.12] px-3.5 py-2.5 text-xs font-mono text-[#1D1D1F] placeholder-[#86868B] focus:outline-hidden focus:border-[#0071E3] bg-[#FBFBFD] transition-colors uppercase tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#1D1D1F] mb-1">
                      Registered Owner Email <span className="text-[#86868B] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="store@business.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full rounded-xl border border-black/[0.12] px-3.5 py-2 text-xs text-[#1D1D1F] placeholder-[#86868B] focus:outline-hidden focus:border-[#0071E3] bg-[#FBFBFD] transition-colors"
                    />
                  </div>

                  {errorMessage && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 rounded-full bg-[#1D1D1F] hover:bg-[#2D2D2F] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 cursor-pointer shadow-xs mt-2"
                  >
                    {isSubmitting ? (
                      <span>Verifying Cryptographic Signature...</span>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Activate Perpetual License Offline</span>
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
        <div className="mt-4 pt-3 border-t border-black/[0.06] flex items-center justify-between text-[11px] text-[#86868B]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Air-Gapped Cryptographic Assurance</span>
          </div>
          <div>
            Support: <a href="mailto:support@wintershogun.tech" className="text-[#0071E3] hover:underline">support@wintershogun.tech</a>
          </div>
        </div>
      </div>
    </div>
  );
};
