"use client";

import { useState, useEffect, useMemo, Key } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";

import { API_BASE_URL } from "@/config/constants";
import { formatQuantity } from "@/lib/formatters";

interface CryptoOption {
  id: number;
  symbol: string;
  name: string;
  image_url: string | null;
}

/** Minimal shape we need from a holding to power the "Max" / held-balance hint. */
interface HeldPosition {
  crypto_id: number;
  quantity: number | string;
}

interface RecordTransactionModalProps {
  portfolioId: number;
  isOpen: boolean;
  onClose: () => void;
  onRecorded: () => void;
  /** Current holdings — used to show the held balance and the "Max" button on sells. */
  holdings?: HeldPosition[];
  /** Pre-select this crypto when the modal opens (e.g. opened from a holding row). */
  presetCryptoId?: number | null;
}

export function RecordTransactionModal({
  portfolioId,
  isOpen,
  onClose,
  onRecorded,
  holdings = [],
  presetCryptoId = null,
}: RecordTransactionModalProps) {
  const [allCryptos, setAllCryptos] = useState<CryptoOption[]>([]);
  const [selectedKey, setSelectedKey] = useState<Key | null>(null);
  const [type, setType] = useState<string>("buy");
  const [quantity, setQuantity] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [feeUsd, setFeeUsd] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || allCryptos.length > 0) return;
    const fetchAll = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/cryptocurrencies?limit=500&sortBy=market_cap_usd&sortOrder=desc`,
        );
        const data = await res.json();

        setAllCryptos(
          (data.data || []).map((c: any) => ({
            id: c.id,
            symbol: c.symbol,
            name: c.name,
            image_url: c.image_url,
          })),
        );
      } catch {
        // ignore
      }
    };

    fetchAll();
  }, [isOpen, allCryptos.length]);

  // Reset the form each time the modal opens, pre-selecting the crypto of the
  // holding row it was opened from (so a sell starts on the right asset).
  useEffect(() => {
    if (!isOpen) return;
    setSelectedKey(presetCryptoId != null ? String(presetCryptoId) : null);
    setType("buy");
    setQuantity("");
    setPriceUsd("");
    setFeeUsd("");
    setNotes("");
    setError("");
  }, [isOpen, presetCryptoId]);

  // Exact held quantity for the selected crypto (DB precision), or null when
  // the asset isn't held. Drives the "Held: …" hint and the "Max" button.
  const heldQty = useMemo(() => {
    if (selectedKey == null) return null;
    const h = holdings.find((p) => p.crypto_id === Number(selectedKey));

    if (!h) return null;
    const q = Number(h.quantity);

    return q > 0 ? q : null;
  }, [selectedKey, holdings]);

  const canSellMax = type === "sell" && heldQty != null;

  // Fill the exact held quantity as a clean dot-decimal string: toFixed(8)
  // matches the DECIMAL(_,8) storage precision and strips any float noise,
  // then trailing zeros are trimmed (139.65318534, 0.005468, 100, …).
  const fillMax = () => {
    if (heldQty == null) return;
    setQuantity(heldQty.toFixed(8).replace(/\.?0+$/, ""));
  };

  // Accept a French decimal comma too — parseFloat("139,65") would otherwise
  // stop at the comma and silently drop the fractional part.
  const toNum = (s: string) => parseFloat(s.replace(",", "."));

  const handleSubmit = async () => {
    if (!selectedKey || !quantity || !priceUsd) {
      setError("Crypto, quantity, and price are required");

      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/user/portfolios/${portfolioId}/transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            crypto_id: Number(selectedKey),
            type,
            quantity: toNum(quantity),
            price_usd: toNum(priceUsd),
            fee_usd: feeUsd ? toNum(feeUsd) : 0,
            timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
            notes: notes || null,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.msg || "Failed to record transaction");

        return;
      }

      setSelectedKey(null);
      setQuantity("");
      setPriceUsd("");
      setFeeUsd("");
      setNotes("");
      setError("");
      onClose();
      onRecorded();
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} size="lg" onClose={onClose}>
      <ModalContent>
        <ModalHeader>Record Transaction</ModalHeader>
        <ModalBody className="gap-4">
          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger">
              {error}
            </div>
          )}
          <Autocomplete
            isRequired
            defaultItems={allCryptos}
            label="Cryptocurrency"
            placeholder="Search..."
            selectedKey={selectedKey != null ? String(selectedKey) : null}
            onSelectionChange={(key) => setSelectedKey(key)}
          >
            {(item) => (
              <AutocompleteItem
                key={String(item.id)}
                textValue={`${item.symbol} ${item.name}`}
              >
                <div className="flex items-center gap-2">
                  {item.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={item.symbol}
                      className="w-5 h-5 rounded-full"
                      src={item.image_url}
                    />
                  )}
                  <span className="font-medium">{item.symbol}</span>
                  <span className="text-default-400 text-sm">{item.name}</span>
                </div>
              </AutocompleteItem>
            )}
          </Autocomplete>
          <Select
            isRequired
            label="Type"
            selectedKeys={[type]}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0];

              if (selected) setType(String(selected));
            }}
          >
            <SelectItem key="buy">Buy</SelectItem>
            <SelectItem key="sell">Sell</SelectItem>
            <SelectItem key="transfer">Transfer</SelectItem>
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input
              isRequired
              description={
                type === "sell" && heldQty != null
                  ? `Held: ${formatQuantity(heldQty)}`
                  : undefined
              }
              endContent={
                canSellMax ? (
                  <Button
                    className="h-6 min-w-0 px-2 text-xs"
                    color="primary"
                    size="sm"
                    variant="flat"
                    onPress={fillMax}
                  >
                    Max
                  </Button>
                ) : undefined
              }
              inputMode="decimal"
              label="Quantity"
              placeholder="0.00"
              type="text"
              value={quantity}
              onValueChange={setQuantity}
            />
            <Input
              isRequired
              inputMode="decimal"
              label="Price (USD)"
              placeholder="0.00"
              type="text"
              value={priceUsd}
              onValueChange={setPriceUsd}
            />
          </div>
          <Input
            inputMode="decimal"
            label="Fee (USD)"
            placeholder="0.00"
            type="text"
            value={feeUsd}
            onValueChange={setFeeUsd}
          />
          <Input
            label="Notes"
            placeholder="Optional notes..."
            value={notes}
            onValueChange={setNotes}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            isDisabled={!selectedKey || !quantity || !priceUsd}
            isLoading={loading}
            onPress={handleSubmit}
          >
            Record
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
