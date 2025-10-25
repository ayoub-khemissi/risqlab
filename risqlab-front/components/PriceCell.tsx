"use client";

import { memo } from 'react';
import { useBinancePrice } from '@/contexts/BinancePricesContext';
import { formatCryptoPrice } from '@/lib/formatters';

interface PriceCellProps {
  symbol: string;
  fallbackPrice: string;
}

// Ce composant re-render UNIQUEMENT quand SON prix change
function PriceCellComponent({ symbol, fallbackPrice }: PriceCellProps) {
  const livePrice = useBinancePrice(symbol);
  const displayPrice = livePrice || fallbackPrice;

  return (
    <div className="font-mono" title={`$${parseFloat(displayPrice)}`}>
      {formatCryptoPrice(displayPrice)}
    </div>
  );
}

export const PriceCell = memo(PriceCellComponent);
