"use client";

import { useUiStore } from "../stores/uiStore";
import {
  useTickerSubscription,
  useOrderBookSubscription,
  useTradesSubscription,
} from "./useSubscription";

/**
 * Master subscription hook for the currently selected instrument.
 * Subscribes to ticker, orderbook, and trades channels via WebSocket.
 * Should be called once at the top level (DeskPage) to ensure
 * real-time data flows regardless of which panel tab is active.
 */
export function useActiveInstrumentSubs() {
  const instrument = useUiStore((s) => s.selectedInstrument);

  // Subscribe to all three channels for the active instrument
  useTickerSubscription(instrument);
  useOrderBookSubscription(instrument);
  useTradesSubscription(instrument);
}
