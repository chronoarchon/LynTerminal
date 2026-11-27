import type { ReceiptPrintPayload, Settings } from "../types";
import { getDefaultCurrencyDecimals } from "../context/CurrencyContext";

export const ESC_INIT = [0x1b, 0x40] as const;
export const GS_CUT_PARTIAL = [0x1d, 0x56, 0x42, 0x00] as const;
export const ESC_DRAWER_PULSE = [0x1b, 0x70, 0x00, 0x19, 0xfa] as const;

export function sanitizeEscposText(input: string): string {
  let out = "";
  for (const ch of input) {
    if (ch === "₹") out += "Rs.";
    else if (ch === "€") out += "EUR ";
    else if (ch === "£") out += "GBP ";
    else if (ch === "¥") out += "JPY ";
    else if (ch === "–" || ch === "—" || ch === "−") out += "-";
    else if (ch === "’" || ch === "‘") out += "'";
    else if (ch === "“" || ch === "”") out += '"';
    else if (ch === "\r" || ch === "\n") out += " ";
    else if (ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e) out += ch;
    else out += "?";
  }
  return out;
}

export function getReceiptColumnWidth(paperWidth?: string): number {
  return paperWidth?.trim().toLowerCase() === "58mm" ? 32 : 48;
}

function padTwoCol(left: string, right: string, width: number): string {
  const l = sanitizeEscposText(left);
  const r = sanitizeEscposText(right);
  if (l.length + r.length + 1 <= width) {
    return `${l}${" ".repeat(width - l.length - r.length)}${r}`;
  }
  const maxLeft = Math.max(0, width - r.length - 1);
  const trunc = l.slice(0, maxLeft);
  const spaces = Math.max(0, width - trunc.length - r.length);
  return `${trunc}${" ".repeat(spaces)}${r}`;
}

export function buildEscposPreviewLines(
  settings: Pick<
    Settings,
    | "business_name"
    | "currency_symbol"
    | "currency_code"
    | "tax_name"
    | "paper_width"
    | "auto_cut"
    | "open_cash_drawer"
  >,
  payload: ReceiptPrintPayload
): { columns: number; lines: string[]; bytes: number[] } {
  const width = getReceiptColumnWidth(payload.paper_width || settings.paper_width);
  const dec = getDefaultCurrencyDecimals(settings.currency_code || "USD");
  const cur =
    settings.currency_symbol?.trim() === "₹"
      ? "Rs."
      : sanitizeEscposText(settings.currency_symbol || "$") || "$";
  const divider = "-".repeat(width);
  const lines: string[] = [];

  lines.push(sanitizeEscposText(settings.business_name).slice(0, width));
  lines.push(divider);
  lines.push(padTwoCol("Bill:", payload.invoice_number, width));
  lines.push(padTwoCol("Date:", payload.invoice_date, width));
  lines.push(padTwoCol("Party:", payload.party_name, width));
  lines.push(padTwoCol("Mode:", payload.payment_method, width));
  lines.push(divider);

  for (const item of payload.items) {
    lines.push(sanitizeEscposText(item.name).slice(0, width));
    lines.push(
      padTwoCol(
        `  ${item.quantity} x ${cur}${item.unit_price.toFixed(dec)}`,
        `${cur}${item.line_total.toFixed(dec)}`,
        width
      )
    );
  }

  lines.push(divider);
  lines.push(padTwoCol("Subtotal:", `${cur}${payload.subtotal.toFixed(dec)}`, width));
  if (Math.abs(payload.discount_amount) >= 0.005) {
    lines.push(padTwoCol("Discount:", `-${cur}${payload.discount_amount.toFixed(dec)}`, width));
  }
  if (Math.abs(payload.tax_amount) >= 0.005) {
    lines.push(
      padTwoCol(`${sanitizeEscposText(settings.tax_name || "Tax")}:`, `${cur}${payload.tax_amount.toFixed(dec)}`, width)
    );
  }
  if (Math.abs(payload.round_off) >= 0.005) {
    const sign = payload.round_off >= 0 ? "+" : "-";
    lines.push(padTwoCol("Round Off:", `${sign}${cur}${Math.abs(payload.round_off).toFixed(dec)}`, width));
  }
  lines.push(padTwoCol("TOTAL:", `${cur}${payload.total_amount.toFixed(dec)}`, width));
  lines.push(padTwoCol("Paid:", `${cur}${payload.paid_amount.toFixed(dec)}`, width));
  lines.push(divider);

  const bytes: number[] = [...ESC_INIT];
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      bytes.push(line.charCodeAt(i));
    }
    bytes.push(0x0a);
  }
  bytes.push(0x0a, 0x0a);

  if (settings.auto_cut !== false) {
    bytes.push(...GS_CUT_PARTIAL);
  }
  if (payload.open_drawer ?? settings.open_cash_drawer) {
    bytes.push(...ESC_DRAWER_PULSE);
  }

  return { columns: width, lines, bytes };
}
