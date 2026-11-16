import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from "react";
import { AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  requiredMatch?: string;
  isDestructive?: boolean;
}

export interface AlertOptions {
  title?: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  buttonText?: string;
}

export interface ToastOptions {
  message: string;
  type?: "success" | "info" | "error";
  duration?: number;
}

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "info" | "error";
}

interface AppleDialogContextValue {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
  alert: (options: AlertOptions | string) => Promise<void>;
  toast: (options: ToastOptions | string) => void;
}

const AppleDialogContext = createContext<AppleDialogContextValue | null>(null);

export const AppleDialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Dialog State
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: "alert" | "confirm" | "prompt";
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    isDestructive: boolean;
    placeholder: string;
    requiredMatch?: string;
    alertType: "info" | "success" | "warning" | "error";
  }>({
    isOpen: false,
    type: "alert",
    title: "",
    message: "",
    confirmText: "OK",
    cancelText: "Cancel",
    isDestructive: false,
    placeholder: "",
    alertType: "info",
  });

  const [promptInput, setPromptInput] = useState("");
  const resolverRef = useRef<((val: any) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toast State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (dialogState.isOpen && dialogState.type === "prompt") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [dialogState.isOpen, dialogState.type]);

  useEffect(() => {
    // Intercept native browser alert so all alert calls open as an Apple modal dialog
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      alert(String(msg ?? ""));
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const confirm = (options: ConfirmOptions | string): Promise<boolean> => {
    const opts = typeof options === "string" ? { message: options } : options;
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        isOpen: true,
        type: "confirm",
        title: opts.title || "Confirmation",
        message: opts.message,
        confirmText: opts.confirmText || "Continue",
        cancelText: opts.cancelText || "Cancel",
        isDestructive: opts.isDestructive ?? false,
        placeholder: "",
        alertType: opts.isDestructive ? "warning" : "info",
      });
    });
  };

  const prompt = (options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setPromptInput(options.defaultValue || "");
      setDialogState({
        isOpen: true,
        type: "prompt",
        title: options.title || "Action Required",
        message: options.message,
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
        isDestructive: options.isDestructive ?? false,
        placeholder: options.placeholder || "",
        requiredMatch: options.requiredMatch,
        alertType: options.isDestructive ? "warning" : "info",
      });
    });
  };

  const alert = (options: AlertOptions | string): Promise<void> => {
    const opts = typeof options === "string" ? { message: options } : options;
    return new Promise((resolve) => {
      resolverRef.current = () => resolve();
      setDialogState({
        isOpen: true,
        type: "alert",
        title: opts.title || (opts.type === "error" ? "Error" : opts.type === "success" ? "Success" : "Notice"),
        message: opts.message,
        confirmText: opts.buttonText || "Dismiss",
        cancelText: "",
        isDestructive: false,
        placeholder: "",
        alertType: opts.type || "info",
      });
    });
  };

  const toast = (options: ToastOptions | string) => {
    const opts = typeof options === "string" ? { message: options } : options;
    const id = Math.random().toString(36).substring(2, 9);
    const item: ToastItem = {
      id,
      message: opts.message,
      type: opts.type || "info",
    };
    setToasts((prev) => [...prev, item]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, opts.duration || 3200);
  };

  const handleConfirm = () => {
    if (dialogState.type === "prompt") {
      if (dialogState.requiredMatch && promptInput !== dialogState.requiredMatch) {
        return;
      }
      resolverRef.current?.(promptInput);
    } else if (dialogState.type === "confirm") {
      resolverRef.current?.(true);
    } else {
      resolverRef.current?.(undefined);
    }
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    if (dialogState.type === "confirm") {
      resolverRef.current?.(false);
    } else if (dialogState.type === "prompt") {
      resolverRef.current?.(null);
    } else {
      resolverRef.current?.(undefined);
    }
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  const isConfirmDisabled =
    dialogState.type === "prompt" &&
    dialogState.requiredMatch &&
    promptInput !== dialogState.requiredMatch;

  return (
    <AppleDialogContext.Provider value={{ confirm, prompt, alert, toast }}>
      {children}

      {/* Floating Apple Toasts Container */}
      <div className="fixed bottom-5 right-5 z-[110] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom-2 fade-in duration-200 ${
              t.type === "success"
                ? "bg-white/95 text-[#1D1D1F] border-[#34C759]/30 shadow-[#34C759]/5"
                : t.type === "error"
                ? "bg-white/95 text-[#FF3B30] border-[#FF3B30]/30 shadow-[#FF3B30]/5"
                : "bg-white/95 text-[#1D1D1F] border-black/[0.08]"
            }`}
          >
            {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0" />}
            {t.type === "error" && <XCircle className="w-4 h-4 text-[#FF3B30] shrink-0" />}
            {t.type === "info" && <Info className="w-4 h-4 text-[#0071E3] shrink-0" />}
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Apple Modal Dialog */}
      {dialogState.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="bg-white rounded-3xl p-6 shadow-2xl border border-black/[0.08] max-w-md w-full animate-in zoom-in-95 fade-in duration-150 select-none"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  dialogState.isDestructive
                    ? "bg-[#FF3B30]/10 text-[#FF3B30]"
                    : dialogState.alertType === "success"
                    ? "bg-[#34C759]/10 text-[#34C759]"
                    : "bg-[#0071E3]/10 text-[#0071E3]"
                }`}
              >
                {dialogState.isDestructive ? (
                  <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
                ) : dialogState.alertType === "success" ? (
                  <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                ) : (
                  <Info className="w-5 h-5 stroke-[2.2]" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-[#1D1D1F] leading-tight">
                  {dialogState.title}
                </h3>
                <p className="text-xs text-[#6E6E73] mt-1.5 leading-relaxed whitespace-pre-line">
                  {dialogState.message}
                </p>
              </div>
            </div>

            {dialogState.type === "prompt" && (
              <div className="mb-5 mt-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isConfirmDisabled) handleConfirm();
                    if (e.key === "Escape") handleCancel();
                  }}
                  placeholder={dialogState.placeholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.12] bg-[#F5F5F7] text-xs font-medium text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:bg-white transition"
                />
                {dialogState.requiredMatch && (
                  <div className="text-[11px] text-[#86868B] mt-1.5 font-mono">
                    Type <span className="font-bold text-[#FF3B30]">{dialogState.requiredMatch}</span> to confirm
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              {dialogState.type !== "alert" && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#F5F5F7] hover:bg-[#EBEBED] text-[#1D1D1F] transition apple-press cursor-pointer"
                >
                  {dialogState.cancelText}
                </button>
              )}
              <button
                type="button"
                disabled={Boolean(isConfirmDisabled)}
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition apple-press cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  dialogState.isDestructive
                    ? "bg-[#FF3B30] hover:bg-[#D70015] text-white shadow-xs"
                    : "bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-xs"
                }`}
              >
                {dialogState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppleDialogContext.Provider>
  );
};

export const useAppleDialog = (): AppleDialogContextValue => {
  const context = useContext(AppleDialogContext);
  if (!context) {
    throw new Error("useAppleDialog must be used within an AppleDialogProvider");
  }
  return context;
};
