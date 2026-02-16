/**
 * Internal error codes for Derive API failures (server-only).
 * Used for retries and observability; never expose raw Derive errors to client.
 */
export const DeriveErrorCode = {
  AUTH_FAILED: "DERIVE_AUTH_FAILED",
  RATE_LIMIT: "DERIVE_RATE_LIMIT",
  VALIDATION: "DERIVE_VALIDATION",
  NETWORK: "DERIVE_NETWORK",
  UNKNOWN: "DERIVE_UNKNOWN",
} as const;

export type DeriveErrorCodeType =
  (typeof DeriveErrorCode)[keyof typeof DeriveErrorCode];

export class ServerDeriveApiError extends Error {
  code: DeriveErrorCodeType;
  statusCode: number;
  method: string;
  retryable: boolean;

  constructor(
    message: string,
    code: DeriveErrorCodeType,
    method: string,
    statusCode: number = 500,
    retryable: boolean = false
  ) {
    super(message);
    this.name = "ServerDeriveApiError";
    this.code = code;
    this.method = method;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export function mapDeriveError(
  method: string,
  statusCode: number,
  message: string,
  deriveCode?: number
): ServerDeriveApiError {
  if (statusCode === 401) {
    return new ServerDeriveApiError(
      message || "Unauthorized",
      DeriveErrorCode.AUTH_FAILED,
      method,
      401,
      false
    );
  }
  if (statusCode === 429) {
    return new ServerDeriveApiError(
      message || "Rate limited",
      DeriveErrorCode.RATE_LIMIT,
      method,
      429,
      true
    );
  }
  if (statusCode >= 400 && statusCode < 500) {
    return new ServerDeriveApiError(
      message || "Bad request",
      DeriveErrorCode.VALIDATION,
      method,
      statusCode,
      false
    );
  }
  if (statusCode >= 500 || statusCode === 0) {
    return new ServerDeriveApiError(
      message || "Server error",
      DeriveErrorCode.NETWORK,
      method,
      statusCode || 502,
      true
    );
  }
  return new ServerDeriveApiError(
    message || "Unknown error",
    DeriveErrorCode.UNKNOWN,
    method,
    statusCode,
    false
  );
}
