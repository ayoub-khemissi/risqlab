"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  TrendingUp,
  TrendingDown,
  Info,
  Activity,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

import { IndexDetailsResponse } from "@/types/index-details";
import { formatPercentage } from "@/lib/formatters";
import { ConstituentsTable } from "@/components/constituents-table";
import { TopConstituentsChart } from "@/components/top-constituents-chart";
import { title } from "@/components/primitives";
import { BinancePricesProvider } from "@/contexts/BinancePricesContext";
import { API_BASE_URL } from "@/config/constants";
import { usePortfolioVolatility } from "@/hooks/usePortfolioVolatility";
import {
  RiskLevelIndicator,
  VolatilityBadge,
  VolatilitySparkline,
} from "@/components/volatility";

type Period = "24h" | "7d" | "30d" | "all";

export default function IndexPage() {
  const [data, setData] = useState<IndexDetailsResponse["data"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("24h");
  const [isMobile, setIsMobile] = useState(false);

  // Fetch portfolio volatility data
  const { data: volatilityData } = usePortfolioVolatility("30d");

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    fetchIndexDetails();
  }, [selectedPeriod]);

  // Scroll to constituents table if hash is present, then remove hash from URL
  useEffect(() => {
    if (window.location.hash === "#constituents-table" && data) {
      // Wait for data to load and page to render
      const scrollToTable = () => {
        const element = document.getElementById("constituents-table");

        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
          // Remove hash from URL to prevent auto-scroll on data updates
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        }
      };

      // Try after a delay
      setTimeout(scrollToTable, 300);
    }
  }, [data]);

  const fetchIndexDetails = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/index-details?period=${selectedPeriod}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch index details");
      }

      const result: IndexDetailsResponse = await response.json();

      setData(result.data);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  };

  const symbols = useMemo(
    () => data?.constituents.map((c) => c.symbol) || [],
    [data?.constituents],
  );

  if (isInitialLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const { current, historicalValues, history, constituents } = data;
  const isAbove100 = current && current.index_level >= 100;

  return (
    <BinancePricesProvider symbols={symbols}>
      <section className="flex flex-col gap-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3">
            <h1 className={title()}>RisqLab 80 Index</h1>
            <Link href="/methodology/index-risqlab">
              <Button
                isIconOnly
                aria-label="How is this calculated?"
                color="primary"
                size="sm"
                variant="flat"
              >
                <Info size={18} />
              </Button>
            </Link>
          </div>
          <p className="text-lg text-default-600 mt-4">
            A market-cap weighted index tracking the top 80 cryptocurrencies
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardBody className="p-6">
                <div className="flex flex-col gap-4">
                  <h2 className="text-sm text-default-500">RISQLAB 80 INDEX</h2>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                      {current?.index_level.toFixed(2)}
                    </span>
                    {current && (
                      <Chip
                        color={
                          current.percent_change_24h > 0 ? "success" : "danger"
                        }
                        size="sm"
                        startContent={
                          current.percent_change_24h > 0 ? (
                            <TrendingUp size={14} />
                          ) : (
                            <TrendingDown size={14} />
                          )
                        }
                        variant="flat"
                      >
                        {formatPercentage(current.percent_change_24h)}
                      </Chip>
                    )}
                  </div>

                  <div className="border-t border-default-200 pt-4">
                    <h3 className="text-sm font-semibold mb-3">
                      Historical Values
                    </h3>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-default-500">
                          Yesterday
                        </span>
                        <span className="text-sm font-medium">
                          {historicalValues.yesterday
                            ? historicalValues.yesterday.toFixed(2)
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-default-500">
                          Last Week
                        </span>
                        <span className="text-sm font-medium">
                          {historicalValues.lastWeek
                            ? historicalValues.lastWeek.toFixed(2)
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-default-500">
                          Last Month
                        </span>
                        <span className="text-sm font-medium">
                          {historicalValues.lastMonth
                            ? historicalValues.lastMonth.toFixed(2)
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card>
              <CardBody className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h2 className="text-lg font-semibold">
                      RisqLab 80 Index Chart
                    </h2>
                    <div className="flex gap-2">
                      {(["24h", "7d", "30d", "all"] as Period[]).map(
                        (period) => (
                          <Button
                            key={period}
                            isDisabled={isLoading}
                            size="sm"
                            variant={
                              selectedPeriod === period ? "solid" : "bordered"
                            }
                            onPress={() => setSelectedPeriod(period)}
                          >
                            {period === "all" ? "All" : period}
                          </Button>
                        ),
                      )}
                    </div>
                  </div>
                  <div
                    className="h-64 md:h-80 transition-opacity"
                    style={{ opacity: isLoading ? 0.5 : 1 }}
                  >
                    <ResponsiveContainer height="100%" width="100%">
                      <LineChart data={history}>
                        <defs>
                          <linearGradient
                            id="colorIndexGreen"
                            x1="0"
                            x2="0"
                            y1="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#22c55e"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#22c55e"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="colorIndexRed"
                            x1="0"
                            x2="0"
                            y1="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#ef4444"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#ef4444"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="timestamp"
                          stroke="#6b7280"
                          style={{ fontSize: "12px" }}
                          tickFormatter={(value) => {
                            const date = new Date(value);

                            return date.toLocaleDateString("en-US", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            });
                          }}
                        />
                        <YAxis
                          domain={["auto", "auto"]}
                          stroke="#6b7280"
                          style={{ fontSize: isMobile ? "10px" : "12px" }}
                          tickFormatter={(value) => value.toFixed(2)}
                          width={isMobile ? 35 : 60}
                        />
                        <ReferenceLine
                          stroke="#6b7280"
                          strokeDasharray="3 3"
                          strokeOpacity={0.5}
                          y={100}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload[0]) {
                              return (
                                <div className="bg-content1 border border-default-200 rounded-lg p-2 shadow-lg">
                                  <p className="text-sm font-semibold">
                                    {parseFloat(
                                      payload[0].value?.toString() || "0",
                                    ).toFixed(2)}
                                  </p>
                                  <p className="text-xs text-default-500">
                                    {new Date(
                                      payload[0].payload.timestamp,
                                    ).toLocaleString("en-US", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                  </p>
                                </div>
                              );
                            }

                            return null;
                          }}
                        />
                        <Line
                          activeDot={false}
                          dataKey="index_level"
                          dot={false}
                          fill={
                            isAbove100
                              ? "url(#colorIndexGreen)"
                              : "url(#colorIndexRed)"
                          }
                          stroke={isAbove100 ? "#037bfc" : "#037bfc"}
                          strokeWidth={2}
                          type="linear"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Risk Metrics Section */}
        {volatilityData?.current && (
          <Card className="bg-gradient-to-br from-primary/5 to-success/5">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Activity className="text-primary" size={24} />
                  <h2 className="text-xl font-bold">Portfolio Risk Metrics</h2>
                </div>
                <Link href="/portfolio-risk">
                  <Button
                    color="primary"
                    endContent={<ArrowRight size={18} />}
                    size="sm"
                    variant="flat"
                  >
                    Detailed Analysis
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Volatility */}
                <div className="bg-content1 p-4 rounded-lg">
                  <p className="text-sm text-default-500 mb-2">
                    Current Volatility
                  </p>
                  <p className="text-3xl font-bold text-primary mb-2">
                    {(
                      volatilityData.current.annualized_volatility * 100
                    ).toFixed(2)}
                    %
                  </p>
                  <p className="text-xs text-default-500 mb-3">
                    Annualized (90-day window)
                  </p>
                  <VolatilityBadge
                    showRiskLevel
                    value={volatilityData.current.annualized_volatility}
                  />
                </div>

                {/* Risk Level */}
                <div className="bg-content1 p-4 rounded-lg">
                  <p className="text-sm text-default-500 mb-3">Risk Level</p>
                  <RiskLevelIndicator
                    level={
                      volatilityData.current.annualized_volatility < 0.3
                        ? "low"
                        : volatilityData.current.annualized_volatility < 0.6
                          ? "medium"
                          : volatilityData.current.annualized_volatility < 1.0
                            ? "high"
                            : "extreme"
                    }
                    size="md"
                  />
                </div>

                {/* Trend */}
                <div className="bg-content1 p-4 rounded-lg">
                  <p className="text-sm text-default-500 mb-2">
                    30-Day Volatility Trend
                  </p>
                  <div className="h-20">
                    <VolatilitySparkline
                      data={volatilityData.history.slice(-30)}
                      height={80}
                    />
                  </div>
                  <p className="text-xs text-default-500 mt-2 text-center">
                    Last 30 days
                  </p>
                </div>
              </div>

              <div className="mt-6 bg-primary/10 border-l-4 border-primary p-4 rounded">
                <p className="text-sm text-default-700">
                  <strong>Diversification Benefit:</strong> The portfolio
                  volatility is typically lower than individual assets due to
                  the diversification across{" "}
                  {volatilityData.current.num_constituents} constituents.{" "}
                  <Link
                    className="text-primary font-semibold"
                    href="/portfolio-risk"
                  >
                    Learn more →
                  </Link>
                </p>
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody className="p-6">
            <h2 className="text-lg font-semibold mb-4">Top Constituents</h2>
            <TopConstituentsChart constituents={constituents} />
          </CardBody>
        </Card>

        <div id="constituents-table">
          <ConstituentsTable constituents={constituents} />
        </div>
      </section>
    </BinancePricesProvider>
  );
}
