// ─── Instrument Types ───

export type InstrumentType = "perp" | "option" | "erc20";
export type OptionType = "C" | "P";
export type OrderSide = "buy" | "sell";
export type OrderType = "limit" | "market";
export type OrderStatus = "open" | "filled" | "cancelled" | "expired" | "rejected";
export type TimeInForce = "gtc" | "ioc" | "fok" | "post_only";
export type MarginType = "PM" | "PM2" | "SM";

/**
 * Instrument as returned by public/get_instruments.
 * Real API response shape from api.lyra.finance.
 */
export interface DeriveInstrument {
  instrument_type: InstrumentType;
  instrument_name: string;
  scheduled_activation: number;
  scheduled_deactivation: number;
  is_active: boolean;
  tick_size: string;
  minimum_amount: string;
  maximum_amount: string;
  amount_step: string;
  mark_price_fee_rate_cap: string;
  maker_fee_rate: string;
  taker_fee_rate: string;
  base_fee: string;
  base_currency: string;
  quote_currency: string;
  option_details: {
    index: string;
    expiry: number;
    strike: string;
    option_type: OptionType;
    settlement_price: string | null;
  } | null;
  perp_details: {
    index: string;
    max_rate_per_hour: string;
    min_rate_per_hour: string;
    static_interest_rate: string;
    aggregate_funding: string;
    funding_rate: string;
  } | null;
  erc20_details: unknown | null;
  base_asset_address: string;
  base_asset_sub_id: string;
  pro_rata_fraction: string;
  fifo_min_allocation: string;
  pro_rata_amount_step: string;
}

// ─── Ticker ───

export interface OptionPricing {
  delta: string;
  gamma: string;
  vega: string;
  theta: string;
  rho: string;
  iv: string;
  bid_iv: string;
  ask_iv: string;
  mark_price: string;
  forward_price: string;
}

/**
 * Ticker as returned by public/get_ticker.
 * Includes full instrument info + pricing + stats.
 */
export interface DeriveTicker {
  instrument_type: InstrumentType;
  instrument_name: string;
  best_bid: string;
  best_bid_amount: string;
  best_ask: string;
  best_ask_amount: string;
  timestamp: number;
  mark_price: string;
  index_price: string;
  min_price: string;
  max_price: string;
  option_pricing: OptionPricing | null;
  stats: {
    contract_volume: string;
    num_trades: string;
    open_interest: string;
    high: string;
    low: string;
    percent_change: string;
    usd_change: string;
  };
  // Perp-specific
  perp_details?: {
    index: string;
    funding_rate: string;
    aggregate_funding: string;
    max_rate_per_hour: string;
    min_rate_per_hour: string;
    static_interest_rate: string;
  };
  // Convenience aliases used in components (mapped from stats)
  last?: string;
  change?: string;
  high?: string;
  low?: string;
  open_interest?: string;
  volume?: string;
  volume_value?: string;
  best_bid_size?: string;
  best_ask_size?: string;
  funding_rate?: string;
}

// ─── Order Book ───

export interface OrderBookLevel {
  price: string;
  qty: string;
}

export interface DeriveOrderBook {
  instrument_name: string;
  depth: number;
  timestamp: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

// ─── Trades ───

export interface DeriveTrade {
  trade_id: string;
  instrument_name: string;
  trade_price: string;
  trade_amount: string;
  direction: OrderSide;
  timestamp: number;
  mark_price: string;
  index_price: string;
  // Convenience aliases used in components
  price?: string;
  qty?: string;
  side?: OrderSide;
}

// ─── Candlestick ───

export interface DeriveCandle {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  volume_usd: string;
  timestamp: string;
}

// ─── Position ───

export interface DerivePosition {
  instrument_name: string;
  instrument_type: string;
  amount: string;
  average_price: string;
  mark_price: string;
  mark_value: string;
  index_price: string;
  liquidation_price: string | null;
  delta: string;
  gamma: string;
  theta: string;
  vega: string;
  initial_margin: string;
  maintenance_margin: string;
  open_orders_margin: string;
  realized_pnl: string;
  unrealized_pnl: string;
  total_fees: string;
  cumulative_funding: string;
  pending_funding: string;
  leverage: string | null;
  creation_timestamp: string;
}

// ─── Collateral ───

export interface DeriveCollateral {
  asset_name: string;
  amount: string;
  mark_price: string;
  mark_value: string;
  initial_margin_factor: string;
  maintenance_margin_factor: string;
}

// ─── Order ───

export interface DeriveOrder {
  order_id: string;
  instrument_name: string;
  direction: OrderSide;
  order_type: string;
  time_in_force: string;
  limit_price: string;
  amount: string;
  filled_amount: string;
  average_price: string;
  max_fee: string;
  status: OrderStatus;
  label: string;
  creation_timestamp: string;
  last_update_timestamp: string;
  cancel_reason?: string;
}

// ─── Subaccount ───

export interface DeriveSubaccount {
  subaccount_id: number;
  currency: string;
  margin_type: MarginType;
  label: string;
  subaccount_value: string;
  collaterals_value: string;
  positions_value: string;
  initial_margin: string;
  maintenance_margin: string;
  open_orders_margin: string;
  is_under_liquidation: boolean;
  collaterals: DeriveCollateral[];
  positions: DerivePosition[];
  open_orders: DeriveOrder[];
}

// ─── Account ───

export interface DeriveAccount {
  wallet: string;
  subaccount_ids: number[];
  default_subaccount_id: number;
}

// ─── Deposit / Withdraw ───

export type TransferStatus = "pending" | "confirmed" | "failed";

export interface DepositParams {
  subaccount_id: number;
  asset_name: string;
  amount: string;
}

export interface WithdrawParams {
  subaccount_id: number;
  asset_name: string;
  amount: string;
  nonce: number;
  signature: string;
  signer: string;
  signature_expiry_sec: number;
}

export interface TransferRecord {
  transfer_id: string;
  asset_name: string;
  amount: string;
  direction: "deposit" | "withdraw";
  status: TransferStatus;
  tx_hash?: string;
  timestamp: string;
}

export const SUPPORTED_COLLATERALS = [
  { name: "USDC", symbol: "USDC", decimals: 6, icon: "💵" },
  { name: "ETH", symbol: "ETH", decimals: 18, icon: "Ξ" },
  { name: "WBTC", symbol: "WBTC", decimals: 8, icon: "₿" },
  { name: "WEETH", symbol: "weETH", decimals: 18, icon: "🔷" },
  { name: "USDT", symbol: "USDT", decimals: 6, icon: "💲" },
] as const;

export type SupportedCollateral = (typeof SUPPORTED_COLLATERALS)[number]["name"];

// ─── JSON-RPC ───

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: Record<string, unknown>;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ─── Parsed Instrument ───

export interface ParsedInstrument {
  underlying: string;
  quoteCurrency: string;
  type: "perpetual" | "future" | "option";
  expiry?: Date;
  strike?: number;
  optionType?: "call" | "put";
  raw: string;
}

// ─── Order Submission ───

export interface OrderParams {
  instrument_name: string;
  direction: OrderSide;
  order_type: OrderType;
  amount: string;
  limit_price?: string;
  time_in_force?: TimeInForce;
  max_fee?: string;
  label?: string;
  reduce_only?: boolean;
}

// ─── RFQ ───

export interface RfqLeg {
  instrument_name: string;
  direction: OrderSide;
  amount: string;
}

export interface RfqParams {
  legs: RfqLeg[];
  label?: string;
}

export interface RfqQuote {
  rfq_id: string;
  legs: Array<{
    instrument_name: string;
    direction: OrderSide;
    amount: string;
    price: string;
  }>;
  total_price: string;
  creation_timestamp: string;
  valid_until: string;
}
