import {
  WS_HEARTBEAT_INTERVAL_MS,
  WS_RECONNECT_BASE_MS,
  WS_RECONNECT_MAX_MS,
  TICKER_STALE_TTL_MS,
  WS_SUBSCRIBE_ACK_TIMEOUT_MS,
  WS_UPDATE_BUFFER_MAX,
  DERIVE_ENVIRONMENTS,
  type DeriveEnvironment,
} from "./constants";
import type { DeriveTicker, JsonRpcResponse, OptionPricing } from "./types";
import { useMarketStore } from "../stores/marketStore";
import { useUiStore } from "../stores/uiStore";
import {
  recordQuoteMessageReceived,
  recordQuoteUpdatesDroppedByBackpressure,
  recordQuoteDeadLetterChannel,
  recordQuoteReconnectAttempt,
  recordQuoteSubscribeAckRetry,
  recordQuoteTickerUpdatesApplied,
} from "../observability/quote-metrics";
import { quotePipelineFlags } from "../features/flags";

type MessageHandler = (data: unknown) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface TickerSlimPayload {
  timestamp?: number;
  instrument_ticker?: Record<string, unknown>;
}

interface CompactOptionPricingPayload {
  d?: string | number;  // delta
  t?: string | number;  // theta
  g?: string | number;  // gamma
  v?: string | number;  // vega
  i?: string | number;  // iv
  r?: string | number;  // rho
  bi?: string | number; // bid iv
  ai?: string | number; // ask iv
  m?: string | number;  // mark price
  f?: string | number;  // forward price
}

function toStringOrFallback(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  return String(value);
}

function normalizeOptionPricing(
  payload: unknown,
  previous: OptionPricing | null | undefined
): OptionPricing | null {
  if (payload == null) return previous ?? null;

  const raw = payload as Record<string, unknown>;

  // Full-shape option_pricing from REST/get_ticker responses.
  if ("iv" in raw || "delta" in raw) {
    return {
      delta: toStringOrFallback(raw.delta, previous?.delta ?? "0"),
      gamma: toStringOrFallback(raw.gamma, previous?.gamma ?? "0"),
      vega: toStringOrFallback(raw.vega, previous?.vega ?? "0"),
      theta: toStringOrFallback(raw.theta, previous?.theta ?? "0"),
      rho: toStringOrFallback(raw.rho, previous?.rho ?? "0"),
      iv: toStringOrFallback(raw.iv, previous?.iv ?? "0"),
      bid_iv: toStringOrFallback(raw.bid_iv, previous?.bid_iv ?? "0"),
      ask_iv: toStringOrFallback(raw.ask_iv, previous?.ask_iv ?? "0"),
      mark_price: toStringOrFallback(raw.mark_price, previous?.mark_price ?? "0"),
      forward_price: toStringOrFallback(raw.forward_price, previous?.forward_price ?? "0"),
    };
  }

  // Compact-shape option_pricing from ticker_slim websocket updates.
  const compact = raw as CompactOptionPricingPayload;
  return {
    delta: toStringOrFallback(compact.d, previous?.delta ?? "0"),
    gamma: toStringOrFallback(compact.g, previous?.gamma ?? "0"),
    vega: toStringOrFallback(compact.v, previous?.vega ?? "0"),
    theta: toStringOrFallback(compact.t, previous?.theta ?? "0"),
    rho: toStringOrFallback(compact.r, previous?.rho ?? "0"),
    iv: toStringOrFallback(compact.i, previous?.iv ?? "0"),
    bid_iv: toStringOrFallback(compact.bi, previous?.bid_iv ?? "0"),
    ask_iv: toStringOrFallback(compact.ai, previous?.ask_iv ?? "0"),
    mark_price: toStringOrFallback(compact.m, previous?.mark_price ?? "0"),
    forward_price: toStringOrFallback(compact.f, previous?.forward_price ?? "0"),
  };
}

/** Dead-letter count for malformed ticker_slim channels (for metrics). */
export let quotePipelineDeadLetterCount = 0;

function extractTickerSlimInstrument(channel: string): string | null {
  if (!channel.startsWith("ticker_slim.")) return null;
  const parts = channel.split(".");
  // Expect ticker_slim.{instrument}.{interval} (at least 3 parts)
  if (parts.length < 3 || !parts[1] || parts[1].length === 0) {
    quotePipelineDeadLetterCount += 1;
    recordQuoteDeadLetterChannel();
    return null;
  }
  return parts[1];
}

export function normalizeTickerSlimUpdate(
  instrument: string,
  payload: unknown,
  previous?: DeriveTicker
): DeriveTicker | null {
  const wrapper = payload as TickerSlimPayload;
  const t = wrapper.instrument_ticker;
  if (!t) return null;

  const rawTimestamp = (wrapper.timestamp as number | undefined) ?? (t.t as number | undefined);
  const timestamp = rawTimestamp ?? previous?.timestamp ?? Date.now();
  // Monotonic: reject out-of-order
  if (previous && timestamp < previous.timestamp) {
    return null;
  }
  // Stale TTL and future skew (guarded by feature flag for rollback)
  if (quotePipelineFlags.strictStaleGuard) {
    const now = Date.now();
    if (timestamp < now - TICKER_STALE_TTL_MS) return null;
    if (timestamp > now + 5_000) return null;
  }

  const previousStats = previous?.stats;
  const tStats = t.stats as Record<string, string | number> | undefined;
  const stats = {
    contract_volume: toStringOrFallback(tStats?.c, previousStats?.contract_volume ?? "0"),
    num_trades: toStringOrFallback(tStats?.n, previousStats?.num_trades ?? "0"),
    open_interest: toStringOrFallback(tStats?.oi, previousStats?.open_interest ?? "0"),
    high: toStringOrFallback(tStats?.h, previousStats?.high ?? "0"),
    low: toStringOrFallback(tStats?.l, previousStats?.low ?? "0"),
    percent_change: toStringOrFallback(tStats?.p, previousStats?.percent_change ?? "0"),
    usd_change: previousStats?.usd_change ?? "0",
  };

  const optionPricing = Object.prototype.hasOwnProperty.call(t, "option_pricing")
    ? normalizeOptionPricing(
      (t as Record<string, unknown>).option_pricing,
      previous?.option_pricing
    )
    : (previous?.option_pricing ?? null);

  const previousPerp = previous?.perp_details;
  const fundingRate = toStringOrFallback(t.f, previousPerp?.funding_rate ?? previous?.funding_rate ?? "0");
  const perpDetails = instrument.includes("-PERP")
    ? {
        index: previousPerp?.index ?? "",
        funding_rate: fundingRate,
        aggregate_funding: previousPerp?.aggregate_funding ?? "0",
        max_rate_per_hour: previousPerp?.max_rate_per_hour ?? "0",
        min_rate_per_hour: previousPerp?.min_rate_per_hour ?? "0",
        static_interest_rate: previousPerp?.static_interest_rate ?? "0",
      }
    : undefined;

  const markPrice = toStringOrFallback(t.M, previous?.mark_price ?? previous?.last ?? "0");
  const bestBid = toStringOrFallback(t.b, previous?.best_bid ?? "0");
  const bestAsk = toStringOrFallback(t.a, previous?.best_ask ?? "0");
  const bestBidAmount = toStringOrFallback(t.B, previous?.best_bid_amount ?? previous?.best_bid_size ?? "0");
  const bestAskAmount = toStringOrFallback(t.A, previous?.best_ask_amount ?? previous?.best_ask_size ?? "0");
  const volumeValue = toStringOrFallback(tStats?.v, previous?.volume_value ?? "0");

  return {
    instrument_type: previous?.instrument_type ?? (instrument.includes("-PERP") ? "perp" : "option"),
    instrument_name: instrument,
    best_bid: bestBid,
    best_bid_amount: bestBidAmount,
    best_ask: bestAsk,
    best_ask_amount: bestAskAmount,
    timestamp,
    mark_price: markPrice,
    index_price: toStringOrFallback(t.I, previous?.index_price ?? "0"),
    min_price: toStringOrFallback(t.minp, previous?.min_price ?? "0"),
    max_price: toStringOrFallback(t.maxp, previous?.max_price ?? "0"),
    option_pricing: optionPricing,
    stats,
    perp_details: perpDetails,
    // Convenience aliases
    last: markPrice,
    change: stats.percent_change,
    high: stats.high,
    low: stats.low,
    open_interest: stats.open_interest,
    volume: stats.contract_volume,
    volume_value: volumeValue,
    best_bid_size: bestBidAmount,
    best_ask_size: bestAskAmount,
    funding_rate: fundingRate,
  };
}

/**
 * Singleton WebSocket manager for the Derive JSON-RPC API.
 * Handles connection lifecycle, auth, subscriptions, message routing, heartbeats, and reconnection.
 */
class DeriveWebSocketManager {
  private ws: WebSocket | null = null;
  private environment: DeriveEnvironment = "mainnet";
  private wallet: string | null = null;
  private signTimestamp: ((timestamp: string) => Promise<string>) | null = null;
  private isAuthenticated = false;
  private isReconnecting = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  // Subscriptions: channel -> Set of callbacks
  private subscriptions = new Map<string, Set<MessageHandler>>();
  // Reference counts for subscription management
  private refCounts = new Map<string, number>();

  // Pending RPC requests
  private pendingRequests = new Map<number, PendingRequest>();
  private nextId = 1;

  // rAF batching for high-freq updates
  private updateBuffer: Array<{ channel: string; data: unknown }> = [];
  private rafScheduled = false;

  // Subscription ack tracking: id -> { channel, timeout, retried }
  private pendingSubscribeAcks = new Map<
    number,
    { channel: string; timeout: ReturnType<typeof setTimeout>; retried?: boolean }
  >();

  // Reconnect verification: channels we've received data for since connect
  private receivedChannelsSinceConnect = new Set<string>();
  private reconnectVerifyTimer: ReturnType<typeof setTimeout> | null = null;

  // Debounced disconnect for React Strict Mode resilience
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(
    environment: DeriveEnvironment,
    wallet?: string,
    signFn?: (timestamp: string) => Promise<string>
  ): void {
    // Cancel any pending debounced disconnect (Strict Mode: unmount→mount happens fast)
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
      console.log("[WS] Cancelled pending disconnect (Strict Mode re-mount)");
    }

    // If already connected/connecting to the same environment, skip reconnection
    if (
      this.ws &&
      this.environment === environment &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      console.log("[WS] Already connected/connecting to same environment, skipping");
      // Update wallet/signFn in case they changed
      this.wallet = wallet ?? null;
      this.signTimestamp = signFn ?? null;
      return;
    }

    console.log(`[WS] connect() — new connection to ${environment}`);

    // Disconnect any existing connection first
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect logic from firing
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, "Reconnecting");
      }
      this.ws = null;
    }
    this.cleanup();

    this.environment = environment;
    this.wallet = wallet ?? null;
    this.signTimestamp = signFn ?? null;
    this.reconnectAttempt = 0;
    this.doConnect();
  }

  disconnect(): void {
    // Debounce disconnect to survive React Strict Mode's unmount→mount cycle.
    // In Strict Mode, cleanup runs synchronously between unmount and re-mount,
    // so a 0ms timeout defers the actual disconnect until after re-mount's
    // connect() has a chance to cancel it.
    console.log("[WS] disconnect() requested — debouncing...");
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
    }
    this.disconnectTimer = setTimeout(() => {
      this.disconnectTimer = null;
      console.log("[WS] Executing deferred disconnect");
      this.cleanup();
      if (this.ws) {
        this.ws.close(1000, "Client disconnect");
        this.ws = null;
      }
      useUiStore.getState().setWsConnected(false);
      this.isAuthenticated = false;
    }, 100);
  }

  /**
   * Subscribe to a WebSocket channel. Returns an unsubscribe function.
   * Sends the subscribe JSON-RPC message when the first handler registers
   * for a channel, OR when a handler re-registers for a channel that already
   * exists (to handle WS reconnection where the server-side sub was lost).
   */
  subscribe(channel: string, handler: MessageHandler): () => void {
    const isNewChannel = !this.subscriptions.has(channel);
    if (isNewChannel) {
      this.subscriptions.set(channel, new Set());
      this.refCounts.set(channel, 0);
    }

    this.subscriptions.get(channel)!.add(handler);
    const newCount = (this.refCounts.get(channel) || 0) + 1;
    this.refCounts.set(channel, newCount);

    // Send subscribe request:
    // - Always send for new channels (first subscriber)
    // - Also send if this is a re-subscription (e.g., after reconnect)
    //   because the server-side subscription was lost when WS reconnected
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (isNewChannel || newCount === 1) {
        console.log(`[WS] Sending subscribe for ${channel} (new=${isNewChannel}, count=${newCount})`);
        this.sendSubscribe(channel);
      }
    }

    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        handlers.delete(handler);
        const count = (this.refCounts.get(channel) || 1) - 1;
        this.refCounts.set(channel, count);

        // Last subscriber: send unsubscribe request
        if (count <= 0) {
          this.subscriptions.delete(channel);
          this.refCounts.delete(channel);
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendUnsubscribe(channel);
          }
        }
      }
    };
  }

  /**
   * Send a JSON-RPC request and wait for the response
   */
  async sendRpc<T = unknown>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = this.nextId++;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, 10_000);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      this.ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          method,
          params,
        })
      );
    });
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated;
  }

  // ── Private Methods ──

  private doConnect(): void {
    const url = DERIVE_ENVIRONMENTS[this.environment].wsUrl;

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.error("[WS] Failed to create WebSocket:", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log("[WS] Connected to", url);
      this.reconnectAttempt = 0;
      this.receivedChannelsSinceConnect = new Set<string>();
      this.startHeartbeat();

      // Authenticate if credentials available
      if (this.wallet && this.signTimestamp) {
        this.authenticate();
      } else {
        // Public-only connection
        useUiStore.getState().setWsConnected(true);
        this.resubscribeAll();
        this.scheduleReconnectVerify();
      }
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event);
    };

    this.ws.onclose = (event) => {
      console.log("[WS] Closed:", event.code, event.reason);
      useUiStore.getState().setWsConnected(false);
      this.isAuthenticated = false;
      this.cleanup();

      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      console.error("[WS] Error:", event);
    };
  }

  private async authenticate(): Promise<void> {
    if (!this.wallet || !this.signTimestamp) return;

    try {
      const timestamp = Date.now().toString();
      const signature = await this.signTimestamp(timestamp);

      await this.sendRpc("public/login", {
        wallet: this.wallet,
        timestamp,
        signature,
      });

      this.isAuthenticated = true;
      useUiStore.getState().setWsConnected(true);
      console.log("[WS] Authenticated");

      // Re-subscribe to all channels
      this.resubscribeAll();
      this.scheduleReconnectVerify();
    } catch (err) {
      console.error("[WS] Authentication failed:", err);
      this.isAuthenticated = false;
    }
  }

  private handleMessage(event: MessageEvent): void {
    let data: JsonRpcResponse;
    try {
      data = JSON.parse(event.data as string);
    } catch {
      return;
    }

    // Handle RPC responses (has id)
    if (data.id !== undefined && data.id !== null) {
      if (this.pendingRequests.has(data.id)) {
        const pending = this.pendingRequests.get(data.id)!;
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(data.id);

        if (data.error) {
          pending.reject(new Error(data.error.message));
        } else {
          pending.resolve(data.result);
        }
        return;
      }
      // Subscribe ack: server confirms subscription
      const ack = this.pendingSubscribeAcks.get(data.id as number);
      if (ack && !(data as { error?: unknown }).error) {
        clearTimeout(ack.timeout);
        this.pendingSubscribeAcks.delete(data.id as number);
        return;
      }
    }

    // Handle subscription updates (has method = "subscription")
    const raw = data as unknown as Record<string, unknown>;
    if (raw.method === "subscription") {
      const params = raw.params as {
        channel?: string;
        data?: unknown;
      } | undefined;
      if (params?.channel && params?.data) {
        recordQuoteMessageReceived();
        this.applyBackpressure();
        this.updateBuffer.push({
          channel: params.channel,
          data: params.data,
        });
        this.scheduleFlush();
      }
    }
  }

  /**
   * Backpressure: if buffer exceeds max, coalesce ticker_slim by instrument (keep latest) and trim.
   */
  private applyBackpressure(): void {
    if (this.updateBuffer.length < WS_UPDATE_BUFFER_MAX) return;
    const before = this.updateBuffer.length;
    const tickerByInstrument = new Map<string, { channel: string; data: unknown }>();
    const other: Array<{ channel: string; data: unknown }> = [];
    for (const entry of this.updateBuffer) {
      if (entry.channel.startsWith("ticker_slim.")) {
        const inst = extractTickerSlimInstrument(entry.channel);
        if (inst) tickerByInstrument.set(inst, entry);
      } else {
        other.push(entry);
      }
    }
    const coalesced = [...other, ...tickerByInstrument.values()];
    this.updateBuffer = coalesced.slice(-Math.floor(WS_UPDATE_BUFFER_MAX / 2));
    recordQuoteUpdatesDroppedByBackpressure(before - this.updateBuffer.length);
  }

  /**
   * rAF-based batching: accumulate WS updates and flush once per frame
   */
  private scheduleFlush(): void {
    if (this.rafScheduled) return;
    this.rafScheduled = true;

    requestAnimationFrame(() => {
      this.rafScheduled = false;
      const store = useMarketStore.getState();
      const buffer = this.updateBuffer;
      this.updateBuffer = [];
      const tickerUpdates = new Map<string, DeriveTicker>();

      for (const { channel, data } of buffer) {
        this.receivedChannelsSinceConnect.add(channel);

        // Dispatch to registered handlers
        const handlers = this.subscriptions.get(channel);
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(data);
            } catch (err) {
              console.error(`[WS] Handler error for ${channel}:`, err);
            }
          }
        }

        if (channel.startsWith("ticker_slim.")) {
          const instrument = extractTickerSlimInstrument(channel);
          if (!instrument) continue;
          const previous = tickerUpdates.get(instrument) ?? store.tickers.get(instrument);
          const normalized = normalizeTickerSlimUpdate(instrument, data, previous);
          if (normalized) {
            tickerUpdates.set(instrument, normalized);
          }
          continue;
        }

        // Auto-route non-ticker channels to stores immediately.
        this.routeToStore(channel, data);
      }

      if (tickerUpdates.size > 0) {
        recordQuoteTickerUpdatesApplied(tickerUpdates.size);
        store.updateTickersBulk(Array.from(tickerUpdates.entries()));
      }
    });
  }

  /**
   * Route incoming data to the appropriate Zustand store.
   *
   * Derive WS channel formats (dot-separated):
   *   ticker_slim.{instrument_name}.{interval}  → e.g. ticker_slim.ETH-PERP.100
   *   orderbook.{instrument_name}.{group}.{depth} → e.g. orderbook.ETH-PERP.1.100
   *   trades.{instrument_type}.{currency}.{tx_status} → e.g. trades.perp.ETH.settled
   */
  private routeToStore(channel: string, data: unknown): void {
    const store = useMarketStore.getState();

    if (channel.startsWith("orderbook.")) {
      // Channel: orderbook.ETH-PERP.1.100
      // Split by dots: ["orderbook", "ETH-PERP", "1", "100"]
      const parts = channel.split(".");
      const instrument = parts[1]; // e.g. "ETH-PERP"
      if (instrument) {
        store.updateOrderBook(instrument, data as Parameters<typeof store.updateOrderBook>[1]);
      }
    } else if (channel.startsWith("ticker_slim.")) {
      // ticker_slim updates are batched in scheduleFlush() to reduce re-renders.
      return;
    } else if (channel.startsWith("trades.")) {
      // Channel: trades.perp.ETH.settled
      // Trades are per-currency, not per-instrument. We pass the currency
      // and let the store route it to the right instrument.
      const parts = channel.split(".");
      const instrumentType = parts[1]; // "perp" or "option"
      const currency = parts[2]; // "ETH", "BTC", etc.
      const trades = data as Array<Record<string, unknown>>;
      if (Array.isArray(trades)) {
        for (const trade of trades) {
          // Each trade should have instrument_name
          const instName = (trade.instrument_name as string) || `${currency}-PERP`;
          store.addTrade(instName, trade as unknown as Parameters<typeof store.addTrade>[1]);
        }
      }
    }
  }

  private sendSubscribe(channel: string, isRetry = false): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const id = this.nextId++;
    const timeout = setTimeout(() => {
      const entry = this.pendingSubscribeAcks.get(id);
      this.pendingSubscribeAcks.delete(id);
      // Retry subscribe once if no ack and not already a retry
      if (entry && !entry.retried && this.subscriptions.has(channel) && this.ws?.readyState === WebSocket.OPEN) {
        recordQuoteSubscribeAckRetry();
        console.warn("[WS] Subscribe ack timeout, retrying:", channel);
        this.sendSubscribe(channel, true);
      }
    }, WS_SUBSCRIBE_ACK_TIMEOUT_MS);
    this.pendingSubscribeAcks.set(id, { channel, timeout, retried: isRetry });
    const msg = {
      jsonrpc: "2.0",
      id,
      method: "subscribe",
      params: { channels: [channel] },
    };
    console.log("[WS] → subscribe:", channel);
    this.ws.send(JSON.stringify(msg));
  }

  private sendUnsubscribe(channel: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg = {
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "unsubscribe",
      params: { channels: [channel] },
    };
    console.log("[WS] → unsubscribe:", channel);
    this.ws.send(JSON.stringify(msg));
  }

  private resubscribeAll(): void {
    const channels = Array.from(this.subscriptions.keys());
    console.log(`[WS] resubscribeAll: ${channels.length} channels`, channels);
    for (const channel of channels) {
      this.sendSubscribe(channel);
    }
  }

  /** Run 15s after connect: resubscribe any channel we didn't receive data on. */
  private scheduleReconnectVerify(): void {
    if (this.reconnectVerifyTimer) clearTimeout(this.reconnectVerifyTimer);
    this.reconnectVerifyTimer = setTimeout(() => {
      this.reconnectVerifyTimer = null;
      for (const channel of this.subscriptions.keys()) {
        if (!this.receivedChannelsSinceConnect.has(channel) && this.ws?.readyState === WebSocket.OPEN) {
          console.warn("[WS] Reconnect verify: no data for channel, resubscribing:", channel);
          this.sendSubscribe(channel);
        }
      }
    }, 15_000);
  }

  private startHeartbeat(): void {
    // Derive WS does not have a heartbeat/ping RPC method.
    // Subscription traffic keeps the connection alive.
    // We use a lightweight no-op ping to detect stale connections:
    // if the WS is no longer open, the onerror/onclose handlers
    // will trigger reconnection automatically.
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Send a minimal JSON-RPC call; even if the server rejects the
        // method, the round-trip confirms the TCP connection is alive.
        this.ws.send(JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method: "public/get_time", params: {} }));
      } else if (this.ws) {
        // Connection went stale — trigger reconnect
        console.log("[WS] Heartbeat detected stale connection, reconnecting...");
        this.ws.close(4000, "Heartbeat stale");
      }
    }, WS_HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    const delay = Math.min(
      WS_RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
      WS_RECONNECT_MAX_MS
    );
    this.reconnectAttempt++;
    recordQuoteReconnectAttempt();

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);

    this.reconnectTimer = setTimeout(() => {
      this.isReconnecting = false;
      this.doConnect();
    }, delay);
  }

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
    if (this.reconnectVerifyTimer) {
      clearTimeout(this.reconnectVerifyTimer);
      this.reconnectVerifyTimer = null;
    }
    for (const [, entry] of this.pendingSubscribeAcks) {
      clearTimeout(entry.timeout);
    }
    this.pendingSubscribeAcks.clear();
    // Clear pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("WebSocket closed"));
    }
    this.pendingRequests.clear();
  }
}

// Singleton
export const wsManager = new DeriveWebSocketManager();

// Debug: expose to window for troubleshooting (remove in production)
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__wsManager = wsManager;
}
