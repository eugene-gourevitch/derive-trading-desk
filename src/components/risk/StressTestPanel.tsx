"use client";

import { useMemo } from "react";
import { usePositionStore } from "@/lib/stores/positionStore";
import { formatUsd, valueSentiment } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";
import Decimal from "decimal.js-light";

// Derive uses 23 stress scenarios for portfolio margin
const SPOT_SHOCKS = [-0.18, -0.135, -0.09, -0.045, 0, 0.045, 0.09, 0.135, 0.18];
const VOL_SHOCKS = ["Down", "Static", "Up"] as const;

interface ScenarioResult {
  spotShock: number;
  volShock: string;
  estimatedPnl: string;
  marginImpact: string;
}

export function StressTestPanel() {
  const positions = usePositionStore((s) => s.positions);

  const scenarios = useMemo((): ScenarioResult[] => {
    if (positions.length === 0) return [];

    const results: ScenarioResult[] = [];

    for (const spotShock of SPOT_SHOCKS) {
      for (const volShock of VOL_SHOCKS) {
        // Approximate P&L using Greeks (first-order for delta, second-order for gamma)
        let totalPnl = new Decimal(0);

        for (const pos of positions) {
          const amount = new Decimal(pos.amount);
          const delta = new Decimal(pos.delta);
          const gamma = new Decimal(pos.gamma);
          const theta = new Decimal(pos.theta);
          const vega = new Decimal(pos.vega);
          const markPrice = new Decimal(pos.mark_price || pos.index_price || "0");

          // Delta P&L: delta * amount * spotShock * spotPrice
          const spotMove = markPrice.times(spotShock);
          const deltaPnl = delta.times(amount).times(spotMove);

          // Gamma P&L: 0.5 * gamma * amount * (spotMove)^2
          const gammaPnl = gamma.times(amount).times(spotMove.pow(2)).times(0.5);

          // Vega P&L: approximate vol shock as ±25%
          const volMultiplier = volShock === "Up" ? 0.25 : volShock === "Down" ? -0.25 : 0;
          const vegaPnl = vega.times(amount).times(volMultiplier);

          totalPnl = totalPnl.plus(deltaPnl).plus(gammaPnl).plus(vegaPnl);
        }

        results.push({
          spotShock,
          volShock,
          estimatedPnl: totalPnl.toFixed(2),
          marginImpact: totalPnl.abs().times(1.25).toFixed(2), // mFactor 1.25
        });
      }
    }

    return results;
  }, [positions]);

  // Find worst case
  const worstCase = useMemo(() => {
    if (scenarios.length === 0) return null;
    return scenarios.reduce((worst, s) =>
      parseFloat(s.estimatedPnl) < parseFloat(worst.estimatedPnl) ? s : worst
    );
  }, [scenarios]);

  if (positions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        No positions to stress test
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Worst Case Banner */}
      {worstCase && (
        <div className="shrink-0 border-b border-red/20 bg-red/5 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red">
              Worst Case Scenario
            </span>
            <span className="font-mono-nums font-bold text-red">
              {formatUsd(worstCase.estimatedPnl)}
            </span>
          </div>
          <div className="mt-0.5 text-text-muted">
            Spot {worstCase.spotShock > 0 ? "+" : ""}
            {(worstCase.spotShock * 100).toFixed(1)}% / Vol {worstCase.volShock}
          </div>
        </div>
      )}

      {/* Heatmap Header */}
      <div className="flex shrink-0 items-center border-b border-border-subtle px-3 py-1">
        <div className="w-20 text-text-muted">Spot / Vol</div>
        {VOL_SHOCKS.map((vs) => (
          <div key={vs} className="flex-1 text-center text-text-muted">
            {vs}
          </div>
        ))}
      </div>

      {/* Heatmap Grid */}
      <div className="flex-1 overflow-auto">
        {SPOT_SHOCKS.map((ss) => (
          <div
            key={ss}
            className="flex items-center border-b border-border-subtle px-3 py-1.5 hover:bg-bg-hover"
          >
            <div className="w-20 font-mono-nums font-medium text-text-secondary">
              {ss > 0 ? "+" : ""}
              {(ss * 100).toFixed(1)}%
            </div>
            {VOL_SHOCKS.map((vs) => {
              const scenario = scenarios.find(
                (s) => s.spotShock === ss && s.volShock === vs
              );
              if (!scenario) return <div key={vs} className="flex-1" />;

              const sentiment = valueSentiment(scenario.estimatedPnl);
              const isWorstCase =
                worstCase &&
                worstCase.spotShock === ss &&
                worstCase.volShock === vs;

              return (
                <div
                  key={vs}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-center font-mono-nums",
                    isWorstCase && "ring-1 ring-red/50",
                    sentiment === "positive" && "bg-green/5 text-green",
                    sentiment === "negative" && "bg-red/5 text-red",
                    sentiment === "neutral" && "text-text-muted"
                  )}
                >
                  {formatUsd(scenario.estimatedPnl)}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="shrink-0 border-t border-border-subtle px-3 py-1 text-[10px] text-text-muted">
        P&L estimated using Greeks (Delta + Gamma + Vega). Vol shocks: ±25%.
        mFactor: 1.25x for initial margin.
      </div>
    </div>
  );
}
