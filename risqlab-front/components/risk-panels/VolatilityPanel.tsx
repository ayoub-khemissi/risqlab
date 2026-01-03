"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { useState } from "react";

import { RiskPeriod } from "@/types/risk-metrics";
import { useCryptoVolatility } from "@/hooks/useCryptoVolatility";
import { VolatilityPeriod } from "@/types/volatility";

interface VolatilityPanelProps {
  symbol: string;
  period: RiskPeriod;
  onPeriodChange: (period: RiskPeriod) => void;
}

const PERIODS: RiskPeriod[] = ["7d", "30d", "90d", "all"];
const PERIOD_MAP: Record<RiskPeriod, VolatilityPeriod> = {
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  all: "all",
};

// Risk zones (annualized)
const RISK_ZONES_ANNUAL = [
  { value: 60, label: "Extreme", color: "#ef4444" },
  { value: 30, label: "High", color: "#f97316" },
  { value: 10, label: "Medium", color: "#eab308" },
];

// Risk zones (daily)
const RISK_ZONES_DAILY = [
  { value: 3.0, label: "Extreme", color: "#ef4444" },
  { value: 1.5, label: "High", color: "#f97316" },
  { value: 0.5, label: "Medium", color: "#eab308" },
];

function getRiskLevel(volatility: number, isAnnualized: boolean) {
  const thresholds = isAnnualized
    ? { low: 10, medium: 30, high: 60 }
    : { low: 0.5, medium: 1.5, high: 3.0 };

  if (volatility >= thresholds.high)
    return { level: "Extreme", color: "danger" as const };
  if (volatility >= thresholds.medium)
    return { level: "High", color: "warning" as const };
  if (volatility >= thresholds.low)
    return { level: "Medium", color: "warning" as const };

  return { level: "Low", color: "success" as const };
}

export function VolatilityPanel({
  symbol,
  period,
  onPeriodChange,
}: VolatilityPanelProps) {
  const [mode, setMode] = useState<"annualized" | "daily">("annualized");
  const { data, isLoading, error } = useCryptoVolatility(
    [symbol],
    PERIOD_MAP[period],
  );

  const volatilityData = data[0]?.data;
  const currentVol = volatilityData?.latest;
  const history = volatilityData?.history || [];

  const chartData = history.map((h) => ({
    date: new Date(h.date).toLocaleDateString("fr-FR", {
      month: "short",
      day: "numeric",
    }),
    volatility:
      mode === "annualized"
        ? Number(h.annualized_volatility) * 100
        : Number(h.daily_volatility) * 100,
    fullDate: h.date,
  }));

  const currentVolValue =
    mode === "annualized"
      ? currentVol
        ? Number(currentVol.annualized_volatility) * 100
        : null
      : currentVol
        ? Number(currentVol.daily_volatility) * 100
        : null;

  const riskInfo = currentVolValue
    ? getRiskLevel(currentVolValue, mode === "annualized")
    : null;
  const riskZones =
    mode === "annualized" ? RISK_ZONES_ANNUAL : RISK_ZONES_DAILY;

  return (
    <div className="flex flex-col gap-4">
      {/* Current Volatility Card */}
      <Card>
        <CardBody className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-default-500 mb-1">
                {mode === "annualized" ? "Annualized" : "Daily"} Volatility
              </p>
              <div className="flex items-center gap-3">
                <p className="text-4xl font-bold">
                  {currentVolValue !== null
                    ? `${currentVolValue.toFixed(2)}%`
                    : "N/A"}
                </p>
                {riskInfo && (
                  <Chip color={riskInfo.color} size="sm" variant="flat">
                    {riskInfo.level} Risk
                  </Chip>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={mode === "annualized" ? "solid" : "bordered"}
                onPress={() => setMode("annualized")}
              >
                Annualized
              </Button>
              <Button
                size="sm"
                variant={mode === "daily" ? "solid" : "bordered"}
                onPress={() => setMode("daily")}
              >
                Daily
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Chart Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-0">
          <h3 className="text-lg font-semibold">Volatility History</h3>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <Button
                key={p}
                isDisabled={isLoading}
                size="sm"
                variant={period === p ? "solid" : "bordered"}
                onPress={() => onPeriodChange(p)}
              >
                {p.toUpperCase()}
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
                  dataKey="date"
                  fontSize={12}
                  stroke="#888"
                  tickLine={false}
                />
                <YAxis
                  domain={[0, "auto"]}
                  fontSize={12}
                  stroke="#888"
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload;

                      return (
                        <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                          <p className="text-sm text-default-500">
                            {new Date(data.fullDate).toLocaleDateString(
                              "fr-FR",
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              },
                            )}
                          </p>
                          <p className="text-lg font-semibold">
                            {data.volatility.toFixed(2)}%
                          </p>
                        </div>
                      );
                    }

                    return null;
                  }}
                />
                {/* Risk zone lines */}
                {riskZones.map((zone) => (
                  <ReferenceLine
                    key={zone.label}
                    stroke={zone.color}
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                    y={zone.value}
                  />
                ))}
                <Line
                  activeDot={false}
                  dataKey="volatility"
                  dot={false}
                  isAnimationActive={true}
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  type="linear"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          {volatilityData && (
            <p className="text-xs text-default-400 mt-2 text-right">
              {history.length} data points
            </p>
          )}
        </CardBody>
      </Card>

      {/* Risk Levels Legend */}
      <Card>
        <CardBody className="p-4">
          <p className="text-sm font-semibold mb-3">Risk Levels</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="text-sm">
                Low (&lt;{mode === "annualized" ? "10%" : "0.5%"})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-warning" />
              <span className="text-sm">
                Medium ({mode === "annualized" ? "10-30%" : "0.5-1.5%"})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-sm">
                High ({mode === "annualized" ? "30-60%" : "1.5-3%"})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-danger" />
              <span className="text-sm">
                Extreme (&gt;{mode === "annualized" ? "60%" : "3%"})
              </span>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
