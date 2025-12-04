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

import { PortfolioVolatility } from "@/types/volatility";

interface VolatilityChartProps {
  /**
   * Historical volatility data
   */
  data: PortfolioVolatility[];
  /**
   * Height of the chart (optional - defaults to 100% of parent container)
   */
  height?: number | string;
}

/**
 * Line chart showing portfolio volatility over time
 */
export function VolatilityChart({
  data,
  height = "100%",
}: VolatilityChartProps) {
  // Transform data for chart
  const chartData = data.map((item) => ({
    date: item.date,
    volatility: item.annualized_volatility * 100, // Convert to percentage
    timestamp: new Date(item.date).getTime(),
  }));

  // Calculate volatility levels for zones
  const avgVolatility =
    chartData.reduce((sum, item) => sum + item.volatility, 0) /
    chartData.length;

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={chartData}>
          <CartesianGrid opacity={0.1} strokeDasharray="3 3" />

          <XAxis
            dataKey="date"
            stroke="#6b7280"
            style={{ fontSize: "12px" }}
            tickFormatter={(value) => {
              const date = new Date(value);

              return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
            }}
          />

          <YAxis
            domain={["auto", "auto"]}
            label={{
              value: "Annualized Volatility (%)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: "12px", fill: "#6b7280" },
            }}
            stroke="#6b7280"
            style={{ fontSize: "12px" }}
            tickFormatter={(value) => `${value.toFixed(0)}%`}
          />

          {/* Reference line for average */}
          <ReferenceLine
            label={{
              value: `Avg: ${avgVolatility.toFixed(1)}%`,
              position: "right",
              style: { fontSize: "11px", fill: "#6b7280" },
            }}
            stroke="#6b7280"
            strokeDasharray="5 5"
            y={avgVolatility}
          />

          {/* Risk zones */}
          <ReferenceLine
            label={{
              value: "Extreme Risk (≥60%)",
              position: "right",
              style: { fontSize: "10px", fill: "#ef4444" },
            }}
            stroke="#ef4444"
            strokeDasharray="3 3"
            strokeOpacity={0.3}
            y={60}
          />

          <ReferenceLine
            label={{
              value: "High Risk (≥30%)",
              position: "right",
              style: { fontSize: "10px", fill: "#ea580c" },
            }}
            stroke="#ea580c"
            strokeDasharray="3 3"
            strokeOpacity={0.3}
            y={30}
          />

          <ReferenceLine
            label={{
              value: "Medium Risk (≥10%)",
              position: "right",
              style: { fontSize: "10px", fill: "#F3D42F" },
            }}
            stroke="#F3D42F"
            strokeDasharray="3 3"
            strokeOpacity={0.3}
            y={10}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload[0]) {
                const data = payload[0].payload;

                return (
                  <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                    <p className="text-sm font-semibold mb-1">
                      {new Date(data.date).toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {data.volatility.toFixed(2)}%
                    </p>
                    <p className="text-xs text-default-500">
                      Annualized Volatility
                    </p>
                  </div>
                );
              }

              return null;
            }}
          />

          <Line
            activeDot={{ r: 6 }}
            dataKey="volatility"
            dot={false}
            stroke="#037bfc"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
