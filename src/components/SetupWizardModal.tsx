import React, { useState, useEffect } from "react";
import {
  Shield,
  ServerOff,
  EyeOff,
  Lock,
  Unlock,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  Store,
  Users,
  CreditCard,
  LayoutDashboard,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Settings as SettingsIcon,
  Printer,
  KeyRound,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { api } from "../services/api";
import { useAppleDialog } from "./common/AppleDialog";
import { AppleSelect } from "./common/AppleSelect";

interface SetupWizardModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

// Generate an 18-character formatted sovereign recovery key: LYN-XXXX-XXXX-XXXX-XX
function generateRecoveryCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude 0, 1, O, I to avoid transcription errors
  const randomChars = (len: number) => {
    let result = "";
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  return `LYN-${randomChars(4)}-${randomChars(4)}-${randomChars(4)}-${randomChars(2)}`;
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const { alert } = useAppleDialog();

  // Wizard Step (1: Privacy, 2: Account, 3: Recovery Key, 4: Business, 5: Visual Tour, 6: Completion)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Privacy Agreement
  const [hasScrolledPolicy, setHasScrolledPolicy] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);

  // Step 2: Account Creation / App Lock (Optional)
  const [skipAppLock, setSkipAppLock] = useState<boolean>(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accountError, setAccountError] = useState("");

  // Step 3: 18-Character Recovery Key
  const [recoveryCode, setRecoveryCode] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [keyRecorded, setKeyRecorded] = useState(false);

  // Step 4: Business Profile
  const [businessName, setBusinessName] = useState("LynTerminal Store");
  const [businessTagline, setBusinessTagline] = useState("Point of Sale & Enterprise Hub");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [currencyCode, setCurrencyCode] = useState("USD");

  // Step 5: Visual Tutorial Slide Index
  const [tourSlide, setTourSlide] = useState(0);

  // Submitting
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize recovery code on mount
  useEffect(() => {
    if (!recoveryCode) {
      setRecoveryCode(generateRecoveryCode());
    }
  }, [recoveryCode]);

  if (!isOpen) return null;

  // Handle scroll listener on privacy policy
  const handlePolicyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      setHasScrolledPolicy(true);
    }
  };

  const handleCopyRecoveryCode = () => {
    navigator.clipboard.writeText(recoveryCode);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const validateStep2Account = (): boolean => {
    setAccountError("");
    if (!username.trim()) {
      setAccountError("Please enter an administrator username.");
      return false;
    }
    if (password.length < 4) {
      setAccountError("Password must be at least 4 characters long.");
      return false;
    }
    if (password !== confirmPassword) {
      setAccountError("Passwords do not match. Please re-enter.");
      return false;
    }
    return true;
  };

  const selectSkipAppLock = () => {
    setSkipAppLock(true);
    setPassword("");
    setConfirmPassword("");
    setAccountError("");
  };

  const handleFinalLaunch = async () => {
    try {
      setIsSubmitting(true);
      await api.completeSetup({
        username: username.trim() || "admin",
        password: skipAppLock ? "" : password,
        recovery_code: skipAppLock ? "" : recoveryCode,
        business_name: businessName.trim() || "LynTerminal Store",
        tagline: businessTagline.trim(),
        currency_symbol: currencySymbol,
        currency_code: currencyCode,
      });

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

  // Currencies list
  const currencies = [
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-black/[0.08] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Wizard Progress Top Bar */}
        <div className="px-6 py-4 border-b border-black/[0.06] bg-[#FAFAFC] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-[#1D1D1F] flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1D1D1F] tracking-tight">LynTerminal Setup Assistant</h2>
              <p className="text-[11px] text-[#86868B]">Step {currentStep} of 6</p>
            </div>
          </div>

          {/* Stepper Pills */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((stepNum) => (
              <div
                key={stepNum}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentStep === stepNum
                    ? "w-6 bg-[#0071E3]"
                    : currentStep > stepNum
                    ? "w-2.5 bg-[#34C759]"
                    : "w-2 bg-black/[0.08]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Wizard Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          
          {/* STEP 1: PRIVACY POLICY & ZERO-TELEMETRY CHARTER */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0071E3]/10 px-3 py-1 text-xs font-semibold text-[#0071E3] mb-3">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Offline-First Privacy Guarantee</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1D1F] tracking-tight">
                  Privacy Policy & Data Terms
                </h1>
                <p className="text-xs sm:text-sm text-[#6E6E73] mt-1">
                  Official Privacy Commitment for LynTerminal POS & Enterprise Systems
                </p>
              </div>

              {/* Bento Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-black/[0.04]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0071E3]">
                    <ServerOff className="w-4 h-4" />
                    <span>Client-Side Only</span>
                  </div>
                  <p className="text-[11px] text-[#6E6E73] mt-1 leading-relaxed">
                    All operations execute locally on your machine. No background tracking or transaction uploads.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-black/[0.04]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <EyeOff className="w-4 h-4" />
                    <span>No Third-Party Sharing</span>
                  </div>
                  <p className="text-[11px] text-[#6E6E73] mt-1 leading-relaxed">
                    We never sell, rent, or broker your customer lists, sales revenue, or inventory records.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-black/[0.04]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600">
                    <Lock className="w-4 h-4" />
                    <span>Air-Gapped Operation</span>
                  </div>
                  <p className="text-[11px] text-[#6E6E73] mt-1 leading-relaxed">
                    Embedded SQLite database engine. Operates completely without internet connectivity.
                  </p>
                </div>
              </div>

              {/* Scrollable Legal & Architectural Charter */}
              <div
                onScroll={handlePolicyScroll}
                className="h-64 sm:h-72 overflow-y-auto p-4 rounded-2xl border border-black/[0.08] bg-[#FAFAFC] text-xs text-[#424245] space-y-4 leading-relaxed font-sans"
              >
                <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
                  <div className="text-[11px] font-mono text-[#86868B] uppercase tracking-wider">
                    DOCUMENT: LYN-PRIVACY-TERMS · CLIENT-SIDE SOVEREIGNTY
                  </div>
                  {hasScrolledPolicy && (
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Scroll Completed
                    </span>
                  )}
                </div>

                <section className="space-y-1.5">
                  <h3 className="font-bold text-[#1D1D1F] text-sm">
                    1. Local Data Architecture & Ownership
                  </h3>
                  <p>
                    LynTerminal is built as a locally installed, offline-first desktop application. Every transaction, product SKU, customer contact, tax calculation, and financial ledger entry is stored exclusively in your local SQLite database on this physical machine.
                  </p>
                  <p>
                    You retain sole ownership and control of all operational data. We do not maintain remote access, escrow keys, or network backdoors to your database file.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="font-bold text-[#1D1D1F] text-sm">
                    2. Zero Telemetry & Tracking Policy
                  </h3>
                  <p>
                    LynTerminal does not harvest or transmit personal or business information. When using this software:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>No usage metrics, commercial totals, or customer identities are monitored or uploaded.</li>
                    <li>The software contains zero advertising SDKs, tracking beacons, or profiling scripts.</li>
                    <li>No third-party marketing or behavioral analytics tools are embedded in any binary.</li>
                  </ul>
                </section>

                <section className="space-y-1.5">
                  <h3 className="font-bold text-[#1D1D1F] text-sm">
                    3. Local Security & Authentication
                  </h3>
                  <p>
                    Master credentials are authenticated client-side using salted cryptographic SHA-256 hashes. Your 18-character emergency recovery key is generated entirely in your local session. LynTerminal never transmits or mirrors your password or recovery key to any server.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="font-bold text-[#1D1D1F] text-sm">
                    4. Data Export & Portability
                  </h3>
                  <p>
                    Because your records are preserved in an open, industry-standard SQLite format, you are free to export sales invoices as PDF documents, generate local database backup snapshots, or query your ledgers without proprietary restrictions.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="font-bold text-[#1D1D1F] text-sm">
                    5. Contact & Support
                  </h3>
                  <p>
                    For questions regarding software security or privacy terms, contact our support team at <span className="font-mono text-[#0071E3]">support@winershogun.tech</span>.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="font-bold text-[#1D1D1F] text-sm">
                    6. Commercial Terms & Local Backup Responsibility
                  </h3>
                  <p>
                    LynTerminal is commercial store management software provided for on-premise single-establishment operations. All transaction, customer, and accounting records remain stored locally on your SSD under your exclusive ownership.
                  </p>
                  <p>
                    Because LynTerminal operates with zero cloud servers or third-party backups, regular local database backup snapshots (accessible anytime with 1 click in Settings &gt; System &amp; Audit) should be exported to external storage to safeguard against machine or hardware damage.
                  </p>
                </section>
              </div>

              {/* Agreement Checkbox */}
              <div className="pt-2 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="privacy-agree"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#0071E3] focus:ring-[#0071E3] cursor-pointer"
                />
                <label htmlFor="privacy-agree" className="text-xs text-[#1D1D1F] font-medium leading-relaxed cursor-pointer select-none">
                  I have read and agree to the <strong>LynTerminal Privacy Policy & Data Terms</strong>. I acknowledge that all business and customer data is stored locally on this machine under my control.
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: CREATE LOCAL ADMIN ACCOUNT */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 mb-3 border border-emerald-200/50">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Sovereign Local Authentication (Optional)</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1D1F] tracking-tight">
                  Master Password & App Lock
                </h1>
                <p className="text-xs sm:text-sm text-[#6E6E73] mt-1">
                  Choose your security mode. Protect your register with a local master password, or skip to launch directly.
                </p>
              </div>

              {/* Mode Selection Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Option 1: Enabled */}
                <div
                  onClick={() => setSkipAppLock(false)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    !skipAppLock
                      ? "border-[#0071E3] bg-[#0071E3]/[0.03] shadow-xs"
                      : "border-black/[0.08] bg-white hover:border-black/[0.16]"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Recommended
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#1D1D1F]">Enable Password Protection</h3>
                      <p className="text-[11px] text-[#6E6E73] mt-0.5 leading-relaxed">
                        Encrypt your store register and require a master password on startup or manual lock.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-black/[0.06] flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-[#86868B]">Status:</span>
                    <span className={`text-[11px] font-bold ${!skipAppLock ? "text-[#0071E3]" : "text-[#86868B]"}`}>
                      {!skipAppLock ? "● App Lock: ENABLED" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Option 2: Skipped */}
                <div
                  onClick={selectSkipAppLock}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    skipAppLock
                      ? "border-amber-500 bg-amber-500/[0.03] shadow-xs"
                      : "border-black/[0.08] bg-white hover:border-black/[0.16]"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                        <Unlock className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 text-[#86868B] border border-black/[0.08]">
                        Direct Launch
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#1D1D1F]">Skip App Lock</h3>
                      <p className="text-[11px] text-[#6E6E73] mt-0.5 leading-relaxed">
                        Launch directly into POS without credentials. Can be configured anytime in Settings.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-black/[0.06] flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-[#86868B]">Status:</span>
                    <span className={`text-[11px] font-bold ${skipAppLock ? "text-amber-600" : "text-[#86868B]"}`}>
                      {skipAppLock ? "● App Lock: SKIPPED" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>

              {accountError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{accountError}</span>
                </div>
              )}

              {skipAppLock ? (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                    <Unlock className="w-4 h-4 text-amber-600" />
                    <span>Direct Launch Active</span>
                  </div>
                  <p className="text-[11px] text-amber-900/80 leading-relaxed">
                    LynTerminal will launch instantly without prompting for a master password. Deadlock safeguards ensure you will never be locked out. You can configure master security at any time in <strong>Settings → Security & App Lock</strong>.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                      Administrator Display Name
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full max-w-sm px-3.5 py-2.5 rounded-xl border border-black/[0.12] bg-white text-xs text-[#1D1D1F] outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-lg">
                  {/* Username */}
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                      Administrator Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. admin or storeowner"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.12] bg-[#FAFAFC] focus:bg-white focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 text-xs text-[#1D1D1F] outline-none transition"
                    />
                    <p className="text-[11px] text-[#86868B] mt-1">
                      Used for logging into LynTerminal and signing administrative shift logs.
                    </p>
                  </div>

                  {/* Password with Eye Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                      Master Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter a secure master password (min 4 characters)"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-black/[0.12] bg-[#FAFAFC] focus:bg-white focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 text-xs text-[#1D1D1F] outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password with Eye Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                      Confirm Master Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your master password"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-black/[0.12] bg-[#FAFAFC] focus:bg-white focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 text-xs text-[#1D1D1F] outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {password && confirmPassword && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                        {password === confirmPassword ? (
                          <span className="text-emerald-600 font-medium flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Passwords match
                          </span>
                        ) : (
                          <span className="text-red-500 font-medium">Passwords do not match</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: 18-CHARACTER RECOVERY KEY */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 mb-3 border border-purple-200/50">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Offline Sovereign Recovery Vault</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1D1F] tracking-tight">
                  Your 18-Character Security Recovery Key
                </h1>
                <p className="text-xs sm:text-sm text-[#6E6E73] mt-1 leading-relaxed">
                  Because LynTerminal operates 100% offline with zero cloud telemetry, <strong>there is no remote server to reset your password</strong>. You must save this key to unlock LynTerminal if you forget your password.
                </p>
              </div>

              {/* Recovery Key Display Box */}
              <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900 text-white shadow-xl relative overflow-hidden group">
                <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                  <span>MASTER RECOVERY KEY (18 CHARACTERS)</span>
                  <span className="text-emerald-400 font-sans font-medium text-xs">Offline Sovereign</span>
                </div>

                <div className="flex items-center justify-between gap-4 mt-2">
                  <div className="font-mono text-lg sm:text-2xl font-bold tracking-widest text-[#0071E3] select-all bg-black/40 px-4 py-2.5 rounded-xl border border-white/10 w-full text-center">
                    {recoveryCode}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyRecoveryCode}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-3 rounded-xl font-semibold text-xs shadow-xs transition apple-press cursor-pointer ${
                      copiedKey
                        ? "bg-[#34C759] text-white"
                        : "bg-white hover:bg-neutral-100 text-[#1D1D1F]"
                    }`}
                  >
                    {copiedKey ? (
                      <>
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Key</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 flex items-start gap-2 text-xs text-neutral-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Critical Instruction</strong>: Write down this 18-character key on physical paper or store it in your password manager vault. LynTerminal does not store a copy in the cloud and cannot recover your account without this key.
                  </p>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div className="pt-2 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="key-recorded"
                  checked={keyRecorded}
                  onChange={(e) => setKeyRecorded(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#0071E3] focus:ring-[#0071E3] cursor-pointer"
                />
                <label htmlFor="key-recorded" className="text-xs text-[#1D1D1F] font-medium leading-relaxed cursor-pointer select-none">
                  I have safely written down and recorded my <strong>18-character recovery key</strong> in a secure location.
                </label>
              </div>
            </div>
          )}

          {/* STEP 4: BUSINESS FIRM SETUP */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0071E3] mb-3 border border-blue-200/50">
                  <Store className="w-3.5 h-3.5" />
                  <span>Business Entity Configuration</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1D1F] tracking-tight">
                  Configure Your Business Firm
                </h1>
                <p className="text-xs sm:text-sm text-[#6E6E73] mt-1">
                  Enter your firm details. You can customize physical addresses, tax numbers, and receipt terms anytime in Settings.
                </p>
              </div>

              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                    Business / Store Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Cosmic De Bakery or Apex Retail"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.12] bg-[#FAFAFC] focus:bg-white focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 text-xs text-[#1D1D1F] outline-none transition"
                  />
                  <p className="text-[11px] text-[#86868B] mt-1">
                    Appears prominently on POS headers, printed thermal slips, and A4 PDF tax bills.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                    Store Tagline or Specialty (Optional)
                  </label>
                  <input
                    type="text"
                    value={businessTagline}
                    onChange={(e) => setBusinessTagline(e.target.value)}
                    placeholder="e.g. Specialty Coffee & Artisan Micro-Roastery"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.12] bg-[#FAFAFC] focus:bg-white focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 text-xs text-[#1D1D1F] outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                    Operating Currency
                  </label>
                  <AppleSelect
                    value={currencyCode}
                    onChange={(val) => {
                      const sel = currencies.find((c) => c.code === val);
                      if (sel) {
                        setCurrencyCode(sel.code);
                        setCurrencySymbol(sel.symbol);
                      }
                    }}
                    options={currencies.map((curr) => ({
                      value: curr.code,
                      label: `${curr.name} (${curr.symbol})`,
                    }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: VISUAL TUTORIAL WALKTHROUGH */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 mb-2 border border-amber-200/50">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Quick Orientation Tour</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1D1F] tracking-tight">
                    How LynTerminal Works
                  </h1>
                </div>

                {/* Tour Tab Buttons */}
                <div className="flex items-center gap-1 bg-[#F5F5F7] p-1 rounded-xl border border-black/[0.04]">
                  {[0, 1, 2, 3].map((idx) => (
                    <button
                      key={idx}
                      onClick={() => setTourSlide(idx)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        tourSlide === idx
                          ? "bg-white text-[#0071E3] shadow-xs"
                          : "text-[#6E6E73] hover:text-[#1D1D1F]"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* SLIDE 0: SETTINGS & FIRM PROFILE */}
              {tourSlide === 0 && (
                <div className="p-6 rounded-2xl border border-black/[0.08] bg-[#FAFAFC] space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                      <SettingsIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1D1D1F]">
                        1. Configure Firm Profile & Taxes from Settings (Ctrl+0)
                      </h3>
                      <p className="text-xs text-[#6E6E73]">
                        Customize tax GST/VAT rules, printer slip styles, and store addresses.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#424245]">
                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-2xs space-y-1.5">
                      <div className="font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-[#0071E3]" />
                        <span>Store Branding & Address</span>
                      </div>
                      <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                        Add your physical address, phone, GSTIN/VAT identification, and invoice footer message.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-2xs space-y-1.5">
                      <div className="font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                        <Printer className="w-4 h-4 text-emerald-600" />
                        <span>Thermal & A4 Invoicing</span>
                      </div>
                      <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                        Toggle auto-print, 80mm thermal receipt format, or luxury red-wave A4 PDF invoices.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 1: STAFF & PAYROLL */}
              {tourSlide === 1 && (
                <div className="p-6 rounded-2xl border border-black/[0.08] bg-[#FAFAFC] space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1D1D1F]">
                        2. Add Staff & Process Monthly Salaries (Ctrl+7)
                      </h3>
                      <p className="text-xs text-[#6E6E73]">
                        Manage cashiers, accountants, and floor managers with confidential payroll.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#424245]">
                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-2xs space-y-1.5">
                      <div className="font-semibold text-[#1D1D1F]">Role-Based Personnel</div>
                      <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                        Register employees with contact details, assigned role (Cashier, Store Manager), and base monthly salary.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-2xs space-y-1.5">
                      <div className="font-semibold text-[#1D1D1F]">Attendance & Salary Payouts</div>
                      <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                        Mark daily attendance, disburse monthly salaries via Cash Drawer or Bank Account, and log audit receipts.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 2: COUNTER POS BILLING */}
              {tourSlide === 2 && (
                <div className="p-6 rounded-2xl border border-black/[0.08] bg-[#FAFAFC] space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1D1D1F]">
                        3. Lightning-Fast Counter POS Register (F2)
                      </h3>
                      <p className="text-xs text-[#6E6E73]">
                        Rapid barcode scanning, instant category pills, and multi-tender checkout.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#424245]">
                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-2xs space-y-1.5">
                      <div className="font-semibold text-[#1D1D1F]">Instant Customer Lookup</div>
                      <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                        Click the <strong>+ Customer</strong> button in POS to add customer name, mobile, and address directly without leaving the counter.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-2xs space-y-1.5">
                      <div className="font-semibold text-[#1D1D1F]">Receipt & PDF Export</div>
                      <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                        Bills automatically save into your local <span className="font-mono text-[10px]">~/Downloads/lynterminal/bills/</span> as real PDF documents.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 3: EXECUTIVE DASHBOARD */}
              {tourSlide === 3 && (
                <div className="p-6 rounded-2xl border border-black/[0.08] bg-[#FAFAFC] space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                      <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1D1D1F]">
                        4. Real-Time Executive Operations Cockpit (Ctrl+1)
                      </h3>
                      <p className="text-xs text-[#6E6E73]">
                        Track revenue velocity, cash-drawer floats, and working capital balance sheet.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#424245]">
                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-2xs space-y-1.5">
                      <div className="font-semibold text-[#1D1D1F]">Cash Drawer & Bank Float</div>
                      <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                        Physical cash at the counter reconciles live with sales and paid supplier expenses.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-2xs space-y-1.5">
                      <div className="font-semibold text-[#1D1D1F]">Balance Sheet & Profit Reconciliation</div>
                      <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                        Assets minus liabilities computed accurately with zero SaaS delays.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Slide Navigation Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  disabled={tourSlide === 0}
                  onClick={() => setTourSlide((prev) => prev - 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white text-xs font-semibold text-[#1D1D1F] hover:bg-neutral-50 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  disabled={tourSlide === 3}
                  onClick={() => setTourSlide((prev) => prev + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white text-xs font-semibold text-[#1D1D1F] hover:bg-neutral-50 disabled:opacity-30 cursor-pointer"
                >
                  <span>Next Feature</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: COMPLETION CELEBRATION */}
          {currentStep === 6 && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1D1F] tracking-tight">
                  You&apos;re All Set to Manage Your Business!
                </h1>
                <p className="text-xs sm:text-sm text-[#6E6E73] mt-2 max-w-md mx-auto leading-relaxed">
                  Your sovereign offline store engine has been initialized and secured. You are in complete control of your data.
                </p>
              </div>

              {/* Summary Overview Card */}
              <div className="max-w-md mx-auto p-5 rounded-2xl bg-[#FAFAFC] border border-black/[0.08] text-left text-xs space-y-2.5">
                <div className="flex items-center justify-between py-1 border-b border-black/[0.04]">
                  <span className="text-[#86868B]">Store Entity</span>
                  <span className="font-bold text-[#1D1D1F]">{businessName || "LynTerminal Store"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-black/[0.04]">
                  <span className="text-[#86868B]">Administrator</span>
                  <span className="font-mono font-semibold text-[#1D1D1F]">{username}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-black/[0.04]">
                  <span className="text-[#86868B]">Currency</span>
                  <span className="font-mono font-semibold text-[#1D1D1F]">{currencyCode} ({currencySymbol})</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04]">
                  <span className="text-[#86868B]">Master Security / App Lock</span>
                  {skipAppLock ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      <Unlock className="w-3 h-3 text-amber-600" />
                      App Lock: SKIPPED (Direct Launch)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      App Lock: ENABLED (Salted SHA-256)
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04]">
                  <span className="text-[#86868B]">18-Char Recovery Key</span>
                  <span className={`font-mono font-semibold ${skipAppLock ? "text-[#86868B]" : "text-emerald-600"}`}>
                    {skipAppLock ? "Skipped (Not Configured)" : "Saved Safely"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#86868B]">Telemetry & Tracking</span>
                  <span className="font-bold text-emerald-600">0% (Completely Disabled)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="px-6 py-4 border-t border-black/[0.06] bg-[#FAFAFC] flex items-center justify-between">
          <div>
            {currentStep > 1 && currentStep < 6 && (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 4 && skipAppLock) {
                    setCurrentStep(2);
                  } else {
                    setCurrentStep((prev) => prev - 1);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-black/[0.1] bg-white hover:bg-neutral-50 text-xs font-semibold text-[#1D1D1F] shadow-2xs transition apple-press cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep === 1 && (
              <button
                type="button"
                disabled={!privacyAgreed}
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Agree & Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 2 && (
              <div className="flex items-center gap-2">
                {skipAppLock ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press cursor-pointer"
                  >
                    <span>Continue to Business Profile</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (validateStep2Account()) {
                        setCurrentStep(3);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press cursor-pointer"
                  >
                    <span>Continue to Recovery Key</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                disabled={!keyRecorded}
                onClick={() => setCurrentStep(4)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Proceed to Business Profile</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 4 && (
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press cursor-pointer"
              >
                <span>Save & View Quick Tour</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 5 && (
              <button
                type="button"
                onClick={() => setCurrentStep(6)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press cursor-pointer"
              >
                <span>Complete Onboarding</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 6 && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalLaunch}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-bold shadow-md transition apple-press cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 stroke-[2.5]" />
                <span>{isSubmitting ? "Initializing LynTerminal..." : "Yes, Enter Dashboard"}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
