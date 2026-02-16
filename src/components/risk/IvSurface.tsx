"use client";

import { useMemo } from "react";
import { useMarketStore } from "@/lib/stores/marketStore";
import { useUiStore } from "@/lib/stores/uiStore";
import { parseInstrumentName, daysToExpiry } from "@/lib/derive/instruments";

export function IvSurface() {
  const underlying = useUiStore((s) => s.selectedUnderlying);
  const instrumentsList = useMarketStore((s) => s.instrumentsList);
  const options = useMemo(
    () => instrumentsList.filter((i) => i.instrument_type === "option" && i.option_details?.index === `${underlying}-USD`),
    [instrumentsList, underlying]
  );
  const tickers = useMarketStore((s) => s.tickers);

  const surfaceData = useMemo(() => {
    const points: Array<{ strike: number; dte: number; iv: number }> = [];

    for (const inst of options) {
      const ticker = tickers.get(inst.instrument_name);
      if (!ticker?.option_pricing?.iv) continue;

      const parsed = parseInstrumentName(inst.instrument_name);
      if (!parsed.strike || !parsed.expiry) continue;

      const dte = daysToExpiry(parsed.expiry);
      if (dte <= 0) continue;

      const iv = parseFloat(ticker.option_pricing.iv) * 100;
      if (isNaN(iv) || iv <= 0) continue;

      points.push({ strike: parsed.strike, dte, iv });
    }

    return points;
  }, [options, tickers]);

  if (surfaceData.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-xs text-text-muted">
        <div className="mb-2 text-sm font-medium text-text-secondary">
          Implied Volatility Surface
        </div>
        <div>No option data available for {underlying}</div>
        <div className="mt-1">Connect and load instruments to generate surface</div>
      </div>
    );
  }

  // Render a 2D heatmap as a fallback (plotly.js loaded dynamically for 3D)
  // Group by DTE buckets and strike buckets
  const strikes = [...new Set(surfaceData.map((p) => p.strike))].sort(
    (a, b) => a - b
  );
  const dtes = [...new Set(surfaceData.map((p) => Math.round(p.dte)))].sort(
    (a, b) => a - b
  );

  const ivMap = new Map<string, number>();
  for (const p of surfaceData) {
    ivMap.set(`${Math.round(p.dte)}-${p.strike}`, p.iv);
  }

  const maxIv = Math.max(...surfaceData.map((p) => p.iv));
  const minIv = Math.min(...surfaceData.map((p) => p.iv));

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="shrink-0 border-b border-border-subtle px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {underlying} Implied Volatility Surface
        </span>
        <span className="ml-2 text-text-muted">
          {surfaceData.length} data points
        </span>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {/* 2D Heatmap Grid */}
        <div className="min-w-max">
          {/* Header: DTE values */}
          <div className="flex">
            <div className="w-16 shrink-0 text-right pr-2 text-text-muted">
              Strike ↓ / DTE →
            </div>
            {dtes.map((dte) => (
              <div
                key={dte}
                className="w-14 shrink-0 text-center font-mono-nums text-text-muted"
              >
                {dte}d
              </div>
            ))}
          </div>

          {/* Data rows */}
          {strikes.map((strike) => (
            <div key={strike} className="flex">
              <div className="w-16 shrink-0 text-right pr-2 font-mono-nums font-medium text-text-secondary">
                {strike}
              </div>
              {dtes.map((dte) => {
                const iv = ivMap.get(`${dte}-${strike}`);
                if (iv === undefined) {
                  return (
                    <div
                      key={dte}
                      className="w-14 shrink-0 p-0.5"
                    >
                      <div className="h-6 rounded bg-bg-primary" />
                    </div>
                  );
                }

                // Color: interpolate from blue (low IV) to red (high IV)
                const normalized =
                  maxIv > minIv ? (iv - minIv) / (maxIv - minIv) : 0.5;
                const hue = (1 - normalized) * 240; // 240=blue, 0=red

                return (
                  <div key={dte} className="w-14 shrink-0 p-0.5">
                    <div
                      className="flex h-6 items-center justify-center rounded font-mono-nums text-[9px] font-medium text-white"
                      style={{
                        backgroundColor: `hsl(${hue}, 70%, ${30 + normalized * 20}%)`,
                      }}
                      title={`Strike: ${strike}, DTE: ${dte}, IV: ${iv.toFixed(1)}%`}
                    >
                      {iv.toFixed(0)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="shrink-0 border-t border-border-subtle px-3 py-1 text-[10px] text-text-muted">
        <div className="flex items-center gap-2">
          <span>Low IV</span>
          <div className="flex h-2 flex-1 overflow-hidden rounded">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="flex-1"
                style={{
                  backgroundColor: `hsl(${240 - i * 12}, 70%, ${30 + (i / 20) * 20}%)`,
                }}
              />
            ))}
          </div>
          <span>High IV</span>
        </div>
      </div>
    </div>
  );
}
