import Decimal from "decimal.js-light";

/**
 * Format a price string with proper decimals
 */
export function formatPrice(
  value: string | number,
  decimals: number = 2
): string {
  try {
    const d = new Decimal(value);
    return d.toFixed(decimals);
  } catch {
    return "—";
  }
}

/**
 * Format a USD value with $ prefix and commas
 */
export function formatUsd(value: string | number, decimals: number = 2): string {
  try {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "$—";

    const abs = Math.abs(num);
    const formatted = abs.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    return num < 0 ? `-$${formatted}` : `$${formatted}`;
  } catch {
    return "$—";
  }
}

/**
 * Format a quantity (amount) string
 */
export function formatQty(
  value: string | number,
  decimals: number = 4
): string {
  try {
    const d = new Decimal(value);
    // Remove trailing zeros
    const fixed = d.toFixed(decimals);
    return parseFloat(fixed).toString();
  } catch {
    return "—";
  }
}

/**
 * Format a percentage (input as decimal, e.g., 0.0203 → "+2.03%")
 */
export function formatPercent(value: string | number): string {
  try {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "—%";
    const pct = num * 100;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(2)}%`;
  } catch {
    return "—%";
  }
}

/**
 * Format a percentage that's already in percent form
 */
export function formatPercentRaw(value: string | number): string {
  try {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "—%";
    const sign = num >= 0 ? "+" : "";
    return `${sign}${num.toFixed(2)}%`;
  } catch {
    return "—%";
  }
}

/**
 * Format a Greek value (high precision, compact)
 */
export function formatGreek(value: string | number, decimals: number = 4): string {
  try {
    const d = new Decimal(value);
    if (d.isZero()) return "0";
    const abs = d.abs();
    // Very small values: use scientific notation
    if (abs.lt("0.0001")) {
      return d.toExponential(2);
    }
    return d.toFixed(decimals);
  } catch {
    return "—";
  }
}

/**
 * Format a timestamp to local time string
 */
export function formatTime(timestamp: string | number): string {
  try {
    const ts =
      typeof timestamp === "string"
        ? parseInt(timestamp) > 1e12
          ? parseInt(timestamp)
          : parseInt(timestamp) * 1000
        : timestamp > 1e12
          ? timestamp
          : timestamp * 1000;
    return new Date(ts).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * Format a timestamp to date+time
 */
export function formatDateTime(timestamp: string | number): string {
  try {
    const ts =
      typeof timestamp === "string"
        ? parseInt(timestamp) > 1e12
          ? parseInt(timestamp)
          : parseInt(timestamp) * 1000
        : timestamp > 1e12
          ? timestamp
          : timestamp * 1000;
    return new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

/**
 * Shorten a wallet address: 0x1234...5678
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Determine if a value is positive, negative, or zero
 */
export function valueSentiment(
  value: string | number
): "positive" | "negative" | "neutral" {
  try {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return "neutral";
    return num > 0 ? "positive" : "negative";
  } catch {
    return "neutral";
  }
}
