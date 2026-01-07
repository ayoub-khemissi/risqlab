"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { useDistribution } from "@/hooks/useRiskMetrics";
import {
  RiskPeriod,
  getSkewnessInterpretation,
  getKurtosisInterpretation,
} from "@/types/risk-metrics";

interface DistributionPanelProps {
  symbol: string;
  period: RiskPeriod;
  onPeriodChange: (period: RiskPeriod) => void;
}

const PERIODS: RiskPeriod[] = ["7d", "30d", "90d", "all"];

export function DistributionPanel({
  symbol,
  period,
  onPeriodChange,
}: DistributionPanelProps) {
  const { data, isLoading, error } = useDistribution(symbol, period);

  const skewnessInterp =
    data?.skewness != null ? getSkewnessInterpretation(data.skewness) : null;
  const kurtosisInterp =
    data?.kurtosis != null ? getKurtosisInterpretation(data.kurtosis) : null;

  // Combine histogram and normal curve for overlay
  const chartData =
    data?.histogram?.map((bin) => {
      // Find corresponding normal curve point
      const normalPoint = data?.normalCurve?.find(
        (p) =>
          Math.abs(p.x - bin.binCenter) <
          Math.abs(bin.binEnd - bin.binStart) / 2,
      );

      return {
        x: bin.binCenter,
        density: bin.density,
        normalDensity: normalPoint?.y || 0,
        count: bin.count,
        range: `${bin.binStart.toFixed(2)}% to ${bin.binEnd.toFixed(2)}%`,
      };
    }) || [];

  return (
    <div className="flex flex-col gap-4">
      {/* Summary Card */}
      <Card>
        <CardBody className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-default-500 mb-1">Skewness</p>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold">
                  {data?.skewness != null ? data.skewness.toFixed(2) : "N/A"}
                </p>
              </div>
              {skewnessInterp && (
                <Chip
                  className="mt-1"
                  color={
                    skewnessInterp.type === "negative"
                      ? "danger"
                      : skewnessInterp.type === "positive"
                        ? "success"
                        : "default"
                  }
                  size="sm"
                  variant="flat"
                >
                  {skewnessInterp.label}
                </Chip>
              )}
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">Kurtosis</p>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold">
                  {data?.kurtosis != null ? data.kurtosis.toFixed(2) : "N/A"}
                </p>
              </div>
              {kurtosisInterp && (
                <Chip
                  className="mt-1"
                  color={
                    kurtosisInterp.type === "leptokurtic"
                      ? "warning"
                      : kurtosisInterp.type === "platykurtic"
                        ? "success"
                        : "default"
                  }
                  size="sm"
                  variant="flat"
                >
                  {kurtosisInterp.label}
                </Chip>
              )}
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">Mean Return</p>
              <p className="text-2xl font-bold">
                {data?.mean !== undefined
                  ? `${data.mean >= 0 ? "+" : ""}${data.mean.toFixed(4)}%`
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">Std Deviation</p>
              <p className="text-2xl font-bold">
                {data?.stdDev !== undefined
                  ? `${data.stdDev.toFixed(4)}%`
                  : "N/A"}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Chart Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-0">
          <div>
            <h3 className="text-lg font-semibold">Distribution vs Normal</h3>
            <p className="text-sm text-default-500">
              Histogram with normal distribution overlay
            </p>
          </div>
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
              <p className="text-default-500">
                {data?.msg || "No data available"}
              </p>
            </div>
          ) : (
            <ResponsiveContainer height={300} width="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid opacity={0.1} strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  fontSize={12}
                  stroke="#888"
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                  tickLine={false}
                />
                <YAxis
                  fontSize={12}
                  stroke="#888"
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const d = payload[0].payload;

                      return (
                        <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                          <p className="text-sm text-default-500">{d.range}</p>
                          <p className="text-sm">
                            <span className="text-primary">Actual:</span>{" "}
                            {d.count} days
                          </p>
                          <p className="text-sm">
                            <span className="text-warning">Density:</span>{" "}
                            {d.density.toFixed(4)}
                          </p>
                        </div>
                      );
                    }

                    return null;
                  }}
                />
                <Bar
                  dataKey="density"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                  name="Actual Distribution"
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  activeDot={false}
                  dataKey="normalDensity"
                  dot={false}
                  isAnimationActive={true}
                  name="Normal Distribution"
                  stroke="#f97316"
                  strokeWidth={2}
                  type="linear"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
          {data && (
            <div className="flex justify-between items-center mt-2">
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-primary rounded" />
                  <span>Actual</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-warning rounded" />
                  <span>Normal</span>
                </div>
              </div>
              <p className="text-xs text-default-400">
                {data.dataPoints} observations
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Interpretation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Skewness Card */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Skewness Analysis</h3>
          </CardHeader>
          <CardBody className="p-4">
            {skewnessInterp ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl font-bold">
                    {data?.skewness?.toFixed(2)}
                  </span>
                  <Chip
                    color={
                      skewnessInterp.type === "negative"
                        ? "danger"
                        : skewnessInterp.type === "positive"
                          ? "success"
                          : "default"
                    }
                    variant="flat"
                  >
                    {skewnessInterp.label}
                  </Chip>
                </div>
                <p className="text-sm text-default-600">
                  {skewnessInterp.description}
                </p>
                <div className="mt-4 p-3 bg-default-100 rounded-lg">
                  <p className="text-xs text-default-500">
                    {skewnessInterp.type === "negative"
                      ? "Negative skewness indicates that this asset has experienced more extreme losses than gains. The left tail is longer."
                      : skewnessInterp.type === "positive"
                        ? "Positive skewness indicates that this asset has experienced more extreme gains than losses. The right tail is longer."
                        : "The distribution is relatively symmetric, similar to a normal distribution."}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-default-500">No data available</p>
            )}
          </CardBody>
        </Card>

        {/* Kurtosis Card */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Kurtosis Analysis</h3>
          </CardHeader>
          <CardBody className="p-4">
            {kurtosisInterp ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl font-bold">
                    {data?.kurtosis?.toFixed(2)}
                  </span>
                  <Chip
                    color={
                      kurtosisInterp.type === "leptokurtic"
                        ? "warning"
                        : kurtosisInterp.type === "platykurtic"
                          ? "success"
                          : "default"
                    }
                    variant="flat"
                  >
                    {kurtosisInterp.label}
                  </Chip>
                </div>
                <p className="text-sm text-default-600">
                  {kurtosisInterp.description}
                </p>
                <div className="mt-4 p-3 bg-default-100 rounded-lg">
                  <p className="text-xs text-default-500">
                    {kurtosisInterp.type === "leptokurtic"
                      ? "Fat tails (excess kurtosis > 0) mean extreme price movements occur more frequently than a normal distribution would predict. Higher tail risk."
                      : kurtosisInterp.type === "platykurtic"
                        ? "Thin tails (excess kurtosis < 0) mean extreme price movements occur less frequently than expected. Lower tail risk."
                        : "The distribution has similar tail behavior to a normal distribution (excess kurtosis ≈ 0)."}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-default-500">No data available</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
