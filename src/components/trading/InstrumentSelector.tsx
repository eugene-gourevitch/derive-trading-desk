"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import { useUiStore } from "@/lib/stores/uiStore";
import { useMarketStore } from "@/lib/stores/marketStore";
import { cn } from "@/lib/utils/cn";

/**
 * Global instrument selector — command palette triggered by Ctrl+K
 * or by clicking the instrument name in the status bar.
 *
 * Groups instruments by type: Perps → Options (by underlying + expiry)
 * Shows key info: mark price, 24h change, OI
 */
export function InstrumentSelector() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setInstrument = useUiStore((s) => s.setSelectedInstrument);
  const setUnderlying = useUiStore((s) => s.setSelectedUnderlying);
  const instrumentsList = useMarketStore((s) => s.instrumentsList);
  const tickers = useMarketStore((s) => s.tickers);
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  // Keyboard shortcut: Ctrl+K to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Group instruments
  const { perps, optionGroups } = useMemo(() => {
    const perps = instrumentsList.filter((i) => i.instrument_type === "perp");

    // Group options by underlying
    const optionMap = new Map<string, typeof instrumentsList>();
    for (const inst of instrumentsList) {
      if (inst.instrument_type === "option") {
        const underlying = inst.instrument_name.split("-")[0] || "ETH";
        if (!optionMap.has(underlying)) optionMap.set(underlying, []);
        optionMap.get(underlying)!.push(inst);
      }
    }

    const optionGroups = Array.from(optionMap.entries()).map(([underlying, instruments]) => ({
      underlying,
      count: instruments.length,
      // Show a few near-ATM options as examples
      instruments: instruments.slice(0, 20),
    }));

    return { perps, optionGroups };
  }, [instrumentsList]);

  const handleSelect = (instrumentName: string) => {
    setInstrument(instrumentName);
    // Also set the underlying for options chain
    const underlying = instrumentName.split("-")[0] || "ETH";
    setUnderlying(underlying);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Command Palette */}
      <div className="fixed left-1/2 top-[15%] z-50 w-[560px] -translate-x-1/2">
        <Command
          className="rounded-xl border border-border-active bg-bg-secondary shadow-2xl"
          shouldFilter={true}
        >
          {/* Input */}
          <div className="flex items-center border-b border-border-subtle px-4">
            <svg
              className="mr-2 h-4 w-4 shrink-0 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <Command.Input
              ref={inputRef}
              value={search}
              onValueChange={setSearch}
              placeholder="Search instruments... (ETH, BTC, PERP, 2500-C)"
              className="w-full bg-transparent py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            <kbd className="ml-2 shrink-0 rounded border border-border-subtle bg-bg-tertiary px-1.5 py-0.5 text-[10px] text-text-muted">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[400px] overflow-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-text-muted">
              No instruments found
            </Command.Empty>

            {/* Perpetuals */}
            {perps.length > 0 && (
              <Command.Group
                heading={
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Perpetuals
                  </span>
                }
              >
                {perps.map((inst) => {
                  const ticker = tickers.get(inst.instrument_name);
                  return (
                    <Command.Item
                      key={inst.instrument_name}
                      value={inst.instrument_name}
                      onSelect={() => handleSelect(inst.instrument_name)}
                      className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm aria-selected:bg-accent/10"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-text-primary">
                          {inst.instrument_name}
                        </span>
                        <span className="rounded bg-blue/20 px-1.5 py-0.5 text-[10px] font-medium text-blue">
                          PERP
                        </span>
                      </div>
                      <div className="flex items-center gap-4 font-mono-nums text-xs">
                        {ticker && (
                          <>
                            <span className="text-text-primary">
                              ${parseFloat(ticker.mark_price).toFixed(2)}
                            </span>
                            <span
                              className={cn(
                                parseFloat(ticker.change) >= 0
                                  ? "text-green"
                                  : "text-red"
                              )}
                            >
                              {parseFloat(ticker.change) >= 0 ? "+" : ""}
                              {(parseFloat(ticker.change) * 100).toFixed(2)}%
                            </span>
                          </>
                        )}
                      </div>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* Options by underlying */}
            {optionGroups.map(({ underlying, count }) => (
              <Command.Group
                key={underlying}
                heading={
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {underlying} Options ({count})
                  </span>
                }
              >
                {/* Quick switch to options chain */}
                <Command.Item
                  value={`${underlying} options chain view all`}
                  onSelect={() => {
                    setUnderlying(underlying);
                    setInstrument(`${underlying}-PERP`);
                    // Switch to options chain tab
                    useUiStore.getState().setLeftPanelTab(0);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm aria-selected:bg-accent/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-accent">
                      → View {underlying} Options Chain
                    </span>
                    <span className="rounded bg-purple/20 px-1.5 py-0.5 text-[10px] font-medium text-purple">
                      {count} instruments
                    </span>
                  </div>
                </Command.Item>
              </Command.Group>
            ))}

            {/* Hint */}
            <div className="mt-2 border-t border-border-subtle px-3 py-2">
              <div className="flex items-center gap-4 text-[10px] text-text-muted">
                <span>
                  <kbd className="rounded border border-border-subtle bg-bg-tertiary px-1 py-0.5">↑↓</kbd>{" "}
                  Navigate
                </span>
                <span>
                  <kbd className="rounded border border-border-subtle bg-bg-tertiary px-1 py-0.5">Enter</kbd>{" "}
                  Select
                </span>
                <span>
                  <kbd className="rounded border border-border-subtle bg-bg-tertiary px-1 py-0.5">Ctrl+K</kbd>{" "}
                  Toggle
                </span>
              </div>
            </div>
          </Command.List>
        </Command>
      </div>
    </>
  );
}
