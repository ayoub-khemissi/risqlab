"use client";

import { memo } from "react";

import { useBinancePrice } from "@/contexts/BinancePricesContext";
import { formatUSD } from "@/lib/formatters";

interface MarketCapCellProps {
  symbol: string;
  fallbackPrice: string;
  circulatingSupply: string;
}

// Ce composant re-render UNIQUEMENT quand SON prix change
function MarketCapCellComponent({
  symbol,
  fallbackPrice,
  circulatingSupply,
}: MarketCapCellProps) {
  const livePrice = useBinancePrice(symbol);
  const displayPrice = livePrice || fallbackPrice;
  const marketCap = parseFloat(displayPrice) * parseFloat(circulatingSupply);

  return <div className="font-mono">{formatUSD(marketCap.toString())}</div>;
}

export const MarketCapCell = memo(MarketCapCellComponent);
