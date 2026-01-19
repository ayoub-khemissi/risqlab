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
      return riskSummary?.volatility?.annualized != null
        ? `${riskSummary.volatility.annualized.toFixed(2)}%`
        : null;
    case "stress-test":
      return riskSummary?.stressTest?.newPrice != null
        ? formatCryptoPrice(riskSummary.stressTest.newPrice)
        : null;
    case "var":
      return riskSummary?.var99 != null
        ? `${(-riskSummary.var99).toFixed(2)}%`
        : null;
    case "beta":
      return riskSummary?.beta != null ? riskSummary.beta.toFixed(2) : null;
    case "skew":
      return riskSummary?.skewness != null
        ? riskSummary.skewness.toFixed(2)
        : null;
    case "kurtosis":
      return riskSummary?.kurtosis != null
        ? riskSummary.kurtosis.toFixed(2)
        : null;
    case "sml":
      return riskSummary?.sml?.alpha != null
        ? `${riskSummary.sml.alpha >= 0 ? "+" : ""}${riskSummary.sml.alpha.toFixed(2)}%`
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
  const handleSelectionChange = (keys: "all" | Set<React.Key>) => {
    if (keys !== "all" && keys.size > 0) {
      const selectedKey = Array.from(keys)[0] as RiskPanel;

      onPanelChange(selectedKey);
    }
  };

  const activeConfig = PANEL_CONFIGS.find((p) => p.id === activePanel);
  const activeMetricValue = formatMetricValue(
    activePanel,
    currentPrice,
    riskSummary,
  );

  return (
    <>
      {/* Mobile: Select dropdown in card */}
      <Card className="md:hidden sticky top-4 z-10">
        <CardBody className="p-3">
          <p className="text-sm font-semibold text-default-500 mb-3 text-center">
            Select a risk metric
          </p>
          <Select
            aria-label="Select risk metric"
            classNames={{
              trigger: "bg-default-100",
              value: "text-small",
            }}
            renderValue={() => (
              <div className="flex items-center justify-between w-full">
                <span>{activeConfig?.label}</span>
                {activeMetricValue && !isLoading && (
                  <span className="text-xs text-default-500 font-mono">
                    {activeMetricValue}
                  </span>
                )}
              </div>
            )}
            selectedKeys={[activePanel]}
            size="sm"
            startContent={PANEL_ICONS[activePanel]}
            onSelectionChange={handleSelectionChange}
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
                  <div className="flex items-center justify-between w-full">
                    <span>{panel.label}</span>
                    {metricValue && !isLoading && (
                      <span className="text-xs text-default-500 font-mono ml-2">
                        {metricValue}
                      </span>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </Select>
        </CardBody>
      </Card>

      {/* Desktop: Expanded button list */}
      <Card className="hidden md:block sticky top-6">
        <CardBody className="p-3">
          <p className="text-sm font-semibold text-default-500 mb-3 px-1">
            Risk Metrics
          </p>

          <div className="flex flex-col gap-1">
            {PANEL_CONFIGS.map((panel) => {
              const metricValue = formatMetricValue(
                panel.id,
                currentPrice,
                riskSummary,
              );

              return (
                <Button
                  key={panel.id}
                  className="justify-between h-auto py-2.5 px-3"
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
    </>
  );
}
