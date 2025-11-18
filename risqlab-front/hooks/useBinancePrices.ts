import { useEffect, useState, useRef } from "react";

interface BinanceTicker {
  s: string;
  c: string;
}

export function useBinancePrices(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);
  const lastUpdateTimeRef = useRef<number>(0);

  useEffect(() => {
    isMountedRef.current = true;

    if (symbols.length === 0) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    const ws = new WebSocket("wss://stream.binance.com:9443/ws/!ticker@arr");

    wsRef.current = ws;

    const MIN_UPDATE_INTERVAL = 5000; // Update at most once every 5 seconds

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;

      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

      // Only update if enough time has passed (manual throttle)
      if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL) {
        return;
      }

      try {
        const tickers: BinanceTicker[] = JSON.parse(event.data);
        const updates: Record<string, string> = {};

        // Collect all price updates for our symbols
        symbols.forEach((symbol) => {
          const binanceSymbol = `${symbol}USDT`;
          const ticker = tickers.find((t) => t.s === binanceSymbol);

          if (ticker) {
            updates[symbol] = ticker.c;
          }
        });

        // Apply updates immediately if we have any
        if (Object.keys(updates).length > 0) {
          setPrices((prev) => ({ ...prev, ...updates }));
          lastUpdateTimeRef.current = now;
        }
      } catch {}
    };

    return () => {
      isMountedRef.current = false;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [symbols.join(",")]);

  return prices;
}
