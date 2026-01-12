"use client";

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import {
  DollarSign,
  Activity,
  AlertTriangle,
  Shield,
  TrendingUp,
  BarChart2,
  GitBranch,
} from "lucide-react";

import {
  RiskPanel,
  PANEL_CONFIGS,
  RiskSummaryData,
} from "@/types/risk-metrics";
import { formatCryptoPrice } from "@/lib/formatters";

interface PanelSidebarProps {
  activePanel: RiskPanel;
  onPanelChange: (panel: RiskPanel) => void;
  currentPrice?: number | null;
  riskSummary?: RiskSummaryData | null;
  isLoading?: boolean;
}

const PANEL_ICONS: Record<RiskPanel, React.ReactNode> = {
  price: <DollarSign size={18} />,
  volatility: <Activity size={18} />,
  "stress-test": <AlertTriangle size={18} />,
  var: <Shield size={18} />,
  beta: <TrendingUp size={18} />,
  skew: <BarChart2 size={18} />,
  kurtosis: <Activity size={18} />,
  sml: <GitBranch size={18} />,
};

function formatMetricValue(
  panelId: RiskPanel,
  currentPrice?: number | null,
  riskSummary?: RiskSummaryData | null,
): string | null {
  if (!riskSummary && !currentPrice) return null;

  switch (panelId) {
    case "price":
      return currentPrice ? formatCryptoPrice(currentPrice) : null;
    case "volatility":
      // volatility.annualized is already in percentage format (e.g., 37.78)
      return riskSummary?.volatility?.annualized != null
        ? `${riskSummary.volatility.annualized.toFixed(2)}%`
        : null;
    case "stress-test":
      return riskSummary?.beta != null
        ? `β ${riskSummary.beta.toFixed(2)}`
        : null;
    case "var":
      return riskSummary?.var95 != null
        ? `-${riskSummary.var95.toFixed(2)}%`
        : null;
    case "beta":
      return riskSummary?.beta != null ? riskSummary.beta.toFixed(2) : null;
    case "skew":
      return riskSummary?.skewness != null
        ? `Skew ${riskSummary.skewness.toFixed(2)}`
        : null;
    case "kurtosis":
      return riskSummary?.kurtosis != null
        ? `Kurt. ${riskSummary.kurtosis.toFixed(2)}`
        : null;
    case "sml":
      return riskSummary?.alpha != null
        ? `α ${riskSummary.alpha >= 0 ? "+" : ""}${riskSummary.alpha.toFixed(2)}%`
        : null;
    default:
      return null;
  }
}

export function PanelSidebar({
  activePanel,
  onPanelChange,
  currentPrice,
  riskSummary,
  isLoading,
}: PanelSidebarProps) {
  return (
    <Card className="sticky top-6">
      <CardBody className="p-4">
        <p className="text-sm font-semibold text-default-500 mb-3">
          Risk Metrics
        </p>

        {/* Mobile: Dropdown Select */}
        <div className="lg:hidden">
          <Select
            aria-label="Select risk panel"
            classNames={{
              trigger: "h-12",
              value: "text-sm",
            }}
            renderValue={(_items) => {
              const selectedPanel = PANEL_CONFIGS.find(
                (p) => p.id === activePanel,
              );
              const metricValue = formatMetricValue(
                activePanel,
                currentPrice,
                riskSummary,
              );

              return (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    {PANEL_ICONS[activePanel]}
                    <span>{selectedPanel?.label}</span>
                  </div>
                  {metricValue && !isLoading && (
                    <span className="text-xs text-foreground font-mono font-semibold">
                      {metricValue}
                    </span>
                  )}
                </div>
              );
            }}
            selectedKeys={[activePanel]}
            size="md"
            variant="bordered"
            onChange={(e) => {
              if (e.target.value) {
                onPanelChange(e.target.value as RiskPanel);
              }
            }}
          >
            {PANEL_CONFIGS.map((panel) => {
              const metricValue = formatMetricValue(
                panel.id,
                currentPrice,
                riskSummary,
              );

              return (
                <SelectItem
                  key={panel.id}
                  startContent={PANEL_ICONS[panel.id]}
                  textValue={panel.label}
                >
                  <div className="flex justify-between items-center w-full">
                    <span>{panel.label}</span>
                    {metricValue && !isLoading && (
                      <span className="text-xs text-foreground font-mono font-semibold">
                        {metricValue}
                      </span>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </Select>
        </div>

        {/* Desktop: Button List */}
        <div className="hidden lg:flex flex-col gap-1">
          {PANEL_CONFIGS.map((panel) => {
            const metricValue = formatMetricValue(
              panel.id,
              currentPrice,
              riskSummary,
            );

            return (
              <Button
                key={panel.id}
                className="justify-between h-auto py-2 px-3"
                size="sm"
                variant={activePanel === panel.id ? "flat" : "light"}
                onPress={() => onPanelChange(panel.id)}
              >
                <div className="flex items-center gap-2">
                  {PANEL_ICONS[panel.id]}
                  <span>{panel.label}</span>
                </div>
                {metricValue && !isLoading && (
                  <span className="text-xs text-foreground font-mono font-semibold ml-2">
                    {metricValue}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
