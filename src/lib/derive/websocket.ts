import {
  WS_HEARTBEAT_INTERVAL_MS,
  WS_RECONNECT_BASE_MS,
  WS_RECONNECT_MAX_MS,
  DERIVE_ENVIRONMENTS,
  type DeriveEnvironment,
} from "./constants";
import type { JsonRpcResponse } from "./types";
import { useMarketStore } from "../stores/marketStore";
import { useUiStore } from "../stores/uiStore";

type MessageHandler = (data: unknown) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
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
      this.startHeartbeat();

      // Authenticate if credentials available
      if (this.wallet && this.signTimestamp) {
        this.authenticate();
      } else {
        // Public-only connection
        useUiStore.getState().setWsConnected(true);
        this.resubscribeAll();
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
    if (data.id && this.pendingRequests.has(data.id)) {
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

    // Handle subscription updates (has method = "subscription")
    const raw = data as unknown as Record<string, unknown>;
    if (raw.method === "subscription") {
      const params = raw.params as {
        channel?: string;
        data?: unknown;
      } | undefined;
      if (params?.channel && params?.data) {
        // Buffer for rAF batching
        this.updateBuffer.push({
          channel: params.channel,
          data: params.data,
        });
        this.scheduleFlush();
      }
    }
  }

  /**
   * rAF-based batching: accumulate WS updates and flush once per frame
   */
  private scheduleFlush(): void {
    if (this.rafScheduled) return;
    this.rafScheduled = true;

    requestAnimationFrame(() => {
      this.rafScheduled = false;
      const buffer = this.updateBuffer;
      this.updateBuffer = [];

      for (const { channel, data } of buffer) {
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

        // Auto-route to stores based on channel prefix
        this.routeToStore(channel, data);
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
      // Channel: ticker_slim.ETH-PERP.100
      const parts = channel.split(".");
      const instrument = parts[1]; // e.g. "ETH-PERP"
      if (!instrument) return;

      // ticker_slim data uses abbreviated keys inside data.instrument_ticker:
      //   A = best_ask_amount, a = best_ask_price
      //   B = best_bid_amount, b = best_bid_price
      //   f = funding_rate
      //   I = index_price, M = mark_price
      //   stats.c = contract_volume, stats.v = volume_value
      //   stats.n = num_trades, stats.oi = open_interest
      //   stats.h = high, stats.l = low, stats.p = percent_change
      //   stats.pr = previous volume
      //   minp = min_price, maxp = max_price
      const wrapper = data as { timestamp?: number; instrument_ticker?: Record<string, unknown> };
      const t = wrapper.instrument_ticker;
      if (!t) return;

      const tStats = t.stats as Record<string, string | number> | undefined;

      const stats = {
        contract_volume: String(tStats?.c || "0"),
        num_trades: String(tStats?.n || "0"),
        open_interest: String(tStats?.oi || "0"),
        high: String(tStats?.h || "0"),
        low: String(tStats?.l || "0"),
        percent_change: String(tStats?.p || "0"),
        usd_change: "0",
      };

      const normalized = {
        instrument_type: instrument.includes("-PERP") ? "perp" : "option",
        instrument_name: instrument,
        best_bid: String(t.b || "0"),
        best_bid_amount: String(t.B || "0"),
        best_ask: String(t.a || "0"),
        best_ask_amount: String(t.A || "0"),
        timestamp: wrapper.timestamp || (t.t as number) || Date.now(),
        mark_price: String(t.M || "0"),
        index_price: String(t.I || "0"),
        min_price: String(t.minp || "0"),
        max_price: String(t.maxp || "0"),
        option_pricing: t.option_pricing || null,
        stats,
        perp_details: t.f ? {
          index: "",
          funding_rate: String(t.f || "0"),
          aggregate_funding: "0",
          max_rate_per_hour: "0",
          min_rate_per_hour: "0",
          static_interest_rate: "0",
        } : undefined,
        // Convenience aliases
        last: String(t.M || "0"),
        change: String(tStats?.p || "0"),
        high: String(tStats?.h || "0"),
        low: String(tStats?.l || "0"),
        open_interest: String(tStats?.oi || "0"),
        volume: String(tStats?.c || "0"),
        volume_value: String(tStats?.v || "0"),
        best_bid_size: String(t.B || "0"),
        best_ask_size: String(t.A || "0"),
        funding_rate: String(t.f || "0"),
      };

      store.updateTicker(instrument, normalized as Parameters<typeof store.updateTicker>[1]);
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

  private sendSubscribe(channel: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg = {
      jsonrpc: "2.0",
      id: this.nextId++,
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
