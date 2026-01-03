"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Line,
  ComposedChart,
} from "recharts";

import { useBeta } from "@/hooks/useRiskMetrics";
import { RiskPeriod, getBetaInterpretation } from "@/types/risk-metrics";

interface BetaPanelProps {
  symbol: string;
  period: RiskPeriod;
  onPeriodChange: (period: RiskPeriod) => void;
}

const PERIODS: RiskPeriod[] = ["7d", "30d", "90d", "all"];

export function BetaPanel({ symbol, period, onPeriodChange }: BetaPanelProps) {
  const { data, isLoading, error } = useBeta(symbol, period);

  const betaInterpretation =
    data && data.beta !== null && data.beta !== undefined
      ? getBetaInterpretation(data.beta)
      : null;

  // Generate regression line points
  const regressionLineData = data?.regressionLine
    ? [
        { x: data.regressionLine.x1, y: data.regressionLine.y1 },
        { x: data.regressionLine.x2, y: data.regressionLine.y2 },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Beta Summary Card */}
      <Card>
        <CardBody className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-default-500 mb-1">Beta</p>
              <p className="text-4xl font-bold">
                {data?.beta != null ? data.beta.toFixed(2) : "N/A"}
              </p>
              {betaInterpretation && (
                <Chip
                  className="mt-1"
                  color={betaInterpretation.color}
                  size="sm"
                  variant="flat"
                >
                  {betaInterpretation.label}
                </Chip>
              )}
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">Alpha (daily)</p>
              <p className="text-2xl font-bold">
                {data?.alpha != null
                  ? `${data.alpha >= 0 ? "+" : ""}${data.alpha.toFixed(4)}%`
                  : "N/A"}
              </p>
              <p className="text-xs text-default-400">
                {data?.alpha && data.alpha > 0
                  ? "Outperforming"
                  : data?.alpha && data.alpha < 0
                    ? "Underperforming"
                    : ""}
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">R-squared</p>
              <p className="text-2xl font-bold">
                {data?.rSquared != null
                  ? `${(data.rSquared * 100).toFixed(1)}%`
                  : "N/A"}
              </p>
              <p className="text-xs text-default-400">Model fit quality</p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">Correlation</p>
              <p className="text-2xl font-bold">
                {data?.correlation != null
                  ? data.correlation.toFixed(2)
                  : "N/A"}
              </p>
              <p className="text-xs text-default-400">With RisqLab 80</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Scatter Plot Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-0">
          <div>
            <h3 className="text-lg font-semibold">Returns Regression</h3>
            <p className="text-sm text-default-500">
              {symbol.toUpperCase()} vs RisqLab 80 Index
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
            <div className="h-[350px] flex items-center justify-center">
              <p className="text-default-500">Loading...</p>
            </div>
          ) : error ? (
            <div className="h-[350px] flex items-center justify-center">
              <p className="text-danger">Error loading data</p>
            </div>
          ) : !data?.scatterData || data.scatterData.length === 0 ? (
            <div className="h-[350px] flex items-center justify-center">
              <p className="text-default-500">
                {data?.msg || "No data available"}
              </p>
            </div>
          ) : (
            <ResponsiveContainer height={350} width="100%">
              <ComposedChart>
                <CartesianGrid opacity={0.1} strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  domain={["auto", "auto"]}
                  fontSize={12}
                  label={{
                    value: "Market Return (%)",
                    position: "bottom",
                    offset: 0,
                  }}
                  stroke="#888"
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                  tickLine={false}
                  type="number"
                />
                <YAxis
                  dataKey="y"
                  domain={["auto", "auto"]}
                  fontSize={12}
                  label={{
                    value: `${symbol.toUpperCase()} Return (%)`,
                    angle: -90,
                    position: "insideLeft",
                  }}
                  stroke="#888"
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                  tickLine={false}
                  type="number"
                  width={60}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const d = payload[0].payload;

                      return (
                        <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                          {d.date && (
                            <p className="text-sm text-default-500 mb-1">
                              {d.date}
                            </p>
                          )}
                          <p className="text-sm">
                            Market:{" "}
                            {d.marketReturn?.toFixed(2) || d.x?.toFixed(2)}%
                          </p>
                          <p className="text-sm">
                            {symbol.toUpperCase()}:{" "}
                            {d.cryptoReturn?.toFixed(2) || d.y?.toFixed(2)}%
                          </p>
                        </div>
                      );
                    }

                    return null;
                  }}
                />
                <ReferenceLine stroke="#888" strokeOpacity={0.5} x={0} />
                <ReferenceLine stroke="#888" strokeOpacity={0.5} y={0} />
                {/* Scatter points */}
                <Scatter
                  data={data.scatterData.map((d) => ({
                    x: d.marketReturn,
                    y: d.cryptoReturn,
                    date: d.date,
                    marketReturn: d.marketReturn,
                    cryptoReturn: d.cryptoReturn,
                  }))}
                  fill="#3b82f6"
                  name="Returns"
                />
                {/* Regression line */}
                {regressionLineData.length > 0 && (
                  <Line
                    activeDot={false}
                    data={regressionLineData}
                    dataKey="y"
                    dot={false}
                    isAnimationActive={true}
                    stroke="#ef4444"
                    strokeWidth={2}
                    type="linear"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
          {data && (
            <p className="text-xs text-default-400 mt-2 text-right">
              {data.dataPoints} observations
            </p>
          )}
        </CardBody>
      </Card>

      {/* Interpretation Card */}
      {betaInterpretation && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Beta Interpretation</h3>
          </CardHeader>
          <CardBody className="p-4">
            <div className="flex items-start gap-4">
              <Chip
                className="min-w-[100px] justify-center"
                color={betaInterpretation.color}
                size="lg"
                variant="flat"
              >
                {betaInterpretation.label}
              </Chip>
              <div>
                <p className="text-default-700">
                  {betaInterpretation.description}
                </p>
                <p className="text-sm text-default-500 mt-2">
                  {data?.beta && data.beta > 1
                    ? `When the market moves 1%, ${symbol.toUpperCase()} is expected to move ${data.beta.toFixed(2)}%`
                    : data?.beta && data.beta < 1 && data.beta > 0
                      ? `When the market moves 1%, ${symbol.toUpperCase()} is expected to move only ${data.beta.toFixed(2)}%`
                      : data?.beta && data.beta < 0
                        ? `When the market moves 1%, ${symbol.toUpperCase()} tends to move ${Math.abs(data.beta).toFixed(2)}% in the opposite direction`
                        : `${symbol.toUpperCase()} moves in line with the market`}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Beta Reference Table */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Beta Reference</h3>
        </CardHeader>
        <CardBody className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default-200">
                  <th className="text-left py-2 px-3">Beta Range</th>
                  <th className="text-left py-2 px-3">Category</th>
                  <th className="text-left py-2 px-3">Meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-default-100">
                  <td className="py-2 px-3">{"< 0"}</td>
                  <td className="py-2 px-3">
                    <Chip color="primary" size="sm" variant="flat">
                      Inverse
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Moves opposite to market
                  </td>
                </tr>
                <tr className="border-b border-default-100">
                  <td className="py-2 px-3">0 - 1</td>
                  <td className="py-2 px-3">
                    <Chip color="success" size="sm" variant="flat">
                      Defensive
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Less volatile than market
                  </td>
                </tr>
                <tr className="border-b border-default-100">
                  <td className="py-2 px-3">= 1</td>
                  <td className="py-2 px-3">
                    <Chip size="sm" variant="flat">
                      Market
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Moves like the market
                  </td>
                </tr>
                <tr className="border-b border-default-100">
                  <td className="py-2 px-3">1 - 2</td>
                  <td className="py-2 px-3">
                    <Chip color="warning" size="sm" variant="flat">
                      Aggressive
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Amplifies market movements
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3">{"> 2"}</td>
                  <td className="py-2 px-3">
                    <Chip color="danger" size="sm" variant="flat">
                      Speculative
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Extreme market sensitivity
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
