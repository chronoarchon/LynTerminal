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
            className={`pointer-events-auto px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom-2 fade-in duration-200 bg-white text-black ${
              t.type === "success"
                ? "border-emerald-300"
                : t.type === "error"
                ? "border-red-300"
                : "border-black/10"
            }`}
          >
            {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {t.type === "error" && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
            {t.type === "info" && <Info className="w-4 h-4 text-neutral-600 shrink-0" />}
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>

      {/* 70% White / 30% Black Luxury Modal Dialog */}
      {dialogState.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="bg-white rounded-3xl p-6 shadow-2xl border border-black/[0.08] max-w-md w-full animate-in zoom-in-95 fade-in duration-150 select-none text-black lux-modal-card"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                  dialogState.isDestructive
                    ? "bg-red-50 text-red-600 border-red-200"
                    : dialogState.alertType === "success"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : "bg-neutral-100 text-black border-black/5"
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
                <h3 className="text-base font-bold text-black leading-tight">
                  {dialogState.title}
                </h3>
                <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed whitespace-pre-line">
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-[#F9FAFB] text-xs font-medium text-black placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-black focus:ring-1 focus:ring-black/20 transition"
                />
                {dialogState.requiredMatch && (
                  <div className="text-[11px] text-neutral-500 mt-1.5 font-mono">
                    Type <span className="font-bold text-red-600">{dialogState.requiredMatch}</span> to confirm
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              {dialogState.type !== "alert" && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-black/5 text-neutral-800 transition cursor-pointer"
                >
                  {dialogState.cancelText}
                </button>
              )}
              <button
                type="button"
                disabled={Boolean(isConfirmDisabled)}
                onClick={handleConfirm}
                className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  dialogState.isDestructive
                    ? "bg-red-600 hover:bg-red-500 text-white shadow-md"
                    : "bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-md"
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
