/**
 * Backend-only Derive REST client.
 * Uses direct API URL, auth header generation, retries, and internal error mapping.
 * Do not import from client-side code.
 */

import { DERIVE_ENVIRONMENTS, type DeriveEnvironment } from "@/lib/derive/constants";
import {
  ServerDeriveApiError,
  mapDeriveError,
  DeriveErrorCode,
} from "./errors";

const DEFAULT_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export interface BackendDeriveAuth {
  wallet: string;
  signMessage: (timestamp: string) => Promise<string>;
}

export interface CallOptions {
  idempotencyKey?: string;
  retries?: number;
}

export interface CreateAccountResult {
  status: "created" | "exists";
  wallet: string;
}

export interface CreateSubaccountParams {
  wallet: string;
  signer: string;
  margin_type: "SM" | "PM" | "PM2";
  amount: string;
  asset_name: string;
  nonce: number;
  signature: string;
  signature_expiry_sec: number;
  currency?: string;
}

export interface CreateSubaccountResult {
  status: string;
  transaction_id: string;
}

export interface SubaccountInfo {
  subaccount_id: number;
  [key: string]: unknown;
}

export class BackendDeriveClient {
  private baseUrl: string;
  private auth: BackendDeriveAuth | null = null;

  constructor(environment: DeriveEnvironment = "mainnet") {
    this.baseUrl = DERIVE_ENVIRONMENTS[environment].httpUrl;
  }

  setAuth(auth: BackendDeriveAuth): void {
    this.auth = auth;
  }

  clearAuth(): void {
    this.auth = null;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    if (!this.auth) throw new ServerDeriveApiError("Not authenticated", DeriveErrorCode.AUTH_FAILED, "auth", 401, false);
    const timestamp = Date.now().toString();
    const signature = await this.auth.signMessage(timestamp);
    return {
      "X-LyraWallet": this.auth.wallet,
      "X-LyraTimestamp": timestamp,
      "X-LyraSignature": signature,
    };
  }

  async call<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    options: CallOptions = {}
  ): Promise<T> {
    const { idempotencyKey, retries = DEFAULT_RETRIES } = options;
    const url = `${this.baseUrl}/${method}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (method.startsWith("private/") && this.auth) {
      Object.assign(headers, await this.authHeaders());
    }
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    let lastError: ServerDeriveApiError | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });
        const json = (await res.json()) as {
          result?: T;
          error?: { code: number; message: string; data?: unknown };
        };

        if (json.error) {
          const err = mapDeriveError(
            method,
            res.status,
            json.error.message,
            json.error.code
          );
          if (!err.retryable || attempt === retries) throw err;
          lastError = err;
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }

        if (!res.ok) {
          const err = mapDeriveError(method, res.status, res.statusText);
          if (!err.retryable || attempt === retries) throw err;
          lastError = err;
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }

        return json.result as T;
      } catch (e) {
        if (e instanceof ServerDeriveApiError) {
          if (!e.retryable || attempt === retries) throw e;
          lastError = e;
          await sleep(RETRY_DELAY_MS * (attempt + 1));
        } else {
          const err = mapDeriveError(method, 0, (e as Error).message);
          if (attempt === retries) throw err;
          lastError = err;
          await sleep(RETRY_DELAY_MS * (attempt + 1));
        }
      }
    }
    throw lastError ?? mapDeriveError(method, 500, "Unknown error");
  }

  async createAccount(wallet: string): Promise<CreateAccountResult> {
    const result = await this.call<CreateAccountResult>(
      "public/create_account",
      { wallet }
    );
    return result;
  }

  async getSubaccounts(): Promise<{ subaccounts: SubaccountInfo[] }> {
    if (!this.auth) throw new ServerDeriveApiError("Auth required", DeriveErrorCode.AUTH_FAILED, "get_subaccounts", 401, false);
    const result = await this.call<{ subaccounts: SubaccountInfo[] }>(
      "private/get_subaccounts",
      { wallet: this.auth.wallet }
    );
    return result;
  }

  async createSubaccount(
    params: CreateSubaccountParams,
    idempotencyKey?: string
  ): Promise<CreateSubaccountResult> {
    const result = await this.call<CreateSubaccountResult>(
      "private/create_subaccount",
      params as unknown as Record<string, unknown>,
      { idempotencyKey, retries: 1 }
    );
    return result;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
