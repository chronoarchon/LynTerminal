import React, { useState } from "react";
import {
  Sparkles,
  Download,
  AlertCircle,
  X,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { api } from "../services/api";
import type { AppUpdateInfo } from "../types";

interface UpdateNotificationModalProps {
  updateInfo: AppUpdateInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateNotificationModal: React.FC<UpdateNotificationModalProps> = ({
  updateInfo,
  isOpen,
  onClose,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState(0);

  if (!isOpen || !updateInfo) return null;

  const handleApplyUpdate = async () => {
    try {
      setIsUpdating(true);
      setErrorMessage("");
      setStatusMessage("Preserving pre-update SQLite safety snapshot...");
      setProgress(25);

      // 1. Create safety backup
      await api.createPreUpdateBackup(updateInfo.latest_version);

      setStatusMessage(`Downloading and staging LynTerminal v${updateInfo.latest_version}...`);
      setProgress(60);

      // 2. Apply update and restart
      await api.applyAppUpdate(updateInfo.download_url, updateInfo.latest_version);
      setProgress(100);
      setStatusMessage("Update applied successfully! Launching updated version...");
    } catch (err) {
      console.error("Update failed:", err);
      setErrorMessage(String(err));
      setIsUpdating(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-black/[0.08] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-black/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3] shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200/50 mb-1">
                <span>Update Available</span>
                <span>•</span>
                <span className="font-mono">v{updateInfo.latest_version}</span>
              </div>
              <h2 className="text-base font-bold text-[#1D1D1F]">
                LynTerminal Software Update
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="p-1.5 rounded-full hover:bg-neutral-100 text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Zero Data Loss Guarantee Card */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-emerald-800 block">
                Zero Data Loss Guaranteed
              </span>
              <p className="text-emerald-700/90 text-[11px] mt-0.5 leading-relaxed">
                Your store records, catalog SKUs, receipts, and accounting ledgers live in your persistent user directory (~/.local/share/com.lynterminal.app) and are never overwritten by application upgrades. An automated snapshot backup is created before applying.
              </p>
            </div>
          </div>

          {/* Version Comparison */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-[#F5F5F7] border border-black/[0.04]">
              <span className="text-[11px] text-[#86868B] block">Current Version</span>
              <span className="font-mono font-bold text-[#1D1D1F] text-sm">
                v{updateInfo.current_version}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#0071E3]/5 border border-[#0071E3]/15">
              <span className="text-[11px] text-[#0071E3] font-semibold block">New Release</span>
              <span className="font-mono font-bold text-[#0071E3] text-sm">
                v{updateInfo.latest_version}
              </span>
            </div>
          </div>

          {/* Release Notes */}
          {updateInfo.release_notes && (
            <div>
              <h4 className="text-xs font-semibold text-[#1D1D1F] mb-1.5">
                Release Notes & Changelog
              </h4>
              <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.06] text-xs text-[#515154] font-mono leading-relaxed max-h-44 overflow-y-auto whitespace-pre-wrap select-text">
                {updateInfo.release_notes}
              </div>
            </div>
          )}

          {/* Progress / Status feedback */}
          {isUpdating && (
            <div className="p-3.5 rounded-2xl bg-[#0071E3]/5 border border-[#0071E3]/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#0071E3]">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {statusMessage}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-black/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#0071E3] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Update Error</span>
                <p className="text-[11px] mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#FAFAFC] border-t border-black/[0.06] flex items-center justify-between gap-3">
          <a
            href={updateInfo.html_url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-[#86868B] hover:text-[#0071E3] flex items-center gap-1 transition"
          >
            <span>View Release on GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUpdating}
              className="px-4 py-2 rounded-xl border border-black/[0.1] bg-white hover:bg-neutral-50 text-xs font-semibold text-[#1D1D1F] transition cursor-pointer disabled:opacity-40"
            >
              Later
            </button>
            <button
              type="button"
              onClick={handleApplyUpdate}
              disabled={isUpdating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isUpdating ? "Applying Update..." : "Apply Update Now"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
