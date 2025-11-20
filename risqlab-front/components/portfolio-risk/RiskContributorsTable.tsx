"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Input } from "@heroui/input";
import { Image } from "@heroui/image";
import { Search } from "lucide-react";

import { RiskContribution } from "@/types/volatility";
import { VolatilityBadge } from "@/components/volatility";
import { getCoinImageUrl } from "@/lib/formatters";

interface RiskContributorsTableProps {
  /**
   * Array of constituents with risk contributions
   */
  contributors: RiskContribution[];
}

type SortKey = "symbol" | "weight" | "volatility" | "risk";
type SortOrder = "asc" | "desc";

/**
 * Table showing risk contribution of each portfolio constituent
 */
export function RiskContributorsTable({
  contributors,
}: RiskContributorsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = contributors.filter(
      (item) =>
        item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    // Sort
    filtered.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortKey) {
        case "symbol":
          return sortOrder === "asc"
            ? a.symbol.localeCompare(b.symbol)
            : b.symbol.localeCompare(a.symbol);
        case "weight":
          aValue = a.weight;
          bValue = b.weight;
          break;
        case "volatility":
          aValue = a.annualized_volatility;
          bValue = b.annualized_volatility;
          break;
        case "risk":
          aValue = a.riskContribution;
          bValue = b.riskContribution;
          break;
        default:
          return 0;
      }

      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  }, [contributors, searchTerm, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <Input
        isClearable
        placeholder="Search by symbol or name..."
        startContent={<Search size={18} />}
        value={searchTerm}
        onClear={() => setSearchTerm("")}
        onValueChange={setSearchTerm}
      />

      {/* Table */}
      <Table aria-label="Risk contributors table">
        <TableHeader>
          <TableColumn
            key="rank"
            allowsSorting
            className="cursor-pointer"
            onClick={() => handleSort("risk")}
          >
            RANK
          </TableColumn>
          <TableColumn
            key="crypto"
            allowsSorting
            className="cursor-pointer"
            onClick={() => handleSort("symbol")}
          >
            CRYPTOCURRENCY
          </TableColumn>
          <TableColumn
            key="weight"
            allowsSorting
            className="cursor-pointer text-right"
            onClick={() => handleSort("weight")}
          >
            WEIGHT
          </TableColumn>
          <TableColumn
            key="volatility"
            allowsSorting
            className="cursor-pointer text-right"
            onClick={() => handleSort("volatility")}
          >
            VOLATILITY
          </TableColumn>
          <TableColumn
            key="risk"
            allowsSorting
            className="cursor-pointer text-right"
            onClick={() => handleSort("risk")}
          >
            RISK CONTRIBUTION
          </TableColumn>
        </TableHeader>
        <TableBody items={filteredAndSortedData}>
          {(item) => (
            <TableRow key={item.crypto_id}>
              <TableCell>
                <span className="text-sm text-default-500">
                  #{filteredAndSortedData.indexOf(item) + 1}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Image
                    alt={item.name}
                    className="rounded-full min-w-8 min-h-8"
                    height={32}
                    src={getCoinImageUrl(item.cmc_id)}
                    width={32}
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-sm text-default-500">
                      {item.symbol}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-right">
                  <p className="font-medium">
                    {(item.weight * 100).toFixed(2)}%
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <VolatilityBadge value={item.annualized_volatility} />
                </div>
              </TableCell>
              <TableCell>
                <div className="text-right">
                  <p className="font-semibold text-primary">
                    {(item.riskContribution * 100).toFixed(2)}%
                  </p>
                  <p className="text-xs text-default-500">
                    {item.riskContributionPercentage.toFixed(1)}% of total
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Summary */}
      <div className="text-sm text-default-500 text-center">
        Showing {filteredAndSortedData.length} of {contributors.length}{" "}
        constituents
      </div>
    </div>
  );
}
