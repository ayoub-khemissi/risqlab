import { useEffect, useState, useRef } from "react";

interface BinanceTicker {
  s: string;
  c: string;
}

export function useBinancePrices(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);
  const pendingUpdatesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    isMountedRef.current = true;

    if (symbols.length === 0) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    const ws = new WebSocket("wss://stream.binance.com:9443/ws/!ticker@arr");

    wsRef.current = ws;

    // Apply all accumulated updates every 5 seconds
    const updateInterval = setInterval(() => {
      if (!isMountedRef.current) return;

      if (Object.keys(pendingUpdatesRef.current).length > 0) {
        setPrices((prev) => ({ ...prev, ...pendingUpdatesRef.current }));
        pendingUpdatesRef.current = {}; // Clear after applying
      }
    }, 5000); // Update every 5 seconds

    ws.onopen = () => {
      if (isMountedRef.current) {
        console.log("WebSocket Binance connecté");
      }
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;

      try {
        const tickers: BinanceTicker[] = JSON.parse(event.data);

        // Accumulate all price updates (last value wins if updated multiple times)
        symbols.forEach((symbol) => {
          const binanceSymbol = `${symbol}USDT`;
          const ticker = tickers.find((t) => t.s === binanceSymbol);

          if (ticker) {
            pendingUpdatesRef.current[symbol] = ticker.c;
          }
        });
      } catch (error) {
        if (isMountedRef.current) {
          console.error("Erreur lors du parsing des données Binance:", error);
        }
      }
    };

    ws.onerror = (error) => {
      if (isMountedRef.current && ws.readyState !== WebSocket.CLOSED) {
        console.error("Erreur WebSocket Binance:", error);
      }
    };

    ws.onclose = () => {
      if (isMountedRef.current) {
        console.log("WebSocket Binance fermé");
      }
    };

    return () => {
      isMountedRef.current = false;
      clearInterval(updateInterval);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [symbols.join(",")]);

  return prices;
}
