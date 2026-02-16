"use client";

import { useEffect, useRef } from "react";
import { wsManager } from "@/lib/derive/websocket";
import { useUiStore } from "@/lib/stores/uiStore";

/**
 * Subscribe to a WebSocket channel. Auto-unsubs on unmount.
 * Only subscribes when WS is connected.
 */
export function useSubscription(
  channel: string | null,
  handler?: (data: unknown) => void
): void {
  const wsConnected = useUiStore((s) => s.wsConnected);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!channel || !wsConnected) {
      console.log(`[Sub] Skip ${channel}: wsConnected=${wsConnected}`);
      return;
    }

    console.log(`[Sub] Subscribing to ${channel}`);
    const unsub = wsManager.subscribe(channel, (data) => {
      handlerRef.current?.(data);
    });

    return () => {
      console.log(`[Sub] Unsubscribing from ${channel}`);
      unsub();
    };
  }, [channel, wsConnected]);
}

/**
 * Subscribe to orderbook for an instrument.
 * Derive channel format: orderbook.{instrument_name}.{group}.{depth}
 */
export function useOrderBookSubscription(
  instrument: string | null,
  depth: number = 20
): void {
  const channel = instrument
    ? `orderbook.${instrument}.1.${depth}`
    : null;
  useSubscription(channel);
}

/**
 * Subscribe to ticker for an instrument.
 * Derive channel format: ticker_slim.{instrument_name}.{interval}
 * Note: "ticker" channel is deprecated on Derive — use "ticker_slim".
 * Valid intervals: 100, 1000 (milliseconds, no "ms" suffix).
 */
export function useTickerSubscription(instrument: string | null): void {
  const channel = instrument ? `ticker_slim.${instrument}.100` : null;
  useSubscription(channel);
}

const TICKER_SLIM_INTERVAL = 100;

/**
 * Subscribe to ticker_slim for multiple instruments (e.g. all options in the chain).
 * Updates flow into the market store via wsManager's routeToStore; no custom handler needed.
 */
export function useTickerSubscriptions(instrumentNames: string[]): void {
  const wsConnected = useUiStore((s) => s.wsConnected);

  const channelKey = [...instrumentNames].sort().join(",");

  useEffect(() => {
    if (!wsConnected || instrumentNames.length === 0) return;

    const unsubs = instrumentNames.map((name) => {
      const channel = `ticker_slim.${name}.${TICKER_SLIM_INTERVAL}`;
      return wsManager.subscribe(channel, () => {});
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [wsConnected, channelKey]);
}

/**
 * Subscribe to trades for a currency + instrument type.
 * Derive channel format: trades.{instrument_type}.{currency}.settled
 * Unlike ticker/orderbook, trades are subscribed per-currency, not per-instrument.
 * We extract the currency and type from the instrument name.
 */
export function useTradesSubscription(instrument: string | null): void {
  let channel: string | null = null;
  if (instrument) {
    const currency = instrument.split("-")[0]; // e.g. "ETH" from "ETH-PERP"
    const isPerp = instrument.includes("-PERP");
    const type = isPerp ? "perp" : "option";
    channel = `trades.${type}.${currency}.settled`;
  }
  useSubscription(channel);
}
