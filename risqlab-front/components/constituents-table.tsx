"use client";

import React, { useState, useMemo, memo } from "react";
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
import { TrendingUp, TrendingDown } from "lucide-react";
import { IndexConstituent } from "@/types/index-details";
import {
  formatUSD,
  formatCryptoPrice,
  formatPercentage,
  getPercentageColor,
  getCoinImageUrl,
} from "@/lib/formatters";
import { PriceCell } from "./PriceCell";
import { MarketCapCell } from "./MarketCapCell";

interface ConstituentsTableProps {
  constituents: IndexConstituent[];
}

function ConstituentsTableComponent({ constituents }: ConstituentsTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);

  const columns = [
    { key: "rank_position", label: "Rank", sortable: true },
    { key: "name", label: "Cryptocurrency", sortable: true },
    { key: "price_usd", label: "Price", sortable: true },
    { key: "percent_change_24h", label: "24h %", sortable: true },
    { key: "percent_change_7d", label: "7d %", sortable: true },
    { key: "market_cap_usd", label: "Market Cap", sortable: true },
    { key: "volume_24h_usd", label: "24h Volume", sortable: true },
    { key: "weight_in_index", label: "Weight", sortable: true },
  ];

  const sortedConstituents = useMemo(() => {
    if (!sortColumn || !sortOrder) {
      return constituents;
    }

    return [...constituents].sort((a, b) => {
      let aValue: any = a[sortColumn as keyof IndexConstituent];
      let bValue: any = b[sortColumn as keyof IndexConstituent];

      if (sortColumn === "name") {
        aValue = a.name;
        bValue = b.name;
      } else {
        aValue = parseFloat(aValue?.toString() || "0");
        bValue = parseFloat(bValue?.toString() || "0");
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [constituents, sortColumn, sortOrder]);

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

  const renderCell = (constituent: IndexConstituent, columnKey: React.Key) => {
    switch (columnKey) {
      case "rank_position":
        return <div className="text-default-600 font-semibold">#{constituent.rank_position}</div>;

      case "name":
        return (
          <div className="flex items-center gap-3">
            <Image
              src={getCoinImageUrl(constituent.cmc_id)}
              alt={constituent.name}
              width={32}
              height={32}
              className="rounded-full"
            />
            <div className="flex flex-col">
              <span className="font-semibold">{constituent.name}</span>
              <span className="text-sm text-default-500">{constituent.symbol}</span>
            </div>
          </div>
        );

      case "price_usd":
        return <PriceCell symbol={constituent.symbol} fallbackPrice={constituent.price_usd} />;

      case "percent_change_24h": {
        const value = parseFloat(constituent.percent_change_24h || "0");
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
        const value = parseFloat(constituent.percent_change_7d || "0");
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
            symbol={constituent.symbol}
            fallbackPrice={constituent.price_usd}
            circulatingSupply={constituent.circulating_supply}
          />
        );

      case "weight_in_index": {
        const weight = parseFloat(constituent.weight_in_index || "0");
        return <div className="font-mono">{weight.toFixed(2)}%</div>;
      }

      case "volume_24h_usd":
        return <div className="font-mono">{formatUSD(constituent.volume_24h_usd)}</div>;

      default:
        return null;
    }
  };

  return (
    <Table
      aria-label="RisqLab 80 Index constituents table"
      classNames={{
        wrapper: "min-h-[400px]",
      }}
      sortDescriptor={
        sortColumn && sortOrder
          ? { column: sortColumn, direction: sortOrder === "asc" ? "ascending" : "descending" }
          : undefined
      }
      onSortChange={(descriptor) => {
        if (descriptor.column) {
          handleSort(descriptor.column.toString());
        }
      }}
      topContent={
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">RisqLab 80 Index Constituents</h2>
        </div>
      }
    >
      <TableHeader columns={columns}>
        {(column) => (
          <TableColumn key={column.key} allowsSorting={column.sortable}>
            {column.label}
          </TableColumn>
        )}
      </TableHeader>
      <TableBody
        items={sortedConstituents}
        emptyContent={"No constituents found"}
      >
        {(item) => (
          <TableRow key={item.cmc_id}>
            {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

// Export with memo to prevent unnecessary re-renders
export const ConstituentsTable = memo(ConstituentsTableComponent);
