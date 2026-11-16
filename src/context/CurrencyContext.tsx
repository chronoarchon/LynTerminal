import React, { createContext, useContext, useMemo } from "react";

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
    return `${symbol}0.00`;
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
    return "0.00";
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
    return {
      currencySymbol: activeSymbol,
      currencyCode: activeCode,
      formatCurrency: (amount, decimals) => formatCurrency(amount, activeSymbol, decimals),
      formatAmount: (amount, decimals) => formatAmount(amount, decimals),
    };
  }, [symbol, code]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
