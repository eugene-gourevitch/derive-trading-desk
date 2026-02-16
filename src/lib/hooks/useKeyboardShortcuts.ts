"use client";

import { useEffect } from "react";
import { useUiStore } from "@/lib/stores/uiStore";

/**
 * Global keyboard shortcut handler for the trading desk.
 *
 * Ctrl+K — Command palette (instrument search)
 * Ctrl+B — Set order side to Buy
 * Ctrl+Shift+S — Set order side to Sell (Ctrl+S reserved for browser save)
 * Escape — Close command palette / cancel
 * Ctrl+Shift+C — Cancel all open orders
 * 1-5 — Switch bottom panel tabs (when no input focused)
 * Ctrl+1/2/3 — Switch left panel tabs
 * Ctrl+L — Cycle layout preset
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Ctrl+K — Command palette
      if (ctrl && e.key === "k") {
        e.preventDefault();
        useUiStore.getState().toggleCommandPalette();
        return;
      }

      // Escape — Close command palette
      if (e.key === "Escape") {
        const store = useUiStore.getState();
        if (store.commandPaletteOpen) {
          store.toggleCommandPalette();
          return;
        }
      }

      // Ctrl+B — Buy
      if (ctrl && e.key === "b" && !shift) {
        e.preventDefault();
        // Dispatch custom event for OrderEntry to listen to
        window.dispatchEvent(new CustomEvent("desk:set-side", { detail: "buy" }));
        return;
      }

      // Ctrl+Shift+S — Sell
      if (ctrl && shift && e.key === "S") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("desk:set-side", { detail: "sell" }));
        return;
      }

      // Ctrl+Shift+C — Cancel all orders
      if (ctrl && shift && e.key === "C") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("desk:cancel-all-orders"));
        return;
      }

      // Ctrl+L — Cycle layout
      if (ctrl && e.key === "l") {
        e.preventDefault();
        const store = useUiStore.getState();
        const presets = ["default", "options-focus", "perp-scalping", "risk-monitor"] as const;
        const current = store.layoutPreset;
        const idx = presets.indexOf(current as typeof presets[number]);
        const next = presets[(idx + 1) % presets.length];
        store.setLayoutPreset(next);
        return;
      }

      // Don't process number keys if inside an input
      if (isInput) return;

      // Ctrl+1/2/3 — Switch left panel tabs
      if (ctrl && !shift) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 3) {
          e.preventDefault();
          useUiStore.getState().setLeftPanelTab(num - 1);
          return;
        }
      }

      // 1-5 (no modifier) — Switch bottom panel tabs
      const num = parseInt(e.key);
      if (!ctrl && !shift && !e.altKey && num >= 1 && num <= 5) {
        e.preventDefault();
        useUiStore.getState().setBottomPanelTab(num - 1);
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
