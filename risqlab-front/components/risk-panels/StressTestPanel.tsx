"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

import { useStressTest } from "@/hooks/useRiskMetrics";
import { formatCryptoPrice } from "@/lib/formatters";

interface StressTestPanelProps {
  symbol: string;
}

const SCENARIO_COLORS: Record<string, string> = {
  Mild: "#eab308",
  Moderate: "#f97316",
  Severe: "#ef4444",
};

export function StressTestPanel({ symbol }: StressTestPanelProps) {
  const { data, isLoading, error } = useStressTest(symbol);

  const chartData =
    data?.scenarios.map((s) => ({
      name: s.name,
      impact: s.expectedImpact,
      newPrice: s.newPrice,
      priceChange: s.priceChange,
      marketShock: s.marketShock,
    })) || [];

  return (
    <div className="flex flex-col gap-4">
      {/* Summary Card */}
      <Card>
        <CardBody className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-default-500 mb-1">Current Price</p>
              <p className="text-4xl font-bold">
                {data ? formatCryptoPrice(data.currentPrice) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">
                Beta (vs RisqLab 80)
              </p>
              <Chip
                color={
                  data?.beta && data.beta > 1.5
                    ? "danger"
                    : data?.beta && data.beta > 1
                      ? "warning"
                      : "success"
                }
                size="lg"
                variant="flat"
              >
                {data?.beta?.toFixed(2) || "N/A"}
              </Chip>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Chart Card */}
      <Card>
        <CardHeader>
          <div>
            <h3 className="text-lg font-semibold">Stress Test Scenarios</h3>
            <p className="text-sm text-default-500">
              Expected price impact based on market shocks
            </p>
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
              <BarChart data={chartData} layout="vertical">
                <XAxis
                  domain={["dataMin", 0]}
                  fontSize={12}
                  stroke="#888"
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  type="number"
                />
                <YAxis
                  dataKey="name"
                  fontSize={12}
                  stroke="#888"
                  type="category"
                  width={80}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const d = payload[0].payload;

                      return (
                        <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                          <p className="font-semibold mb-2">
                            {d.name} Scenario
                          </p>
                          <div className="space-y-1 text-sm">
                            <p>
                              <span className="text-default-500">
                                Market Shock:{" "}
                              </span>
                              {d.marketShock}%
                            </p>
                            <p>
                              <span className="text-default-500">
                                Expected Impact:{" "}
                              </span>
                              <span className="text-danger">
                                {d.impact.toFixed(2)}%
                              </span>
                            </p>
                            <p>
                              <span className="text-default-500">
                                New Price:{" "}
                              </span>
                              {formatCryptoPrice(d.newPrice)}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  }}
                />
                <ReferenceLine stroke="#888" strokeDasharray="3 3" x={0} />
                <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={SCENARIO_COLORS[entry.name] || "#888"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      {/* Scenarios Details */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Scenario Details</h3>
        </CardHeader>
        <CardBody className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data?.scenarios.map((scenario) => (
              <div
                key={scenario.name}
                className="p-4 rounded-lg border border-default-200"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: SCENARIO_COLORS[scenario.name],
                    }}
                  />
                  <span className="font-semibold">{scenario.name}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-default-500">Market Shock</span>
                    <span>{scenario.marketShock}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-default-500">Your Impact</span>
                    <span className="text-danger font-medium">
                      {scenario.expectedImpact.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-default-500">New Price</span>
                    <span className="font-medium">
                      {formatCryptoPrice(scenario.newPrice)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Explanation */}
      <Card>
        <CardBody className="p-4">
          <p className="text-sm text-default-500">
            <strong>How it works:</strong> The stress test calculates expected
            price impact using the formula:{" "}
            <code className="bg-default-100 px-1 rounded">
              Impact = Beta x Market Shock
            </code>
            . A beta of {data?.beta?.toFixed(2) || "1.0"} means this crypto
            moves{" "}
            {data?.beta && data.beta > 1
              ? `${((data.beta - 1) * 100).toFixed(0)}% more`
              : data?.beta && data.beta < 1
                ? `${((1 - data.beta) * 100).toFixed(0)}% less`
                : "exactly like"}{" "}
            than the market.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
