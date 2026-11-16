import React, { useState, useEffect } from "react";
import {
  Save,
  Building,
  Globe,
  Receipt,
  CheckCircle,
  Shield,
  HardDrive,
  AlertTriangle,
  X,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  ServerOff,
  Coins,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import type { Settings, BackupInfo, AuthState, AppUpdateInfo } from "../types";
import { api } from "../services/api";
import { AppleSelect } from "./common/AppleSelect";
import { useAppleDialog } from "./common/AppleDialog";
import { useCurrency } from "../context/CurrencyContext";
import { UpdateNotificationModal } from "./UpdateNotificationModal";
import type { GstSettings } from "../modules/india_gst/gstTypes";
import { gstApi } from "../modules/india_gst/gstApi";
import { INDIAN_STATES } from "../modules/india_gst/gstUtils";

interface SettingsViewProps {
  settings: Settings | null;
  gstSettings?: GstSettings | null;
  onSettingsUpdated: (newSettings: Settings) => void;
}

const COMMON_CURRENCIES = [
  { symbol: "$", code: "USD", name: "US Dollar ($)" },
  { symbol: "€", code: "EUR", name: "Euro (€)" },
  { symbol: "£", code: "GBP", name: "British Pound (£)" },
  { symbol: "₹", code: "INR", name: "Indian Rupee (₹)" },
  { symbol: "¥", code: "JPY", name: "Japanese Yen (¥)" },
  { symbol: "C$", code: "CAD", name: "Canadian Dollar (C$)" },
  { symbol: "A$", code: "AUD", name: "Australian Dollar (A$)" },
  { symbol: "CHF", code: "CHF", name: "Swiss Franc (CHF)" },
  { symbol: "AED", code: "AED", name: "UAE Dirham (AED)" },
  { symbol: "₱", code: "PHP", name: "Philippine Peso (₱)" },
  { symbol: "฿", code: "THB", name: "Thai Baht (฿)" },
];

const TAX_PRESETS: {
  id: "US_SALES_TAX" | "EU_UK_VAT" | "JAPAN_JCT" | "INDIA_GST" | "NO_TAX" | "CUSTOM";
  name: string;
  tax_mode: "EXCLUSIVE" | "INCLUSIVE";
  tax_name: string;
  rate: number;
}[] = [
  {
    id: "US_SALES_TAX",
    name: "United States (Sales Tax - Checkout Added)",
    tax_mode: "EXCLUSIVE",
    tax_name: "Sales Tax",
    rate: 8.25,
  },
  {
    id: "EU_UK_VAT",
    name: "EU / UK (VAT - Shelf Price Inclusive)",
    tax_mode: "INCLUSIVE",
    tax_name: "VAT",
    rate: 20.0,
  },
  {
    id: "JAPAN_JCT",
    name: "Japan (JCT - Consumption Tax Inclusive)",
    tax_mode: "INCLUSIVE",
    tax_name: "Consumption Tax",
    rate: 10.0,
  },
  {
    id: "INDIA_GST",
    name: "India (GST - Tax Inclusive)",
    tax_mode: "INCLUSIVE",
    tax_name: "GST",
    rate: 18.0,
  },
  {
    id: "NO_TAX",
    name: "Tax Exempt / 0%",
    tax_mode: "EXCLUSIVE",
    tax_name: "Tax Exempt",
    rate: 0.0,
  },
  {
    id: "CUSTOM",
    name: "Custom International Tax Rate",
    tax_mode: "EXCLUSIVE",
    tax_name: "Sales Tax",
    rate: 5.0,
  },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  gstSettings,
  onSettingsUpdated,
}) => {
  const [formData, setFormData] = useState<Settings>({
    id: 1,
    business_name: "LynTerminal Store",
    tagline: "Retail, Wholesale & Cafe Management",
    address: "100 Commercial Way, Suite 10",
    phone: "+1 (555) 019-2834",
    email: "contact@store.local",
    tax_id: "TAX-998822",
    currency_symbol: "$",
    currency_code: "USD",
    tax_name: "Sales Tax",
    default_tax_rate: 8.25,
    invoice_prefix: "INV-",
    enable_godowns: true,
    terms_and_conditions:
      "Thank you for doing business with us! Goods once sold cannot be returned without original receipt.",
    tax_mode: "EXCLUSIVE",
    tax_preset: "US_SALES_TAX",
    preview_after_sale: false,
    auto_print: false,
    opening_cash: 0,
    opening_bank: 0,
    opening_balance_mode: "CASH",
    capital_cash: 0,
    capital_bank: 0,
    capital_mode: "CASH",
    custom_payment_1_name: "UPI",
    custom_payment_1_enabled: false,
    custom_payment_2_name: "Bank Transfer",
    custom_payment_2_enabled: false,
  });

  const { currencySymbol } = useCurrency();
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Indian GST Profile Form
  const [gstForm, setGstForm] = useState<GstSettings>({
    is_enabled: true,
    gstin: "27AABCU9603R1ZN",
    legal_name: "LynTerminal Infotech Pvt Ltd",
    trade_name: "LynStore India",
    state_code: "27",
    state_name: "Maharashtra",
    pan: "AABCU9603R",
    gst_composition: false,
    einvoice_enabled: false,
    eway_bill_threshold: 50000,
    lut_number: "",
    bank_name: "HDFC Bank",
    bank_account_no: "50200012345678",
    bank_ifsc: "HDFC0000128",
    bank_branch: "Fort, Mumbai",
    upi_id: "lynstore@okhdfcbank",
  });

  // Auto-Update states
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdateInfo | null>(null);

  useEffect(() => {
    api.getAuthState().then(setAuthState).catch(() => {});
    gstApi
      .getGstSettings()
      .then((res) => {
        if (res && res.gstin) {
          setGstForm(res);
        }
      })
      .catch(console.error);
  }, []);

  // Currency Switch State
  const [pendingCurrency, setPendingCurrency] = useState<{ symbol: string; code: string; name: string } | null>(null);
  const [preserveCatalogOnReset, setPreserveCatalogOnReset] = useState(true);
  const [isResettingCurrency, setIsResettingCurrency] = useState(false);

  // Backup states
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState("");
  const { alert, confirm, toast } = useAppleDialog();

  // Security & Master Auth states
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newMasterPassword, setNewMasterPassword] = useState("");
  const [confirmMasterPassword, setConfirmMasterPassword] = useState("");
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [changePwError, setChangePwError] = useState("");

  const [revealedRecoveryKey, setRevealedRecoveryKey] = useState<string | null>(null);
  const [isCharterOpen, setIsCharterOpen] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwError("");
    if (!oldPassword) {
      setChangePwError("Please enter your current master password.");
      return;
    }
    if (newMasterPassword.length < 4) {
      setChangePwError("New password must be at least 4 characters.");
      return;
    }
    if (newMasterPassword !== confirmMasterPassword) {
      setChangePwError("New passwords do not match.");
      return;
    }

    try {
      setIsChangingPw(true);
      await api.changePassword(oldPassword, newMasterPassword);
      setIsChangePasswordOpen(false);
      setOldPassword("");
      setNewMasterPassword("");
      setConfirmMasterPassword("");
      api.getAuthState().then(setAuthState).catch(() => {});
      toast({ message: "Master password configured successfully", type: "success" });
    } catch (err) {
      setChangePwError(String(err));
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleRevealRecoveryKey = async () => {
    if (revealedRecoveryKey) {
      setRevealedRecoveryKey(null);
      return;
    }
    try {
      const code = await api.getRecoveryCode();
      setRevealedRecoveryKey(code);
    } catch (err) {
      alert({ title: "Error", message: String(err), type: "error" });
    }
  };

  const handleManualLock = async () => {
    if (!authState || !authState.has_account) {
      alert({
        title: "Master Password Required",
        message: "You skipped configuring a master password during setup. Please set a master password before locking your workstation.",
        type: "warning",
      });
      setIsChangePasswordOpen(true);
      return;
    }
    try {
      await api.setAppLocked(true);
      toast({ message: "Workstation locked successfully", type: "success" });
      onSettingsUpdated({ ...formData });
    } catch (err) {
      alert({ title: "Lock Error", message: String(err), type: "error" });
    }
  };

  const handleCheckUpdate = async () => {
    try {
      setCheckingUpdate(true);
      const info = await api.checkAppUpdate();
      if (info && info.has_update) {
        setAvailableUpdate(info);
        setUpdateModalOpen(true);
      } else {
        toast({ message: `LynTerminal is up to date (v${info.current_version})`, type: "success" });
      }
    } catch (err) {
      alert({ title: "Update Check", message: String(err), type: "error" });
    } finally {
      setCheckingUpdate(false);
    }
  };

  useEffect(() => {
    if (gstSettings) {
      setGstForm(gstSettings);
    }
  }, [gstSettings]);

  useEffect(() => {
    if (settings) {
      setFormData({
        ...settings,
        opening_cash: settings.opening_cash ?? 0,
        opening_bank: settings.opening_bank ?? 0,
        opening_balance_mode: settings.opening_balance_mode || "CASH",
        capital_cash: settings.capital_cash ?? 0,
        capital_bank: settings.capital_bank ?? 0,
        capital_mode: settings.capital_mode || "CASH",
        custom_payment_1_name: settings.custom_payment_1_name || "UPI",
        custom_payment_1_enabled: settings.custom_payment_1_enabled || false,
        custom_payment_2_name: settings.custom_payment_2_name || "Bank Transfer",
        custom_payment_2_enabled: settings.custom_payment_2_enabled || false,
      });
    }
  }, [settings]);

  const loadBackups = async () => {
    try {
      setLoadingBackups(true);
      const list = await api.listBackups();
      setBackups(list);
    } catch (err) {
      console.error("Failed to load backups:", err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const payload: Settings = {
        ...formData,
        opening_cash: Number(formData.opening_cash) || 0,
        opening_bank: Number(formData.opening_bank) || 0,
        opening_balance_mode: formData.opening_balance_mode || "CASH",
        capital_cash: Number(formData.capital_cash) || 0,
        capital_bank: Number(formData.capital_bank) || 0,
        capital_mode: formData.capital_mode || "CASH",
        default_tax_rate: Number(formData.default_tax_rate) || 0,
      };
      const updated = await api.saveSettings(payload);
      if (formData.currency_code === "INR") {
        await gstApi.saveGstSettings(gstForm).catch(console.error);
      }
      setFormData(updated);
      onSettingsUpdated(updated);
      setSaveSuccess(true);
      toast({ message: "Store settings saved successfully", type: "success" });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert({ title: "Settings Error", message: String(err), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencySelect = (currencyCode: string) => {
    const found = COMMON_CURRENCIES.find((c) => c.code === currencyCode);
    if (!found) return;

    if (settings && found.code !== settings.currency_code) {
      setPendingCurrency(found);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      currency_code: found.code,
      currency_symbol: found.symbol,
    }));
  };

  const confirmCurrencySwitch = async () => {
    if (!pendingCurrency) return;
    setIsResettingCurrency(true);

    try {
      const updated = await api.switchCurrencyAndResetData({
        new_currency_code: pendingCurrency.code,
        new_currency_symbol: pendingCurrency.symbol,
        preserve_catalog: preserveCatalogOnReset,
      });

      setFormData(updated);
      onSettingsUpdated(updated);
      setPendingCurrency(null);
      toast({ message: `Operating currency changed to ${pendingCurrency.name}`, type: "success" });
    } catch (err) {
      alert({ title: "Currency Switch Failed", message: String(err), type: "error" });
    } finally {
      setIsResettingCurrency(false);
    }
  };

  const handleTaxPresetSelect = (presetId: string) => {
    const preset = TAX_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setFormData((prev) => ({
        ...prev,
        tax_preset: preset.id,
        tax_mode: preset.tax_mode,
        tax_name: preset.tax_name,
        default_tax_rate: preset.rate,
        ...(preset.id === "INDIA_GST"
          ? { currency_symbol: "₹", currency_code: "INR" }
          : {}),
      }));
    }
  };

  const handleCreateManualBackup = async () => {
    try {
      setCreatingBackup(true);
      const res = await api.createBackup();
      setBackupSuccessMessage(`Created backup snapshot: ${res}`);
      toast({ message: "Database snapshot created safely in vault", type: "success" });
      setTimeout(() => setBackupSuccessMessage(""), 4000);
      await loadBackups();
    } catch (err) {
      alert({ title: "Backup Failed", message: String(err), type: "error" });
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backupPath: string) => {
    const ok = await confirm({
      title: "Restore Database Snapshot",
      message: "Restore this database backup snapshot? Current records will be replaced.",
      isDestructive: true,
      confirmText: "Restore Database",
    });

    if (ok) {
      try {
        await api.restoreBackup(backupPath);
        toast({ message: "Database restored successfully!", type: "success" });
        window.location.reload();
      } catch (err) {
        alert({ title: "Restore Failed", message: String(err), type: "error" });
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto select-none pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.07]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Store Settings
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Branding, international currencies, tax presets, register floats, and local backups
          </p>
        </div>

        <button
          onClick={() => handleSubmit()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press cursor-pointer self-start sm:self-auto"
        >
          <Save className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{saving ? "Saving..." : "Save Preferences"}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-[#34C759]/10 border border-[#34C759]/20 flex items-center gap-2 text-xs text-[#34C759] font-semibold animate-in fade-in duration-150">
          <CheckCircle className="w-4 h-4" />
          <span>Preferences successfully saved to local SQLite database</span>
        </div>
      )}

      {/* SECTION 1: Store Branding & Identification */}
      <div className="apple-card p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 border-b border-black/[0.06] pb-3">
          <Building className="w-4 h-4 text-[#0071E3]" />
          <h2 className="text-sm font-semibold text-[#1D1D1F]">
            Store Profile & Branding
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
              Store / Business Name *
            </label>
            <input
              type="text"
              required
              value={formData.business_name}
              onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-[#0071E3]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
              Tagline / Subheading
            </label>
            <input
              type="text"
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-[#0071E3]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
              Store Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-[#0071E3]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
              Phone Number
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-[#0071E3]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
              Store Tax Registration ID
            </label>
            <input
              type="text"
              value={formData.tax_id}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-mono font-medium focus:outline-none focus:border-[#0071E3]"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Currency & International Tax Presets */}
      <div className="apple-card p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 border-b border-black/[0.06] pb-3">
          <Globe className="w-4 h-4 text-[#0071E3]" />
          <h2 className="text-sm font-semibold text-[#1D1D1F]">
            Operating Currency & Tax Engine
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
              Primary Currency
            </label>
            <AppleSelect
              value={formData.currency_code}
              onChange={(code) => handleCurrencySelect(code)}
              options={COMMON_CURRENCIES.map((c) => ({
                value: c.code,
                label: c.name,
                sublabel: `${c.code} · ${c.symbol}`,
              }))}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
              International Tax Preset
            </label>
            <AppleSelect
              value={formData.tax_preset}
              onChange={(presetId) => handleTaxPresetSelect(presetId)}
              options={TAX_PRESETS.map((p) => ({
                value: p.id,
                label: p.name,
                sublabel: `${p.rate}% · ${p.tax_name}`,
              }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
              Tax Name
            </label>
            <input
              type="text"
              value={formData.tax_name}
              onChange={(e) => setFormData({ ...formData, tax_name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-[#0071E3]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
              Default Tax Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.default_tax_rate}
              onChange={(e) => setFormData({ ...formData, default_tax_rate: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-mono font-bold focus:outline-none focus:border-[#0071E3]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
              Tax Mode
            </label>
            <AppleSelect
              value={formData.tax_mode}
              onChange={(mode) => setFormData({ ...formData, tax_mode: mode as any })}
              options={[
                { value: "EXCLUSIVE", label: "Exclusive (Added at Checkout)", sublabel: "Item price does not include tax" },
                { value: "INCLUSIVE", label: "Inclusive (Built into Shelf Price)", sublabel: "Tax is reverse-calculated from price" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* INDIAN GST & TALLY STATUTORY PROFILE (Visible ONLY when active currency is INR) */}
      {formData.currency_code === "INR" && (
        <div className="apple-card p-5 sm:p-6 rounded-3xl space-y-4 border border-[#FF9500]/30 bg-gradient-to-b from-white to-[#FFF9F2]/20">
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FF9500]/10 text-[#FF9500] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-[#1D1D1F]">
                    India GST &amp; Tally Statutory Accounting
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF9500]/10 text-[#FF9500] uppercase tracking-wide">
                    Rule 46 CGST
                  </span>
                </div>
                <p className="text-[11px] text-[#86868B] mt-0.5">
                  Optional GST engine for INR currency: CGST, SGST, IGST tax breakdown, HSN/SAC codes &amp; Tally gateway
                </p>
              </div>
            </div>

            {/* Apple Styled Toggle Switch */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-[#1D1D1F]">
                {gstForm.is_enabled ? "Enabled" : "Disabled"}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={gstForm.is_enabled}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    const updatedGst = { ...gstForm, is_enabled: val };
                    setGstForm(updatedGst);
                    try {
                      await gstApi.saveGstSettings(updatedGst);
                      toast({
                        message: val ? "Indian GST & Tally activated" : "Indian GST & Tally turned off",
                        type: "info",
                      });
                      onSettingsUpdated({ ...formData, tax_preset: val ? "INDIA_GST" : "CUSTOM" });
                    } catch (err) {
                      console.error("Failed to update GST status:", err);
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-black/[0.15] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF9500]"></div>
              </label>
            </div>
          </div>

          {gstForm.is_enabled && (
            <div className="space-y-4 pt-1 animate-in fade-in duration-200">

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                Supplier GSTIN (15 Digits)
              </label>
              <input
                type="text"
                maxLength={15}
                value={gstForm.gstin}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  const stateCode = val.slice(0, 2);
                  const pan = val.length >= 12 ? val.slice(2, 12) : gstForm.pan;
                  const foundState = INDIAN_STATES.find((s) => s.code === stateCode);
                  setGstForm((prev) => ({
                    ...prev,
                    gstin: val,
                    state_code: stateCode || prev.state_code,
                    state_name: foundState ? foundState.name : prev.state_name,
                    pan: pan || prev.pan,
                  }));
                }}
                placeholder="27AABCU9603R1ZN"
                className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold focus:outline-none focus:border-[#FF9500]"
              />
              <span className="text-[10px] text-neutral-400 mt-1 block">
                Auto-syncs 2-digit State Code and PAN
              </span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                Legal Registered Name
              </label>
              <input
                type="text"
                value={gstForm.legal_name}
                onChange={(e) => setGstForm({ ...gstForm, legal_name: e.target.value })}
                placeholder="e.g. Acme Retail Pvt Ltd"
                className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium focus:outline-none focus:border-[#FF9500]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                Trade Name
              </label>
              <input
                type="text"
                value={gstForm.trade_name}
                onChange={(e) => setGstForm({ ...gstForm, trade_name: e.target.value })}
                placeholder="e.g. Acme Supermarket"
                className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium focus:outline-none focus:border-[#FF9500]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                Place of Supply State ({gstForm.state_code})
              </label>
              <AppleSelect
                value={gstForm.state_code}
                onChange={(code) => {
                  const found = INDIAN_STATES.find((s) => s.code === code);
                  if (found) {
                    setGstForm({ ...gstForm, state_code: found.code, state_name: found.name });
                  }
                }}
                options={INDIAN_STATES.map((s) => ({
                  value: s.code,
                  label: `${s.code} - ${s.name}`,
                  sublabel: s.isUnionTerritory ? "Union Territory" : "State",
                }))}
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                Permanent Account Number (PAN)
              </label>
              <input
                type="text"
                maxLength={10}
                value={gstForm.pan}
                onChange={(e) => setGstForm({ ...gstForm, pan: e.target.value.toUpperCase() })}
                placeholder="AABCU9603R"
                className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold focus:outline-none focus:border-[#FF9500]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                E-Way Bill Threshold (₹)
              </label>
              <input
                type="number"
                value={gstForm.eway_bill_threshold}
                onChange={(e) =>
                  setGstForm({ ...gstForm, eway_bill_threshold: parseFloat(e.target.value) || 50000 })
                }
                className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold focus:outline-none focus:border-[#FF9500]"
              />
            </div>
          </div>

          <div className="border-t border-black/[0.06] pt-3">
            <h3 className="text-xs font-bold text-neutral-800 mb-2">
              Bank Details for Tax Invoices & UPI QR
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={gstForm.bank_name}
                  onChange={(e) => setGstForm({ ...gstForm, bank_name: e.target.value })}
                  placeholder="e.g. HDFC Bank"
                  className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium focus:outline-none focus:border-[#FF9500]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Bank Account Number
                </label>
                <input
                  type="text"
                  value={gstForm.bank_account_no}
                  onChange={(e) => setGstForm({ ...gstForm, bank_account_no: e.target.value })}
                  placeholder="50200012345678"
                  className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold focus:outline-none focus:border-[#FF9500]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Bank IFSC Code
                </label>
                <input
                  type="text"
                  maxLength={11}
                  value={gstForm.bank_ifsc}
                  onChange={(e) => setGstForm({ ...gstForm, bank_ifsc: e.target.value.toUpperCase() })}
                  placeholder="HDFC0000128"
                  className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold focus:outline-none focus:border-[#FF9500]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Merchant UPI ID
                </label>
                <input
                  type="text"
                  value={gstForm.upi_id}
                  onChange={(e) => setGstForm({ ...gstForm, upi_id: e.target.value })}
                  placeholder="merchant@okhdfcbank"
                  className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium focus:outline-none focus:border-[#FF9500]"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )}

      {/* SECTION: Payment Methods & Custom Gateways */}
      <div className="apple-card p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
              <Receipt className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#1D1D1F]">
                Payment Methods &amp; Custom Checkout Gateways
              </h2>
              <p className="text-[11px] text-[#86868B]">
                Configure standard Cash/Card and up to 2 customized payment methods for POS counter checkout
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3]">
            POS Gateways
          </span>
        </div>

        {/* Default Methods */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                💵
              </span>
              <div>
                <span className="text-xs font-bold text-[#1D1D1F] block">Cash</span>
                <span className="text-[10px] text-[#86868B]">Physical register drawer float</span>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/40">
              Default (Always On)
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs">
                💳
              </span>
              <div>
                <span className="text-xs font-bold text-[#1D1D1F] block">Card / Terminal</span>
                <span className="text-[10px] text-[#86868B]">Swipe, chip &amp; contactless terminal</span>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/40">
              Default (Always On)
            </span>
          </div>
        </div>

        {/* 2 Customizable Payment Methods */}
        <div className="pt-2 border-t border-black/[0.05] space-y-3">
          <h3 className="text-xs font-bold text-[#1D1D1F]">
            Customizable Payment Methods
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Custom Payment 1 */}
            <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#1D1D1F] block">
                    Custom Method 1
                  </span>
                  <span className="text-[10px] text-[#86868B]">
                    e.g. UPI, Google Pay, PayPay, Alipay
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.custom_payment_1_enabled || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        custom_payment_1_enabled: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-black/[0.15] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0071E3]"></div>
                </label>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Button Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI, Google Pay, PayPay"
                  value={formData.custom_payment_1_name || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      custom_payment_1_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                />
              </div>
            </div>

            {/* Custom Payment 2 */}
            <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#1D1D1F] block">
                    Custom Method 2
                  </span>
                  <span className="text-[10px] text-[#86868B]">
                    e.g. Bank Draft, Alipay, Cheque, Wire
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.custom_payment_2_enabled || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        custom_payment_2_enabled: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-black/[0.15] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0071E3]"></div>
                </label>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Button Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank Draft, Wire Transfer"
                  value={formData.custom_payment_2_name || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      custom_payment_2_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Receipt Formatting & Register Defaults */}
      <div className="apple-card p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 border-b border-black/[0.06] pb-3">
          <Receipt className="w-4 h-4 text-[#0071E3]" />
          <h2 className="text-sm font-semibold text-[#1D1D1F]">
            Thermal Receipt & Register Defaults
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
              Invoice Prefix
            </label>
            <input
              type="text"
              value={formData.invoice_prefix}
              onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-mono font-medium focus:outline-none focus:border-[#0071E3]"
            />
          </div>

        </div>

        <div>
          <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
            Receipt Terms & Conditions Footer
          </label>
          <textarea
            rows={2}
            value={formData.terms_and_conditions}
            onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-[#0071E3]"
          />
        </div>
      </div>

      {/* SECTION: Opening Balance & Capital Allocation (Cash vs. Bank) */}
      <div className="apple-card p-5 sm:p-6 rounded-3xl space-y-6">
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#0071E3]" />
            <h2 className="text-sm font-semibold text-[#1D1D1F]">
              Opening Balance & Owner Capital Allocation
            </h2>
          </div>
          <span className="text-[11px] font-medium text-[#86868B]">
            Separated Cash & Bank Accounting
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Starting Opening Balance */}
          <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.06] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#1D1D1F]">
                  Starting Opening Balance
                </h3>
                <p className="text-[11px] text-[#86868B] mt-0.5">
                  Initial register float or starting bank funds on Day 1.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#0071E3] bg-[#0071E3]/10 px-2 py-0.5 rounded-lg">
                Total: {currencySymbol}{(Number(formData.opening_cash || 0) + Number(formData.opening_bank || 0)).toFixed(2)}
              </span>
            </div>

            {/* Mode Selector Tabs */}
            <div>
              <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1.5">
                Payment Allocation Mode
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-black/[0.04] rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    const currentTotal = Number(formData.opening_cash || 0) + Number(formData.opening_bank || 0);
                    setFormData({
                      ...formData,
                      opening_balance_mode: "CASH",
                      opening_cash: currentTotal,
                      opening_bank: 0,
                    });
                  }}
                  className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
                    formData.opening_balance_mode === "CASH"
                      ? "bg-white text-[#1D1D1F] font-semibold shadow-xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  Cash Only
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentTotal = Number(formData.opening_cash || 0) + Number(formData.opening_bank || 0);
                    setFormData({
                      ...formData,
                      opening_balance_mode: "BANK",
                      opening_cash: 0,
                      opening_bank: currentTotal,
                    });
                  }}
                  className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
                    formData.opening_balance_mode === "BANK"
                      ? "bg-white text-[#1D1D1F] font-semibold shadow-xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  Bank Only
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      opening_balance_mode: "SPLIT",
                    });
                  }}
                  className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
                    formData.opening_balance_mode === "SPLIT"
                      ? "bg-white text-[#1D1D1F] font-semibold shadow-xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  Split Both
                </button>
              </div>
            </div>

            {/* Dynamic Inputs based on mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(formData.opening_balance_mode === "CASH" || formData.opening_balance_mode === "SPLIT") && (
                <div className={formData.opening_balance_mode === "CASH" ? "sm:col-span-2" : ""}>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Cash in Hand Float ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.opening_cash ?? 0}
                    onChange={(e) => setFormData({ ...formData, opening_cash: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium focus:outline-none focus:border-[#0071E3]"
                  />
                </div>
              )}

              {(formData.opening_balance_mode === "BANK" || formData.opening_balance_mode === "SPLIT") && (
                <div className={formData.opening_balance_mode === "BANK" ? "sm:col-span-2" : ""}>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Bank Account Balance ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.opening_bank ?? 0}
                    onChange={(e) => setFormData({ ...formData, opening_bank: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium focus:outline-none focus:border-[#0071E3]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Injected Owner Capital */}
          <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.06] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#1D1D1F]">
                  Owner Capital & Equity
                </h3>
                <p className="text-[11px] text-[#86868B] mt-0.5">
                  Initial capital investment injected to launch the business.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/50">
                Total: {currencySymbol}{(Number(formData.capital_cash || 0) + Number(formData.capital_bank || 0)).toFixed(2)}
              </span>
            </div>

            {/* Mode Selector Tabs */}
            <div>
              <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1.5">
                Capital Allocation Mode
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-black/[0.04] rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    const currentTotal = Number(formData.capital_cash || 0) + Number(formData.capital_bank || 0);
                    setFormData({
                      ...formData,
                      capital_mode: "CASH",
                      capital_cash: currentTotal,
                      capital_bank: 0,
                    });
                  }}
                  className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
                    formData.capital_mode === "CASH"
                      ? "bg-white text-[#1D1D1F] font-semibold shadow-xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  Cash Only
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentTotal = Number(formData.capital_cash || 0) + Number(formData.capital_bank || 0);
                    setFormData({
                      ...formData,
                      capital_mode: "BANK",
                      capital_cash: 0,
                      capital_bank: currentTotal,
                    });
                  }}
                  className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
                    formData.capital_mode === "BANK"
                      ? "bg-white text-[#1D1D1F] font-semibold shadow-xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  Bank Only
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      capital_mode: "SPLIT",
                    });
                  }}
                  className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
                    formData.capital_mode === "SPLIT"
                      ? "bg-white text-[#1D1D1F] font-semibold shadow-xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  Split Both
                </button>
              </div>
            </div>

            {/* Dynamic Inputs based on mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(formData.capital_mode === "CASH" || formData.capital_mode === "SPLIT") && (
                <div className={formData.capital_mode === "CASH" ? "sm:col-span-2" : ""}>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Capital Injected as Cash ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.capital_cash ?? 0}
                    onChange={(e) => setFormData({ ...formData, capital_cash: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium focus:outline-none focus:border-[#0071E3]"
                  />
                </div>
              )}

              {(formData.capital_mode === "BANK" || formData.capital_mode === "SPLIT") && (
                <div className={formData.capital_mode === "BANK" ? "sm:col-span-2" : ""}>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Capital Injected to Bank ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.capital_bank ?? 0}
                    onChange={(e) => setFormData({ ...formData, capital_bank: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium focus:outline-none focus:border-[#0071E3]"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Combined Starting Net Position Summary */}
        <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/[0.05] flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#86868B]">Starting Physical Cash Float:</span>
            <span className="font-mono font-bold text-[#1D1D1F]">
              {currencySymbol}{(Number(formData.opening_cash || 0) + Number(formData.capital_cash || 0)).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#86868B]">Starting Bank Liquidity:</span>
            <span className="font-mono font-bold text-[#1D1D1F]">
              {currencySymbol}{(Number(formData.opening_bank || 0) + Number(formData.capital_bank || 0)).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#86868B]">Total Initial Capital Equity:</span>
            <span className="font-mono font-bold text-[#0071E3]">
              {currencySymbol}{(
                Number(formData.opening_cash || 0) +
                Number(formData.opening_bank || 0) +
                Number(formData.capital_cash || 0) +
                Number(formData.capital_bank || 0)
              ).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION: Workstation Security & Sovereign Privacy Charter */}
      <div className="apple-card p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#0071E3]" />
            <h2 className="text-sm font-semibold text-[#1D1D1F]">
              Workstation Security & Local Master Account
            </h2>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Salted SHA-256 Vault Active</span>
          </div>
        </div>

        <p className="text-xs text-[#6E6E73] leading-relaxed">
          LynTerminal is an offline-first enterprise operating system. Master credentials and recovery keys are maintained exclusively on this local computer.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Lock App Now */}
          <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.05] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-[#0071E3]" />
                  <span>Lock Workstation</span>
                </div>
                {authState?.has_account ? (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200/50">
                    Protected
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold border border-amber-200/50">
                    No Password
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#86868B] mt-1 leading-relaxed">
                {authState?.has_account
                  ? "Immediately lock this screen when stepping away from the counter. Shortcut: Ctrl+L."
                  : "Lock is disabled until a master password is set."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleManualLock}
              className={`w-full py-2 rounded-xl border text-xs font-semibold shadow-2xs transition apple-press cursor-pointer ${
                authState?.has_account
                  ? "border-black/[0.08] bg-white hover:bg-neutral-50 text-[#1D1D1F]"
                  : "border-amber-200 bg-amber-50 hover:bg-amber-100/60 text-amber-900"
              }`}
            >
              {authState?.has_account ? "Lock Now (Ctrl+L)" : "Set Password to Lock"}
            </button>
          </div>

          {/* Change Password */}
          <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.05] flex flex-col justify-between space-y-3">
            <div>
              <div className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-purple-600" />
                <span>Master Password</span>
              </div>
              <p className="text-[11px] text-[#86868B] mt-1 leading-relaxed">
                {authState?.has_account
                  ? "Update the local administrator master password used to unlock LynTerminal."
                  : "Create an administrator password to protect your store workstation."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="w-full py-2 rounded-xl border border-black/[0.08] bg-white hover:bg-neutral-50 text-xs font-semibold text-[#1D1D1F] shadow-2xs transition apple-press cursor-pointer"
            >
              {authState?.has_account ? "Change Password" : "Create Master Password"}
            </button>
          </div>

          {/* 18-Character Recovery Key */}
          <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.05] flex flex-col justify-between space-y-3">
            <div>
              <div className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>18-Char Recovery Key</span>
              </div>
              <p className="text-[11px] text-[#86868B] mt-1 leading-relaxed">
                View your emergency sovereign recovery key used for forgot password reset.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRevealRecoveryKey}
              className="w-full py-2 rounded-xl border border-black/[0.08] bg-white hover:bg-neutral-50 text-xs font-semibold text-[#1D1D1F] shadow-2xs transition apple-press cursor-pointer"
            >
              {revealedRecoveryKey ? "Hide Recovery Key" : "View Recovery Key"}
            </button>
          </div>
        </div>

        {revealedRecoveryKey && (
          <div className="p-4 rounded-2xl bg-neutral-900 text-white flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <div>
              <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                SOVEREIGN RECOVERY KEY
              </div>
              <div className="font-mono text-sm sm:text-base font-bold text-[#0071E3] tracking-widest select-all mt-0.5">
                {revealedRecoveryKey}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(revealedRecoveryKey);
                toast({ message: "Recovery key copied to clipboard", type: "success" });
              }}
              className="px-3 py-1.5 rounded-xl bg-white text-[#1D1D1F] text-xs font-bold hover:bg-neutral-100 transition"
            >
              Copy
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-black/[0.06] flex items-center justify-between text-xs text-[#6E6E73]">
          <div className="flex items-center gap-1.5">
            <ServerOff className="w-3.5 h-3.5 text-[#0071E3]" />
            <span>Zero Inbound / Outbound Telemetry · DPDPA 2023 & GDPR Aligned</span>
          </div>

          <button
            type="button"
            onClick={() => setIsCharterOpen(true)}
            className="text-[#0071E3] font-semibold hover:underline cursor-pointer"
          >
            Read Privacy Charter & Terms →
          </button>
        </div>
      </div>

      {/* SECTION 4: Safe Vault & Snapshots */}
      <div className="apple-card p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#0071E3]" />
            <h2 className="text-sm font-semibold text-[#1D1D1F]">
              Safe Vault & Database Backups
            </h2>
          </div>

          <button
            onClick={handleCreateManualBackup}
            disabled={creatingBackup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold shadow-2xs transition apple-press"
          >
            <Shield className="w-3.5 h-3.5 text-[#34C759]" />
            <span>{creatingBackup ? "Backing up..." : "Create Snapshot"}</span>
          </button>
        </div>

        {backupSuccessMessage && (
          <div className="p-3 rounded-xl bg-[#34C759]/10 text-xs text-[#34C759] font-medium">
            {backupSuccessMessage}
          </div>
        )}

        <div className="space-y-2">
          {loadingBackups ? (
            <div className="text-center py-6 text-xs text-[#86868B]">
              Loading backup snapshots...
            </div>
          ) : (
            backups.map((b, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-black/[0.06] bg-[#FBFBFC] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-[#1D1D1F] font-mono text-[11px]">{b.filename}</div>
                  <div className="text-[10px] text-[#86868B] mt-0.5">
                    Size: {(b.size_bytes / 1024).toFixed(1)} KB · Created: {new Date(b.created_at).toLocaleString()}
                  </div>
                </div>

                <button
                  onClick={() => handleRestoreBackup(b.filepath)}
                  className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#EBEBED] text-xs font-medium text-[#1D1D1F] transition"
                >
                  Restore
                </button>
              </div>
            ))
          )}

          {!loadingBackups && backups.length === 0 && (
            <div className="text-center py-6 text-xs text-[#86868B]">
              No backup snapshots yet. Press "Create Snapshot" to create one.
            </div>
          )}
        </div>
      </div>

      {/* SECTION: Software Updates & GitHub Release Channel */}
      <div className="apple-card p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#0071E3]" />
            <h2 className="text-sm font-semibold text-[#1D1D1F]">
              Software Updates & GitHub Release Channel
            </h2>
          </div>
          <span className="text-[11px] font-mono font-semibold text-[#0071E3] bg-[#0071E3]/10 px-2.5 py-0.5 rounded-full border border-[#0071E3]/20">
            v1.5.0v
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.05]">
          <div>
            <div className="text-xs font-bold text-[#1D1D1F] flex items-center gap-2">
              <span>Installed Version: LynTerminal v1.5.0v</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200/50">
                Current
              </span>
            </div>
            <p className="text-[11px] text-[#86868B] mt-1 leading-relaxed">
              Official releases are published on GitHub. Non-destructive updating preserves your database, SKUs, and settings automatically.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? "animate-spin" : ""}`} />
            <span>{checkingUpdate ? "Checking Releases..." : "Check for Updates"}</span>
          </button>
        </div>
      </div>

      {/* CURRENCY SWITCH CONFIRM MODAL */}
      {pendingCurrency && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-black/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFC]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#FF9500]" />
                <h3 className="text-sm font-semibold text-[#1D1D1F]">
                  Switch Store Currency
                </h3>
              </div>
              <button
                onClick={() => setPendingCurrency(null)}
                className="w-7 h-7 rounded-full text-[#86868B] hover:text-[#1D1D1F]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-[#6E6E73]">
              <p>
                Changing currency to <strong className="text-[#1D1D1F]">{pendingCurrency.name}</strong> will create an automatic database backup snapshot before applying.
              </p>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={preserveCatalogOnReset}
                  onChange={(e) => setPreserveCatalogOnReset(e.target.checked)}
                  className="rounded text-[#0071E3] focus:ring-0"
                />
                <span className="text-[#1D1D1F]">Preserve catalog products & SKUs</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingCurrency(null)}
                  className="flex-1 py-2.5 rounded-xl border border-black/[0.08] text-xs font-semibold text-[#6E6E73]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmCurrencySwitch}
                  disabled={isResettingCurrency}
                  className="flex-1 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs"
                >
                  {isResettingCurrency ? "Switching..." : "Confirm Switch"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE MASTER PASSWORD MODAL */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-black/[0.08] p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1D1D1F]">Change Master Password</h3>
                  <p className="text-[11px] text-[#86868B]">Update workstation administrator password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(false)}
                className="w-7 h-7 rounded-full text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {changePwError && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{changePwError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showOldPw ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 pr-9 rounded-xl border border-black/[0.12] bg-[#FAFAFC] focus:bg-white focus:border-[#0071E3] text-xs text-[#1D1D1F] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPw(!showOldPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B]"
                  >
                    {showOldPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newMasterPassword}
                    onChange={(e) => setNewMasterPassword(e.target.value)}
                    placeholder="At least 4 characters"
                    className="w-full px-3 py-2 pr-9 rounded-xl border border-black/[0.12] bg-[#FAFAFC] focus:bg-white focus:border-[#0071E3] text-xs text-[#1D1D1F] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B]"
                  >
                    {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                  Confirm New Password
                </label>
                <input
                  type={showNewPw ? "text" : "password"}
                  value={confirmMasterPassword}
                  onChange={(e) => setConfirmMasterPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 rounded-xl border border-black/[0.12] bg-[#FAFAFC] focus:bg-white focus:border-[#0071E3] text-xs text-[#1D1D1F] outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-black/[0.1] text-xs font-semibold text-[#1D1D1F] hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPw}
                  className="px-4 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold shadow-xs transition apple-press"
                >
                  {isChangingPw ? "Saving..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRIVACY CHARTER MODAL */}
      {isCharterOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-black/[0.08] flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FAFAFC]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1D1D1F]">
                    LynTerminal Privacy Policy & Data Terms
                  </h3>
                  <p className="text-[11px] text-[#86868B]">
                    Offline-First Client Sovereignty
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCharterOpen(false)}
                className="w-7 h-7 rounded-full text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#424245] leading-relaxed">
              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-[#1D1D1F]">1. Local Data Architecture & Ownership</h4>
                <p>
                  LynTerminal is built as a locally installed, offline-first desktop application. Every transaction, product SKU, customer contact, tax calculation, and financial ledger entry is stored exclusively in your local SQLite database on this physical machine.
                </p>
                <p>
                  You retain sole ownership and control of all operational data. We do not maintain remote access, escrow keys, or network backdoors to your database file.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-[#1D1D1F]">2. Zero Telemetry & Tracking Policy</h4>
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
                <h4 className="font-bold text-sm text-[#1D1D1F]">3. Local Security & Authentication</h4>
                <p>
                  Master credentials are authenticated client-side using salted cryptographic SHA-256 hashes. Your 18-character emergency recovery key is generated entirely in your local session. LynTerminal never transmits or mirrors your password or recovery key to any server.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-[#1D1D1F]">4. Data Export & Portability</h4>
                <p>
                  Because your records are preserved in an open, industry-standard SQLite format, you are free to export sales invoices as PDF documents, generate local database backup snapshots, or query your ledgers without proprietary restrictions.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-[#1D1D1F]">5. Contact & Support</h4>
                <p>
                  For questions regarding software security or privacy terms, contact our support team at <span className="font-mono text-[#0071E3]">support@winershogun.tech</span>.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-[#1D1D1F]">6. Commercial Terms & Local Backup Responsibility</h4>
                <p>
                  LynTerminal is commercial store management software provided for on-premise single-establishment operations. All transaction, customer, and accounting records remain stored locally on your SSD under your exclusive ownership.
                </p>
                <p>
                  Because LynTerminal operates with zero cloud servers or third-party backups, regular local database backup snapshots (accessible anytime with 1 click in Settings &gt; System &amp; Audit) should be exported to external storage to safeguard against machine or hardware damage.
                </p>
              </section>
            </div>

            <div className="px-6 py-3 border-t border-black/[0.06] bg-[#FAFAFC] flex justify-end">
              <button
                type="button"
                onClick={() => setIsCharterOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#0071E3] text-white text-xs font-semibold hover:bg-[#0077ED]"
              >
                Close Terms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE NOTIFICATION MODAL */}
      <UpdateNotificationModal
        updateInfo={availableUpdate}
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
      />
    </div>
  );
};
