"use client";

import { useMemo, memo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

import { IndexConstituent } from "@/types/index-details";

interface TopConstituentsChartProps {
  constituents: IndexConstituent[];
}

const COLORS = [
  "#FF6B35", // Orange
  "#3B82F6", // Blue
  "#10B981", // Green
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
  "#14B8A6", // Teal
  "#94A3B8", // Slate gray for "Others"
];

function TopConstituentsChartComponent({ constituents }: TopConstituentsChartProps) {
  const chartData = useMemo(() => {
    if (!constituents || constituents.length === 0) return [];

    // Sort by weight descending and take top 10
    const sorted = [...constituents].sort(
      (a, b) => parseFloat(b.weight_in_index) - parseFloat(a.weight_in_index)
    );

    const top10 = sorted.slice(0, 10);
    const rest = sorted.slice(10);

    const data = top10.map((constituent) => ({
      name: constituent.symbol,
      value: parseFloat(constituent.weight_in_index),
      displayValue: `${parseFloat(constituent.weight_in_index).toFixed(2)}%`,
    }));

    // Add "Others" if there are more than 10 constituents
    if (rest.length > 0) {
      const othersWeight = rest.reduce(
        (sum, constituent) => sum + parseFloat(constituent.weight_in_index),
        0
      );

      data.push({
        name: "Others",
        value: othersWeight,
        displayValue: `${othersWeight.toFixed(2)}%`,
      });
    }

    return data;
  }, [constituents]);

  const totalConstituents = constituents?.length || 0;

  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 25;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        className="fill-gray-900 dark:fill-white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-content1 border border-default-200 rounded-lg shadow-lg px-4 py-2">
          <p className="text-sm font-semibold">{payload[0].name}</p>
          <p className="text-sm text-default-500">{payload[0].payload.displayValue}</p>
        </div>
      );
    }

    return null;
  };

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-[400px] text-default-500">
        No data available
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row items-center gap-8 w-full">
      <div className="w-full lg:w-1/2 h-[400px]" style={{ minHeight: '400px' }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={400}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={140}
              innerRadius={80}
              fill="#8884d8"
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
              <tspan x="50%" dy="-0.5em" fontSize={32} fontWeight={700} className="fill-gray-900 dark:fill-white">
                {totalConstituents}
              </tspan>
              <tspan x="50%" dy="1.5em" fontSize={14} className="fill-gray-600 dark:fill-gray-400">
                Assets
              </tspan>
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full lg:w-1/2">
        <ul className="flex flex-col gap-3">
          {chartData.map((entry, index) => (
            <li key={`legend-${index}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm font-medium">{entry.name}</span>
              </div>
              <span className="text-sm text-default-500">{entry.displayValue}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Export with memo to prevent unnecessary re-renders
export const TopConstituentsChart = memo(TopConstituentsChartComponent);
