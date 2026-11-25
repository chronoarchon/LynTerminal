export interface SplitTenderState {
  cash: string;
  card: string;
}

export interface SplitTenderValidation {
  cashAmount: number;
  cardAmount: number;
  combinedTotal: number;
  remaining: number;
  isValid: boolean;
  error: string | null;
}

/**
 * Rounds currency figures accurately to 2 decimal places across all currencies
 * (avoids JS floating point drift like 180 - 100.00 = 79.99999999999999).
 */
export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Parses a numeric tender input cleanly; returns null if empty or non-numeric.
 */
function parseTenderInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : NaN;
}

/**
 * Initializes a balanced default split for a given bill total.
 */
export function createInitialSplit(totalAmount: number): SplitTenderState {
  const total = Math.max(0, roundCurrency(totalAmount));
  if (total <= 0) {
    return { cash: "0.00", card: "0.00" };
  }
  const halfCash = roundCurrency(total / 2);
  const remainderCard = roundCurrency(total - halfCash);
  return {
    cash: halfCash.toFixed(2),
    card: remainderCard.toFixed(2),
  };
}

/**
 * Updates one tender side (cash or card) and automatically calculates and feeds
 * the exact remaining balance into the opposite tender field (when 0 <= val <= total).
 * Accepts empty string while editing so users can clear & retype smoothly.
 */
export function calculateCounterSplit(
  editedSide: "cash" | "card",
  rawValue: string,
  totalAmount: number
): SplitTenderState {
  const total = Math.max(0, roundCurrency(totalAmount));
  const sanitized = rawValue.replace(/[^0-9.]/g, "");
  const dotParts = sanitized.split(".");
  const normalizedInput =
    dotParts.length > 2
      ? `${dotParts[0]}.${dotParts.slice(1).join("")}`
      : sanitized;

  if (!normalizedInput) {
    return editedSide === "cash"
      ? { cash: "", card: total.toFixed(2) }
      : { cash: total.toFixed(2), card: "" };
  }

  const parsed = parseTenderInput(normalizedInput);
  if (parsed === null || Number.isNaN(parsed)) {
    return editedSide === "cash"
      ? { cash: normalizedInput, card: total.toFixed(2) }
      : { cash: total.toFixed(2), card: normalizedInput };
  }

  if (parsed < 0) {
    return editedSide === "cash"
      ? { cash: "0.00", card: total.toFixed(2) }
      : { cash: total.toFixed(2), card: "0.00" };
  }

  const bounded = roundCurrency(Math.min(total, parsed));
  const counter = roundCurrency(Math.max(0, total - bounded));

  // Keep raw normalizedInput if within valid range so user can type decimals like "80." smoothly
  const preservedInput = parsed <= total ? normalizedInput : normalizedInput;

  return editedSide === "cash"
    ? { cash: preservedInput, card: counter.toFixed(2) }
    : { cash: counter.toFixed(2), card: preservedInput };
}

/**
 * Validates that Cash + Card equals Total Bill with no negative, NaN, or overflow amounts.
 */
export function validateSplitTender(
  cashStr: string,
  cardStr: string,
  totalAmount: number,
  formatCurrencyFn?: (n: number) => string
): SplitTenderValidation {
  const total = Math.max(0, roundCurrency(totalAmount));
  const fmt = formatCurrencyFn || ((n: number) => n.toFixed(2));

  const parsedCash = parseTenderInput(cashStr);
  const parsedCard = parseTenderInput(cardStr);

  if (Number.isNaN(parsedCash) || Number.isNaN(parsedCard)) {
    return {
      cashAmount: 0,
      cardAmount: 0,
      combinedTotal: 0,
      remaining: total,
      isValid: false,
      error: "Enter valid numeric tender amounts.",
    };
  }

  const cashVal = roundCurrency(parsedCash ?? 0);
  const cardVal = roundCurrency(parsedCard ?? 0);

  if (cashVal < 0 || cardVal < 0) {
    return {
      cashAmount: cashVal,
      cardAmount: cardVal,
      combinedTotal: roundCurrency(cashVal + cardVal),
      remaining: total,
      isValid: false,
      error: "Split amounts cannot be negative.",
    };
  }

  if (cashVal > total + 0.009 || cardVal > total + 0.009) {
    return {
      cashAmount: cashVal,
      cardAmount: cardVal,
      combinedTotal: roundCurrency(cashVal + cardVal),
      remaining: roundCurrency(total - (cashVal + cardVal)),
      isValid: false,
      error: `Single tender cannot exceed bill total (${fmt(total)}).`,
    };
  }

  const combined = roundCurrency(cashVal + cardVal);
  const diff = roundCurrency(total - combined);

  if (total <= 0) {
    return {
      cashAmount: 0,
      cardAmount: 0,
      combinedTotal: 0,
      remaining: 0,
      isValid: false,
      error: "Cart total must be greater than zero.",
    };
  }

  if (Math.abs(diff) > 0.01) {
    return {
      cashAmount: cashVal,
      cardAmount: cardVal,
      combinedTotal: combined,
      remaining: diff,
      isValid: false,
      error:
        diff > 0
          ? `Remaining split due: ${fmt(diff)}`
          : `Split exceeds bill total by ${fmt(Math.abs(diff))}`,
    };
  }

  return {
    cashAmount: cashVal,
    cardAmount: cardVal,
    combinedTotal: combined,
    remaining: 0,
    isValid: true,
    error: null,
  };
}

/**
 * Formats canonical payment_method description compatible with Rust liquidity parser
 * across all currency symbols ($, ₹, €, £, ¥, etc.).
 */
export function formatSplitPaymentDescription(
  currencySymbol: string,
  cashAmount: number,
  cardAmount: number,
  secondaryLabel: string = "Card"
): string {
  const sym = currencySymbol || "$";
  return `Split (${sym}${roundCurrency(cashAmount).toFixed(2)} Cash + ${sym}${roundCurrency(cardAmount).toFixed(2)} ${secondaryLabel})`;
}
