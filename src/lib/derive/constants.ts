export const DERIVE_ENVIRONMENTS = {
  mainnet: {
    httpUrl: "https://api.lyra.finance",
    wsUrl: "wss://api.lyra.finance/ws",
    chainId: 957,
    rpcUrl: "https://rpc.derive.xyz",
    explorerUrl: "https://explorer.derive.xyz",
    name: "Derive Mainnet",
  },
  testnet: {
    httpUrl: "https://api-demo.lyra.finance",
    wsUrl: "wss://api-demo.lyra.finance/ws",
    chainId: 901,
    rpcUrl: "https://rpc-demo.derive.xyz",
    explorerUrl: "https://explorer-demo.derive.xyz",
    name: "Derive Testnet",
  },
} as const;

export type DeriveEnvironment = keyof typeof DERIVE_ENVIRONMENTS;

export const DEFAULT_ENVIRONMENT: DeriveEnvironment = "mainnet";

// EIP-712 domain for action signing
export const DERIVE_SIGNING_DOMAIN = {
  name: "Derive",
  version: "1",
  chainId: 957,
} as const;

// Session key defaults
export const SESSION_KEY_EXPIRY_SECONDS = 86400; // 24 hours
export const SESSION_KEY_LABEL = "derive-trading-desk";

// WebSocket config
export const WS_HEARTBEAT_INTERVAL_MS = 10_000;
export const WS_RECONNECT_BASE_MS = 1_000;
export const WS_RECONNECT_MAX_MS = 30_000;

// Quote correctness: reject ticker updates older than this (ms)
export const TICKER_STALE_TTL_MS = 60_000;
// UI: show "stale" when ticker age exceeds this (ms)
export const TICKER_STALE_UI_MS = 30_000;
// Subscription ack: retry subscribe if no response within this (ms)
export const WS_SUBSCRIBE_ACK_TIMEOUT_MS = 5_000;

// Backpressure: max buffered WS updates before coalescing/drop
export const WS_UPDATE_BUFFER_MAX = 2000;

// UI defaults
export const DEFAULT_ORDERBOOK_DEPTH = 20;
export const DEFAULT_TRADES_COUNT = 50;
export const CANDLE_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type CandleTimeframe = (typeof CANDLE_TIMEFRAMES)[number];
