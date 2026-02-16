"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMarketStore } from "@/lib/stores/marketStore";
import { useUiStore } from "@/lib/stores/uiStore";
import { useTickerSubscriptions } from "@/lib/hooks/useSubscription";
import { deriveClient } from "@/lib/derive/client";
import { parseInstrumentName, formatExpiryCompact, daysToExpiry } from "@/lib/derive/instruments";
import { TICKER_STALE_UI_MS } from "@/lib/derive/constants";
import { formatPrice, formatGreek } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";
import type { DeriveTicker, OptionPricing, InstrumentType } from "@/lib/derive/types";

interface OptionStrike {
  strike: number;
  callInstrument: string | null;
  putInstrument: string | null;
  callTicker: DeriveTicker | null;
  putTicker: DeriveTicker | null;
}

export function OptionsChain() {
  const underlying = useUiStore((s) => s.selectedUnderlying);
  const setInstrument = useUiStore((s) => s.setSelectedInstrument);
  const setRightTab = useUiStore((s) => s.setRightPanelTab);
  const instrumentsList = useMarketStore((s) => s.instrumentsList);
  const options = useMemo(
    () => instrumentsList.filter((i) => i.instrument_type === "option" && i.option_details?.index === `${underlying}-USD`),
    [instrumentsList, underlying]
  );

  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);

  // Instrument names for the selected expiry (for real-time subscriptions)
  const selectedExpiryInstrumentNames = useMemo(() => {
    if (!selectedExpiry) return [];
    return options
      .filter((inst) => {
        const parsed = parseInstrumentName(inst.instrument_name);
        return parsed.expiry && parsed.expiry.toISOString().split("T")[0] === selectedExpiry;
      })
      .map((inst) => inst.instrument_name);
  }, [options, selectedExpiry]);

  // Only re-render when tickers for the selected expiry change (not on unrelated instrument updates)
  const tickersSliceRef = useRef<Map<string, DeriveTicker>>(new Map());
  const tickers = useMarketStore((s) => {
    const names = selectedExpiryInstrumentNames;
    const prev = tickersSliceRef.current;
    let same = prev.size === names.length;
    if (same) for (const n of names) { if (s.tickers.get(n) !== prev.get(n)) { same = false; break; } }
    if (same) return prev;
    const next = new Map<string, DeriveTicker>();
    for (const n of names) { const t = s.tickers.get(n); if (t) next.set(n, t); }
    tickersSliceRef.current = next;
    return next;
  });

  // Group by expiry
  const expiries = useMemo(() => {
    const expiryMap = new Map<string, { date: Date; label: string; dte: number }>();

    for (const inst of options) {
      const parsed = parseInstrumentName(inst.instrument_name);
      if (parsed.expiry) {
        const key = parsed.expiry.toISOString().split("T")[0]!;
        if (!expiryMap.has(key)) {
          expiryMap.set(key, {
            date: parsed.expiry,
            label: formatExpiryCompact(parsed.expiry),
            dte: daysToExpiry(parsed.expiry),
          });
        }
      }
    }

    return Array.from(expiryMap.entries())
      .sort(([, a], [, b]) => a.date.getTime() - b.date.getTime())
      .map(([key, val]) => ({ key, ...val }));
  }, [options]);

  useTickerSubscriptions(selectedExpiryInstrumentNames);

  // Auto-select first expiry when expiries become available
  useEffect(() => {
    if (!selectedExpiry && expiries.length > 0) {
      setSelectedExpiry(expiries[0].key);
    }
  }, [expiries, selectedExpiry]);

  // Track partial load: requested vs loaded count for selected expiry
  const [fetchRequestedCount, setFetchRequestedCount] = useState<number | null>(null);

  // Fetch tickers for option instruments in the selected expiry (initial load)
  const fetchedExpiryRef = useRef<string | null>(null);
  const inFlightExpiryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedExpiry || fetchedExpiryRef.current === selectedExpiry) return;
    if (inFlightExpiryRef.current === selectedExpiry) return; // Dedupe: already fetching this expiry
    fetchedExpiryRef.current = selectedExpiry;
    inFlightExpiryRef.current = selectedExpiry;

    const expiryInstruments = options.filter((inst) => {
      const parsed = parseInstrumentName(inst.instrument_name);
      return parsed.expiry && parsed.expiry.toISOString().split("T")[0] === selectedExpiry;
    });

    const instrumentsToFetch = expiryInstruments.filter((inst) => {
      const existing = useMarketStore.getState().tickers.get(inst.instrument_name);
      return !existing;
    });

    setFetchRequestedCount(instrumentsToFetch.length);

    // Fetch with bounded concurrency for faster first paint without API overload.
    const fetchConcurrent = async (instruments: typeof instrumentsToFetch) => {
      const concurrency = 12;
      let cursor = 0;
      const workers = Array.from({ length: Math.min(concurrency, instruments.length) }, async () => {
        while (cursor < instruments.length) {
          const index = cursor++;
          const inst = instruments[index];
          if (!inst) continue;

          try {
            const raw = await deriveClient.call<Record<string, unknown>>(
              "public/get_ticker",
              { instrument_name: inst.instrument_name }
            );
            if (!raw) continue;

            const rawStats = (raw.stats as Record<string, string>) || {};
            const ticker: DeriveTicker = {
              instrument_type: raw.instrument_type as InstrumentType,
              instrument_name: raw.instrument_name as string,
              best_bid: (raw.best_bid_price as string) || "0",
              best_bid_amount: (raw.best_bid_amount as string) || "0",
              best_ask: (raw.best_ask_price as string) || "0",
              best_ask_amount: (raw.best_ask_amount as string) || "0",
              timestamp: raw.timestamp as number,
              mark_price: (raw.mark_price as string) || "0",
              index_price: (raw.index_price as string) || "0",
              min_price: (raw.min_price as string) || "0",
              max_price: (raw.max_price as string) || "0",
              option_pricing: (raw.option_pricing as OptionPricing) || null,
              stats: {
                contract_volume: rawStats.contract_volume || "0",
                num_trades: rawStats.num_trades || "0",
                open_interest: rawStats.open_interest || "0",
                high: rawStats.high || "0",
                low: rawStats.low || "0",
                percent_change: rawStats.percent_change || "0",
                usd_change: rawStats.usd_change || "0",
              },
              last: (raw.mark_price as string) || "0",
              change: rawStats.percent_change || "0",
              high: rawStats.high || "0",
              low: rawStats.low || "0",
              open_interest: rawStats.open_interest || "0",
              volume: rawStats.contract_volume || "0",
              volume_value: "0",
              best_bid_size: (raw.best_bid_amount as string) || "0",
              best_ask_size: (raw.best_ask_amount as string) || "0",
              funding_rate: "0",
            };
            useMarketStore.getState().updateTicker(inst.instrument_name, ticker);
          } catch {
            // Silently skip failed tickers
          }
        }
      });

      await Promise.all(workers);
    };

    fetchConcurrent(instrumentsToFetch).then(() => {
      inFlightExpiryRef.current = null;
      setFetchRequestedCount(null); // Clear so we don't show partial after load completes
      console.log(
        `[Options] Loaded tickers for ${instrumentsToFetch.length}/${expiryInstruments.length} instruments (${selectedExpiry})`
      );
    });
  }, [selectedExpiry, options]);

  // Stale and partial-load indicators for selected expiry
  const selectedExpiryInstruments = useMemo(() => {
    if (!selectedExpiry) return [];
    return options.filter((inst) => {
      const parsed = parseInstrumentName(inst.instrument_name);
      return parsed.expiry && parsed.expiry.toISOString().split("T")[0] === selectedExpiry;
    });
  }, [options, selectedExpiry]);

  const tickerFreshness = useMemo(() => {
    const now = Date.now();
    let maxAge = 0;
    for (const inst of selectedExpiryInstruments) {
      const t = tickers.get(inst.instrument_name);
      if (t?.timestamp) maxAge = Math.max(maxAge, now - t.timestamp);
    }
    return { maxAge, isStale: maxAge > TICKER_STALE_UI_MS };
  }, [tickers, selectedExpiryInstruments]);

  const partialLoad = useMemo(() => {
    if (fetchRequestedCount == null || fetchRequestedCount === 0) return null;
    const loaded = selectedExpiryInstruments.filter((inst) => tickers.has(inst.instrument_name)).length;
    if (loaded >= fetchRequestedCount) return null;
    return { loaded, requested: fetchRequestedCount };
  }, [fetchRequestedCount, selectedExpiryInstruments, tickers]);

  // Build strike grid for selected expiry
  const strikes = useMemo(() => {
    if (!selectedExpiry) return [];

    const strikeMap = new Map<number, OptionStrike>();

    for (const inst of options) {
      const parsed = parseInstrumentName(inst.instrument_name);
      if (!parsed.expiry || parsed.expiry.toISOString().split("T")[0] !== selectedExpiry) continue;
      if (!parsed.strike) continue;

      if (!strikeMap.has(parsed.strike)) {
        strikeMap.set(parsed.strike, {
          strike: parsed.strike,
          callInstrument: null,
          putInstrument: null,
          callTicker: null,
          putTicker: null,
        });
      }

      const entry = strikeMap.get(parsed.strike)!;
      if (parsed.optionType === "call") {
        entry.callInstrument = inst.instrument_name;
        entry.callTicker = tickers.get(inst.instrument_name) ?? null;
      } else {
        entry.putInstrument = inst.instrument_name;
        entry.putTicker = tickers.get(inst.instrument_name) ?? null;
      }
    }

    return Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike);
  }, [options, selectedExpiry, tickers]);

  if (options.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        <div className="text-center">
          <div>No options loaded for {underlying}</div>
          <div className="mt-1 text-text-muted">Connect to fetch instruments</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Stale / partial-load indicators */}
      {(tickerFreshness.isStale || partialLoad) && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-2 py-1 text-[10px]">
          {tickerFreshness.isStale && (
            <span className="text-amber-500" title={`Quotes older than ${(TICKER_STALE_UI_MS / 1000).toFixed(0)}s`}>
              Stale
            </span>
          )}
          {partialLoad && (
            <span className="text-text-muted" title="Some quotes failed to load">
              Partial ({partialLoad.loaded}/{partialLoad.requested})
            </span>
          )}
        </div>
      )}
      {/* Expiry Tabs */}
      <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border-subtle px-2 py-1">
        {expiries.map((exp) => (
          <button
            key={exp.key}
            onClick={() => setSelectedExpiry(exp.key)}
            className={cn(
              "shrink-0 rounded px-2 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap",
              selectedExpiry === exp.key
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {exp.label}
            <span className="ml-1 text-text-muted">({exp.dte.toFixed(0)}d)</span>
          </button>
        ))}
      </div>

      {/* Column Headers */}
      <div className="flex shrink-0 items-center border-b border-border-subtle text-[10px] text-text-muted">
        {/* Call side */}
        <div className="flex flex-1 items-center px-1 py-1">
          <div className="w-14 text-right">Bid</div>
          <div className="w-14 text-right">Ask</div>
          <div className="w-12 text-right">IV</div>
          <div className="w-12 text-right">Delta</div>
          <div className="flex-1 text-right">OI</div>
        </div>
        {/* Strike */}
        <div className="w-16 shrink-0 text-center font-semibold text-text-secondary">Strike</div>
        {/* Put side */}
        <div className="flex flex-1 items-center px-1 py-1">
          <div className="w-14">Bid</div>
          <div className="w-14">Ask</div>
          <div className="w-12">IV</div>
          <div className="w-12">Delta</div>
          <div className="flex-1">OI</div>
        </div>
      </div>

      {/* Strike Rows */}
      <div className="flex-1 overflow-auto">
        {strikes.map((row) => (
          <div
            key={row.strike}
            className="flex items-center border-b border-border-subtle hover:bg-bg-hover"
          >
            {/* Call Side */}
            <OptionSide
              ticker={row.callTicker}
              instrument={row.callInstrument}
              side="call"
              onSelect={(name) => {
                setInstrument(name);
                setRightTab(0); // Switch to Order Entry tab
              }}
            />

            {/* Strike */}
            <div className="w-16 shrink-0 text-center font-mono-nums font-semibold text-text-primary">
              {formatPrice(row.strike, 0)}
            </div>

            {/* Put Side */}
            <OptionSide
              ticker={row.putTicker}
              instrument={row.putInstrument}
              side="put"
              onSelect={(name) => {
                setInstrument(name);
                setRightTab(0); // Switch to Order Entry tab
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function OptionSide({
  ticker,
  instrument,
  side,
  onSelect,
}: {
  ticker: DeriveTicker | null;
  instrument: string | null;
  side: "call" | "put";
  onSelect: (name: string) => void;
}) {
  const op = ticker?.option_pricing;
  const isCall = side === "call";
  const ivNum = op ? Number(op.iv) : NaN;
  const deltaNum = op ? Number(op.delta) : NaN;
  const ivLabel = Number.isFinite(ivNum) ? `${(ivNum * 100).toFixed(1)}%` : "—";
  const deltaLabel = Number.isFinite(deltaNum) ? formatGreek(deltaNum, 3) : "—";

  return (
    <div
      className={cn(
        "flex flex-1 items-center px-1 py-1 cursor-pointer",
        isCall ? "text-right" : "text-left"
      )}
      onClick={() => instrument && onSelect(instrument)}
    >
      <div
        className={cn(
          "w-14 font-mono-nums",
          isCall ? "text-right text-green" : "text-red"
        )}
      >
        {ticker ? formatPrice(ticker.best_bid, 2) : "—"}
      </div>
      <div
        className={cn(
          "w-14 font-mono-nums",
          isCall ? "text-right text-red" : "text-green"
        )}
      >
        {ticker ? formatPrice(ticker.best_ask, 2) : "—"}
      </div>
      <div className={cn("w-12 font-mono-nums text-text-secondary", isCall ? "text-right" : "")}>
        {ivLabel}
      </div>
      <div className={cn("w-12 font-mono-nums text-text-secondary", isCall ? "text-right" : "")}>
        {deltaLabel}
      </div>
      <div className={cn("flex-1 font-mono-nums text-text-muted", isCall ? "text-right" : "")}>
        {ticker?.open_interest ? formatPrice(ticker.open_interest, 0) : "—"}
      </div>
    </div>
  );
}
