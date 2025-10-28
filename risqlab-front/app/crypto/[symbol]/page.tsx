"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Progress } from "@heroui/progress";
import {
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Globe,
  FileText,
  Twitter,
  MessageCircle,
  Github,
} from "lucide-react";

import { CryptoDetailResponse } from "@/types/crypto-detail";
import {
  formatCryptoPrice,
  formatUSD,
  formatNumber,
  formatPercentage,
  getPercentageColor,
} from "@/lib/formatters";
import { title } from "@/components/primitives";

const API_HOSTNAME =
  process.env.NEXT_PUBLIC_RISQLAB_API_HOSTNAME || "localhost";
const API_PORT = process.env.NEXT_PUBLIC_RISQLAB_API_PORT || "8080";
const API_HTTPSECURE =
  process.env.NEXT_PUBLIC_RISQLAB_API_HTTPSECURE === "true";
const API_BASE_URL = `http${API_HTTPSECURE ? "s" : ""}://${API_HOSTNAME}:${API_PORT}`;

export default function CryptoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = params.symbol as string;

  const [data, setData] = useState<CryptoDetailResponse["data"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnPath, setReturnPath] = useState<string>("/#crypto-table");

  useEffect(() => {
    fetchCryptoDetail();

    // Get return path from sessionStorage
    const savedReturnPath = sessionStorage.getItem("cryptoReturnPath");

    if (savedReturnPath) {
      setReturnPath(savedReturnPath);
    }
  }, [symbol]);

  const fetchCryptoDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/cryptocurrency/${symbol.toUpperCase()}`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError(`Cryptocurrency ${symbol.toUpperCase()} not found`);
        } else {
          throw new Error("Failed to fetch cryptocurrency details");
        }

        return;
      }

      const result: CryptoDetailResponse = await response.json();

      setData(result.data);
    } catch (error) {
      console.error("Error fetching crypto details:", error);
      setError("Failed to load cryptocurrency details");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-lg text-danger">
          {error || "No data available"}
        </div>
        <Button onPress={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const { basic, links, launch, market } = data;

  const supplyPercentage = market.max_supply
    ? (market.circulating_supply / market.max_supply) * 100
    : market.total_supply
      ? (market.circulating_supply / market.total_supply) * 100
      : 0;

  return (
    <section className="flex flex-col gap-6 py-8 md:py-10">
      {/* Back Button */}
      <div>
        <Button
          startContent={<ArrowLeft size={18} />}
          variant="light"
          onPress={() => router.push(returnPath)}
        >
          Back
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        {basic.logo_url && (
          <img alt={basic.name} className="w-16 h-16" src={basic.logo_url} />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className={title()}>{basic.name}</h1>
            <Chip size="lg" variant="flat">
              {basic.symbol}
            </Chip>
            {market.cmc_rank && (
              <Chip size="sm" variant="bordered">
                Rank #{market.cmc_rank}
              </Chip>
            )}
          </div>
          {basic.category && (
            <p className="text-default-500 mt-2">Category: {basic.category}</p>
          )}
        </div>
      </div>

      {/* Price & Change */}
      <Card>
        <CardBody className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-default-500 mb-1">
                {basic.symbol} Price
              </p>
              <p className="text-4xl font-bold">
                {formatCryptoPrice(market.price_usd)}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {market.percent_change_1h !== null && (
                <div>
                  <p className="text-xs text-default-500">1h</p>
                  <Chip
                    color={getPercentageColor(market.percent_change_1h)}
                    size="sm"
                    startContent={
                      market.percent_change_1h > 0 ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )
                    }
                    variant="flat"
                  >
                    {formatPercentage(market.percent_change_1h)}
                  </Chip>
                </div>
              )}
              {market.percent_change_24h !== null && (
                <div>
                  <p className="text-xs text-default-500">24h</p>
                  <Chip
                    color={getPercentageColor(market.percent_change_24h)}
                    size="sm"
                    startContent={
                      market.percent_change_24h > 0 ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )
                    }
                    variant="flat"
                  >
                    {formatPercentage(market.percent_change_24h)}
                  </Chip>
                </div>
              )}
              {market.percent_change_7d !== null && (
                <div>
                  <p className="text-xs text-default-500">7d</p>
                  <Chip
                    color={getPercentageColor(market.percent_change_7d)}
                    size="sm"
                    startContent={
                      market.percent_change_7d > 0 ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )
                    }
                    variant="flat"
                  >
                    {formatPercentage(market.percent_change_7d)}
                  </Chip>
                </div>
              )}
              {market.percent_change_30d !== null && (
                <div>
                  <p className="text-xs text-default-500">30d</p>
                  <Chip
                    color={getPercentageColor(market.percent_change_30d)}
                    size="sm"
                    startContent={
                      market.percent_change_30d > 0 ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )
                    }
                    variant="flat"
                  >
                    {formatPercentage(market.percent_change_30d)}
                  </Chip>
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Links */}
      {(links.website ||
        links.whitepaper ||
        links.twitter ||
        links.reddit ||
        links.telegram ||
        links.github) && (
        <div className="flex flex-wrap gap-2">
          {links.website && (
            <Button
              as="a"
              href={links.website}
              rel="noopener noreferrer"
              size="sm"
              startContent={<Globe size={16} />}
              target="_blank"
              variant="bordered"
            >
              Website
            </Button>
          )}
          {links.whitepaper && (
            <Button
              as="a"
              href={links.whitepaper}
              rel="noopener noreferrer"
              size="sm"
              startContent={<FileText size={16} />}
              target="_blank"
              variant="bordered"
            >
              Whitepaper
            </Button>
          )}
          {links.twitter && (
            <Button
              as="a"
              href={links.twitter}
              rel="noopener noreferrer"
              size="sm"
              startContent={<Twitter size={16} />}
              target="_blank"
              variant="bordered"
            >
              Twitter
            </Button>
          )}
          {links.telegram && (
            <Button
              as="a"
              href={links.telegram}
              rel="noopener noreferrer"
              size="sm"
              startContent={<MessageCircle size={16} />}
              target="_blank"
              variant="bordered"
            >
              Telegram
            </Button>
          )}
          {links.github && (
            <Button
              as="a"
              href={links.github}
              rel="noopener noreferrer"
              size="sm"
              startContent={<Github size={16} />}
              target="_blank"
              variant="bordered"
            >
              GitHub
            </Button>
          )}
        </div>
      )}

      {/* Market Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-default-500">Market Cap</p>
            <p className="text-2xl font-bold">
              {formatUSD(market.market_cap_usd)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-default-500">Volume 24h</p>
            <p className="text-2xl font-bold">
              {formatUSD(market.volume_24h_usd)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-default-500">Circulating Supply</p>
            <p className="text-2xl font-bold">
              {formatNumber(market.circulating_supply)} {basic.symbol}
            </p>
          </CardBody>
        </Card>
        {market.fully_diluted_valuation && (
          <Card>
            <CardBody className="p-4">
              <p className="text-sm text-default-500">
                Fully Diluted Valuation
              </p>
              <p className="text-2xl font-bold">
                {formatUSD(market.fully_diluted_valuation)}
              </p>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Supply Information */}
      {(market.max_supply || market.total_supply) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Supply Information</h2>
          </CardHeader>
          <CardBody className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-default-500">Circulating</span>
                <span className="font-medium">
                  {formatNumber(market.circulating_supply)} {basic.symbol}
                </span>
              </div>
              {market.total_supply && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-default-500">Total Supply</span>
                  <span className="font-medium">
                    {formatNumber(market.total_supply)} {basic.symbol}
                  </span>
                </div>
              )}
              {market.max_supply && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-default-500">Max Supply</span>
                  <span className="font-medium">
                    {formatNumber(market.max_supply)} {basic.symbol}
                  </span>
                </div>
              )}
              {supplyPercentage > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-default-500">
                      Circulating %
                    </span>
                    <span className="font-medium">
                      {supplyPercentage.toFixed(2)}%
                    </span>
                  </div>
                  <Progress color="primary" value={supplyPercentage} />
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* About */}
      {basic.description && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">About {basic.name}</h2>
          </CardHeader>
          <CardBody className="p-6">
            <p className="text-default-700 whitespace-pre-wrap">
              {basic.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              {launch.platform && (
                <div>
                  <span className="text-sm text-default-500">Platform: </span>
                  <span className="text-sm font-medium">{launch.platform}</span>
                </div>
              )}
              {launch.date && (
                <div>
                  <span className="text-sm text-default-500">Launched: </span>
                  <span className="text-sm font-medium">
                    {new Date(launch.date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
            {basic.tags.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-default-500 mb-2">Tags:</p>
                <div className="flex flex-wrap gap-2">
                  {basic.tags.map((tag, index) => (
                    <Chip key={index} size="sm" variant="flat">
                      {tag}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </section>
  );
}
