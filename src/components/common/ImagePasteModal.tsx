import React, { useState, useEffect, useCallback } from "react";
import {
  Check,
  X,
  Copy,
  Download,
  Building,
  Receipt,
  Sparkles,
} from "lucide-react";

interface ImagePasteModalProps {
  onNavigateTab?: (tab: string) => void;
}

export const ImagePasteModal: React.FC<ImagePasteModalProps> = ({ onNavigateTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{
    width: number;
    height: number;
    sizeFormatted: string;
    type: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [appliedLogo, setAppliedLogo] = useState(false);

  const processImageFile = useCallback((file: File) => {
    // Security check: ensure valid MIME type
    if (!file.type.startsWith("image/")) return;

    // Security check: limit size to 8MB
    if (file.size > 8 * 1024 * 1024) {
      alert("Image is too large. Maximum supported size is 8MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) return;

      const img = new Image();
      img.onload = () => {
        const sizeKb = (file.size / 1024).toFixed(1);
        const formattedSize = file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
          : `${sizeKb} KB`;

        setImageMeta({
          width: img.naturalWidth,
          height: img.naturalHeight,
          sizeFormatted: formattedSize,
          type: file.type.replace("image/", "").toUpperCase(),
        });
        setDataUrl(result);
        setAppliedLogo(false);
        setCopied(false);
        setIsOpen(true);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }, []);

  // Global clipboard paste listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing standard text in an input or textarea without image items
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [processImageFile]);

  // Handle explicit custom paste event
  useEffect(() => {
    const handleCustomTrigger = (e: Event) => {
      const customEvent = e as CustomEvent<{ file?: File; dataUrl?: string }>;
      if (customEvent.detail?.file) {
        processImageFile(customEvent.detail.file);
      } else if (customEvent.detail?.dataUrl) {
        const url = customEvent.detail.dataUrl;
        const img = new Image();
        img.onload = () => {
          setImageMeta({
            width: img.naturalWidth,
            height: img.naturalHeight,
            sizeFormatted: "Clipboard Data",
            type: "IMAGE",
          });
          setDataUrl(url);
          setAppliedLogo(false);
          setCopied(false);
          setIsOpen(true);
        };
        img.src = url;
      }
    };

    window.addEventListener("lynterminal_open_image_paste", handleCustomTrigger);
    return () => window.removeEventListener("lynterminal_open_image_paste", handleCustomTrigger);
  }, [processImageFile]);

  const handleSetStoreLogo = () => {
    if (!dataUrl) return;
    try {
      localStorage.setItem("lynterminal_custom_logo", dataUrl);
      window.dispatchEvent(new CustomEvent("lynterminal_logo_updated", { detail: dataUrl }));
      setAppliedLogo(true);
      setTimeout(() => {
        setIsOpen(false);
      }, 700);
    } catch (err) {
      console.error("Failed to save store logo:", err);
      alert("Storage limit exceeded. Please choose a smaller logo image.");
    }
  };

  const handleAttachReceipt = () => {
    if (!dataUrl) return;
    try {
      sessionStorage.setItem("lynterminal_pending_receipt", dataUrl);
    } catch (err) {
      console.error("Failed to store pending receipt:", err);
      alert("Storage limit exceeded. Please choose a smaller receipt image.");
      return;
    }
    if (onNavigateTab) {
      onNavigateTab("expenses");
    }
    window.dispatchEvent(new CustomEvent("lynterminal_attach_receipt", { detail: dataUrl }));
    setIsOpen(false);
  };

  const handleCopyDataUrl = async () => {
    if (!dataUrl) return;
    try {
      await navigator.clipboard.writeText(dataUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `lynterminal-image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen || !dataUrl) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.08] overflow-hidden flex flex-col text-[#1D1D1F] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#1D1D1F]">
                Clipboard Image Detected
              </div>
              <div className="text-[11px] text-[#86868B]">
                {imageMeta?.width} × {imageMeta?.height} px · {imageMeta?.sizeFormatted} · {imageMeta?.type}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-black hover:bg-black/5 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Image Preview */}
        <div className="p-5 flex flex-col items-center">
          <div className="w-full max-h-[220px] rounded-2xl border border-black/[0.08] bg-[#F5F5F7] p-2 flex items-center justify-center overflow-hidden shadow-inner">
            <img
              src={dataUrl}
              alt="Pasted content"
              className="max-h-[200px] max-w-full object-contain rounded-xl"
            />
          </div>
          <div className="text-[11px] text-[#86868B] mt-2.5 text-center">
            Where would you like to apply this image?
          </div>
        </div>

        {/* Action Options */}
        <div className="p-5 pt-0 space-y-2.5">
          {/* Option 1: Set as Store Logo */}
          <button
            onClick={handleSetStoreLogo}
            disabled={appliedLogo}
            className={`w-full py-3 px-4 rounded-2xl flex items-center justify-between font-semibold text-xs transition cursor-pointer shadow-xs ${
              appliedLogo
                ? "bg-emerald-500 text-white"
                : "bg-black text-white hover:bg-neutral-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Building className="w-4 h-4" />
              <span>{appliedLogo ? "Applied as Store Logo!" : "Set as Store Logo & Branding"}</span>
            </div>
            {appliedLogo ? (
              <Check className="w-4 h-4" />
            ) : (
              <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded-full">
                Header & Invoices
              </span>
            )}
          </button>

          {/* Option 2: Attach as Expense Receipt */}
          <button
            onClick={handleAttachReceipt}
            className="w-full py-3 px-4 rounded-2xl flex items-center justify-between font-semibold text-xs bg-[#F5F5F7] hover:bg-neutral-200 text-neutral-800 transition cursor-pointer border border-black/[0.06]"
          >
            <div className="flex items-center gap-2.5">
              <Receipt className="w-4 h-4 text-neutral-600" />
              <span>Attach as Expense Receipt</span>
            </div>
            <span className="text-[10px] text-neutral-500">Expenses</span>
          </button>

          {/* Option 3: Utilities (Copy Data URL & Download) */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCopyDataUrl}
              className="flex-1 py-2 px-3 rounded-xl border border-black/[0.08] hover:bg-neutral-50 text-[11px] font-semibold text-neutral-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-neutral-500" />}
              <span>{copied ? "Copied!" : "Copy Data URL"}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex-1 py-2 px-3 rounded-xl border border-black/[0.08] hover:bg-neutral-50 text-[11px] font-semibold text-neutral-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              <span>Download File</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/[0.06] bg-neutral-50 flex items-center justify-between text-[11px] text-[#86868B]">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-white border border-black/10 font-mono text-[10px]">Ctrl+V</kbd> anywhere to paste</span>
          <button
            onClick={() => setIsOpen(false)}
            className="font-medium text-neutral-600 hover:text-black cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
