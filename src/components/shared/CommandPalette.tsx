"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useUiStore } from "@/lib/stores/uiStore";
import { useMarketStore } from "@/lib/stores/marketStore";
import { cn } from "@/lib/utils/cn";

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const toggle = useUiStore((s) => s.toggleCommandPalette);
  const setInstrument = useUiStore((s) => s.setSelectedInstrument);
  const setUnderlying = useUiStore((s) => s.setSelectedUnderlying);
  const instruments = useMarketStore((s) => s.instruments);

  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter instruments by query
  const results = useMemo(() => {
    if (!query) {
      // Show popular / recent instruments
      const all = Array.from(instruments.values());
      // Put perps first, then options sorted by name
      const perps = all.filter((i) => i.instrument_type === "perp");
      const opts = all.filter((i) => i.instrument_type === "option").slice(0, 20);
      return [...perps, ...opts];
    }

    const q = query.toUpperCase();
    return Array.from(instruments.values())
      .filter((i) => i.instrument_name.includes(q))
      .slice(0, 30);
  }, [instruments, query]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIdx(0);
  }, [results]);

  const handleSelect = (instrumentName: string) => {
    setInstrument(instrumentName);
    // Also update underlying
    const parts = instrumentName.split("-");
    if (parts.length > 0) {
      setUnderlying(parts[0]);
    }
    toggle();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      e.preventDefault();
      handleSelect(results[selectedIdx].instrument_name);
    } else if (e.key === "Escape") {
      toggle();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={toggle}
      />

      {/* Palette */}
      <div className="relative w-[560px] overflow-hidden rounded-xl border border-border-subtle bg-bg-secondary shadow-2xl">
        {/* Search Input */}
        <div className="flex items-center border-b border-border-subtle px-4">
          <svg
            className="mr-2 h-4 w-4 text-text-muted"
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
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search instruments... (e.g., ETH-PERP, BTC-20260327-50000-C)"
            className="w-full bg-transparent py-3 text-sm text-text-primary placeholder-text-muted outline-none"
          />
          <kbd className="ml-2 rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] text-text-muted">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-auto p-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-text-muted">
              {query
                ? "No instruments found"
                : "No instruments loaded — connect first"}
            </div>
          ) : (
            results.map((inst, idx) => (
              <button
                key={inst.instrument_name}
                onClick={() => handleSelect(inst.instrument_name)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors",
                  idx === selectedIdx
                    ? "bg-accent/10 text-text-primary"
                    : "text-text-secondary hover:bg-bg-hover"
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-bold",
                      inst.instrument_type === "perp" &&
                        "bg-accent/20 text-accent",
                      inst.instrument_type === "option" &&
                        "bg-yellow/20 text-yellow",
                      inst.instrument_type === "erc20" &&
                        "bg-green/20 text-green"
                    )}
                  >
                    {inst.instrument_type === "perp"
                      ? "PERP"
                      : inst.instrument_type === "option"
                        ? inst.option_details?.option_type?.toUpperCase() || "OPT"
                        : "ERC20"}
                  </span>
                  <span className="font-mono-nums text-xs font-medium">
                    {inst.instrument_name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-text-muted">
                  {inst.option_details?.strike && (
                    <span>K={inst.option_details.strike}</span>
                  )}
                  {inst.is_active ? (
                    <span className="text-green">Active</span>
                  ) : (
                    <span className="text-red">Inactive</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2 text-[10px] text-text-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded bg-bg-tertiary px-1 py-0.5">↑↓</kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="rounded bg-bg-tertiary px-1 py-0.5">↵</kbd>{" "}
              select
            </span>
            <span>
              <kbd className="rounded bg-bg-tertiary px-1 py-0.5">esc</kbd>{" "}
              close
            </span>
          </div>
          <span>{results.length} instruments</span>
        </div>
      </div>
    </div>
  );
}
