"use client";

import React, { useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { IndexMetric, GlobalMetric, FearGreedMetric } from "@/types/metrics";
import { formatUSD, formatPercentage, formatCompactUSD } from "@/lib/formatters";

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
}

function MetricsCardsComponent({ indexData, globalData, fearGreedData }: MetricsCardsProps) {
  const router = useRouter();

  const renderMetricCard = (
    title: string,
    value: string,
    change: number,
    chartData: any[],
    dataKey: string,
    fullValue?: string,
    onClick?: () => void
  ) => {
    const isPositive = change > 0;
    const strokeColor = isPositive ? "#22c55e" : "#ef4444";

    // Calculate dynamic Y-axis domain with padding
    const chartDomain = useMemo(() => {
      if (chartData.length === 0) return undefined;
      const values = chartData.map(d => d[dataKey]);
      const rawMin = Math.min(...values);
      const rawMax = Math.max(...values);
      const range = rawMax - rawMin;
      const padding = range * 0.05; // 5% padding
      const domainMin = rawMin - padding;
      const domainMax = rawMax + padding;
      return [domainMin, domainMax];
    }, [chartData, dataKey]);

    return (
      <Card isPressable={!!onClick} onPress={onClick} className={onClick ? "cursor-pointer hover:scale-[1.02] transition-transform" : ""}>
        <CardBody className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-default-500">{title}</span>
              <Chip
                size="sm"
                variant="flat"
                color={isPositive ? "success" : "danger"}
                startContent={isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              >
                {formatPercentage(change)}
              </Chip>
            </div>
            <div className="text-2xl font-bold" title={fullValue}>
              {value}
            </div>
            <div className="h-12" style={{ minHeight: '48px' }}>
              <ResponsiveContainer width="100%" height="100%" minHeight={48}>
                <LineChart
                  data={chartData}
                  margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
                >
                  <YAxis domain={chartDomain} hide />
                  <Line
                    type="linear"
                    dataKey={dataKey}
                    stroke={strokeColor}
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  };

  const getFearGreedColor = (value: number): "success" | "warning" | "danger" | "default" => {
    if (value >= 75) return "success";
    if (value >= 50) return "warning";
    if (value >= 25) return "danger";
    return "danger";
  };

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
            <span className="text-sm text-default-500 self-start">Fear & Greed</span>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
              <path
                d="M 13 67.99999999999999 A 59 59 0 0 1 20.699799159192082 38.85742987153037"
                stroke="#EA3943"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 25.25491104204376 32.001435329825206 A 59 59 0 0 1 49.136580399325936 13.610074056278464"
                stroke="#EA8C00"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 56.928700281788366 10.957420072336895 A 59 59 0 0 1 87.07129971821165 10.957420072336895"
                stroke="#F3D42F"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 94.86341960067408 13.61007405627847 A 59 59 0 0 1 118.74508895795626 32.00143532982522"
                stroke="#93D900"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 123.30020084080792 38.85742987153038 A 59 59 0 0 1 131 68"
                stroke="#16C784"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />

              <circle
                cx={pointerX}
                cy={pointerY}
                r="7"
                fill="none"
                stroke={getZoneColor()}
                strokeWidth="4"
              />
              <circle cx={pointerX} cy={pointerY} r="5" className="fill-white dark:fill-gray-900" />

              <text
                x={centerX}
                y="55"
                textAnchor="middle"
                className="fill-gray-900 dark:fill-white"
                fontSize="32"
                fontWeight="bold"
              >
                {Math.round(value)}
              </text>
              <text
                x={centerX}
                y="72"
                textAnchor="middle"
                className="fill-gray-600 dark:fill-gray-300"
                fontSize="12"
                fontWeight="500"
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
          renderMetricCard(
            "RisqLab 80 Index",
            indexData.current.index_level.toFixed(2),
            parseFloat(indexData.current.percent_change_24h.toString()),
            indexData.history.map(item => ({
              value: parseFloat(item.index_level.toString())
            })),
            "value",
            undefined,
            () => router.push('/index')
          )
        )}

        {globalData.current && (
          <>
            {renderMetricCard(
              "Market Cap",
              formatCompactUSD(globalData.current.total_market_cap_usd),
              parseFloat(globalData.current.market_cap_change_24h.toString()),
              globalData.history.map(item => ({
                value: parseFloat(item.total_market_cap_usd.toString())
              })),
              "value",
              formatUSD(globalData.current.total_market_cap_usd)
            )}

            {renderMetricCard(
              "24h Volume",
              formatCompactUSD(globalData.current.total_volume_24h_usd),
              parseFloat(globalData.current.volume_change_24h.toString()),
              globalData.history.map(item => ({
                value: parseFloat(item.total_volume_24h_usd.toString())
              })),
              "value",
              formatUSD(globalData.current.total_volume_24h_usd)
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {globalData.current && (
          <Card>
            <CardBody className="p-4">
              <div className="flex flex-col gap-3">
                <span className="text-sm text-default-500">Dominance</span>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">BTC</span>
                      <span className="text-xl font-bold">{globalData.current.btc_dominance.toFixed(2)}%</span>
                    </div>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={globalData.current.btc_dominance_24h_change > 0 ? "success" : "danger"}
                      startContent={
                        globalData.current.btc_dominance_24h_change > 0 ?
                        <TrendingUp size={12} /> :
                        <TrendingDown size={12} />
                      }
                    >
                      {formatPercentage(parseFloat(globalData.current.btc_dominance_24h_change.toString()))}
                    </Chip>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">ETH</span>
                      <span className="text-xl font-bold">{globalData.current.eth_dominance.toFixed(2)}%</span>
                    </div>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={globalData.current.eth_dominance_24h_change > 0 ? "success" : "danger"}
                      startContent={
                        globalData.current.eth_dominance_24h_change > 0 ?
                        <TrendingUp size={12} /> :
                        <TrendingDown size={12} />
                      }
                    >
                      {formatPercentage(parseFloat(globalData.current.eth_dominance_24h_change.toString()))}
                    </Chip>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">Others</span>
                      <span className="text-xl font-bold">{globalData.current.others_dominance.toFixed(2)}%</span>
                    </div>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={globalData.current.others_dominance_24h_change > 0 ? "success" : "danger"}
                      startContent={
                        globalData.current.others_dominance_24h_change > 0 ?
                        <TrendingUp size={12} /> :
                        <TrendingDown size={12} />
                      }
                    >
                      {formatPercentage(parseFloat(globalData.current.others_dominance_24h_change.toString()))}
                    </Chip>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {fearGreedData.current && renderFearGreedGauge(fearGreedData.current.value)}
      </div>
    </div>
  );
}

// Export with memo to prevent unnecessary re-renders when parent updates
export const MetricsCards = memo(MetricsCardsComponent);
