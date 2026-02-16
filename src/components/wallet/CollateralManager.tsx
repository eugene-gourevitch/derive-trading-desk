"use client";

import { useMemo } from "react";
import { useAccountStore, selectMarginUtilization, selectMarginAvailable } from "@/lib/stores/accountStore";
import { formatUsd, formatPrice, formatPercent } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";
import Decimal from "decimal.js-light";

export function CollateralManager() {
  const subaccount = useAccountStore((s) => s.subaccount);
  const isAuthenticated = useAccountStore((s) => s.isAuthenticated);
  const marginUtil = useAccountStore(selectMarginUtilization);
  const marginAvailable = useAccountStore(selectMarginAvailable);

  // Compute per-asset breakdown
  const collateralBreakdown = useMemo(() => {
    if (!subaccount || subaccount.collaterals.length === 0) return [];

    const totalValue = new Decimal(subaccount.collaterals_value || "0");

    return subaccount.collaterals.map((col) => {
      const markVal = new Decimal(col.mark_value || "0");
      const pctOfTotal = totalValue.gt(0)
        ? markVal.div(totalValue).toNumber()
        : 0;

      return {
        asset: col.asset_name,
        amount: col.amount,
        markPrice: col.mark_price,
        markValue: col.mark_value,
        imFactor: col.initial_margin_factor,
        mmFactor: col.maintenance_margin_factor,
        pctOfTotal,
      };
    }).sort((a, b) => parseFloat(b.markValue) - parseFloat(a.markValue));
  }, [subaccount]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-xs text-text-muted">
        <div className="mb-2 text-sm font-medium text-text-secondary">Collateral</div>
        <div>Connect wallet to view collateral</div>
      </div>
    );
  }

  if (!subaccount) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-xs text-text-muted">
        <div className="mb-2 text-sm font-medium text-text-secondary">Collateral</div>
        <div>Loading subaccount data...</div>
      </div>
    );
  }

  const marginUtilPct = marginUtil * 100;
  const marginColor = marginUtilPct > 80 ? "text-red" : marginUtilPct > 50 ? "text-yellow" : "text-green";
  const marginBarColor = marginUtilPct > 80 ? "bg-red" : marginUtilPct > 50 ? "bg-yellow" : "bg-green";

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Header */}
      <div className="shrink-0 border-b border-border-subtle px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Collateral & Margin
        </span>
        <span className="ml-2 text-text-muted">
          Sub #{subaccount.subaccount_id} · {subaccount.margin_type}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-2 p-3">
          <SummaryCard
            label="Portfolio Value"
            value={formatUsd(subaccount.subaccount_value)}
            accent
          />
          <SummaryCard
            label="Collateral Value"
            value={formatUsd(subaccount.collaterals_value)}
          />
          <SummaryCard
            label="Margin Available"
            value={formatUsd(marginAvailable)}
            className={marginColor}
          />
          <SummaryCard
            label="Positions Value"
            value={formatUsd(subaccount.positions_value)}
          />
        </div>

        {/* Margin Gauge */}
        <div className="mx-3 mb-3 rounded-md border border-border-subtle bg-bg-secondary p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Margin Utilization
            </span>
            <span className={cn("font-mono-nums text-sm font-semibold", marginColor)}>
              {marginUtilPct.toFixed(1)}%
            </span>
          </div>

          {/* Bar */}
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-bg-primary">
            <div
              className={cn("h-full rounded-full transition-all duration-500", marginBarColor)}
              style={{ width: `${Math.min(marginUtilPct, 100)}%` }}
            />
            {/* Liquidation threshold line at ~90% */}
            <div
              className="absolute top-0 h-full w-px bg-red/60"
              style={{ left: "90%" }}
            />
          </div>

          <div className="mt-2 flex justify-between text-[9px] text-text-muted">
            <span>0%</span>
            <span>Initial Margin: {formatUsd(subaccount.initial_margin)}</span>
            <span>Maint: {formatUsd(subaccount.maintenance_margin)}</span>
            <span>100%</span>
          </div>

          {subaccount.is_under_liquidation && (
            <div className="mt-2 rounded bg-red/20 px-2 py-1 text-center text-[10px] font-semibold text-red animate-pulse">
              ⚠ UNDER LIQUIDATION — Deposit collateral immediately
            </div>
          )}
        </div>

        {/* Collateral Table */}
        <div className="px-3 pb-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Collateral Breakdown
          </div>

          {/* Table Header */}
          <div className="flex items-center border-b border-border-subtle py-1 text-[10px] text-text-muted">
            <div className="w-20">Asset</div>
            <div className="w-24 text-right">Balance</div>
            <div className="w-20 text-right">Price</div>
            <div className="w-24 text-right">Value</div>
            <div className="w-16 text-right">Weight</div>
            <div className="flex-1 text-right">IM Factor</div>
          </div>

          {collateralBreakdown.length === 0 ? (
            <div className="py-6 text-center text-text-muted">
              No collateral deposited
            </div>
          ) : (
            collateralBreakdown.map((col) => (
              <div
                key={col.asset}
                className="flex items-center border-b border-border-subtle py-2 hover:bg-bg-hover"
              >
                <div className="w-20 font-medium text-text-primary">{col.asset}</div>
                <div className="w-24 text-right font-mono-nums text-text-secondary">
                  {formatPrice(col.amount, 6)}
                </div>
                <div className="w-20 text-right font-mono-nums text-text-secondary">
                  {formatUsd(col.markPrice)}
                </div>
                <div className="w-24 text-right font-mono-nums text-text-primary">
                  {formatUsd(col.markValue)}
                </div>
                <div className="w-16 text-right font-mono-nums text-text-secondary">
                  {(col.pctOfTotal * 100).toFixed(1)}%
                </div>
                <div className="flex-1 text-right font-mono-nums text-text-muted">
                  {formatPercent(col.imFactor)}
                </div>
              </div>
            ))
          )}

          {/* Total row */}
          {collateralBreakdown.length > 0 && (
            <div className="flex items-center border-t border-border-active py-2 font-medium">
              <div className="w-20 text-text-primary">Total</div>
              <div className="w-24" />
              <div className="w-20" />
              <div className="w-24 text-right font-mono-nums text-text-primary">
                {formatUsd(subaccount.collaterals_value)}
              </div>
              <div className="w-16 text-right font-mono-nums text-text-secondary">100%</div>
              <div className="flex-1" />
            </div>
          )}
        </div>

        {/* Open Orders Margin */}
        {parseFloat(subaccount.open_orders_margin) > 0 && (
          <div className="mx-3 mb-3 rounded-md border border-border-subtle bg-bg-secondary p-2.5 text-[10px]">
            <div className="flex justify-between text-text-muted">
              <span>Open Orders Margin</span>
              <span className="font-mono-nums text-text-secondary">
                {formatUsd(subaccount.open_orders_margin)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-secondary p-2">
      <div className="text-[9px] uppercase tracking-wider text-text-muted">{label}</div>
      <div
        className={cn(
          "mt-0.5 font-mono-nums text-sm font-semibold",
          accent ? "text-accent" : "text-text-primary",
          className
        )}
      >
        {value}
      </div>
    </div>
  );
}
