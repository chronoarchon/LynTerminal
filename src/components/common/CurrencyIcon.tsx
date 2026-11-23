import React from "react";
import { DollarSign, IndianRupee } from "lucide-react";
import { useCurrency } from "../../context/CurrencyContext";

interface CurrencyIconProps {
  className?: string;
  strokeWidth?: number;
}

/**
 * Standard, clean, semi-bold currency icon component.
 * Automatically displays standard IndianRupee (₹) or DollarSign ($)
 * with standard semi-bold stroke (strokeWidth=2) based on active currency.
 */
export const CurrencyIcon: React.FC<CurrencyIconProps> = ({
  className = "w-4 h-4",
  strokeWidth = 2,
}) => {
  const { currencyCode, currencySymbol } = useCurrency();
  const isINR = currencyCode === "INR" || currencySymbol === "₹";

  if (isINR) {
    return <IndianRupee className={className} strokeWidth={strokeWidth} />;
  }

  return <DollarSign className={className} strokeWidth={strokeWidth} />;
};
