"use client";

import { useMemo } from "react";
import { usePositionStore } from "@/lib/stores/positionStore";
import { formatPrice, formatUsd, formatGreek, valueSentiment } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";
import Decimal from "decimal.js-light";

export function PositionsTable() {
  const positions = usePositionStore((s) => s.positions);

  const greeks = useMemo(() => {
    let netDelta = new Decimal(0);
    let netGamma = new Decimal(0);
    let netTheta = new Decimal(0);
    let netVega = new Decimal(0);
    for (const pos of positions) {
      const amount = new Decimal(pos.amount);
      netDelta = netDelta.plus(new Decimal(pos.delta).times(amount));
      netGamma = netGamma.plus(new Decimal(pos.gamma).times(amount));
      netTheta = netTheta.plus(new Decimal(pos.theta).times(amount));
      netVega = netVega.plus(new Decimal(pos.vega).times(amount));
    }
    return {
      netDelta: netDelta.toFixed(4),
      netGamma: netGamma.toFixed(6),
      netTheta: netTheta.toFixed(4),
      netVega: netVega.toFixed(4),
    };
  }, [positions]);

  const totalPnl = useMemo(() => {
    let total = new Decimal(0);
    for (const pos of positions) {
      total = total.plus(new Decimal(pos.unrealized_pnl));
    }
    return total.toFixed(2);
  }, [positions]);

  if (positions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        No open positions
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Portfolio Summary Bar */}
      <div className="flex shrink-0 items-center gap-4 border-b border-border-subtle bg-bg-tertiary px-3 py-1.5">
        <GreekBadge label="Delta" value={greeks.netDelta} />
        <GreekBadge label="Gamma" value={greeks.netGamma} />
        <GreekBadge label="Theta" value={greeks.netTheta} />
        <GreekBadge label="Vega" value={greeks.netVega} />
        <div className="ml-auto flex items-center gap-1">
          <span className="text-text-muted">Unreal. P&L:</span>
          <span
            className={cn(
              "font-mono-nums font-semibold",
              valueSentiment(totalPnl) === "positive" && "text-green",
              valueSentiment(totalPnl) === "negative" && "text-red",
              valueSentiment(totalPnl) === "neutral" && "text-text-secondary"
            )}
          >
            {formatUsd(totalPnl)}
          </span>
        </div>
      </div>

      {/* Table Header */}
      <div className="flex shrink-0 items-center border-b border-border-subtle px-3 py-1 text-text-muted">
        <div className="w-[160px]">Instrument</div>
        <div className="w-[80px] text-right">Size</div>
        <div className="w-[80px] text-right">Entry</div>
        <div className="w-[80px] text-right">Mark</div>
        <div className="w-[80px] text-right">Unreal. P&L</div>
        <div className="w-[60px] text-right">Delta</div>
        <div className="w-[60px] text-right">Gamma</div>
        <div className="w-[60px] text-right">Theta</div>
        <div className="w-[60px] text-right">Vega</div>
        <div className="w-[80px] text-right">Margin</div>
        <div className="flex-1 text-right">Liq. Price</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {positions.map((pos) => {
          const pnlSentiment = valueSentiment(pos.unrealized_pnl);
          const isLong = parseFloat(pos.amount) > 0;

          return (
            <div
              key={pos.instrument_name}
              className="flex items-center border-b border-border-subtle px-3 py-1.5 hover:bg-bg-hover"
            >
              <div className="w-[160px]">
                <span className="font-medium text-text-primary">
                  {pos.instrument_name}
                </span>
              </div>
              <div
                className={cn(
                  "w-[80px] text-right font-mono-nums",
                  isLong ? "text-green" : "text-red"
                )}
              >
                {parseFloat(pos.amount) > 0 ? "+" : ""}
                {pos.amount}
              </div>
              <div className="w-[80px] text-right font-mono-nums text-text-secondary">
                {formatPrice(pos.average_price, 2)}
              </div>
              <div className="w-[80px] text-right font-mono-nums text-text-secondary">
                {formatPrice(pos.mark_price, 2)}
              </div>
              <div
                className={cn(
                  "w-[80px] text-right font-mono-nums font-medium",
                  pnlSentiment === "positive" && "text-green",
                  pnlSentiment === "negative" && "text-red",
                  pnlSentiment === "neutral" && "text-text-muted"
                )}
              >
                {formatUsd(pos.unrealized_pnl)}
              </div>
              <div className="w-[60px] text-right font-mono-nums text-text-secondary">
                {formatGreek(pos.delta)}
              </div>
              <div className="w-[60px] text-right font-mono-nums text-text-secondary">
                {formatGreek(pos.gamma)}
              </div>
              <div className="w-[60px] text-right font-mono-nums text-text-secondary">
                {formatGreek(pos.theta)}
              </div>
              <div className="w-[60px] text-right font-mono-nums text-text-secondary">
                {formatGreek(pos.vega)}
              </div>
              <div className="w-[80px] text-right font-mono-nums text-text-secondary">
                {formatUsd(pos.initial_margin)}
              </div>
              <div className="flex-1 text-right font-mono-nums text-text-muted">
                {pos.liquidation_price
                  ? formatPrice(pos.liquidation_price, 2)
                  : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GreekBadge({ label, value }: { label: string; value: string }) {
  const sentiment = valueSentiment(value);
  return (
    <div className="flex items-center gap-1">
      <span className="text-text-muted">{label}</span>
      <span
        className={cn(
          "font-mono-nums font-medium",
          sentiment === "positive" && "text-green",
          sentiment === "negative" && "text-red",
          sentiment === "neutral" && "text-text-secondary"
        )}
      >
        {formatGreek(value)}
      </span>
    </div>
  );
}
