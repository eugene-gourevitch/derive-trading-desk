"use client";

import { useMemo } from "react";
import { usePositionStore } from "@/lib/stores/positionStore";
import { useAccountStore, selectMarginUtilization, selectPortfolioValue } from "@/lib/stores/accountStore";
import { formatUsd, formatGreek, valueSentiment } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";
import Decimal from "decimal.js-light";

export function GreeksDashboard() {
  const positions = usePositionStore((s) => s.positions);
  const portfolioValue = useAccountStore(selectPortfolioValue);
  const marginUtil = useAccountStore(selectMarginUtilization);

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

  const unrealizedPnl = useMemo(() => {
    let total = new Decimal(0);
    for (const pos of positions) {
      total = total.plus(new Decimal(pos.unrealized_pnl));
    }
    return total.toFixed(2);
  }, [positions]);

  const realizedPnl = useMemo(() => {
    let total = new Decimal(0);
    for (const pos of positions) {
      total = total.plus(new Decimal(pos.realized_pnl));
    }
    return total.toFixed(2);
  }, [positions]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4 text-xs">
      {/* Portfolio Greeks */}
      <div>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Portfolio Greeks
        </h3>
        <div className="grid grid-cols-4 gap-2">
          <GreekCard
            label="Net Delta"
            value={greeks.netDelta}
            description="Directional exposure ($1 move)"
          />
          <GreekCard
            label="Net Gamma"
            value={greeks.netGamma}
            description="Delta acceleration (convexity)"
          />
          <GreekCard
            label="Net Theta"
            value={greeks.netTheta}
            description="Daily time decay"
          />
          <GreekCard
            label="Net Vega"
            value={greeks.netVega}
            description="1% IV change sensitivity"
          />
        </div>
      </div>

      {/* Portfolio Summary */}
      <div>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Portfolio Summary
        </h3>
        <div className="grid grid-cols-4 gap-2">
          <MetricCard label="Portfolio Value" value={formatUsd(portfolioValue)} />
          <MetricCard
            label="Unrealized P&L"
            value={formatUsd(unrealizedPnl)}
            sentiment={valueSentiment(unrealizedPnl)}
          />
          <MetricCard
            label="Realized P&L"
            value={formatUsd(realizedPnl)}
            sentiment={valueSentiment(realizedPnl)}
          />
          <MetricCard
            label="Margin Utilization"
            value={`${(marginUtil * 100).toFixed(1)}%`}
            sentiment={
              marginUtil > 0.8
                ? "negative"
                : marginUtil > 0.5
                  ? "neutral"
                  : "positive"
            }
          />
        </div>
      </div>

      {/* Exposure by Underlying */}
      <div>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Exposure by Underlying
        </h3>
        <ExposureBreakdown positions={positions} />
      </div>
    </div>
  );
}

function GreekCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  const sentiment = valueSentiment(value);
  return (
    <div className="rounded-md border border-border-subtle bg-bg-secondary p-3">
      <div className="text-[10px] text-text-muted">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono-nums text-lg font-bold",
          sentiment === "positive" && "text-green",
          sentiment === "negative" && "text-red",
          sentiment === "neutral" && "text-text-primary"
        )}
      >
        {formatGreek(value, 4)}
      </div>
      <div className="mt-0.5 text-[9px] text-text-muted">{description}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sentiment,
}: {
  label: string;
  value: string;
  sentiment?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-secondary p-3">
      <div className="text-[10px] text-text-muted">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono-nums text-sm font-semibold",
          sentiment === "positive" && "text-green",
          sentiment === "negative" && "text-red",
          !sentiment && "text-text-primary"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ExposureBreakdown({
  positions,
}: {
  positions: Array<{
    instrument_name: string;
    delta: string;
    amount: string;
    unrealized_pnl: string;
    initial_margin: string;
  }>;
}) {
  // Group by underlying
  const byUnderlying = new Map<
    string,
    { delta: number; pnl: number; margin: number; count: number }
  >();

  for (const pos of positions) {
    const underlying = pos.instrument_name.split("-")[0] || "OTHER";
    const existing = byUnderlying.get(underlying) || {
      delta: 0,
      pnl: 0,
      margin: 0,
      count: 0,
    };
    existing.delta += parseFloat(pos.delta) * parseFloat(pos.amount);
    existing.pnl += parseFloat(pos.unrealized_pnl);
    existing.margin += parseFloat(pos.initial_margin);
    existing.count++;
    byUnderlying.set(underlying, existing);
  }

  if (byUnderlying.size === 0) {
    return (
      <div className="text-text-muted">No positions to analyze</div>
    );
  }

  return (
    <div className="rounded-md border border-border-subtle">
      <div className="flex items-center border-b border-border-subtle px-3 py-1 text-text-muted">
        <div className="w-20">Asset</div>
        <div className="w-12 text-right">#</div>
        <div className="w-24 text-right">Net Delta</div>
        <div className="w-24 text-right">Unreal. P&L</div>
        <div className="flex-1 text-right">Margin</div>
      </div>
      {Array.from(byUnderlying.entries()).map(([underlying, data]) => (
        <div
          key={underlying}
          className="flex items-center px-3 py-1.5 hover:bg-bg-hover"
        >
          <div className="w-20 font-medium text-text-primary">{underlying}</div>
          <div className="w-12 text-right text-text-secondary">{data.count}</div>
          <div
            className={cn(
              "w-24 text-right font-mono-nums",
              valueSentiment(data.delta.toString()) === "positive" && "text-green",
              valueSentiment(data.delta.toString()) === "negative" && "text-red"
            )}
          >
            {formatGreek(data.delta.toString())}
          </div>
          <div
            className={cn(
              "w-24 text-right font-mono-nums",
              valueSentiment(data.pnl.toString()) === "positive" && "text-green",
              valueSentiment(data.pnl.toString()) === "negative" && "text-red"
            )}
          >
            {formatUsd(data.pnl)}
          </div>
          <div className="flex-1 text-right font-mono-nums text-text-secondary">
            {formatUsd(data.margin)}
          </div>
        </div>
      ))}
    </div>
  );
}
