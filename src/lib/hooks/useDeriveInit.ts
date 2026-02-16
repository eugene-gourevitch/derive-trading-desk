"use client";

import { useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useAccountStore } from "@/lib/stores/accountStore";
import { useMarketStore } from "@/lib/stores/marketStore";
import { useUiStore } from "@/lib/stores/uiStore";
import { usePositionStore } from "@/lib/stores/positionStore";
import { useOrderStore } from "@/lib/stores/orderStore";
import { wsManager } from "@/lib/derive/websocket";
import { deriveClient } from "@/lib/derive/client";
import { resolveDeriveWallet } from "@/lib/derive/session-keys";
import type { DeriveAccount, DeriveInstrument, DeriveSubaccount, DeriveTicker, InstrumentType, OptionPricing } from "@/lib/derive/types";

/**
 * All currencies that Derive supports for trading instruments.
 * We fetch perps + options for each. The API returns empty arrays
 * for currencies that don't have a particular instrument type.
 */
const SUPPORTED_CURRENCIES = [
  "ETH", "BTC", "SOL", "HYPE", "DOGE", "AVAX", "LINK", "SUI",
  "PEPE", "XRP", "ADA", "DOT", "UNI", "AAVE", "ARB", "OP",
  "NEAR", "ATOM", "FIL", "LTC", "BCH", "APT", "SEI", "INJ",
  "TIA", "RENDER", "BONK", "WIF", "TRUMP", "PENGU", "VIRTUAL",
  "FLOKI", "ONDO", "ENA", "DYDX", "SNX", "COMP", "MKR", "CRV",
  "STX", "MINA", "GRT", "IMX", "SAND", "ALGO", "XTZ", "KSM",
  "THETA", "FLOW", "ICP", "HBAR",
] as const;

/**
 * Master initialization hook for the trading desk.
 * Runs on desk mount. Handles:
 *  1. Connecting to Derive API (public data)
 *  2. Loading ALL instruments across all supported currencies
 *  3. Connecting WebSocket for real-time data
 *  4. Subscribing to ticker channels for key instruments
 *  5. If wallet connected: attempt to resolve Derive wallet for private data
 */
// Module-level dedup: prevents double-fetching in React Strict Mode.
// The first mount's fetch gets cancelled by cleanup, so we track whether
// instruments have actually been loaded into the store.
let initInProgress = false;

export function useDeriveInit() {
  const { address: eoaAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const environment = useUiStore((s) => s.environment);

  useEffect(() => {
    const accountStore = useAccountStore.getState();
    const marketStore = useMarketStore.getState();
    const positionStore = usePositionStore.getState();
    const orderStore = useOrderStore.getState();

    if (isConnected && eoaAddress) {
      accountStore.setEoaAddress(eoaAddress);
      accountStore.setConnected(true);
    }

    // Always connect WebSocket for public data (idempotent)
    wsManager.connect(environment);

    let cancelled = false;

    // ── Wallet resolution, auth, and private data (account, positions, orders) ──
    async function loadWalletAndAccount() {
      if (!isConnected || !eoaAddress || !walletClient) return;
      accountStore.setError(null);
      accountStore.setLoadingAccount(true);
      try {
        const deriveWallet = await resolveDeriveWallet(eoaAddress);
        if (cancelled) return;
        if (!deriveWallet) {
          accountStore.setError(
            "No Derive account for this wallet. Create one in the Deposit tab."
          );
          accountStore.setLoadingAccount(false);
          return;
        }
        accountStore.setDeriveWallet(deriveWallet);

        const signTimestampWithEoa = (timestamp: string) =>
          walletClient.signMessage({ message: timestamp });
        deriveClient.setAuth(deriveWallet, signTimestampWithEoa);
        wsManager.connect(environment, deriveWallet, signTimestampWithEoa);
        if (cancelled) return;

        const account = (await deriveClient.getAccount()) as DeriveAccount;
        if (cancelled) return;
        accountStore.setAccount(account);
        accountStore.setAuthenticated(true);

        const subaccountId = account.default_subaccount_id;
        const subaccount = (await deriveClient.getSubaccount(subaccountId)) as DeriveSubaccount;
        if (cancelled) return;
        accountStore.setSubaccount(subaccount);
        accountStore.setActiveSubaccountId(subaccountId);

        const [positions, openOrders] = await Promise.all([
          deriveClient.getPositions(subaccountId),
          deriveClient.getOpenOrders(subaccountId),
        ]);
        if (cancelled) return;
        positionStore.setPositions(Array.isArray(positions) ? positions : []);
        orderStore.setOpenOrders(Array.isArray(openOrders) ? openOrders : []);

        accountStore.setError(null);
        console.log("[Init] Account and private data loaded");
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Unable to load account";
          accountStore.setError(message);
          console.warn("[Init] Account load failed:", err);
        }
      } finally {
        if (!cancelled) accountStore.setLoadingAccount(false);
      }
    }

    loadWalletAndAccount();

    // ── Instruments and tickers (public data) ──
    if (initInProgress) {
      return () => {
        cancelled = true;
        wsManager.disconnect();
        deriveClient.clearAuth();
      };
    }
    if (marketStore.instrumentsList.length > 0) {
      return () => {
        cancelled = true;
        wsManager.disconnect();
        deriveClient.clearAuth();
      };
    }

    initInProgress = true;

    async function initialize() {
      console.log("[Init] Starting Derive initialization...");
      console.log("[Init] Environment:", environment);

      console.log("[Init] Fetching instruments for", SUPPORTED_CURRENCIES.length, "currencies...");
      marketStore.setLoadingInstruments(true);

      const allInstruments: DeriveInstrument[] = [];

      const fetchInstruments = async (currency: string, type: string) => {
        try {
          const result = await deriveClient.call<DeriveInstrument[]>(
            "public/get_instruments",
            { currency, expired: false, instrument_type: type }
          );
          if (Array.isArray(result) && result.length > 0) {
            return result;
          }
        } catch {
          // Silently skip currencies that don't have this instrument type
        }
        return [];
      };

      const batchSize = 10;
      for (let i = 0; i < SUPPORTED_CURRENCIES.length; i += batchSize) {
        if (cancelled) return;
        const batch = SUPPORTED_CURRENCIES.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.flatMap((currency) => [
            fetchInstruments(currency, "perp"),
            fetchInstruments(currency, "option"),
          ])
        );
        for (const result of results) {
          allInstruments.push(...result);
        }
      }

      if (cancelled) return;

      if (allInstruments.length > 0) {
        marketStore.setInstruments(allInstruments);
        const perps = allInstruments.filter((i) => i.instrument_type === "perp");
        const options = allInstruments.filter((i) => i.instrument_type === "option");
        const currencies = new Set(allInstruments.map((i) => i.instrument_name.split("-")[0]));
        console.log(`[Init] Loaded ${allInstruments.length} instruments: ${perps.length} perps, ${options.length} options across ${currencies.size} currencies`);
      }
      marketStore.setLoadingInstruments(false);

      if (cancelled) return;

      const perpInstruments = allInstruments
        .filter((i) => i.instrument_type === "perp")
        .map((i) => i.instrument_name);

      const tickerBatchSize = 5;
      for (let i = 0; i < perpInstruments.length; i += tickerBatchSize) {
        if (cancelled) return;
        const batch = perpInstruments.slice(i, i + tickerBatchSize);
        await Promise.all(
          batch.map(async (instName) => {
            try {
              const tickerRaw = await deriveClient.call<Record<string, unknown>>(
                "public/get_ticker",
                { instrument_name: instName }
              );
              if (tickerRaw && !cancelled) {
                const ticker = normalizeTicker(tickerRaw);
                marketStore.updateTicker(instName, ticker);
              }
            } catch {
              // Skip instruments that fail
            }
          })
        );
      }

      if (!cancelled) {
        console.log("[Init] Initialization complete — tickers loaded for", perpInstruments.length, "perps");
      }
    }

    initialize();

    return () => {
      cancelled = true;
      initInProgress = false;
      wsManager.disconnect();
      deriveClient.clearAuth();
    };
  }, [isConnected, eoaAddress, environment, walletClient]);
}

/**
 * Normalize the raw ticker response from the API into the DeriveTicker shape
 * that components expect (with convenience aliases).
 */
function normalizeTicker(raw: Record<string, unknown>): DeriveTicker {
  const rawStats = (raw.stats as Record<string, string>) || {};
  const perpDetails = raw.perp_details as Record<string, string> | null;

  const stats: DeriveTicker["stats"] = {
    contract_volume: rawStats.contract_volume || "0",
    num_trades: rawStats.num_trades || "0",
    open_interest: rawStats.open_interest || "0",
    high: rawStats.high || "0",
    low: rawStats.low || "0",
    percent_change: rawStats.percent_change || "0",
    usd_change: rawStats.usd_change || "0",
  };

  return {
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
    stats,
    perp_details: perpDetails ? {
      index: perpDetails.index || "",
      funding_rate: perpDetails.funding_rate || "0",
      aggregate_funding: perpDetails.aggregate_funding || "0",
      max_rate_per_hour: perpDetails.max_rate_per_hour || "0",
      min_rate_per_hour: perpDetails.min_rate_per_hour || "0",
      static_interest_rate: perpDetails.static_interest_rate || "0",
    } : undefined,

    // Convenience aliases that components use
    last: (raw.mark_price as string) || "0",
    change: stats.percent_change || "0",
    high: stats.high || "0",
    low: stats.low || "0",
    open_interest: stats.open_interest || "0",
    volume: stats.contract_volume || "0",
    volume_value: "0",
    best_bid_size: (raw.best_bid_amount as string) || "0",
    best_ask_size: (raw.best_ask_amount as string) || "0",
    funding_rate: perpDetails?.funding_rate || "0",
  };
}
