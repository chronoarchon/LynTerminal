import React, { useState, useEffect, useMemo } from "react";
import {
  RefreshCw,
  Trash2,
  Sparkles,
  HardDrive,
  CheckCircle,
  Eye,
  X,
  Search,
  Lock,
} from "lucide-react";
import type { AuditLog, Settings } from "../types";
import { api } from "../services/api";
import { useAppleDialog } from "./common/AppleDialog";

import { mockAuditLogs } from "../browserMock";

interface AuditLogViewProps {
  settings: Settings | null;
  onRefreshAll: () => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  settings,
  onRefreshAll,
}) => {
  const isMock = typeof window !== "undefined" && !(window as any).__TAURI_INTERNALS__;
  const [logs, setLogs] = useState<AuditLog[]>(() => (isMock ? (mockAuditLogs as any) : []));
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const { confirm, prompt, alert, toast } = useAppleDialog();

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLogs(200);
      setLogs(data);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleSeedDemoData = async () => {
    const ok = await confirm({
      title: "Generate Demo Data",
      message:
        "Generate 30 days of realistic commercial business records?\n\nThis will populate products, customers, daily POS sales, purchase restocks, and operating expenses to verify math and accounting.",
      confirmText: "Generate Data",
    });

    if (!ok) return;

    try {
      setSeeding(true);
      setSeedResult(null);
      const res = await api.seedDemoData(30);
      setSeedResult(res);
      await loadLogs();
      onRefreshAll();
      toast({ message: "30-day simulation records generated successfully", type: "success" });
    } catch (err) {
      alert({ title: "Simulation Failed", message: String(err), type: "error" });
    } finally {
      setSeeding(false);
    }
  };

  const handleClearData = async () => {
    const confirmName = await prompt({
      title: "Reset Local Database",
      message:
        "CAUTION: This will permanently purge all sales, products, contacts, and transactions from the local database.",
      placeholder: "RESET",
      requiredMatch: "RESET",
      confirmText: "Erase Everything",
      isDestructive: true,
    });

    if (confirmName === "RESET") {
      try {
        await api.clearAllData();
        toast({ message: "Database purged and re-indexed successfully", type: "success" });
        await loadLogs();
        onRefreshAll();
      } catch (err) {
        alert({ title: "Reset Failed", message: String(err), type: "error" });
      }
    }
  };

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter((log) => {
      return (
        log.action.toLowerCase().includes(q) ||
        log.entity.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.timestamp.toLowerCase().includes(q)
      );
    });
  }, [logs, search]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto select-none">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.07]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
            System & Security Audit
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Tamper-evident activity journal for {settings?.business_name || "Store"}, local database maintenance, and QA simulator
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedDemoData}
            disabled={seeding}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-50 text-black text-xs font-semibold shadow-xs transition apple-press"
          >
            <Sparkles className={`w-3.5 h-3.5 ${seeding ? "animate-spin" : ""}`} />
            <span>{seeding ? "Simulating..." : "Generate Demo Data"}</span>
          </button>

          <button
            onClick={loadLogs}
            className="p-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] transition"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {seedResult && (
        <div className="p-4 rounded-2xl bg-[#34C759]/10 border border-[#34C759]/20 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-[#34C759] shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-xs font-bold text-[#1D1D1F]">Demo Records Seeded Successfully</div>
            <div className="text-[11px] text-[#6E6E73] mt-0.5">{seedResult}</div>
          </div>
          <button
            onClick={() => setSeedResult(null)}
            className="text-[#86868B] hover:text-[#1D1D1F]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="apple-card p-4 rounded-2xl space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#34C759]/10 text-[#34C759] flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-[#1D1D1F]">Zero Telemetry</h3>
              <div className="text-[10px] text-[#34C759] font-medium">100% Offline & Private</div>
            </div>
          </div>
          <p className="text-[11px] text-[#86868B] leading-relaxed">
            All customer accounts, receipts, prices, and employee payroll remain strictly on your local disk.
          </p>
        </div>

        <div className="apple-card p-4 rounded-2xl space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-[#1D1D1F]">SQLite WAL Storage</h3>
              <div className="text-[10px] text-[#0071E3] font-medium font-mono">ACID Guaranteed</div>
            </div>
          </div>
          <p className="text-[11px] text-[#86868B] leading-relaxed font-mono truncate">
            Path: ~/.local/share/com.lynterminal.app/lynterminal.db
          </p>
        </div>

        <div className="apple-card p-4 rounded-2xl space-y-2 flex flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-[#1D1D1F]">Database Maintenance</h3>
              <div className="text-[10px] text-[#86868B]">Factory Reset & Vacuum</div>
            </div>
          </div>
          <button
            onClick={handleClearData}
            className="w-full py-1.5 rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] text-xs font-semibold transition apple-press"
          >
            Clear Database / Reset
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="apple-card rounded-2xl overflow-hidden shadow-2xs">
        <div className="p-3.5 border-b border-black/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-[#1D1D1F]">Audit Journal</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/[0.05] text-[#6E6E73]">
              {logs.length} entries
            </span>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-2 text-[#86868B]" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-black/[0.08] bg-[#F5F5F7] rounded-xl text-xs focus:outline-none focus:border-[#0071E3]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] bg-[#FBFBFC] text-[#86868B] font-semibold text-[11px]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Entity</th>
                <th className="py-3 px-3">Entity ID</th>
                <th className="py-3 px-3">Details</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] font-mono text-[11px]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#FBFBFC] transition-colors">
                  <td className="py-3 px-4 text-[#86868B] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action === "CREATE"
                          ? "bg-[#34C759]/10 text-[#34C759]"
                          : log.action === "DELETE" || log.action === "RESET"
                          ? "bg-[#FF3B30]/10 text-[#FF3B30]"
                          : "bg-[#0071E3]/10 text-[#0071E3]"
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#1D1D1F] font-semibold font-sans">{log.entity}</td>
                  <td className="py-3 px-3 text-[#6E6E73] truncate max-w-[120px]">{log.entity_id}</td>
                  <td className="py-3 px-3 text-[#6E6E73] font-sans truncate max-w-[240px]">{log.details}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1 rounded-lg text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.05]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#86868B] font-sans">
                    No matching audit records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECT LOG MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB]">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  Audit Entry
                </h3>
                <p className="text-[11px] text-neutral-400 font-mono">ID #{selectedLog.id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 select-text font-mono text-xs">
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase">Timestamp</span>
                <span className="text-black">{selectedLog.timestamp}</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase">Action</span>
                <span className="text-black font-bold">{selectedLog.action} · {selectedLog.entity}</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase">Entity ID</span>
                <span className="text-black">{selectedLog.entity_id}</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase">Details</span>
                <p className="text-black font-sans leading-relaxed mt-1 p-3 rounded-xl bg-white border border-black/[0.08]">
                  {selectedLog.details}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="w-full py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
