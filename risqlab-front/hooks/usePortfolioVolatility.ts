import { useState, useEffect } from "react";

import { API_BASE_URL } from "@/config/constants";
import {
  PortfolioVolatilityResponse,
  PortfolioConstituentsVolatilityResponse,
  VolatilityPeriod,
  DiversificationBenefit,
  RiskContribution,
} from "@/types/volatility";

/**
 * Hook to fetch portfolio volatility data
 * @param period - Time period for historical data
 * @returns Portfolio volatility data, loading state, and error
 */
export function usePortfolioVolatility(period: VolatilityPeriod = "all") {
  const [data, setData] = useState<PortfolioVolatilityResponse["data"] | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/volatility/portfolio?period=${period}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch portfolio volatility");
        }

        const result: PortfolioVolatilityResponse = await response.json();

        setData(result.data);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [period]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch portfolio volatility constituents
 * @returns Portfolio constituents with their volatility data
 */
export function usePortfolioConstituentsVolatility() {
  const [data, setData] = useState<
    PortfolioConstituentsVolatilityResponse["data"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/volatility/portfolio/constituents`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch portfolio constituents volatility");
        }

        const result: PortfolioConstituentsVolatilityResponse =
          await response.json();

        setData(result.data);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, isLoading, error };
}

/**
 * Calculate diversification benefit
 * @param portfolioVol - Portfolio volatility
 * @param constituents - Array of constituents with weights and volatilities
 * @returns Diversification benefit calculation
 */
export function calculateDiversificationBenefit(
  portfolioVol: number,
  constituents: Array<{ weight: number; annualized_volatility: number }>,
): DiversificationBenefit {
  // Calculate weighted average volatility
  const weightedAverageVolatility = constituents.reduce(
    (sum, constituent) =>
      sum + constituent.weight * constituent.annualized_volatility,
    0,
  );

  // Calculate benefit
  const benefitAbsolute = weightedAverageVolatility - portfolioVol;
  const benefitPercentage =
    weightedAverageVolatility > 0
      ? (benefitAbsolute / weightedAverageVolatility) * 100
      : 0;

  return {
    portfolioVolatility: portfolioVol,
    weightedAverageVolatility,
    benefitAbsolute,
    benefitPercentage,
  };
}

/**
 * Calculate risk contribution for each constituent
 * @param constituents - Array of constituents with weights and volatilities
 * @returns Array of risk contributions
 */
export function calculateRiskContributions(
  constituents: Array<{
    crypto_id: number;
    symbol: string;
    name: string;
    cmc_id: number;
    weight: number;
    daily_volatility: number;
    annualized_volatility: number;
    market_cap_usd: number;
  }>,
): RiskContribution[] {
  // Calculate total risk (sum of weight × volatility)
  const totalRisk = constituents.reduce(
    (sum, c) => sum + c.weight * c.annualized_volatility,
    0,
  );

  return constituents.map((constituent) => {
    const riskContribution =
      constituent.weight * constituent.annualized_volatility;
    const riskContributionPercentage =
      totalRisk > 0 ? (riskContribution / totalRisk) * 100 : 0;

    return {
      ...constituent,
      riskContribution,
      riskContributionPercentage,
    };
  });
}

/**
 * Determine risk level based on annualized volatility
 * @param volatility - Annualized volatility (as decimal, e.g., 0.45 for 45%)
 * @returns Risk level classification
 */
export function getRiskLevel(
  volatility: number,
): "low" | "medium" | "high" | "extreme" {
  const volPercentage = volatility * 100;

  if (volPercentage < 5) return "low";
  if (volPercentage < 10) return "medium";
  if (volPercentage < 20) return "high";

  return "extreme";
}

/**
 * Get color for risk level
 * @param level - Risk level
 * @returns HeroUI color
 */
export function getRiskLevelColor(
  level: "low" | "medium" | "high" | "extreme",
): "success" | "warning" | "danger" | "default" {
  switch (level) {
    case "low":
      return "success"; // Green (< 5%)
    case "medium":
      return "warning"; // Yellow (5-10%)
    case "high":
      return "warning"; // Orange (10-20%)
    case "extreme":
      return "danger"; // Red (≥ 20%)
    default:
      return "default";
  }
}
