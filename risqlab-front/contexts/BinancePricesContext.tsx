"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useBinancePrices } from '@/hooks/useBinancePrices';

interface BinancePricesContextType {
  prices: Record<string, string>;
}

const BinancePricesContext = createContext<BinancePricesContextType | undefined>(undefined);

interface BinancePricesProviderProps {
  children: ReactNode;
  symbols: string[];
}

export function BinancePricesProvider({ children, symbols }: BinancePricesProviderProps) {
  const prices = useBinancePrices(symbols);

  // Memoize the context value to ensure proper re-renders
  const value = useMemo(() => ({ prices }), [prices]);

  return (
    <BinancePricesContext.Provider value={value}>
      {children}
    </BinancePricesContext.Provider>
  );
}

export function useBinancePricesContext() {
  const context = useContext(BinancePricesContext);
  if (context === undefined) {
    throw new Error('useBinancePricesContext must be used within BinancePricesProvider');
  }
  return context;
}

// Hook optionnel pour récupérer le prix d'un seul symbole
export function useBinancePrice(symbol: string): string | undefined {
  const { prices } = useBinancePricesContext();
  return prices[symbol];
}
