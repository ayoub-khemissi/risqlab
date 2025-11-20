import { Chip } from "@heroui/chip";

import {
  getRiskLevel,
  getRiskLevelColor,
} from "@/hooks/usePortfolioVolatility";

interface VolatilityBadgeProps {
  /**
   * Volatility value (annualized, as decimal, e.g., 0.45 for 45%)
   */
  value: number;
  /**
   * Display format
   */
  format?: "percentage" | "decimal";
  /**
   * Size of the badge
   */
  size?: "sm" | "md" | "lg";
  /**
   * Show risk level text
   */
  showRiskLevel?: boolean;
  /**
   * Variant of the chip
   */
  variant?: "solid" | "flat" | "bordered" | "light";
}

/**
 * Badge component to display volatility with appropriate color coding
 */
export function VolatilityBadge({
  value,
  format = "percentage",
  size = "sm",
  showRiskLevel = false,
  variant = "flat",
}: VolatilityBadgeProps) {
  const riskLevel = getRiskLevel(value);
  const color = getRiskLevelColor(riskLevel);

  // Format the value
  const displayValue =
    format === "percentage" ? `${(value * 100).toFixed(2)}%` : value.toFixed(4);

  // Get risk level label
  const riskLabelMap = {
    low: "Low Risk",
    medium: "Medium Risk",
    high: "High Risk",
    extreme: "Extreme Risk",
  };

  return (
    <Chip color={color} size={size} variant={variant}>
      {showRiskLevel ? riskLabelMap[riskLevel] : displayValue}
    </Chip>
  );
}
