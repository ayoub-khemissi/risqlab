"use client";

import { useState, useMemo } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Info, TrendingUp, Activity } from "lucide-react";
import Link from "next/link";

import { title } from "@/components/primitives";
import {
  usePortfolioVolatility,
  usePortfolioConstituentsVolatility,
  calculateDiversificationBenefit,
  calculateRiskContributions,
  getRiskLevel,
} from "@/hooks/usePortfolioVolatility";
import {
  RiskLevelIndicator,
  VolatilityBadge,
  DiversificationMeter,
} from "@/components/volatility";
import {
  VolatilityChart,
  RiskContributorsTable,
  VolatilityDistribution,
} from "@/components/portfolio-risk";

type Period = "7d" | "30d" | "90d" | "all";

export default function PortfolioRiskPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("30d");

  // Fetch portfolio volatility data
  const {
    data: volatilityData,
    isLoading: volatilityLoading,
    error: volatilityError,
  } = usePortfolioVolatility(selectedPeriod);

  // Fetch constituents volatility data
  const {
    data: constituentsData,
    isLoading: constituentsLoading,
    error: constituentsError,
  } = usePortfolioConstituentsVolatility();

  // Calculate derived data
  const diversificationBenefit = useMemo(() => {
    if (!volatilityData?.current || !constituentsData) return null;

    return calculateDiversificationBenefit(
      volatilityData.current.annualized_volatility,
      constituentsData,
    );
  }, [volatilityData, constituentsData]);

  const riskContributions = useMemo(() => {
    if (!constituentsData) return [];

    return calculateRiskContributions(constituentsData);
  }, [constituentsData]);

  const riskLevel = useMemo(() => {
    if (!volatilityData?.current) return null;

    return getRiskLevel(volatilityData.current.annualized_volatility);
  }, [volatilityData]);

  // Loading state
  if (volatilityLoading || constituentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading portfolio risk data...</div>
      </div>
    );
  }

  // Error state
  if (volatilityError || constituentsError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-danger mb-2">
            Error loading portfolio risk data
          </p>
          <p className="text-sm text-default-500">
            {volatilityError?.message || constituentsError?.message}
          </p>
        </div>
      </div>
    );
  }

  // No data state
  if (!volatilityData?.current || !constituentsData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg mb-2">No portfolio risk data available</p>
          <p className="text-sm text-default-500">
            Please check back later when data has been calculated.
          </p>
        </div>
      </div>
    );
  }

  const { current, history } = volatilityData;

  return (
    <section className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3">
          <h1 className={title()}>Portfolio Risk Analysis</h1>
          <Link href="/methodology/volatility">
            <Button
              isIconOnly
              aria-label="How is volatility calculated?"
              color="primary"
              size="sm"
              variant="flat"
            >
              <Info size={18} />
            </Button>
          </Link>
        </div>
        <p className="text-lg text-default-600 mt-4">
          Comprehensive risk analysis for the RisqLab 80 Index
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Volatility */}
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="text-primary" size={20} />
              <h3 className="font-semibold">Current Volatility</h3>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-3xl font-bold text-primary">
                  {(current.annualized_volatility * 100).toFixed(2)}%
                </p>
                <p className="text-xs text-default-500">Annualized</p>
              </div>
              <div>
                <p className="text-lg text-default-600">
                  {(current.daily_volatility * 100).toFixed(3)}%
                </p>
                <p className="text-xs text-default-500">Daily</p>
              </div>
              <div className="pt-2">
                <VolatilityBadge
                  showRiskLevel
                  value={current.annualized_volatility}
                  variant="solid"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Risk Level */}
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-warning" size={20} />
              <h3 className="font-semibold">Risk Level</h3>
            </div>
            {riskLevel && <RiskLevelIndicator level={riskLevel} size="lg" />}
          </CardBody>
        </Card>

        {/* Portfolio Info */}
        <Card>
          <CardBody className="p-6">
            <h3 className="font-semibold mb-4">Portfolio Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-default-500">Constituents</span>
                <Chip color="primary" size="sm" variant="flat">
                  {current.num_constituents}
                </Chip>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-default-500">Window</span>
                <span className="text-sm font-medium">
                  {current.window_days} days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-default-500">Last Updated</span>
                <span className="text-sm font-medium">
                  {new Date(current.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Volatility Timeline Chart */}
      <Card>
        <CardBody className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Volatility Over Time</h2>
            <div className="flex gap-2">
              {(["7d", "30d", "90d", "all"] as Period[]).map((period) => (
                <Button
                  key={period}
                  size="sm"
                  variant={selectedPeriod === period ? "solid" : "bordered"}
                  onPress={() => setSelectedPeriod(period)}
                >
                  {period === "all" ? "All" : period.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <VolatilityChart data={history} height={400} />
        </CardBody>
      </Card>

      {/* Diversification Benefit */}
      {diversificationBenefit && (
        <Card>
          <CardBody className="p-6">
            <DiversificationMeter benefit={diversificationBenefit} size="md" />
          </CardBody>
        </Card>
      )}

      {/* Risk Contributors */}
      <Card>
        <CardBody className="p-6">
          <h2 className="text-lg font-semibold mb-4">Risk Contributors</h2>
          <p className="text-sm text-default-500 mb-6">
            How each constituent contributes to the overall portfolio risk
          </p>
          <RiskContributorsTable contributors={riskContributions} />
        </CardBody>
      </Card>

      {/* Volatility Distribution */}
      <Card>
        <CardBody className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            Volatility Distribution
          </h2>
          <p className="text-sm text-default-500 mb-6">
            Distribution of individual constituent volatilities
          </p>
          <VolatilityDistribution
            constituents={constituentsData}
            height={350}
            portfolioVolatility={current.annualized_volatility}
          />
        </CardBody>
      </Card>

      {/* Methodology Link */}
      <Card className="bg-primary/5 border border-primary/20">
        <CardBody className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">
                How is volatility calculated?
              </h3>
              <p className="text-sm text-default-600">
                Learn about the mathematical methodology behind our volatility
                calculations, including logarithmic returns, covariance
                matrices, and the diversification benefit.
              </p>
            </div>
            <Link href="/methodology/volatility">
              <Button color="primary" endContent={<Info size={18} />}>
                View Methodology
              </Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </section>
  );
}
