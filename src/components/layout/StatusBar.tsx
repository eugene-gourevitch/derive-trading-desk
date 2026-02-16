"use client";

import { useEffect, useState } from "react";
import { useUiStore } from "@/lib/stores/uiStore";
import { useMarketStore } from "@/lib/stores/marketStore";
import { useAccountStore } from "@/lib/stores/accountStore";
import { shortenAddress } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";

export function StatusBar() {
  const [time, setTime] = useState("");
  const wsConnected = useUiStore((s) => s.wsConnected);
  const environment = useUiStore((s) => s.environment);
  const selectedInstrument = useUiStore((s) => s.selectedInstrument);
  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette);
  const deriveWallet = useAccountStore((s) => s.deriveWallet);
  const ticker = useMarketStore((s) => s.tickers.get(selectedInstrument || ""));

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "UTC",
        }) + " UTC"
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const markPrice = ticker?.mark_price ? parseFloat(ticker.mark_price) : null;
  const change = ticker?.change ? parseFloat(ticker.change) * 100 : null;

  return (
    <div className="flex h-7 items-center justify-between border-b border-border-default bg-bg-secondary px-3 text-xs">
      {/* Left */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              wsConnected ? "bg-green" : "bg-red"
            }`}
          />
          <span className="text-text-secondary">
            {wsConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        {environment === "testnet" && (
          <span className="rounded bg-yellow/20 px-1.5 py-0.5 text-[10px] font-semibold text-yellow">
            TESTNET
          </span>
        )}
      </div>

      {/* Center — clickable instrument selector with live price */}
      <button
        onClick={toggleCommandPalette}
        className="flex items-center gap-2 rounded-md px-2 py-0.5 transition-colors hover:bg-bg-hover"
      >
        {selectedInstrument && (
          <span className="font-mono-nums font-medium text-text-primary">
            {selectedInstrument}
          </span>
        )}
        {markPrice !== null && markPrice > 0 && (
          <>
            <span className="font-mono-nums text-text-secondary">
              ${markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {change !== null && (
              <span
                className={cn(
                  "font-mono-nums text-[10px]",
                  change >= 0 ? "text-green" : "text-red"
                )}
              >
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            )}
          </>
        )}
        <kbd className="rounded border border-border-subtle bg-bg-tertiary px-1 py-0.5 text-[9px] text-text-muted">
          Ctrl+K
        </kbd>
      </button>

      {/* Right */}
      <div className="flex items-center gap-3">
        {deriveWallet && (
          <span className="font-mono-nums text-text-muted">
            {shortenAddress(deriveWallet)}
          </span>
        )}
        <span className="font-mono-nums text-text-secondary">{time}</span>
      </div>
    </div>
  );
}
