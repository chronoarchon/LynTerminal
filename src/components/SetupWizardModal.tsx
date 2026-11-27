import React, { useState } from "react";
import {
  Shield,
  ServerOff,
  HardDrive,
  CheckCircle2,
  Store,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { api } from "../services/api";
import { gstApi } from "../modules/india_gst/gstApi";
import { useAppleDialog } from "./common/AppleDialog";
import { AppleSelect } from "./common/AppleSelect";

interface SetupWizardModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar ($)" },
  { code: "INR", symbol: "₹", name: "Indian Rupee (₹)" },
  { code: "EUR", symbol: "€", name: "Euro (€)" },
  { code: "GBP", symbol: "£", name: "British Pound (£)" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham (د.إ)" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar ($)" },
  { code: "AUD", symbol: "$", name: "Australian Dollar ($)" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen (¥)" },
  { code: "SGD", symbol: "$", name: "Singapore Dollar ($)" },
];

const QUICK_CURRENCY_CODES = ["USD", "INR", "EUR", "GBP"];

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const { alert } = useAppleDialog();

  // Streamlined 2-Step Flow: 1. Store Identity -> 2. Review & Launch
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Store & Currency
  const [businessName, setBusinessName] = useState("");
  const [businessTagline, setBusinessTagline] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [storeError, setStoreError] = useState("");

  // Step 2: Offline Privacy & Launch
  const [privacyAgreed, setPrivacyAgreed] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleStep1Next = () => {
    setStoreError("");
    if (!businessName.trim()) {
      setStoreError("Please enter your store or business name.");
      return;
    }
    setCurrentStep(2);
  };

  const handleFinalLaunch = async () => {
    try {
      setIsSubmitting(true);
      await api.completeSetup({
        username: "admin",
        password: "",
        recovery_code: "",
        business_name: businessName.trim() || "LynTerminal Store",
        tagline: businessTagline.trim() || "Retail & Business OS",
        currency_symbol: currencySymbol,
        currency_code: currencyCode,
      });

      const existingGst = await gstApi.getGstSettings().catch(() => null);
      if (existingGst) {
        await gstApi
          .saveGstSettings({
            ...existingGst,
            is_enabled: currencyCode === "INR",
          })
          .catch(() => {});
      }

      onComplete();
    } catch (err) {
      alert({
        title: "Setup Error",
        message: String(err),
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectCurrency = (code: string) => {
    const found = CURRENCIES.find((c) => c.code === code);
    if (found) {
      setCurrencyCode(found.code);
      setCurrencySymbol(found.symbol);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white text-black rounded-3xl shadow-2xl border border-black/[0.08] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 lux-modal-card">
        {/* Header & Minimal Step Indicator */}
        <div className="px-6 py-4 border-b border-black/[0.06] bg-[#FAFAFC] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#18191E] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              L
            </div>
            <div>
              <h2 className="text-xs font-bold text-black tracking-tight">
                LynTerminal Setup
              </h2>
              <p className="text-[11px] text-neutral-500">
                Step {currentStep} of 2 · {currentStep === 1 ? "Store Identity" : "Launch"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {[1, 2].map((step) => (
              <div
                key={step}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentStep === step
                    ? "w-6 bg-[#0071E3]"
                    : currentStep > step
                    ? "w-2.5 bg-emerald-500"
                    : "w-2 bg-black/10"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-5 bg-white">
          {/* STEP 1: STORE IDENTITY & CURRENCY */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0071E3] mb-1">
                  <Store className="w-3.5 h-3.5" />
                  <span>Workspace Setup</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-black tracking-tight">
                  Name your store
                </h1>
                <p className="text-xs text-neutral-500 mt-1">
                  Shown on receipts, tax invoices, and financial reports. Editable anytime.
                </p>
              </div>

              {storeError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{storeError}</span>
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Business / Store Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={businessName}
                    onChange={(e) => {
                      setBusinessName(e.target.value);
                      if (storeError) setStoreError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleStep1Next()}
                    placeholder="e.g. Sri Durgambika Enterprises"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.1] bg-[#FAFAFC] focus:bg-white text-sm font-medium text-black placeholder-neutral-400 outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/15 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Tagline <span className="text-neutral-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={businessTagline}
                    onChange={(e) => setBusinessTagline(e.target.value)}
                    placeholder="e.g. Retail & Wholesale Store"
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.1] bg-[#FAFAFC] focus:bg-white text-xs text-black placeholder-neutral-400 outline-none focus:border-[#0071E3] transition"
                  />
                </div>

                <div className="pt-1 space-y-2">
                  <label className="block text-xs font-semibold text-neutral-700">
                    Primary Currency
                  </label>

                  {/* Quick Pills */}
                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_CURRENCY_CODES.map((code) => {
                      const item = CURRENCIES.find((c) => c.code === code)!;
                      const active = currencyCode === item.code;
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => selectCurrency(item.code)}
                          className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            active
                              ? "border-[#0071E3] bg-[#0071E3]/8 text-[#0071E3] shadow-2xs"
                              : "border-black/[0.08] bg-[#FAFAFC] text-neutral-700 hover:bg-neutral-100"
                          }`}
                        >
                          <span className="font-mono font-bold">{item.symbol}</span>
                          <span>{item.code}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Full Global Currency Selector */}
                  <AppleSelect
                    value={currencyCode}
                    onChange={selectCurrency}
                    options={CURRENCIES.map((curr) => ({
                      value: curr.code,
                      label: curr.name,
                    }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PRIVACY SUMMARY & LAUNCH */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ready to Launch</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-black tracking-tight">
                  Review &amp; start selling
                </h1>
                <p className="text-xs text-neutral-500 mt-1">
                  Everything runs privately on this machine with zero cloud dependencies.
                </p>
              </div>

              {/* Clean Summary Card */}
              <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.08] text-xs space-y-2.5">
                <div className="flex items-center justify-between py-1 border-b border-black/[0.06]">
                  <span className="text-neutral-500">Store</span>
                  <span className="font-bold text-black">{businessName.trim() || "LynTerminal Store"}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-neutral-500">Currency</span>
                  <span className="font-mono font-semibold text-black">{currencyCode} ({currencySymbol})</span>
                </div>
              </div>

              {/* Minimalist 3-Pledge Strip */}
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="p-3 rounded-xl bg-white border border-black/[0.07] space-y-1">
                  <ServerOff className="w-4 h-4 text-neutral-700" />
                  <div className="font-semibold text-black">Offline First</div>
                  <div className="text-neutral-400 text-[10px]">No cloud sync</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-black/[0.07] space-y-1">
                  <Shield className="w-4 h-4 text-neutral-700" />
                  <div className="font-semibold text-black">Zero Tracking</div>
                  <div className="text-neutral-400 text-[10px]">0% telemetry</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-black/[0.07] space-y-1">
                  <HardDrive className="w-4 h-4 text-neutral-700" />
                  <div className="font-semibold text-black">Local SQLite</div>
                  <div className="text-neutral-400 text-[10px]">1-click backups</div>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FAFAFC] border border-black/[0.06] cursor-pointer text-xs text-neutral-700 select-none">
                <input
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-[#0071E3] cursor-pointer"
                />
                <span>
                  I understand <strong className="text-black">LynTerminal</strong> stores all data locally on this computer under my ownership.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 border-t border-black/[0.06] bg-[#FAFAFC] flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-black/[0.08] bg-white hover:bg-neutral-100 text-xs font-semibold text-black transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div>
            {currentStep === 1 && (
              <button
                type="button"
                onClick={handleStep1Next}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="button"
                disabled={isSubmitting || !privacyAgreed}
                onClick={handleFinalLaunch}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Launching..." : "Launch Terminal"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
