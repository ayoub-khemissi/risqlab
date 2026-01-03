"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

import { useVaR } from "@/hooks/useRiskMetrics";
import { RiskPeriod } from "@/types/risk-metrics";

interface VaRPanelProps {
  symbol: string;
  period: RiskPeriod;
  onPeriodChange: (period: RiskPeriod) => void;
}

const PERIODS: RiskPeriod[] = ["7d", "30d", "90d", "all"];

export function VaRPanel({ symbol, period, onPeriodChange }: VaRPanelProps) {
  const { data, isLoading, error } = useVaR(symbol, period);

  const chartData =
    data?.histogram?.map((bin) => ({
      x: bin.binCenter,
      count: bin.count,
      percentage: bin.percentage,
      range: `${bin.binStart.toFixed(2)}% to ${bin.binEnd.toFixed(2)}%`,
    })) || [];

  return (
    <div className="flex flex-col gap-4">
      {/* VaR Summary Card */}
      <Card>
        <CardBody className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-default-500 mb-1">VaR 95%</p>
              <p className="text-3xl font-bold text-danger">
                {data?.var95 != null ? `-${data.var95.toFixed(2)}%` : "N/A"}
              </p>
              <p className="text-xs text-default-400">
                Daily loss won&apos;t exceed this 95% of the time
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">VaR 99%</p>
              <p className="text-3xl font-bold text-danger">
                {data?.var99 != null ? `-${data.var99.toFixed(2)}%` : "N/A"}
              </p>
              <p className="text-xs text-default-400">
                Daily loss won&apos;t exceed this 99% of the time
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">CVaR 95%</p>
              <p className="text-2xl font-bold text-warning">
                {data?.cvar95 != null ? `-${data.cvar95.toFixed(2)}%` : "N/A"}
              </p>
              <p className="text-xs text-default-400">
                Expected loss when VaR is exceeded
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">CVaR 99%</p>
              <p className="text-2xl font-bold text-warning">
                {data?.cvar99 != null ? `-${data.cvar99.toFixed(2)}%` : "N/A"}
              </p>
              <p className="text-xs text-default-400">
                Expected Shortfall at 99%
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Chart Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-0">
          <div>
            <h3 className="text-lg font-semibold">Returns Distribution</h3>
            <p className="text-sm text-default-500">
              Histogram of daily log returns
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
              <p className="text-default-500">No data available</p>
            </div>
          ) : (
            <ResponsiveContainer height={300} width="100%">
              <BarChart data={chartData}>
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
                  width={40}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const d = payload[0].payload;

                      return (
                        <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                          <p className="text-sm text-default-500">{d.range}</p>
                          <p className="text-lg font-semibold">
                            {d.count} days ({d.percentage.toFixed(1)}%)
                          </p>
                        </div>
                      );
                    }

                    return null;
                  }}
                />
                {/* VaR 95% line */}
                {data?.var95 && (
                  <ReferenceLine
                    label={{
                      value: "VaR 95%",
                      position: "top",
                      fill: "#ef4444",
                      fontSize: 12,
                    }}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    x={-data.var95}
                  />
                )}
                {/* VaR 99% line */}
                {data?.var99 && (
                  <ReferenceLine
                    label={{
                      value: "VaR 99%",
                      position: "top",
                      fill: "#dc2626",
                      fontSize: 12,
                    }}
                    stroke="#dc2626"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    x={-data.var99}
                  />
                )}
                <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {data && (
            <p className="text-xs text-default-400 mt-2 text-right">
              {data.dataPoints} observations
            </p>
          )}
        </CardBody>
      </Card>

      {/* Statistics Card */}
      {data?.statistics && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Return Statistics</h3>
          </CardHeader>
          <CardBody className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-default-500">Mean Return</p>
                <Chip
                  color={data.statistics.mean >= 0 ? "success" : "danger"}
                  variant="flat"
                >
                  {data.statistics.mean >= 0 ? "+" : ""}
                  {data.statistics.mean.toFixed(4)}%
                </Chip>
              </div>
              <div>
                <p className="text-sm text-default-500">Std Deviation</p>
                <Chip variant="flat">{data.statistics.stdDev.toFixed(4)}%</Chip>
              </div>
              <div>
                <p className="text-sm text-default-500">Min Return</p>
                <Chip color="danger" variant="flat">
                  {data.statistics.min.toFixed(4)}%
                </Chip>
              </div>
              <div>
                <p className="text-sm text-default-500">Max Return</p>
                <Chip color="success" variant="flat">
                  +{data.statistics.max.toFixed(4)}%
                </Chip>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Explanation */}
      <Card>
        <CardBody className="p-4">
          <p className="text-sm text-default-500">
            <strong>Value at Risk (VaR)</strong> estimates the maximum potential
            loss over a given period at a specific confidence level. A VaR 95%
            of {data?.var95?.toFixed(2)}% means there&apos;s only a 5% chance of
            losing more than this amount in a single day.{" "}
            <strong>CVaR (Expected Shortfall)</strong> measures the average loss
            when the VaR threshold is exceeded.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
