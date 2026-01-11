"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { usePriceHistory } from "@/hooks/useRiskMetrics";
import { RiskPeriod } from "@/types/risk-metrics";
import {
  formatCryptoPrice,
  formatPercentage,
  getPercentageColor,
} from "@/lib/formatters";

interface PricePanelProps {
  symbol: string;
  period: RiskPeriod;
  onPeriodChange: (period: RiskPeriod) => void;
}

const PERIODS: RiskPeriod[] = ["7d", "30d", "90d", "all"];

export function PricePanel({
  symbol,
  period,
  onPeriodChange,
}: PricePanelProps) {
  const { data, isLoading, error } = usePriceHistory(symbol, period);

  const chartData =
    data?.prices.map((p, index) => ({
      index,
      timestamp: new Date(p.date).getTime(),
      dateLabel: new Date(p.date).toLocaleDateString("fr-FR", {
        month: "short",
        day: "numeric",
      }),
      price: p.price,
      fullDateTime: new Date(p.date).toLocaleString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    })) || [];

  return (
    <div className="flex flex-col gap-4">
      {/* Current Price Card */}
      {data?.current && (
        <Card>
          <CardBody className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-default-500 mb-1">
                  {symbol.toUpperCase()} Price
                </p>
                <p className="text-4xl font-bold">
                  {formatCryptoPrice(data.current.price)}
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {data.current.changes["1h"] !== null && (
                  <div>
                    <p className="text-xs text-default-500">1h</p>
                    <Chip
                      color={getPercentageColor(data.current.changes["1h"])}
                      size="sm"
                      startContent={
                        data.current.changes["1h"] > 0 ? (
                          <TrendingUp size={14} />
                        ) : (
                          <TrendingDown size={14} />
                        )
                      }
                      variant="flat"
                    >
                      {formatPercentage(data.current.changes["1h"])}
                    </Chip>
                  </div>
                )}
                {data.current.changes["24h"] !== null && (
                  <div>
                    <p className="text-xs text-default-500">24h</p>
                    <Chip
                      color={getPercentageColor(data.current.changes["24h"])}
                      size="sm"
                      startContent={
                        data.current.changes["24h"] > 0 ? (
                          <TrendingUp size={14} />
                        ) : (
                          <TrendingDown size={14} />
                        )
                      }
                      variant="flat"
                    >
                      {formatPercentage(data.current.changes["24h"])}
                    </Chip>
                  </div>
                )}
                {data.current.changes["7d"] !== null && (
                  <div>
                    <p className="text-xs text-default-500">7d</p>
                    <Chip
                      color={getPercentageColor(data.current.changes["7d"])}
                      size="sm"
                      startContent={
                        data.current.changes["7d"] > 0 ? (
                          <TrendingUp size={14} />
                        ) : (
                          <TrendingDown size={14} />
                        )
                      }
                      variant="flat"
                    >
                      {formatPercentage(data.current.changes["7d"])}
                    </Chip>
                  </div>
                )}
                {data.current.changes["30d"] !== null && (
                  <div>
                    <p className="text-xs text-default-500">30d</p>
                    <Chip
                      color={getPercentageColor(data.current.changes["30d"])}
                      size="sm"
                      startContent={
                        data.current.changes["30d"] > 0 ? (
                          <TrendingUp size={14} />
                        ) : (
                          <TrendingDown size={14} />
                        )
                      }
                      variant="flat"
                    >
                      {formatPercentage(data.current.changes["30d"])}
                    </Chip>
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Chart Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-0">
          <h3 className="text-lg font-semibold">Price History</h3>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <Button
                key={p}
                isDisabled={isLoading}
                size="sm"
                variant={period === p ? "solid" : "bordered"}
                onPress={() => onPeriodChange(p)}
              >
                {p === "all" ? "All" : p}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardBody className="p-4">
          {isLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-default-500">Loading...</p>
            </div>
          ) : error ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-danger">Error loading data</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-default-500">No data available</p>
            </div>
          ) : (
            <ResponsiveContainer height={300} width="100%">
              <LineChart data={chartData}>
                <CartesianGrid opacity={0.1} strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  fontSize={12}
                  stroke="#888"
                  tickFormatter={(value) => {
                    const date = new Date(value);

                    return date.toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    });
                  }}
                  tickLine={false}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  fontSize={12}
                  stroke="#888"
                  tickFormatter={(value) => formatCryptoPrice(value)}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload;

                      return (
                        <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                          <p className="text-sm text-default-500">
                            {data.fullDateTime}
                          </p>
                          <p className="text-lg font-semibold">
                            {formatCryptoPrice(data.price)}
                          </p>
                        </div>
                      );
                    }

                    return null;
                  }}
                />
                <Line
                  activeDot={false}
                  dataKey="price"
                  dot={false}
                  isAnimationActive={true}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  type="linear"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          {data && (
            <p className="text-xs text-default-400 mt-2 text-right">
              {data.dataPoints} data points
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
