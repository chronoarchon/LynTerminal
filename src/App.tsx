import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { MobileNavBar } from "./components/MobileNavBar";
import { AppLockScreen } from "./components/AppLockScreen";
import { AppleDialogProvider } from "./components/common/AppleDialog";
import { CurrencyProvider } from "./context/CurrencyContext";
import { gstApi } from "./modules/india_gst/gstApi";
import type { GstSettings } from "./modules/india_gst/gstTypes";
import type { Settings, Item, Party, Invoice, DashboardSummary, AuthState, AppUpdateInfo, LicenseStatus } from "./types";
import { api } from "./services/api";

import { DashboardView } from "./components/DashboardView";
import { POSBilling } from "./components/POSBilling";
import { InventoryView } from "./components/InventoryView";
import { PartiesView } from "./components/PartiesView";
import { InvoicesView } from "./components/InvoicesView";
import { ExpensesView } from "./components/ExpensesView";
import { StaffView } from "./components/StaffView";
import { ReportsView } from "./components/ReportsView";
import { AuditLogView } from "./components/AuditLogView";
import { SettingsView } from "./components/SettingsView";
const TallyAccountingHub = lazy(() =>
  import("./modules/india_gst/TallyAccountingHub").then((m) => ({ default: m.TallyAccountingHub }))
);
const GSTPOSBilling = lazy(() =>
  import("./modules/india_gst/GSTPOSBilling").then((m) => ({ default: m.GSTPOSBilling }))
);
const CreditManagementView = lazy(() =>
  import("./modules/india_gst/CreditManagementView").then((m) => ({ default: m.CreditManagementView }))
);
const GSTR1ReportView = lazy(() =>
  import("./modules/india_gst/GSTR1ReportView").then((m) => ({ default: m.GSTR1ReportView }))
);
const GSTR3BReportView = lazy(() =>
  import("./modules/india_gst/GSTR3BReportView").then((m) => ({ default: m.GSTR3BReportView }))
);
import { TrialActivationModal } from "./components/TrialActivationModal";

const SetupWizardModal = lazy(() =>
  import("./components/SetupWizardModal").then((m) => ({ default: m.SetupWizardModal }))
);
const UpdateNotificationModal = lazy(() =>
  import("./components/UpdateNotificationModal").then((m) => ({ default: m.UpdateNotificationModal }))
);


function ViewFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[360px]">
      <div className="flex flex-col items-center gap-2.5">
        <div className="w-6 h-6 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-neutral-400 tracking-tight">Loading</span>
      </div>
    </div>
  );
}

const defaultSettings: Settings = {
  id: 1,
  business_name: "LynTerminal Store",
  tagline: "Retail, Wholesale & Cafe Management",
  address: "100 Commercial Way, Suite 10",
  phone: "+1 (555) 012-3456",
  email: "orders@lynterminal.local",
  tax_id: "TAX-102938",
  currency_symbol: "$",
  currency_code: "USD",
  tax_name: "Sales Tax",
  default_tax_rate: 8.5,
  invoice_prefix: "INV-",
  enable_godowns: true,
  terms_and_conditions:
    "Thank you for doing business with us! Goods once sold cannot be returned without original receipt.",
  tax_mode: "EXCLUSIVE",
  tax_preset: "CUSTOM",
  preview_after_sale: false,
  auto_print: false,
};

export function AppContent() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tab");
      if (p) return p;
    }
    return "pos";
  });
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [items, setItems] = useState<Item[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [gstSettings, setGstSettings] = useState<GstSettings | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("modal");
      if (p === "license" || p === "key") return true;
    }
    return false;
  });


  // Check for updates on startup and periodically (every 4 hours)
  useEffect(() => {
    const runUpdateCheck = () => {
      api.checkAppUpdate()
        .then((info) => {
          if (info && info.has_update) {
            setUpdateInfo(info);
            setIsUpdateModalOpen(true);
          }
        })
        .catch((err) => {
          console.debug("Silent update check info:", err);
        });
    };

    runUpdateCheck();
    const timer = setInterval(runUpdateCheck, 4 * 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLockApp = useCallback(async () => {
    if (!authState || !authState.has_account) {
      return;
    }
    try {
      await api.setAppLocked(true);
      setIsLocked(true);
    } catch (e) {
      console.error("Lock error:", e);
    }
  }, [authState]);

  const handleUnlocked = useCallback(() => {
    setIsLocked(false);
    loadAllData();
  }, []);

  // Two-phase central data loader: instant metadata unblocks UI, heavy lists stream non-blocking
  const loadAllData = useCallback(async () => {
    try {
      // Phase 1: Essential configuration & security check (sub-10ms)
      const [fetchedSettings, fetchedAuth, fetchedGstSettings, fetchedLicense] = await Promise.all([
        api.getSettings().catch((e) => {
          console.error("Error fetching settings:", e);
          return defaultSettings;
        }),
        api.getAuthState().catch((e) => {
          console.error("Error fetching auth state:", e);
          return null;
        }),
        gstApi.getGstSettings().catch((e) => {
          console.error("Error fetching GST settings:", e);
          return null;
        }),
        api.getLicenseStatus().catch((e) => {
          console.error("Error fetching license status:", e);
          return null;
        }),
      ]);

      if (fetchedSettings) setSettings(fetchedSettings);
      if (fetchedGstSettings) setGstSettings(fetchedGstSettings);
      if (fetchedLicense) {
        setLicenseStatus(fetchedLicense);
        if (fetchedLicense.is_expired && !fetchedLicense.is_licensed) {
          setIsLicenseModalOpen(true);
        }
      }


      if (fetchedAuth) {
        setAuthState(fetchedAuth);
        if (!fetchedAuth.is_setup_completed) {
          setIsSetupOpen(true);
        } else if (fetchedAuth.is_locked && fetchedAuth.has_account) {
          setIsLocked(true);
        }
      }

      // Unblock UI skeleton immediately!
      setInitialLoading(false);

      // Phase 2: Asynchronously stream catalog, ledger, and metrics in background
      Promise.all([
        api.listItems().then((it) => setItems(it)).catch(console.error),
        api.listParties().then((pa) => setParties(pa)).catch(console.error),
        api.listInvoices().then((inv) => setInvoices(inv)).catch(console.error),
        api.getDashboardSummary().then((sum) => setSummary(sum)).catch(console.error),
      ]).catch(console.error);
    } catch (err) {
      console.error("Fatal error loading LynTerminal data:", err);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const isGstActive = settings.currency_code === "INR" && (gstSettings?.is_enabled ?? true);

  useEffect(() => {
    if (!isGstActive && ["gst_hub", "gst_pos", "gst_credit", "gstr1", "gstr3b"].includes(activeTab)) {
      setActiveTab("pos");
    }
  }, [isGstActive, activeTab]);

  // Global hotkeys (F1 for Tally Hub, F2 for POS, F4 Contra, F5 Payment, F6 Receipt/Credit, F8 GST POS, F9 Purchase, Ctrl+1..0 for tabs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setActiveTab("pos");
      } else if (e.key === "F8") {
        e.preventDefault();
        setActiveTab(isGstActive ? "gst_pos" : "pos");
      } else if (e.key === "F6") {
        e.preventDefault();
        setActiveTab(isGstActive ? "gst_credit" : "invoices");
      } else if (e.key === "F5") {
        e.preventDefault();
        setActiveTab(isGstActive ? "gst_credit" : "expenses");
      } else if (e.key === "F4") {
        e.preventDefault();
        setActiveTab("expenses");
      } else if (e.key === "F9") {
        e.preventDefault();
        setActiveTab("invoices");
      } else if (e.key === "F1") {
        e.preventDefault();
        setActiveTab(isGstActive ? "gst_hub" : "dashboard");
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === "1") {
          e.preventDefault();
          setActiveTab("dashboard");
        } else if (e.key === "2") {
          e.preventDefault();
          setActiveTab("pos");
        } else if (e.key === "3") {
          e.preventDefault();
          setActiveTab("inventory");
        } else if (e.key === "4") {
          e.preventDefault();
          setActiveTab("parties");
        } else if (e.key === "5") {
          e.preventDefault();
          setActiveTab("invoices");
        } else if (e.key === "6") {
          e.preventDefault();
          setActiveTab("expenses");
        } else if (e.key === "7") {
          e.preventDefault();
          setActiveTab("staff");
        } else if (e.key === "8") {
          e.preventDefault();
          setActiveTab("reports");
        } else if (e.key === "9") {
          e.preventDefault();
          setActiveTab("audit");
        } else if (e.key === "0") {
          e.preventDefault();
          setActiveTab("settings");
        } else if (e.key === "l" || e.key === "L") {
          e.preventDefault();
          handleLockApp();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSettingsUpdated = (newSettings: Settings) => {
    setSettings(newSettings);
    loadAllData();
  };

  if (initialLoading) {
    return (
      <div className="h-screen w-screen bg-[#F5F5F7] flex flex-col items-center justify-center text-[#1D1D1F]">
        <div className="w-14 h-14 rounded-2xl bg-[#1D1D1F] flex items-center justify-center mb-4 shadow-xl">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-7 h-7"
          >
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M7 8h10" />
            <path d="M7 12h5" />
            <path d="M7 16h3" />
            <circle cx="16" cy="14" r="1.5" fill="white" />
          </svg>
        </div>
        <div className="text-sm font-semibold tracking-tight text-[#1D1D1F]">
          LynTerminal Business Engine
        </div>
        <div className="text-xs text-[#86868B] mt-1 font-mono">
          Embedded SQLite WAL · 100% Offline
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardView
            summary={summary}
            settings={settings}
            parties={parties}
            gstSettings={gstSettings}
            onNavigate={setActiveTab}
            onRefresh={loadAllData}
          />
        );
      case "pos":
        return (
          <POSBilling
            settings={settings}
            items={items}
            parties={parties}
            licenseStatus={licenseStatus}
            onInvoiceCreated={loadAllData}
            onRefreshData={loadAllData}
            onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
          />
        );
      case "inventory":
        return (
          <InventoryView
            items={items}
            settings={settings}
            onRefresh={loadAllData}
          />
        );
      case "parties":
        return (
          <PartiesView
            parties={parties}
            settings={settings}
            onRefresh={loadAllData}
          />
        );
      case "invoices":
        return (
          <InvoicesView
            invoices={invoices}
            items={items}
            parties={parties}
            settings={settings}
            onRefresh={loadAllData}
            showGst={isGstActive}
          />
        );
      case "expenses":
        return (
          <ExpensesView
            settings={settings}
            onRefreshSummary={loadAllData}
          />
        );
      case "staff":
        return (
          <StaffView
            settings={settings}
            onRefreshAll={loadAllData}
          />
        );
      case "reports":
        return (
          <ReportsView
            settings={settings}
            summary={summary}
          />
        );
      case "audit":
        return (
          <AuditLogView
            settings={settings}
            onRefreshAll={loadAllData}
          />
        );
      case "settings":
        return (
          <SettingsView
            settings={settings}
            gstSettings={gstSettings}
            licenseStatus={licenseStatus}
            onSettingsUpdated={handleSettingsUpdated}
            onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
          />
        );
      case "gst_hub":
        return (
          <TallyAccountingHub
            settings={settings}
            gstSettings={gstSettings || ({} as any)}
            onNavigateTab={setActiveTab}
          />
        );
      case "gst_pos":
        return (
          <GSTPOSBilling
            settings={settings}
            gstSettings={gstSettings || ({} as any)}
            items={items}
            parties={parties}
            licenseStatus={licenseStatus}
            onInvoiceCreated={loadAllData}
            onRefreshData={loadAllData}
            onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
          />
        );
      case "gst_credit":
        return (
          <CreditManagementView
            settings={settings}
            parties={parties}
            onRefresh={loadAllData}
          />
        );
      case "gstr1":
        return <GSTR1ReportView />;
      case "gstr3b":
        return <GSTR3BReportView />;
      default:
        return null;
    }
  };

  return (
    <CurrencyProvider symbol={settings.currency_symbol} code={settings.currency_code}>
      <div className="h-screen w-screen overflow-hidden flex bg-[#F5F5F7] select-none text-[#1D1D1F]">
        {/* Desktop Sidebar (Hidden on mobile/tablet < lg) */}
        <div className="hidden lg:flex h-full shrink-0">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            lowStockCount={summary?.low_stock_count ?? 0}
            showGst={isGstActive}
            licenseStatus={licenseStatus}
            onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
          />
        </div>

        {/* Main Application Area */}
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden bg-[#F5F5F7] relative">
          <Header
            settings={settings}
            licenseStatus={licenseStatus}
            onOpenQuickSale={() => {
              if (licenseStatus?.is_expired) {
                setIsLicenseModalOpen(true);
              } else {
                setActiveTab(isGstActive ? "gst_pos" : "pos");
              }
            }}
            onLockApp={authState?.has_account ? handleLockApp : undefined}
            onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
          />

          <main
            className={`flex-1 min-w-0 ${
              activeTab === "pos" || activeTab === "gst_pos"
                ? "h-[calc(100vh-3.5rem)] overflow-hidden p-0"
                : "overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8"
            }`}
          >
            <Suspense fallback={<ViewFallback />}>
              {renderContent()}
            </Suspense>
          </main>

          {/* Mobile Bottom Navigation Bar (Shows on screens < lg) */}
          <div className="lg:hidden">
            <MobileNavBar
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              lowStockCount={summary?.low_stock_count ?? 0}
              showGst={isGstActive}
            />
          </div>
        </div>

        {/* First-time Onboarding & Privacy Setup Wizard */}
        <Suspense fallback={null}>
          <SetupWizardModal
            isOpen={isSetupOpen}
            onComplete={() => {
              setIsSetupOpen(false);
              loadAllData();
            }}
          />
        </Suspense>

        {/* Sovereign Master Lock Screen */}
        <AppLockScreen
          isLocked={isLocked}
          settings={settings}
          authState={authState}
          onUnlocked={handleUnlocked}
        />

        {/* GitHub Software Update Notification Modal */}
        <Suspense fallback={null}>
          <UpdateNotificationModal
            updateInfo={updateInfo}
            isOpen={isUpdateModalOpen}
            onClose={() => setIsUpdateModalOpen(false)}
          />
        </Suspense>

        {/* Commercial License & 14-Day Trial Activation Modal */}
        <TrialActivationModal
          isOpen={isLicenseModalOpen}
          onClose={() => setIsLicenseModalOpen(false)}
          licenseStatus={licenseStatus}
          onActivated={(updated) => {
            setLicenseStatus(updated);
            loadAllData();
          }}
        />
      </div>

    </CurrencyProvider>
  );
}

export function App() {
  return (
    <AppleDialogProvider>
      <AppContent />
    </AppleDialogProvider>
  );
}

export default App;
