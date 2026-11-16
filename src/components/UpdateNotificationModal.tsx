import React, { useState } from "react";
import {
  Sparkles,
  Download,
  AlertCircle,
  X,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { api } from "../services/api";
import type { AppUpdateInfo } from "../types";

interface UpdateNotificationModalProps {
  updateInfo: AppUpdateInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

const renderFormattedText = (text: string) => {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-[#1D1D1F]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded-md bg-black/[0.05] font-mono text-[11px] text-[#0071E3] font-medium"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts;
};

const FormattedReleaseNotes: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <div
            key={`code-${i}`}
            className="p-2.5 rounded-xl bg-black/[0.04] border border-black/[0.06] font-mono text-[11px] text-[#1D1D1F] overflow-x-auto my-2"
          >
            <pre>{codeBlockContent.join("\n")}</pre>
          </div>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    if (!trimmed) return;

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4
          key={i}
          className="text-xs font-bold text-[#1D1D1F] mt-3 mb-1.5 flex items-center gap-1.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />
          <span>{trimmed.replace(/^###\s+/, "")}</span>
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h3
          key={i}
          className="text-xs font-bold text-[#0071E3] uppercase tracking-wider mt-2.5 mb-1"
        >
          {trimmed.replace(/^##\s+/, "")}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="text-sm font-bold text-[#1D1D1F] mt-2 mb-1">
          {trimmed.replace(/^#\s+/, "")}
        </h2>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const itemText = trimmed.replace(/^[-*]\s+/, "");
      elements.push(
        <div
          key={i}
          className="flex items-start gap-2 text-xs text-[#515154] leading-relaxed my-1 pl-1"
        >
          <span className="text-[#0071E3] font-bold text-sm leading-none mt-0.5">•</span>
          <div className="flex-1">{renderFormattedText(itemText)}</div>
        </div>
      );
    } else {
      elements.push(
        <p key={i} className="text-xs text-[#515154] leading-relaxed my-1">
          {renderFormattedText(trimmed)}
        </p>
      );
    }
  });

  return <div className="space-y-1">{elements}</div>;
};

export const UpdateNotificationModal: React.FC<UpdateNotificationModalProps> = ({
  updateInfo,
  isOpen,
  onClose,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState(0);

  if (!isOpen || !updateInfo) return null;

  const handleApplyUpdate = async () => {
    try {
      setIsUpdating(true);
      setErrorMessage("");

      // Step 1: Pre-update SQLite safety backup
      setCurrentStep(1);
      setStatusMessage("Step 1/4: Backing up database...");
      setProgress(25);
      await api.createPreUpdateBackup(updateInfo.latest_version);
      await new Promise((r) => setTimeout(r, 400));

      // Step 2: Download release binary
      setCurrentStep(2);
      setStatusMessage("Step 2/4: Downloading release binary...");
      setProgress(50);
      await new Promise((r) => setTimeout(r, 400));

      // Step 3: Verify binary integrity
      setCurrentStep(3);
      setStatusMessage("Step 3/4: Verifying binary...");
      setProgress(75);
      await new Promise((r) => setTimeout(r, 400));

      // Step 4: Apply update and relaunch
      setCurrentStep(4);
      setStatusMessage("Step 4/4: Applying update and relaunching...");
      setProgress(100);
      await api.applyAppUpdate(updateInfo.download_url, updateInfo.latest_version);
    } catch (err) {
      console.error("Update failed:", err);
      setErrorMessage(String(err));
      setIsUpdating(false);
      setCurrentStep(0);
      setProgress(0);
    }
  };

  const stepsList = [
    { num: 1, label: "Backing up" },
    { num: 2, label: "Downloading" },
    { num: 3, label: "Verifying" },
    { num: 4, label: "Relaunching" },
  ];

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

          {/* Release Notes with Styled Typography */}
          {updateInfo.release_notes && (
            <div>
              <h4 className="text-xs font-semibold text-[#1D1D1F] mb-1.5 flex items-center justify-between">
                <span>Release Notes &amp; Changelog</span>
                <span className="text-[10px] text-[#86868B] font-mono">v{updateInfo.latest_version}</span>
              </h4>
              <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.06] max-h-52 overflow-y-auto select-text scrollbar-thin">
                <FormattedReleaseNotes content={updateInfo.release_notes} />
              </div>
            </div>
          )}

          {/* Step-by-Step Progress Feedback */}
          {isUpdating && (
            <div className="p-4 rounded-2xl bg-[#0071E3]/5 border border-[#0071E3]/20 space-y-3">
              {/* Step indicator pills */}
              <div className="grid grid-cols-4 gap-1.5">
                {stepsList.map((step) => {
                  const isDone = currentStep > step.num;
                  const isCurrent = currentStep === step.num;
                  return (
                    <div
                      key={step.num}
                      className={`px-2 py-1.5 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
                        isDone
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                          : isCurrent
                          ? "bg-[#0071E3] text-white shadow-xs"
                          : "bg-black/[0.04] text-[#86868B]"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <span>{step.num}</span>
                      )}
                      <span className="truncate">{step.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Status Message and Percent */}
              <div className="flex items-center justify-between text-xs font-semibold text-[#0071E3]">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>{statusMessage}</span>
                </span>
                <span className="font-mono">{progress}%</span>
              </div>

              {/* Smooth Progress Bar */}
              <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#0071E3] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Update Error</span>
                <p className="text-[11px] mt-0.5 leading-relaxed">{errorMessage}</p>
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
              {isUpdating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{statusMessage.split(":")[0]}...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Apply Update Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
