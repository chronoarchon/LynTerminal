import type { jsPDF } from "jspdf";

/**
 * Directly prints a generated jsPDF instance as a pure PDF document.
 * This triggers the browser or system's PDF print pipeline directly,
 * eliminating the surrounding web page, headers, and navigation UI.
 */
export async function printPdfDocument(pdf: jsPDF): Promise<boolean> {
  try {
    // Inject print action into PDF document metadata
    pdf.autoPrint({ variant: "non-conform" });
    const blob = pdf.output("blob");
    const blobUrl = URL.createObjectURL(blob);

    // Create an invisible iframe to spool the PDF directly to the printer
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.border = "none";
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    let resolved = false;

    return await new Promise<boolean>((resolve) => {
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolved = true;
          resolve(true);
        } catch (e) {
          console.warn("Iframe direct PDF print error, falling back to window popup:", e);
          const win = window.open(blobUrl, "_blank");
          if (win) {
            win.focus();
            resolved = true;
            resolve(true);
          } else {
            resolve(false);
          }
        }
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(blobUrl);
          } catch {}
        }, 60000);
      };

      // Fallback timeout in case onload doesn't fire for application/pdf in some environments
      setTimeout(() => {
        if (!resolved) {
          const win = window.open(blobUrl, "_blank");
          if (win) {
            win.focus();
            resolve(true);
          } else {
            resolve(false);
          }
        }
      }, 1200);
    });
  } catch (err) {
    console.error("Failed to print pure PDF:", err);
    return false;
  }
}
