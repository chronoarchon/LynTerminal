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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white text-black rounded-3xl shadow-2xl border border-black/[0.08] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 lux-modal-card">
        
        {/* Wizard Progress Top Bar */}
        <div className="px-6 py-4 border-b border-black/[0.08] bg-[#F9FAFB] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-white/10 border border-black/[0.08] text-black flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-black tracking-tight">Setup Assistant</h2>
              <p className="text-[11px] text-neutral-400 font-mono">Step {currentStep} of 6</p>
            </div>
          </div>

          {/* Stepper Pills */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((stepNum) => (
              <div
                key={stepNum}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentStep === stepNum
                    ? "w-6 bg-white"
                    : currentStep > stepNum
                    ? "w-2.5 bg-emerald-400"
                    : "w-2 bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Wizard Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white text-black">
          
          {/* STEP 1: PRIVACY POLICY & ZERO-TELEMETRY CHARTER */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-black/[0.08] px-3 py-1 text-xs font-semibold text-black mb-3">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Offline Privacy</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-black tracking-tight">
                  Privacy Policy & Terms
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                  100% offline desktop billing. Zero cloud telemetry.
                </p>
              </div>

              {/* Bento Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#F9FAFB] border border-black/[0.08]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-black">
                    <ServerOff className="w-4 h-4" />
                    <span>Client-Side Only</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    All operations execute locally on this workstation.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F9FAFB] border border-black/[0.08]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <EyeOff className="w-4 h-4" />
                    <span>Zero Cloud Upload</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    Sales, inventory, and customer ledgers stay on your SSD.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F9FAFB] border border-black/[0.08]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-black">
                    <Lock className="w-4 h-4" />
                    <span>Air-Gapped Ready</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    Embedded SQLite engine. Runs without internet.
                  </p>
                </div>
              </div>

              {/* Scrollable Legal & Architectural Charter */}
              <div
                onScroll={handlePolicyScroll}
                className="h-64 sm:h-72 overflow-y-auto p-4 rounded-2xl border border-black/[0.08] bg-white text-xs text-neutral-700 space-y-4 leading-relaxed font-sans"
              >
                <div className="flex items-center justify-between pb-2 border-b border-black/[0.08]">
                  <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
                    SPECIFICATION: LYN-PRIVACY-TERMS · CLIENT-SIDE SOVEREIGNTY
                  </div>
                  {hasScrolledPolicy && (
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Scroll Completed
                    </span>
                  )}
                </div>

                <section className="space-y-1.5">
                  <h3 className="font-bold text-black text-sm">
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
                  <h3 className="font-bold text-black text-sm">
                    2. Zero Telemetry & Tracking Policy
                  </h3>
                  <p>
                    LynTerminal does not harvest or transmit personal or business information. When using this software:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-neutral-400">
                    <li>No usage metrics, commercial totals, or customer identities are monitored or uploaded.</li>
                    <li>The software contains zero advertising SDKs, tracking beacons, or profiling scripts.</li>
                    <li>No third-party marketing or behavioral analytics tools are embedded in any binary.</li>
                  </ul>
                </section>

                <section className="space-y-1.5">
                  <h3 className="font-bold text-black text-sm">
                    3. Local Security & Authentication
                  </h3>
                  <p>
                    Master credentials are authenticated client-side using salted cryptographic SHA-256 hashes. Your 18-character emergency recovery key is generated entirely in your local session. LynTerminal never transmits or mirrors your password or recovery key to any server.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="font-bold text-black text-sm">
                    4. Data Export & Portability
                  </h3>
                  <p>
                    Because your records are preserved in an open, industry-standard SQLite format, you are free to export sales invoices as PDF documents, generate local database backup snapshots, or query your ledgers without proprietary restrictions.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="font-bold text-black text-sm">
                    5. Contact & Support
                  </h3>
                  <p>
                    For questions regarding software security or privacy terms, contact our team at <span className="font-mono text-black underline">support@wintershogun.tech</span>.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="font-bold text-black text-sm">
                    6. Commercial Terms & Local Backup Responsibility
                  </h3>
                  <p>
                    LynTerminal is commercial store management software provided for on-premise single-establishment operations. All transaction, customer, and accounting records remain stored locally on your SSD under your exclusive ownership.
                  </p>
                  <p>
                    Because LynTerminal operates with zero cloud servers or third-party backups, regular local database backup snapshots (accessible anytime with 1 click in Settings) should be exported to external storage to safeguard against machine or hardware damage.
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
                  className="mt-0.5 h-4 w-4 rounded border-black/15 bg-white text-black focus:ring-black/20 accent-black cursor-pointer"
                />
                <label htmlFor="privacy-agree" className="text-xs text-neutral-700 font-medium leading-relaxed cursor-pointer select-none">
                  I agree to the <strong className="text-black">LynTerminal Privacy Policy & Terms</strong>. Business and customer data is stored locally under my control.
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: CREATE LOCAL ADMIN ACCOUNT */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-black mb-3 border border-black/[0.08]">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Security Mode</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-black tracking-tight">
                  Master Password & App Lock
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                  Protect your counter with a password or skip to launch directly.
                </p>
              </div>

              {/* Mode Selection Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Option 1: Enabled */}
                <div
                  onClick={() => setSkipAppLock(false)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    !skipAppLock
                      ? "border-white bg-[#F9FAFB] shadow-md"
                      : "border-black/[0.08] bg-white hover:border-black/15"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-black/5 text-black flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/5 text-black border border-black/15">
                        Recommended
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-black">Enable Password</h3>
                      <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                        Require a master password on startup and workstation lock.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-black/[0.08] flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-neutral-400">Status:</span>
                    <span className={`text-[11px] font-bold ${!skipAppLock ? "text-black" : "text-neutral-500"}`}>
                      {!skipAppLock ? "● App Lock: ENABLED" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Option 2: Skipped */}
                <div
                  onClick={selectSkipAppLock}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    skipAppLock
                      ? "border-white bg-[#F9FAFB] shadow-md"
                      : "border-black/[0.08] bg-white hover:border-black/15"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-black/5 text-black flex items-center justify-center">
                        <Unlock className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-neutral-400 border border-black/[0.08]">
                        Direct
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-black">Skip App Lock</h3>
                      <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                        Launch directly into POS without credentials. Can configure later.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-black/[0.08] flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-neutral-400">Status:</span>
                    <span className={`text-[11px] font-bold ${skipAppLock ? "text-black" : "text-neutral-500"}`}>
                      {skipAppLock ? "● App Lock: SKIPPED" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>

              {accountError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{accountError}</span>
                </div>
              )}

              {skipAppLock ? (
                <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-black/[0.08] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-black">
                    <Unlock className="w-4 h-4 text-black" />
                    <span>Direct Launch Active</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    LynTerminal will launch instantly without prompting for a master password.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Administrator Display Name
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full max-w-sm px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs text-black placeholder-neutral-400 outline-none focus:border-black focus:ring-1 focus:ring-black/20"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-lg">
                  {/* Username */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                      Administrator Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. admin or storeowner"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs text-black placeholder-neutral-400 outline-none focus:border-black focus:ring-1 focus:ring-black/20 transition"
                    />
                  </div>

                  {/* Password with Eye Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                      Master Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password (min 4 characters)"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-black/[0.08] bg-white text-xs text-black placeholder-neutral-400 outline-none focus:border-black focus:ring-1 focus:ring-black/20 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password with Eye Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                      Confirm Master Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-black/[0.08] bg-white text-xs text-black placeholder-neutral-400 outline-none focus:border-black focus:ring-1 focus:ring-black/20 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black cursor-pointer"
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {password && confirmPassword && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                        {password === confirmPassword ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Passwords match
                          </span>
                        ) : (
                          <span className="text-red-400 font-medium">Passwords do not match</span>
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
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-black mb-3 border border-black/[0.08]">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Recovery Vault</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-black tracking-tight">
                  Security Recovery Key
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1 leading-relaxed">
                  LynTerminal runs 100% offline. Save this key to restore access if you forget your password.
                </p>
              </div>

              {/* Recovery Key Display Box */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white text-black border border-black/[0.08] shadow-xl relative overflow-hidden group">
                <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                  <span>MASTER RECOVERY KEY (18 CHARS)</span>
                  <span className="text-emerald-400 font-mono text-xs">OFFLINE SOVEREIGN</span>
                </div>

                <div className="flex items-center justify-between gap-4 mt-2">
                  <div className="font-mono text-lg sm:text-2xl font-bold tracking-widest text-black select-all bg-[#F9FAFB] px-4 py-2.5 rounded-xl border border-black/[0.08] w-full text-center">
                    {recoveryCode}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyRecoveryCode}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-3 rounded-xl font-bold uppercase tracking-wider text-xs shadow-md transition active:scale-95 cursor-pointer ${
                      copiedKey
                        ? "bg-emerald-500 text-white"
                        : "bg-black hover:bg-neutral-800 text-white"
                    }`}
                  >
                    {copiedKey ? (
                      <>
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-black/[0.08] flex items-start gap-2 text-xs text-neutral-400">
                  <AlertTriangle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Write down this key or save it in your password vault. It cannot be recovered via cloud.
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
                  className="mt-0.5 h-4 w-4 rounded border-black/15 bg-white text-black focus:ring-black/20 accent-black cursor-pointer"
                />
                <label htmlFor="key-recorded" className="text-xs text-neutral-700 font-medium leading-relaxed cursor-pointer select-none">
                  I have saved my <strong className="text-black">18-character recovery key</strong> in a secure location.
                </label>
              </div>
            </div>
          )}

          {/* STEP 4: BUSINESS FIRM SETUP */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-black mb-3 border border-black/[0.08]">
                  <Store className="w-3.5 h-3.5" />
                  <span>Business Profile</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-black tracking-tight">
                  Business Details
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                  Configure your store name and currency. Customizable anytime in Settings.
                </p>
              </div>

              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Store / Firm Name *
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. LynTerminal Store"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs text-black placeholder-neutral-400 outline-none focus:border-black focus:ring-1 focus:ring-black/20 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Tagline (Optional)
                  </label>
                  <input
                    type="text"
                    value={businessTagline}
                    onChange={(e) => setBusinessTagline(e.target.value)}
                    placeholder="e.g. Retail & Inventory"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs text-black placeholder-neutral-400 outline-none focus:border-black focus:ring-1 focus:ring-black/20 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
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
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-black mb-2 border border-black/[0.08]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Quick Tour</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-black tracking-tight">
                    System Overview
                  </h1>
                </div>

                {/* Tour Tab Buttons */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-black/[0.08]">
                  {[0, 1, 2, 3].map((idx) => (
                    <button
                      key={idx}
                      onClick={() => setTourSlide(idx)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        tourSlide === idx
                          ? "bg-white text-black font-bold"
                          : "text-neutral-400 hover:text-black"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* SLIDE 0: SETTINGS & FIRM PROFILE */}
              {tourSlide === 0 && (
                <div className="p-6 rounded-2xl border border-black/[0.08] bg-[#F9FAFB] space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black/5 text-black flex items-center justify-center">
                      <SettingsIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-black">
                        1. Store Settings & Taxes (Ctrl+0)
                      </h3>
                      <p className="text-xs text-neutral-400">
                        Configure taxes, slip layout, and store details.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.08] space-y-1.5">
                      <div className="font-semibold text-black flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-black" />
                        <span>Branding & Tax ID</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        Add GSTIN/VAT, contact, address, and receipt terms.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.08] space-y-1.5">
                      <div className="font-semibold text-black flex items-center gap-1.5">
                        <Printer className="w-4 h-4 text-emerald-400" />
                        <span>Thermal & A4 Print</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        Toggle 80mm thermal slip or A4 tax invoice print.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 1: STAFF & PAYROLL */}
              {tourSlide === 1 && (
                <div className="p-6 rounded-2xl border border-black/[0.08] bg-[#F9FAFB] space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black/5 text-black flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-black">
                        2. Staff & Payroll (Ctrl+7)
                      </h3>
                      <p className="text-xs text-neutral-400">
                        Manage cashiers, managers, and attendance.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.08] space-y-1.5">
                      <div className="font-semibold text-black">Role Management</div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        Register employees with contact details and roles.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.08] space-y-1.5">
                      <div className="font-semibold text-black">Salary Payouts</div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        Track attendance and disburse monthly payouts.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 2: COUNTER POS BILLING */}
              {tourSlide === 2 && (
                <div className="p-6 rounded-2xl border border-black/[0.08] bg-[#F9FAFB] space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black/5 text-black flex items-center justify-center">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-black">
                        3. Counter POS Register (F2)
                      </h3>
                      <p className="text-xs text-neutral-400">
                        Barcode scanning, category filters, and fast checkout.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.08] space-y-1.5">
                      <div className="font-semibold text-black">Quick Customer Add</div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        Add customer details directly from the checkout register.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.08] space-y-1.5">
                      <div className="font-semibold text-black">Instant Export</div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        Bills save locally as PDF files with zero cloud delay.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 3: EXECUTIVE DASHBOARD */}
              {tourSlide === 3 && (
                <div className="p-6 rounded-2xl border border-black/[0.08] bg-[#F9FAFB] space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black/5 text-black flex items-center justify-center">
                      <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-black">
                        4. Operations Cockpit (Ctrl+1)
                      </h3>
                      <p className="text-xs text-neutral-400">
                        Live sales velocity, cash float, and profit reports.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.08] space-y-1.5">
                      <div className="font-semibold text-black">Cash & Bank Float</div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        Drawer cash reconciles live with sales and payouts.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-black/[0.08] space-y-1.5">
                      <div className="font-semibold text-black">Profit & Margins</div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        Net income and expense ledger computed on device.
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-[#F9FAFB] text-xs font-semibold text-black hover:bg-[#232733] disabled:opacity-30 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  disabled={tourSlide === 3}
                  onClick={() => setTourSlide((prev) => prev + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-[#F9FAFB] text-xs font-semibold text-black hover:bg-[#232733] disabled:opacity-30 cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: COMPLETION CELEBRATION */}
          {currentStep === 6 && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-black tracking-tight">
                  Setup Complete
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-md mx-auto leading-relaxed">
                  Your offline store system is configured and ready.
                </p>
              </div>

              {/* Summary Overview Card */}
              <div className="max-w-md mx-auto p-5 rounded-2xl bg-[#F9FAFB] border border-black/[0.08] text-left text-xs space-y-2.5 text-black">
                <div className="flex items-center justify-between py-1 border-b border-black/[0.08]">
                  <span className="text-neutral-400">Store Entity</span>
                  <span className="font-bold text-black">{businessName || "LynTerminal Store"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-black/[0.08]">
                  <span className="text-neutral-400">Administrator</span>
                  <span className="font-mono font-semibold text-black">{username}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-black/[0.08]">
                  <span className="text-neutral-400">Currency</span>
                  <span className="font-mono font-semibold text-black">{currencyCode} ({currencySymbol})</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-black/[0.08]">
                  <span className="text-neutral-400">Security Mode</span>
                  {skipAppLock ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-600 bg-black/5 px-2.5 py-0.5 rounded-full border border-black/10">
                      <Unlock className="w-3 h-3 text-neutral-500" />
                      Direct Launch
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Password Enabled
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-neutral-500">Telemetry</span>
                  <span className="font-bold text-emerald-600">0% (Offline Only)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="px-6 py-4 border-t border-black/[0.08] bg-[#F9FAFB] flex items-center justify-between">
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
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-black/[0.08] bg-white hover:bg-neutral-100 text-xs font-semibold text-black transition cursor-pointer shadow-xs"
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
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition active:scale-95 cursor-pointer"
                  >
                    <span>Next</span>
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
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition active:scale-95 cursor-pointer"
                  >
                    <span>Next</span>
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
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 4 && (
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition active:scale-95 cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 5 && (
              <button
                type="button"
                onClick={() => setCurrentStep(6)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition active:scale-95 cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 6 && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalLaunch}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmitting ? "Launching..." : "Launch Terminal"}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
