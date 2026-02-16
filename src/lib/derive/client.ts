import { DERIVE_ENVIRONMENTS, DEFAULT_ENVIRONMENT, type DeriveEnvironment } from "./constants";

/**
 * Derive REST API client.
 *
 * In the browser, calls are proxied through /api/derive/... to avoid CORS.
 * On the server, calls go directly to https://api.lyra.finance/...
 *
 * The Derive API uses path-based routing:
 *   POST https://api.lyra.finance/{method}
 *   Body: JSON params (NOT JSON-RPC wrapper)
 *   Response: { result: T, id: string } or { error: { code, message, data } }
 *
 * Private endpoints require auth headers:
 *   X-LyraWallet: <derive_wallet_address>
 *   X-LyraTimestamp: <ms_since_epoch>
 *   X-LyraSignature: <session_key_signature_of_timestamp>
 */
export class DeriveClient {
  private directBaseUrl: string;
  private environment: DeriveEnvironment;
  private wallet: string | null = null;
  private signTimestamp: ((timestamp: string) => Promise<string>) | null = null;

  constructor(environment: DeriveEnvironment = DEFAULT_ENVIRONMENT) {
    this.environment = environment;
    this.directBaseUrl = DERIVE_ENVIRONMENTS[environment].httpUrl;
  }

  /**
   * Get the base URL — uses proxy in browser, direct URL on server.
   */
  private get baseUrl(): string {
    if (typeof window !== "undefined") {
      // In browser: proxy through Next.js server to avoid CORS
      return "/api/derive";
    }
    return this.directBaseUrl;
  }

  /**
   * Set authentication for private endpoints
   */
  setAuth(
    wallet: string,
    signFn: (timestamp: string) => Promise<string>
  ): void {
    this.wallet = wallet;
    this.signTimestamp = signFn;
  }

  clearAuth(): void {
    this.wallet = null;
    this.signTimestamp = null;
  }

  get isAuthenticated(): boolean {
    return this.wallet !== null && this.signTimestamp !== null;
  }

  /**
   * Switch environment
   */
  setEnvironment(environment: DeriveEnvironment): void {
    this.environment = environment;
    this.directBaseUrl = DERIVE_ENVIRONMENTS[environment].httpUrl;
  }

  /**
   * Make an API call.
   * Method should be like "public/get_instruments" or "private/get_account".
   * The method is appended to the base URL as a path.
   * Body is sent as raw JSON params (no JSON-RPC wrapper).
   */
  async call<T = unknown>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/${method}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Tell the proxy which environment to use
    if (typeof window !== "undefined") {
      headers["X-Derive-Env"] = this.environment;
    }

    // Add auth headers for private methods
    if (method.startsWith("private/") && this.wallet && this.signTimestamp) {
      const timestamp = Date.now().toString();
      const signature = await this.signTimestamp(timestamp);
      headers["X-LyraWallet"] = this.wallet;
      headers["X-LyraTimestamp"] = timestamp;
      headers["X-LyraSignature"] = signature;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new DeriveApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        -1,
        method
      );
    }

    const json = (await response.json()) as {
      result?: T;
      error?: { code: number; message: string; data?: unknown };
      id?: string;
    };

    if (json.error) {
      throw new DeriveApiError(
        json.error.message,
        json.error.code,
        method,
        json.error.data
      );
    }

    return json.result as T;
  }

  // ── Public Endpoints ──

  async getInstruments(params: {
    currency?: string;
    instrument_type?: string;
    expired?: boolean;
  } = {}) {
    return this.call("public/get_instruments", params);
  }

  async getTicker(instrument_name: string) {
    return this.call("public/get_ticker", { instrument_name });
  }

  async getTrades(instrument_name: string, count: number = 50) {
    return this.call("public/get_trade_history", { instrument_name, count });
  }

  async getIndexPrice(instrument_name: string) {
    return this.call("public/get_index", { instrument_name });
  }

  // ── Private Endpoints ──

  async getAccount() {
    return this.call("private/get_account", {});
  }

  async getSubaccount(subaccount_id: number) {
    return this.call("private/get_subaccount", { subaccount_id });
  }

  async getOpenOrders(subaccount_id: number) {
    return this.call("private/get_open_orders", { subaccount_id });
  }

  async getPositions(subaccount_id: number) {
    return this.call("private/get_positions", { subaccount_id });
  }

  async submitOrder(params: {
    subaccount_id: number;
    instrument_name: string;
    direction: string;
    order_type: string;
    amount: string;
    limit_price?: string;
    time_in_force?: string;
    max_fee?: string;
    label?: string;
    signature: string;
    nonce: number;
    signer: string;
    signature_expiry_sec: number;
  }) {
    return this.call("private/order", params);
  }

  async cancelOrder(order_id: string, subaccount_id: number) {
    return this.call("private/cancel", { order_id, subaccount_id });
  }

  async cancelAllOrders(subaccount_id: number) {
    return this.call("private/cancel_all", { subaccount_id });
  }

  async getMargin(params: {
    subaccount_id: number;
    simulated_position_changes?: unknown[];
  }) {
    return this.call("private/get_margin", params);
  }

  async getTradeHistory(params: {
    subaccount_id: number;
    instrument_name?: string;
    start_timestamp?: string;
    end_timestamp?: string;
  }) {
    return this.call("private/get_trade_history", params);
  }

  async getOrderHistory(params: {
    subaccount_id: number;
    instrument_name?: string;
    start_timestamp?: string;
    end_timestamp?: string;
  }) {
    return this.call("private/get_order_history", params);
  }

  // ── Deposits & Withdrawals ──

  async getTransferHistory(params: {
    subaccount_id: number;
    start_timestamp?: string;
    end_timestamp?: string;
  }) {
    return this.call("private/get_transfer_history", params);
  }

  async getCollaterals(subaccount_id: number) {
    return this.call("private/get_collaterals", { subaccount_id });
  }

  /** Deposit to existing subaccount. Caller must sign EIP-712 action and pass signature. */
  async deposit(params: {
    subaccount_id: number;
    amount: string;
    asset_name: string;
    nonce: number;
    signature: string;
    signature_expiry_sec: number;
    signer: string;
  }) {
    return this.call<{ status: string; transaction_id: string }>(
      "private/deposit",
      params
    );
  }

  /** Withdraw from subaccount. Caller must sign EIP-712 action and pass signature. */
  async withdraw(params: {
    subaccount_id: number;
    amount: string;
    asset_name: string;
    nonce: number;
    signature: string;
    signature_expiry_sec: number;
    signer: string;
  }) {
    return this.call<{ status: string; transaction_id: string }>(
      "private/withdraw",
      params
    );
  }

  // ── Session Key Registration ──

  async buildRegisterSessionKeyTx(params: {
    wallet: string;
    public_session_key: string;
    expiry_sec: number;
    label: string;
  }) {
    return this.call("public/build_register_session_key_tx", params);
  }

  async registerSessionKey(params: {
    wallet: string;
    public_session_key: string;
    expiry_sec: number;
    label: string;
    signed_raw_tx: string;
  }) {
    return this.call("public/register_session_key", params);
  }

  // ── RFQ ──

  async sendRfq(params: {
    subaccount_id: number;
    legs: unknown[];
    label?: string;
    signature: string;
    nonce: number;
    signer: string;
  }) {
    return this.call("private/send_rfq", params);
  }

  async pollQuotes(rfq_id: string) {
    return this.call("private/poll_quotes", { rfq_id });
  }

  async executeQuote(params: {
    rfq_id: string;
    quote_id: string;
    subaccount_id: number;
    signature: string;
    nonce: number;
    signer: string;
  }) {
    return this.call("private/execute_quote", params);
  }
}

export class DeriveApiError extends Error {
  code: number;
  method: string;
  data?: unknown;

  constructor(message: string, code: number, method: string, data?: unknown) {
    super(`[${method}] ${message}`);
    this.name = "DeriveApiError";
    this.code = code;
    this.method = method;
    this.data = data;
  }
}

// Default singleton instance
export const deriveClient = new DeriveClient();
