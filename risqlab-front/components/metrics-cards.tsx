"use client";

import React, { useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

import { IndexMetric, GlobalMetric, FearGreedMetric } from "@/types/metrics";
import { PortfolioVolatility } from "@/types/volatility";
import {
  formatUSD,
  formatPercentage,
  formatCompactUSD,
} from "@/lib/formatters";

interface MetricsCardsProps {
  indexData: {
    current: IndexMetric | null;
    history: IndexMetric[];
  };
  globalData: {
    current: GlobalMetric | null;
    history: GlobalMetric[];
  };
  fearGreedData: {
    current: FearGreedMetric | null;
    history: FearGreedMetric[];
  };
  volatilityData?: {
    current: PortfolioVolatility | null;
  } | null;
}

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  chartData: any[];
  dataKey: string;
  fullValue?: string;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  chartData,
  dataKey,
  fullValue,
  onClick,
}) => {
  const isPositive = change > 0;
  const strokeColor = isPositive ? "#22c55e" : "#ef4444";

  // Calculate dynamic Y-axis domain with padding
  const chartDomain = useMemo(() => {
    if (chartData.length === 0) return undefined;
    const values = chartData.map((d) => d[dataKey]);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const range = rawMax - rawMin;
    const padding = range * 0.05; // 5% padding
    const domainMin = rawMin - padding;
    const domainMax = rawMax + padding;

    return [domainMin, domainMax];
  }, [chartData, dataKey]);

  return (
    <Card
      className={
        onClick ? "cursor-pointer hover:scale-[1.02] transition-transform" : ""
      }
      isPressable={!!onClick}
      onPress={onClick}
    >
      <CardBody className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-default-500">{title}</span>
            <Chip
              color={isPositive ? "success" : "danger"}
              size="sm"
              startContent={
                isPositive ? (
                  <TrendingUp size={14} />
                ) : (
                  <TrendingDown size={14} />
                )
              }
              variant="flat"
            >
              {formatPercentage(change)}
            </Chip>
          </div>
          <div className="text-2xl font-bold" title={fullValue}>
            {value}
          </div>
          <div className="h-12" style={{ minHeight: "48px" }}>
            <ResponsiveContainer height="100%" minHeight={48} width="100%">
              <LineChart
                data={chartData}
                margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
              >
                <YAxis hide domain={chartDomain} />
                <Line
                  activeDot={false}
                  dataKey={dataKey}
                  dot={false}
                  isAnimationActive={false}
                  stroke={strokeColor}
                  strokeWidth={2}
                  type="linear"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

function MetricsCardsComponent({
  indexData,
  globalData,
  fearGreedData,
  volatilityData,
}: MetricsCardsProps) {
  const router = useRouter();

  const renderFearGreedGauge = (value: number) => {
    const width = 144;
    const height = 80;
    const radius = 59;
    const centerX = width / 2;
    const centerY = height - 12;

    const angle = ((value / 100) * 180 - 180) * (Math.PI / 180);
    const pointerX = centerX + radius * Math.cos(angle);
    const pointerY = centerY + radius * Math.sin(angle);

    const getZoneColor = () => {
      if (value < 25) return "#EA3943";
      if (value < 45) return "#EA8C00";
      if (value < 55) return "#F3D42F";
      if (value < 75) return "#93D900";

      return "#16C784";
    };

    const getLabel = () => {
      if (value < 25) return "Extreme Fear";
      if (value < 45) return "Fear";
      if (value < 55) return "Neutral";
      if (value < 75) return "Greed";

      return "Extreme Greed";
    };

    return (
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm text-default-500 self-start">
              Fear & Greed
            </span>
            <svg
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              width={width}
            >
              <path
                d="M 13 67.99999999999999 A 59 59 0 0 1 20.699799159192082 38.85742987153037"
                fill="none"
                stroke="#EA3943"
                strokeLinecap="round"
                strokeWidth="6"
              />
              <path
                d="M 25.25491104204376 32.001435329825206 A 59 59 0 0 1 49.136580399325936 13.610074056278464"
                fill="none"
                stroke="#EA8C00"
                strokeLinecap="round"
                strokeWidth="6"
              />
              <path
                d="M 56.928700281788366 10.957420072336895 A 59 59 0 0 1 87.07129971821165 10.957420072336895"
                fill="none"
                stroke="#F3D42F"
                strokeLinecap="round"
                strokeWidth="6"
              />
              <path
                d="M 94.86341960067408 13.61007405627847 A 59 59 0 0 1 118.74508895795626 32.00143532982522"
                fill="none"
                stroke="#93D900"
                strokeLinecap="round"
                strokeWidth="6"
              />
              <path
                d="M 123.30020084080792 38.85742987153038 A 59 59 0 0 1 131 68"
                fill="none"
                stroke="#16C784"
                strokeLinecap="round"
                strokeWidth="6"
              />

              <circle
                cx={pointerX}
                cy={pointerY}
                fill="none"
                r="7"
                stroke={getZoneColor()}
                strokeWidth="4"
              />
              <circle
                className="fill-white dark:fill-gray-900"
                cx={pointerX}
                cy={pointerY}
                r="5"
              />

              <text
                className="fill-gray-900 dark:fill-white"
                fontSize="32"
                fontWeight="bold"
                textAnchor="middle"
                x={centerX}
                y="55"
              >
                {Math.round(value)}
              </text>
              <text
                className="fill-gray-600 dark:fill-gray-300"
                fontSize="12"
                fontWeight="500"
                textAnchor="middle"
                x={centerX}
                y="72"
              >
                {getLabel()}
              </text>
            </svg>
          </div>
        </CardBody>
      </Card>
    );
  };

  const renderVolatilityGauge = (
    volatilityPercent: number,
    windowDays: number,
  ) => {
    const width = 144;
    const height = 80;
    const radius = 59;
    const centerX = width / 2;
    const centerY = height - 12;
    const strokeWidth = 6;

    // Calculate position based on volatility percentage (0-30% mapped to 0-100 on gauge)
    // Cap at 30% for display purposes
    const cappedVolatility = Math.min(volatilityPercent, 30);
    const gaugeValue = (cappedVolatility / 30) * 100;

    const angle = ((gaugeValue / 100) * 180 - 180) * (Math.PI / 180);
    const pointerX = centerX + radius * Math.cos(angle);
    const pointerY = centerY + radius * Math.sin(angle);

    const getZoneColor = () => {
      if (volatilityPercent < 5) return "#16C784"; // Green
      if (volatilityPercent < 10) return "#F3D42F"; // Light orange
      if (volatilityPercent < 20) return "#EA8C00"; // Dark orange

      return "#EA3943"; // Red
    };

    const getLabel = () => {
      if (volatilityPercent < 5) return "Low";
      if (volatilityPercent < 10) return "Moderate";
      if (volatilityPercent < 20) return "High";

      return "Very High";
    };

    // Helper function to create arc path
    const createArc = (startAngle: number, endAngle: number) => {
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      const largeArc = endAngle - startAngle > 180 ? 1 : 0;

      return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    };

    // Divide 180° arc into 4 zones with gaps
    // Gap size approx 8 degrees (4 degrees on each side of boundary) to account for rounded caps
    // Boundaries: -150, -120, -60

    const greenArc = createArc(-180, -154); // 0-5% zone
    const lightOrangeArc = createArc(-146, -124); // 5-10% zone
    const darkOrangeArc = createArc(-116, -64); // 10-20% zone
    const redArc = createArc(-56, 0); // 20-30% zone

    return (
      <Card
        isPressable
        className="cursor-pointer hover:scale-[1.02] transition-transform"
        onPress={() => router.push("/portfolio-risk")}
      >
        <CardBody className="p-4">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1 self-start">
              <span className="text-sm text-default-500">
                Volatility ({windowDays}d)
              </span>
              {windowDays < 90 && (
                <Tooltip
                  content={
                    <div className="px-1 py-2 max-w-xs">
                      <div className="text-small font-bold">
                        Limited Historical Data
                      </div>
                      <div className="text-tiny">
                        Currently based on {windowDays} days. Full accuracy
                        requires 90 days of data.
                      </div>
                    </div>
                  }
                  placement="right"
                >
                  <AlertCircle className="text-warning" size={14} />
                </Tooltip>
              )}
            </div>
            <svg
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              width={width}
            >
              {/* Green zone: 0-5% */}
              <path
                d={greenArc}
                fill="none"
                stroke="#16C784"
                strokeLinecap="round"
                strokeWidth={strokeWidth}
              />

              {/* Light orange zone: 5-10% */}
              <path
                d={lightOrangeArc}
                fill="none"
                stroke="#F3D42F"
                strokeLinecap="round"
                strokeWidth={strokeWidth}
              />

              {/* Dark orange zone: 10-20% */}
              <path
                d={darkOrangeArc}
                fill="none"
                stroke="#EA8C00"
                strokeLinecap="round"
                strokeWidth={strokeWidth}
              />

              {/* Red zone: 20-30% */}
              <path
                d={redArc}
                fill="none"
                stroke="#EA3943"
                strokeLinecap="round"
                strokeWidth={strokeWidth}
              />

              {/* Pointer */}
              <circle
                cx={pointerX}
                cy={pointerY}
                fill="none"
                r="7"
                stroke={getZoneColor()}
                strokeWidth="4"
              />
              <circle
                className="fill-white dark:fill-gray-900"
                cx={pointerX}
                cy={pointerY}
                r="5"
              />

              {/* Value text - smaller size */}
              <text
                className="fill-gray-900 dark:fill-white"
                fontSize="20"
                fontWeight="bold"
                textAnchor="middle"
                x={centerX}
                y="54"
              >
                {volatilityPercent.toFixed(1)}%
              </text>
              {/* Label text */}
              <text
                className="fill-gray-600 dark:fill-gray-300"
                fontSize="11"
                fontWeight="500"
                textAnchor="middle"
                x={centerX}
                y="69"
              >
                {getLabel()}
              </text>
            </svg>
          </div>
        </CardBody>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-4 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {indexData.current && (
          <MetricCard
            change={parseFloat(indexData.current.percent_change_24h.toString())}
            chartData={indexData.history.map((item) => ({
              value: parseFloat(item.index_level.toString()),
            }))}
            dataKey="value"
            title="RisqLab 80 Index"
            value={indexData.current.index_level.toFixed(2)}
            onClick={() => router.push("/index-risqlab")}
          />
        )}

        {globalData.current && (
          <>
            <MetricCard
              change={parseFloat(
                globalData.current.market_cap_change_24h.toString(),
              )}
              chartData={globalData.history.map((item) => ({
                value: parseFloat(item.total_market_cap_usd.toString()),
              }))}
              dataKey="value"
              fullValue={formatUSD(globalData.current.total_market_cap_usd)}
              title="Market Cap"
              value={formatCompactUSD(globalData.current.total_market_cap_usd)}
            />

            <MetricCard
              change={parseFloat(
                globalData.current.volume_change_24h.toString(),
              )}
              chartData={globalData.history.map((item) => ({
                value: parseFloat(item.total_volume_24h_usd.toString()),
              }))}
              dataKey="value"
              fullValue={formatUSD(globalData.current.total_volume_24h_usd)}
              title="24h Volume"
              value={formatCompactUSD(globalData.current.total_volume_24h_usd)}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {globalData.current && (
          <Card>
            <CardBody className="p-4">
              <div className="flex flex-col gap-3">
                <span className="text-sm text-default-500">Dominance</span>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">BTC</span>
                      <span className="text-xl font-bold">
                        {globalData.current.btc_dominance.toFixed(2)}%
                      </span>
                    </div>
                    <Chip
                      color={
                        globalData.current.btc_dominance_24h_change > 0
                          ? "success"
                          : "danger"
                      }
                      size="sm"
                      startContent={
                        globalData.current.btc_dominance_24h_change > 0 ? (
                          <TrendingUp size={12} />
                        ) : (
                          <TrendingDown size={12} />
                        )
                      }
                      variant="flat"
                    >
                      {formatPercentage(
                        parseFloat(
                          globalData.current.btc_dominance_24h_change.toString(),
                        ),
                      )}
                    </Chip>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">ETH</span>
                      <span className="text-xl font-bold">
                        {globalData.current.eth_dominance.toFixed(2)}%
                      </span>
                    </div>
                    <Chip
                      color={
                        globalData.current.eth_dominance_24h_change > 0
                          ? "success"
                          : "danger"
                      }
                      size="sm"
                      startContent={
                        globalData.current.eth_dominance_24h_change > 0 ? (
                          <TrendingUp size={12} />
                        ) : (
                          <TrendingDown size={12} />
                        )
                      }
                      variant="flat"
                    >
                      {formatPercentage(
                        parseFloat(
                          globalData.current.eth_dominance_24h_change.toString(),
                        ),
                      )}
                    </Chip>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">Others</span>
                      <span className="text-xl font-bold">
                        {globalData.current.others_dominance.toFixed(2)}%
                      </span>
                    </div>
                    <Chip
                      color={
                        globalData.current.others_dominance_24h_change > 0
                          ? "success"
                          : "danger"
                      }
                      size="sm"
                      startContent={
                        globalData.current.others_dominance_24h_change > 0 ? (
                          <TrendingUp size={12} />
                        ) : (
                          <TrendingDown size={12} />
                        )
                      }
                      variant="flat"
                    >
                      {formatPercentage(
                        parseFloat(
                          globalData.current.others_dominance_24h_change.toString(),
                        ),
                      )}
                    </Chip>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {fearGreedData.current &&
          renderFearGreedGauge(fearGreedData.current.value)}

        {volatilityData?.current &&
          renderVolatilityGauge(
            volatilityData.current.annualized_volatility * 100,
            volatilityData.current.window_days,
          )}
      </div>
    </div>
  );
}

// Export with memo to prevent unnecessary re-renders when parent updates
export const MetricsCards = memo(MetricsCardsComponent);
