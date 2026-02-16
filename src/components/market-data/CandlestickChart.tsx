"use client";

import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/lib/stores/uiStore";
import { useMarketStore } from "@/lib/stores/marketStore";
import { deriveClient } from "@/lib/derive/client";
import { cn } from "@/lib/utils/cn";

/**
 * Derive API uses integer seconds for candle periods.
 * Endpoint: public/get_spot_feed_history_candles
 * Params: currency (ETH/BTC), period (int seconds), start_timestamp, end_timestamp (unix seconds)
 * Response: { currency, spot_feed_history: [{ open_price, high_price, low_price, close_price, price, timestamp, timestamp_bucket }] }
 */
const CANDLE_PERIODS = [
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "15m", seconds: 900 },
  { label: "30m", seconds: 1800 },
  { label: "1h", seconds: 3600 },
  { label: "4h", seconds: 14400 },
  { label: "8h", seconds: 28800 },
  { label: "1d", seconds: 86400 },
] as const;

type CandlePeriodLabel = (typeof CANDLE_PERIODS)[number]["label"];

/** Extract base currency from instrument name: "ETH-PERP" → "ETH", "BTC-20260227-2500-C" → "BTC" */
function getCurrency(instrument: string): string {
  return instrument.split("-")[0] || "ETH";
}

const EMPTY_CANDLES: never[] = [];

export function CandlestickChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<unknown>(null);
  const seriesRef = useRef<unknown>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const instrument = useUiStore((s) => s.selectedInstrument);
  const [selectedPeriod, setSelectedPeriod] = useState<CandlePeriodLabel>("15m");
  const [isLoading, setIsLoading] = useState(false);

  const periodConfig = CANDLE_PERIODS.find((p) => p.label === selectedPeriod) || CANDLE_PERIODS[2];
  const candleKey = `${instrument}-${selectedPeriod}`;
  const candles = useMarketStore((s) => s.candles.get(candleKey)) ?? EMPTY_CANDLES;

  // Fetch candles when instrument or timeframe changes
  useEffect(() => {
    if (!instrument) return;

    let cancelled = false;
    setIsLoading(true);

    const now = Math.floor(Date.now() / 1000);
    // Fetch enough candles to fill the chart (~100 candles worth of history)
    const start = now - periodConfig.seconds * 100;
    const currency = getCurrency(instrument);

    deriveClient
      .call<{ currency: string; spot_feed_history: Array<{
        open_price: string; high_price: string; low_price: string; close_price: string;
        price: string; timestamp: number; timestamp_bucket: number;
      }> }>("public/get_spot_feed_history_candles", {
        currency,
        period: periodConfig.seconds,
        start_timestamp: start,
        end_timestamp: now,
      })
      .then((result) => {
        if (cancelled) return;
        const history = result?.spot_feed_history;
        if (Array.isArray(history) && history.length > 0) {
          // Sort by timestamp_bucket ascending — LWC requires asc-ordered data
          const sorted = [...history].sort((a, b) => a.timestamp_bucket - b.timestamp_bucket);
          // Deduplicate by timestamp_bucket (API can return duplicate buckets)
          const deduped = sorted.filter(
            (c, i, arr) => i === 0 || c.timestamp_bucket !== arr[i - 1].timestamp_bucket
          );
          useMarketStore.getState().setCandles(
            candleKey,
            deduped.map((c) => ({
              open: c.open_price,
              high: c.high_price,
              low: c.low_price,
              close: c.close_price,
              volume: "0", // Spot feed doesn't include volume
              volume_usd: "0",
              timestamp: String(c.timestamp_bucket),
            }))
          );
          console.log(`[Chart] Loaded ${deduped.length} candles for ${currency} @ ${selectedPeriod}`);
        }
      })
      .catch((err) => {
        if (!cancelled) console.warn("[Chart] Failed to fetch candles:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [instrument, selectedPeriod, candleKey, periodConfig.seconds]);

  // Initialize and update chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    let disposed = false;

    // Clean up previous chart/observer before creating new ones
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (chartRef.current) {
      (chartRef.current as { remove: () => void }).remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    import("lightweight-charts").then(({ createChart, CandlestickSeries }) => {
      // Guard: if effect was cleaned up before async import resolved, bail
      if (disposed || !chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: "transparent" },
          textColor: "#8888a0",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: "#1e1e32" },
          horzLines: { color: "#1e1e32" },
        },
        crosshair: {
          mode: 0,
          vertLine: { color: "#3b3b5c", width: 1, style: 2 },
          horzLine: { color: "#3b3b5c", width: 1, style: 2 },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: "#1e1e32",
        },
        rightPriceScale: {
          borderColor: "#1e1e32",
        },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#00d897",
        downColor: "#ff4d6a",
        borderUpColor: "#00d897",
        borderDownColor: "#ff4d6a",
        wickUpColor: "#00d897",
        wickDownColor: "#ff4d6a",
      });

      chartRef.current = chart;
      seriesRef.current = series;

      // Set data if available
      if (candles.length > 0) {
        const chartData = candles
          .map((c) => ({
            time: (parseInt(c.timestamp) > 1e12
              ? Math.floor(parseInt(c.timestamp) / 1000)
              : parseInt(c.timestamp)) as import("lightweight-charts").UTCTimestamp,
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));
        (series as { setData: (data: typeof chartData) => void }).setData(chartData);
        chart.timeScale().fitContent();
      }

      // Handle resize — store ref so cleanup can disconnect it
      const observer = new ResizeObserver((entries) => {
        if (chartRef.current && entries[0]) {
          const { width, height } = entries[0].contentRect;
          (chartRef.current as { applyOptions: (opts: { width: number; height: number }) => void })
            .applyOptions({ width, height });
        }
      });
      observer.observe(chartContainerRef.current);
      observerRef.current = observer;
    });

    return () => {
      disposed = true;

      // Disconnect ResizeObserver
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      // Remove chart
      if (chartRef.current) {
        (chartRef.current as { remove: () => void }).remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [instrument, selectedPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update chart data when candles change
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    const chartData = candles
      .map((c) => ({
        time: (parseInt(c.timestamp) > 1e12
          ? Math.floor(parseInt(c.timestamp) / 1000)
          : parseInt(c.timestamp)) as import("lightweight-charts").UTCTimestamp,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));
    (seriesRef.current as { setData: (data: typeof chartData) => void }).setData(chartData);
  }, [candles]);

  return (
    <div className="flex h-full flex-col">
      {/* Timeframe selector */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border-subtle px-2 py-1">
        {CANDLE_PERIODS.map((p) => (
          <button
            key={p.label}
            onClick={() => setSelectedPeriod(p.label)}
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
              selectedPeriod === p.label
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {p.label}
          </button>
        ))}
        {isLoading && (
          <span className="ml-2 text-[10px] text-text-muted">Loading...</span>
        )}
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="min-h-0 flex-1" />
    </div>
  );
}
