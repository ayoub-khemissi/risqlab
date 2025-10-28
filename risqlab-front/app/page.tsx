"use client";

import { useState, useEffect, useMemo } from "react";

import { title } from "@/components/primitives";
import { CryptoTable } from "@/components/crypto-table";
import { MetricsCards } from "@/components/metrics-cards";
import { Cryptocurrency, CryptocurrencyResponse } from "@/types/cryptocurrency";
import { MetricsResponse } from "@/types/metrics";
import { PortfolioVolatilityResponse } from "@/types/volatility";
import { BinancePricesProvider } from "@/contexts/BinancePricesContext";
import { API_BASE_URL } from "@/config/constants";

export default function Home() {
  const [data, setData] = useState<Cryptocurrency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
  const [metricsData, setMetricsData] = useState<
    MetricsResponse["data"] | null
  >(null);
  const [volatilityData, setVolatilityData] = useState<
    PortfolioVolatilityResponse["data"] | null
  >(null);

  useEffect(() => {
    fetchCryptocurrencies();
    fetchMetrics();
    fetchVolatility();
  }, [page, sortColumn, sortOrder]);

  // Scroll to crypto table if hash is present
  useEffect(() => {
    if (window.location.hash === "#crypto-table") {
      // Wait for data to load and page to render
      const scrollToTable = () => {
        const element = document.getElementById("crypto-table");

        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      };

      // Try after a delay
      setTimeout(scrollToTable, 300);
    }
  }, [data]);

  const fetchCryptocurrencies = async () => {
    setIsLoading(true);
    try {
      const url =
        sortColumn && sortOrder
          ? `${API_BASE_URL}/cryptocurrencies?page=${page}&limit=100&sortBy=${sortColumn}&sortOrder=${sortOrder}`
          : `${API_BASE_URL}/cryptocurrencies?page=${page}&limit=100`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch cryptocurrencies");
      }

      const result: CryptocurrencyResponse = await response.json();

      setData(result.data);
      setTotalPages(result.pagination.totalPages);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics`);

      if (!response.ok) {
        throw new Error("Failed to fetch metrics");
      }

      const result: MetricsResponse = await response.json();

      setMetricsData(result.data);
    } catch {}
  };

  const fetchVolatility = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/volatility/portfolio`);

      if (!response.ok) {
        return;
      }

      const result: PortfolioVolatilityResponse = await response.json();

      setVolatilityData(result.data);
    } catch {}
  };

  const symbols = useMemo(() => data.map((crypto) => crypto.symbol), [data]);

  const handleSort = (column: string) => {
    if (column === sortColumn) {
      if (sortOrder === "desc") {
        setSortOrder("asc");
      } else if (sortOrder === "asc") {
        setSortColumn(null);
        setSortOrder(null);
      } else {
        setSortOrder("desc");
      }
    } else {
      setSortColumn(column);
      setSortOrder("desc");
    }
  };

  return (
    <BinancePricesProvider symbols={symbols}>
      <section className="flex flex-col gap-8 py-8 md:py-10">
        <div className="text-center">
          <h1 className={title()}>RisqLab</h1>
          <p className="text-lg text-default-600 mt-4">
            Track the performance of the top cryptocurrencies in real-time
          </p>
        </div>

        {metricsData && (
          <MetricsCards
            fearGreedData={metricsData.fearGreed}
            globalData={metricsData.global}
            indexData={metricsData.index}
            volatilityData={volatilityData}
          />
        )}

        <div id="crypto-table">
          <CryptoTable
            data={data}
            isLoading={isLoading}
            page={page}
            sortColumn={sortColumn}
            sortOrder={sortOrder}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onSort={handleSort}
          />
        </div>
      </section>
    </BinancePricesProvider>
  );
}
