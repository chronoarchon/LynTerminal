import React, { createContext, useContext, useMemo } from "react";

const ZERO_DECIMAL_CURRENCIES = new Set([
  "JPY", "KRW", "VND", "IDR", "CLP", "ISK", "PYG", "UGX", "RWF",
  "BIF", "DJF", "GNF", "KMF", "MGA", "VUV", "XAF", "XOF", "XPF",
]);

export function getDefaultCurrencyDecimals(code: string = "USD"): number {
  return ZERO_DECIMAL_CURRENCIES.has(code.trim().toUpperCase()) ? 0 : 2;
}

/**
 * Universal Currency & Number Formatting Utility
 * Correctly places negative sign before currency symbol: -$10.00 instead of $-10.00
 */
export function formatCurrency(
  amount: number | null | undefined,
  symbol: string = "$",
  decimals: number = 2
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${symbol}${(0).toFixed(decimals)}`;
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formattedNumber = absAmount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return isNegative ? `-${symbol}${formattedNumber}` : `${symbol}${formattedNumber}`;
}

export function formatAmount(
  amount: number | null | undefined,
  decimals: number = 2
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return (0).toFixed(decimals);
  }
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

interface CurrencyContextType {
  currencySymbol: string;
  currencyCode: string;
  formatCurrency: (amount: number | null | undefined, decimals?: number) => string;
  formatAmount: (amount: number | null | undefined, decimals?: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currencySymbol: "$",
  currencyCode: "USD",
  formatCurrency: (amount, decimals) => formatCurrency(amount, "$", decimals),
  formatAmount: (amount, decimals) => formatAmount(amount, decimals),
});

interface CurrencyProviderProps {
  symbol?: string;
  code?: string;
  children: React.ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({
  symbol = "$",
  code = "USD",
  children,
}) => {
  const value = useMemo<CurrencyContextType>(() => {
    const activeSymbol = symbol || "$";
    const activeCode = code || "USD";
    const defaultDecimals = getDefaultCurrencyDecimals(activeCode);
    return {
      currencySymbol: activeSymbol,
      currencyCode: activeCode,
      formatCurrency: (amount, decimals = defaultDecimals) =>
        formatCurrency(amount, activeSymbol, decimals),
      formatAmount: (amount, decimals = defaultDecimals) =>
        formatAmount(amount, decimals),
    };
  }, [symbol, code]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
