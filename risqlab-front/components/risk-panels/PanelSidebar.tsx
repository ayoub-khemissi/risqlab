"use client";

import { Card, CardBody } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import {
  DollarSign,
  Activity,
  AlertTriangle,
  Shield,
  TrendingUp,
  TrendingDown,
  BarChart2,
  GitBranch,
} from "lucide-react";

import { SidebarMetricCard } from "./SidebarMetricCard";

import {
  RiskPanel,
  PANEL_CONFIGS,
  RiskSummaryData,
  getBetaInterpretation,
  getSkewnessInterpretation,
  getKurtosisInterpretation,
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

type CardData = {
  value: React.ReactNode;
  subValue?: React.ReactNode;
  chipLabel?: string;
  chipColor?: string;
};

// Helper to format data for each panel type
function getCardData(
  panelId: RiskPanel,
  riskSummary?: RiskSummaryData | null,
): CardData {
  const empty: CardData = { value: null };

  if (!riskSummary) return empty;

  switch (panelId) {
    case "price":
      if (!riskSummary.price) return empty;
      const { current, changes } = riskSummary.price;
      const change1h = changes?.["1h"] ?? 0;
      const change24h = changes?.["24h"] ?? 0;
      const change7d = changes?.["7d"] ?? 0;

      const c1hColor = change1h >= 0 ? "success" : "danger";
      const c24Color = change24h >= 0 ? "success" : "danger";
      const c7dColor = change7d >= 0 ? "success" : "danger";
      const c30dColor =
        changes?.["30d"] != null && changes["30d"] >= 0 ? "success" : "danger";

      return {
        value: formatCryptoPrice(current), // Current Price
        subValue: (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {/* 1h */}
            {changes?.["1h"] != null && (
              <Chip
                classNames={{
                  base: "h-6 px-1",
                }}
                color={c1hColor}
                size="sm"
                startContent={
                  change1h > 0 ? (
                    <TrendingUp size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )
                }
                variant="flat"
              >
                1h: {change1h > 0 ? "+" : ""}
                {change1h.toFixed(2)}%
              </Chip>
            )}

            {/* 24h */}
            <Chip
              classNames={{
                base: "h-6 px-1",
              }}
              color={c24Color}
              size="sm"
              startContent={
                change24h > 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )
              }
              variant="flat"
            >
              24h: {change24h > 0 ? "+" : ""}
              {change24h.toFixed(2)}%
            </Chip>

            {/* 7d */}
            <Chip
              classNames={{
                base: "h-6 px-1",
              }}
              color={c7dColor}
              size="sm"
              startContent={
                change7d > 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )
              }
              variant="flat"
            >
              7d: {change7d > 0 ? "+" : ""}
              {change7d.toFixed(2)}%
            </Chip>

            {/* 30d */}
            {changes?.["30d"] != null && (
              <Chip
                classNames={{
                  base: "h-6 px-1",
                }}
                color={c30dColor}
                size="sm"
                startContent={
                  changes["30d"] > 0 ? (
                    <TrendingUp size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )
                }
                variant="flat"
              >
                30d: {changes["30d"] > 0 ? "+" : ""}
                {changes["30d"].toFixed(2)}%
              </Chip>
            )}
          </div>
        ),
      };

    case "volatility":
      if (!riskSummary.volatility) return empty;
      const volChanges = riskSummary.volatility.changes;

      const v24 = volChanges?.["24h"] ?? 0;
      const v7d = volChanges?.["7d"] ?? 0;
      const v30d = volChanges?.["30d"] ?? 0;
      const v90d = volChanges?.["90d"] ?? 0; // New 90d var

      // For volatility, increase can be seen as "danger" (higher risk) or just a change.
      // Usually red for increase, green for decrease is good for risk perception.
      const v24Color = v24 > 0 ? "danger" : "success"; // Increased vol = bad? or just diff. Let's stick to Green=Good (Down), Red=Bad (Up).
      const v7dColor = v7d > 0 ? "danger" : "success";
      const v30dColor = v30d > 0 ? "danger" : "success";
      const v90dColor = v90d > 0 ? "danger" : "success";

      // Calculate risk level for annualized volatility
      const volVal = riskSummary.volatility.annualized;
      let volRisk: { label: string; color: string } = {
        label: "Low Risk",
        color: "#16C784", // Green - Low
      };

      if (volVal >= 60) {
        volRisk = { label: "Extreme Risk", color: "#EA3943" }; // Red - Extreme
      } else if (volVal >= 30) {
        volRisk = { label: "High Risk", color: "#EA580C" }; // Orange - High
      } else if (volVal >= 10) {
        volRisk = { label: "Medium Risk", color: "#F3D42F" }; // Yellow - Medium
      }

      return {
        value: `${riskSummary.volatility.annualized.toFixed(2)}%`,
        subValue: (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {/* 24h */}
            {volChanges?.["24h"] != null && (
              <Chip
                classNames={{
                  base: "h-6 px-1",
                }}
                color={v24Color}
                size="sm"
                startContent={
                  v24 > 0 ? (
                    <TrendingUp size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )
                }
                variant="flat"
              >
                24h: {v24 > 0 ? "+" : ""}
                {v24.toFixed(2)}%
              </Chip>
            )}

            {/* 7d */}
            {volChanges?.["7d"] != null && (
              <Chip
                classNames={{
                  base: "h-6 px-1",
                }}
                color={v7dColor}
                size="sm"
                startContent={
                  v7d > 0 ? (
                    <TrendingUp size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )
                }
                variant="flat"
              >
                7d: {v7d > 0 ? "+" : ""}
                {v7d.toFixed(2)}%
              </Chip>
            )}

            {/* 30d */}
            {volChanges?.["30d"] != null && (
              <Chip
                classNames={{
                  base: "h-6 px-1",
                }}
                color={v30dColor}
                size="sm"
                startContent={
                  v30d > 0 ? (
                    <TrendingUp size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )
                }
                variant="flat"
              >
                30d: {v30d > 0 ? "+" : ""}
                {v30d.toFixed(2)}%
              </Chip>
            )}

            {/* 90d */}
            {volChanges?.["90d"] != null && (
              <Chip
                classNames={{
                  base: "h-6 px-1",
                }}
                color={v90dColor}
                size="sm"
                startContent={
                  v90d > 0 ? (
                    <TrendingUp size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )
                }
                variant="flat"
              >
                90d: {v90d > 0 ? "+" : ""}
                {v90d.toFixed(2)}%
              </Chip>
            )}
          </div>
        ),
        chipLabel: volRisk.label,
        chipColor: volRisk.color,
      };

    case "stress-test":
      if (!riskSummary.stressTest) return { value: "N/A" };
      const { newPrice, impactPercentage } = riskSummary.stressTest;
      const stressColor =
        impactPercentage >= 0 ? "text-success" : "text-danger";

      return {
        value: formatCryptoPrice(newPrice),
        subValue: (
          <span>
            Impact:{" "}
            <span className={stressColor}>{impactPercentage.toFixed(2)}%</span>
          </span>
        ),
        chipLabel: "Covid-19",
        chipColor: "danger",
      };

    case "var":
      if (riskSummary.var99 == null || riskSummary.cvar99 == null)
        return { value: "N/A" };

      return {
        value: `${(-riskSummary.var99).toFixed(2)}%`,
        subValue: `CVaR 99%: ${(-riskSummary.cvar99).toFixed(2)}%`,
        chipLabel: "VaR 99%",
        chipColor: "default",
      };

    case "beta":
      if (riskSummary.beta == null) return { value: "N/A" };
      const betaInterp = getBetaInterpretation(riskSummary.beta);

      return {
        value: riskSummary.beta.toFixed(2),
        subValue: null,
        // User asked for "valeur du beta et son chip label". He didn't ask for alpha here??
        // Wait, "5- beta : la valeur du beta et son chip label".
        // But requested "8- sml : l'alpha jensen's".
        // So I can remove Alpha from Beta card to be cleaner if he didn't ask for it.
        chipLabel: betaInterp.label,
        chipColor: betaInterp.color,
      };

    case "skew":
      if (riskSummary.skewness == null) return { value: "N/A" };
      const skewInterp = getSkewnessInterpretation(riskSummary.skewness);

      return {
        value: riskSummary.skewness.toFixed(2),
        chipLabel: skewInterp.label,
        chipColor: skewInterp.color,
      };

    case "kurtosis":
      if (riskSummary.kurtosis == null) return { value: "N/A" };
      const kurtInterp = getKurtosisInterpretation(riskSummary.kurtosis);

      return {
        value: riskSummary.kurtosis.toFixed(2),
        chipLabel: kurtInterp.label,
        chipColor: kurtInterp.color,
      };

    case "sml":
      if (!riskSummary.sml) return { value: "N/A" };
      const { alpha, isOvervalued } = riskSummary.sml;

      return {
        value: `${alpha >= 0 ? "+" : ""}${alpha.toFixed(2)}%`,
        subValue: "Jensen's Alpha",
        chipLabel: isOvervalued ? "Overvalued" : "Undervalued",
        chipColor: isOvervalued ? "danger" : "success",
      };

    default:
      return empty;
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
    <div className="flex flex-col gap-4">
      {/* Mobile: Dropdown Select (Keeping it simple for mobile for now) */}
      <Card className="lg:hidden sticky top-6 z-20">
        <CardBody className="p-4 flex flex-col gap-2">
          <p className="text-sm font-medium text-default-500 ml-1 text-center">
            Select your risk metric
          </p>
          <Select
            aria-label="Select risk panel"
            className="max-w-xs mx-auto"
            renderValue={(items) => {
              return items.map((item) => {
                const panel = PANEL_CONFIGS.find((p) => p.id === item.key);

                if (!panel) return item.textValue;

                let cardData = getCardData(panel.id, riskSummary);

                // Fallback for Price
                if (panel.id === "price" && !cardData.value && currentPrice) {
                  cardData.value = formatCryptoPrice(currentPrice);
                }

                let displayValue = cardData.value;

                // For valid values, simplified display without parens
                if (displayValue) {
                  // Just value, no extra text in parens
                  // But maybe specific logic per panel if value itself needs adjustment?
                  // User said "Section Name" left, "Value" right.
                  // For Stress Test, value includes "Covid-19" in my previous logic, I should just show the dollar amount.
                  // Actually cardData.value IS the formatted string usually.
                  // The previous logic added " (Covid-19)".
                  // Now I should just use cardData.value.
                  // Let's ensure cardData.value is pure.
                  // getCardData returns string or ReactNode.
                  // cardData.value is usually the main metric.
                  // E.g. for Stress Test it is "$45,000".
                  // For Beta it is "0.85".
                  // So sticking to cardData.value is correct.
                }

                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between w-full gap-2"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      {PANEL_ICONS[panel.id]}
                      <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                        {panel.label}
                      </span>
                    </div>
                    <span className="font-bold whitespace-nowrap opacity-80 pl-2">
                      {displayValue}
                    </span>
                  </div>
                );
              });
            }}
            selectedKeys={[activePanel]}
            size="md"
            variant="bordered"
            onChange={(e) => {
              if (e.target.value) onPanelChange(e.target.value as RiskPanel);
            }}
          >
            {PANEL_CONFIGS.map((panel) => {
              let cardData = getCardData(panel.id, riskSummary);

              if (panel.id === "price" && !cardData.value && currentPrice) {
                cardData.value = formatCryptoPrice(currentPrice);
              }

              // Plain text for the item
              return (
                <SelectItem key={panel.id} textValue={panel.label}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-2">
                      {PANEL_ICONS[panel.id]}
                      <span className="font-medium">{panel.label}</span>
                    </div>
                    {cardData.value && (
                      <span className="font-bold opacity-70">
                        {cardData.value}
                      </span>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </Select>
        </CardBody>
      </Card>

      {/* Desktop: Vertical Stack of Cards */}
      <div className="hidden lg:flex flex-col gap-3 sticky top-6">
        {PANEL_CONFIGS.map((panel) => {
          // Special handling for Price panel to use currentPrice prop if riskSummary missing
          // But riskSummary.price should be populated now.
          // If riskSummary is null (loading initial), we might fail.
          // Fallback for price if summary is missing but currentPrice is passed prop

          let cardData = getCardData(panel.id, riskSummary);

          // Fallback for Price value if riskSummary not yet loaded but currentPrice exists
          if (panel.id === "price" && !cardData.value && currentPrice) {
            cardData.value = formatCryptoPrice(currentPrice);
          }

          return (
            <SidebarMetricCard
              key={panel.id}
              chipColor={cardData.chipColor}
              chipLabel={cardData.chipLabel}
              icon={PANEL_ICONS[panel.id]}
              isActive={activePanel === panel.id}
              isLoading={isLoading}
              label={panel.label}
              subValue={cardData.subValue}
              value={cardData.value}
              onClick={() => onPanelChange(panel.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
