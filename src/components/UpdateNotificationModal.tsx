import React, { useState } from "react";
import {
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
  const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded-md bg-white/10 font-mono text-[11px] text-white font-medium"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const linkMatch = token.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={match.index}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline inline-flex items-center gap-0.5 font-medium"
          >
            <span>{linkMatch[1]}</span>
            <ExternalLink className="w-2.5 h-2.5 inline" />
          </a>
        );
      }
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
            className="p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-[11px] text-white overflow-x-auto my-2"
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

    if (trimmed.startsWith("#### ")) {
      elements.push(
        <h5
          key={i}
          className="text-xs font-semibold text-white mt-2 mb-1"
        >
          {trimmed.replace(/^####\s+/, "")}
        </h5>
      );
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <h4
          key={i}
          className="text-xs font-bold text-white mt-3 mb-1.5 flex items-center gap-1.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          <span>{trimmed.replace(/^###\s+/, "")}</span>
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h3
          key={i}
          className="text-xs font-bold text-white uppercase tracking-wider mt-2.5 mb-1"
        >
          {trimmed.replace(/^##\s+/, "")}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="text-sm font-bold text-white mt-2 mb-1">
          {trimmed.replace(/^#\s+/, "")}
        </h2>
      );
    } else if (trimmed.startsWith("> ")) {
      elements.push(
        <div
          key={i}
          className="pl-3 py-1.5 my-1.5 border-l-2 border-white/30 bg-white/5 rounded-r-xl text-xs text-neutral-300 italic"
        >
          {renderFormattedText(trimmed.replace(/^>\s*/, ""))}
        </div>
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        elements.push(
          <div
            key={i}
            className="flex items-start gap-2 text-xs text-neutral-300 leading-relaxed my-1 pl-1"
          >
            <span className="font-mono font-bold text-white text-xs shrink-0 w-4">
              {numMatch[1]}.
            </span>
            <div className="flex-1">{renderFormattedText(numMatch[2])}</div>
          </div>
        );
      }
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("+ ")) {
      const itemText = trimmed.replace(/^[-*+]\s+/, "");
      const isIndented = line.search(/\S/) > 0;
      elements.push(
        <div
          key={i}
          className={`flex items-start gap-2 text-xs text-neutral-300 leading-relaxed my-1 ${
            isIndented ? "pl-5" : "pl-1"
          }`}
        >
          <span className="text-white font-bold text-sm leading-none mt-0.5">•</span>
          <div className="flex-1">{renderFormattedText(itemText)}</div>
        </div>
      );
    } else {
      elements.push(
        <p key={i} className="text-xs text-neutral-300 leading-relaxed my-1">
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

      // Step 2: Download release binary
      setCurrentStep(2);
      setStatusMessage("Step 2/4: Downloading release binary...");
      setProgress(50);
      await api.downloadUpdateBinary(updateInfo.download_url, updateInfo.latest_version);

      // Step 3: Verify binary integrity
      setCurrentStep(3);
      setStatusMessage("Step 3/4: Verifying binary...");
      setProgress(75);
      await api.verifyUpdateBinary(updateInfo.latest_version);

      // Step 4: Apply update and relaunch
      setCurrentStep(4);
      setStatusMessage("Step 4/4: Applying update and relaunching...");
      setProgress(100);
      await api.applyUpdateAndRestart(updateInfo.latest_version);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-black/[0.08] overflow-hidden flex flex-col text-black lux-modal-card">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-black/[0.06] bg-[#F9FAFB]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black/5 border border-black/10 flex items-center justify-center text-black shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/5 text-black text-[10px] font-bold tracking-wider uppercase border border-black/10 mb-1">
                <span>Update Ready</span>
                <span>•</span>
                <span className="font-mono">v{updateInfo.latest_version}</span>
              </div>
              <h2 className="text-base font-bold text-black tracking-tight">
                Software Update
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="p-1.5 rounded-full hover:bg-black/5 text-neutral-400 hover:text-black transition cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Safe Data Guarantee Card */}
          <div className="p-3.5 rounded-2xl bg-[#F9FAFB] border border-black/[0.06] flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-black block">
                Zero Data Loss
              </span>
              <p className="text-neutral-500 text-[11px] mt-0.5 leading-relaxed">
                Persistent database isolated. Auto backup snapshot created before upgrade.
              </p>
            </div>
          </div>

          {/* Version Comparison */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-[#F9FAFB] border border-black/[0.06]">
              <span className="text-[11px] text-neutral-500 block">Current</span>
              <span className="font-mono font-bold text-black text-sm">
                v{updateInfo.current_version}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#F9FAFB] border border-black/10">
              <span className="text-[11px] text-neutral-700 font-semibold block">Target</span>
              <span className="font-mono font-bold text-black text-sm">
                v{updateInfo.latest_version}
              </span>
            </div>
          </div>

          {/* Release Notes with Styled Typography */}
          {updateInfo.release_notes && (
            <div>
              <h4 className="text-xs font-bold text-black mb-1.5 flex items-center justify-between uppercase tracking-wider">
                <span>Changelog</span>
                <span className="text-[10px] text-neutral-500 font-mono">v{updateInfo.latest_version}</span>
              </h4>
              <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-black/[0.06] max-h-52 overflow-y-auto select-text scrollbar-thin text-black">
                <FormattedReleaseNotes content={updateInfo.release_notes} />
              </div>
            </div>
          )}

          {/* Step-by-Step Progress Feedback */}
          {isUpdating && (
            <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-black/[0.06] space-y-3">
              {/* Step indicator pills */}
              <div className="grid grid-cols-4 gap-1.5">
                {stepsList.map((step) => {
                  const isDone = currentStep > step.num;
                  const isCurrent = currentStep === step.num;
                  return (
                    <div
                      key={step.num}
                      className={`px-2 py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                        isDone
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          : isCurrent
                          ? "bg-black text-white shadow-xs font-black"
                          : "bg-neutral-100 text-neutral-400 border border-black/5"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <span>{step.num}</span>
                      )}
                      <span className="truncate">{step.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Status Message and Percent */}
              <div className="flex items-center justify-between text-xs font-bold text-black">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-black" />
                  <span>{statusMessage}</span>
                </span>
                <span className="font-mono text-neutral-600">{progress}%</span>
              </div>

              {/* Smooth Progress Bar */}
              <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-black h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-red-700 block">Update Failed</span>
                <p className="text-[11px] mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#F9FAFB] border-t border-black/[0.06] flex items-center justify-between gap-3">
          <a
            href={updateInfo.html_url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-neutral-500 hover:text-black flex items-center gap-1 transition"
          >
            <span>GitHub Release</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUpdating}
              className="px-4 py-2 rounded-full border border-black/10 bg-neutral-100 hover:bg-neutral-200 text-xs font-bold text-neutral-700 transition cursor-pointer disabled:opacity-40"
            >
              Later
            </button>
            <button
              type="button"
              onClick={handleApplyUpdate}
              disabled={isUpdating}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Install Update</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
