"use client";

import React, { memo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Image } from "@heroui/image";
import { Chip } from "@heroui/chip";
import { Pagination } from "@heroui/pagination";
import { Spinner } from "@heroui/spinner";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Cryptocurrency } from "@/types/cryptocurrency";
import {
  formatUSD,
  formatCryptoPrice,
  formatNumber,
  formatCirculatingSupply,
  formatPercentage,
  getPercentageColor,
  getCoinImageUrl,
} from "@/lib/formatters";
import { PriceCell } from "./PriceCell";
import { MarketCapCell } from "./MarketCapCell";

interface CryptoTableProps {
  data: Cryptocurrency[];
  isLoading?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSort: (column: string) => void;
  sortColumn: string | null;
  sortOrder: "asc" | "desc" | null;
}

function CryptoTableComponent({
  data,
  isLoading = false,
  page,
  totalPages,
  onPageChange,
  onSort,
  sortColumn,
  sortOrder,
}: CryptoTableProps) {
  const columns = [
    { key: "rank", label: "Rank", sortable: true, dbColumn: "market_cap_usd" },
    { key: "name", label: "Cryptocurrency", sortable: true },
    { key: "price_usd", label: "Price", sortable: true },
    { key: "percent_change_24h", label: "24h %", sortable: true },
    { key: "percent_change_7d", label: "7d %", sortable: true },
    { key: "market_cap_usd", label: "Market Cap", sortable: true },
    { key: "circulating_supply", label: "Circulating Supply", sortable: true },
    { key: "volume_24h_usd", label: "24h Volume", sortable: true },
  ];

  const renderCell = (crypto: Cryptocurrency, columnKey: React.Key) => {
    switch (columnKey) {
      case "rank":
        return <div className="text-default-600 font-semibold">#{crypto.rank}</div>;

      case "name":
        return (
          <div className="flex items-center gap-3">
            <Image
              src={getCoinImageUrl(crypto.cmc_id)}
              alt={crypto.name}
              width={32}
              height={32}
              className="rounded-full"
            />
            <div className="flex flex-col">
              <span className="font-semibold">{crypto.name}</span>
              <span className="text-sm text-default-500">{crypto.symbol}</span>
            </div>
          </div>
        );

      case "price_usd":
        return <PriceCell symbol={crypto.symbol} fallbackPrice={crypto.price_usd} />;

      case "percent_change_24h": {
        const value = parseFloat(crypto.percent_change_24h || "0");
        const color = getPercentageColor(value);

        return (
          <Chip
            size="sm"
            variant="flat"
            color={color}
            startContent={
              value > 0 ? (
                <TrendingUp size={14} />
              ) : value < 0 ? (
                <TrendingDown size={14} />
              ) : null
            }
          >
            {formatPercentage(value)}
          </Chip>
        );
      }

      case "percent_change_7d": {
        const value = parseFloat(crypto.percent_change_7d || "0");
        const color = getPercentageColor(value);

        return (
          <Chip
            size="sm"
            variant="flat"
            color={color}
            startContent={
              value > 0 ? (
                <TrendingUp size={14} />
              ) : value < 0 ? (
                <TrendingDown size={14} />
              ) : null
            }
          >
            {formatPercentage(value)}
          </Chip>
        );
      }

      case "market_cap_usd":
        return (
          <MarketCapCell
            symbol={crypto.symbol}
            fallbackPrice={crypto.price_usd}
            circulatingSupply={crypto.circulating_supply}
          />
        );

      case "circulating_supply":
        return (
          <div className="font-mono text-sm">
            {formatCirculatingSupply(crypto.circulating_supply, crypto.symbol)}
          </div>
        );

      case "volume_24h_usd":
        return <div className="font-mono">{formatUSD(crypto.volume_24h_usd)}</div>;

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Table
        aria-label="Cryptocurrency table"
        sortDescriptor={
          sortColumn && sortOrder
            ? {
                column: sortColumn,
                direction: sortOrder === "asc" ? "ascending" : "descending",
              }
            : undefined
        }
        onSortChange={(descriptor) => {
          if (descriptor.column) {
            const column = descriptor.column as string;
            const columnConfig = columns.find(col => col.key === column);
            const dbColumn = columnConfig?.dbColumn || column;
            onSort(dbColumn);
          }
        }}
        bottomContent={
          totalPages > 1 ? (
            <div className="flex w-full justify-center">
              <Pagination
                isCompact
                showControls
                showShadow
                color="primary"
                page={page}
                total={totalPages}
                onChange={onPageChange}
              />
            </div>
          ) : null
        }
        classNames={{
          wrapper: "min-h-[400px]",
        }}
      >
        <TableHeader columns={columns}>
          {(column) => (
            <TableColumn
              key={column.key}
              allowsSorting={column.sortable}
            >
              {column.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody
          items={data}
          isLoading={isLoading}
          loadingContent={<Spinner label="Loading..." />}
          emptyContent={"No cryptocurrencies found"}
        >
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Export with memo to prevent unnecessary re-renders
export const CryptoTable = memo(CryptoTableComponent);
