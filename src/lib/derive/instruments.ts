import type { ParsedInstrument } from "./types";

/**
 * Parse a Derive instrument name into structured data.
 *
 * Formats:
 *   Perpetual: "ETH-PERP"
 *   Option:    "ETH-20260227-2500-C"
 *   Spot:      "ETH-USD"
 */
export function parseInstrumentName(name: string): ParsedInstrument {
  const raw = name;

  // Perpetual: contains "PERP"
  if (name.includes("PERP")) {
    const underlying = name.split("-")[0] || name.replace(/USD.*PERP.*/, "");
    return {
      underlying: underlying.toUpperCase(),
      quoteCurrency: "USD",
      type: "perpetual",
      raw,
    };
  }

  // Option: UNDERLYING-YYYYMMDD-STRIKE-C/P
  const optionMatch = name.match(
    /^(\w+)-(\d{8})-(\d+(?:\.\d+)?)-([CP])$/i
  );
  if (optionMatch) {
    const [, underlying, expiryStr, strikeStr, optType] = optionMatch;
    const year = parseInt(expiryStr.slice(0, 4));
    const month = parseInt(expiryStr.slice(4, 6)) - 1;
    const day = parseInt(expiryStr.slice(6, 8));

    return {
      underlying: underlying.toUpperCase(),
      quoteCurrency: "USD",
      type: "option",
      expiry: new Date(Date.UTC(year, month, day, 8, 0, 0)), // 8 AM UTC settlement
      strike: parseFloat(strikeStr),
      optionType: optType.toUpperCase() === "C" ? "call" : "put",
      raw,
    };
  }

  // Fallback: treat as spot or unknown
  const parts = name.split("-");
  return {
    underlying: (parts[0] || name).toUpperCase(),
    quoteCurrency: parts[1] || "USD",
    type: "perpetual", // fallback
    raw,
  };
}

/**
 * Format expiry date for display: "27 Feb 2026"
 */
export function formatExpiry(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Format expiry as compact: "27Feb26"
 */
export function formatExpiryCompact(date: Date): string {
  const day = date.getUTCDate();
  const month = date.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const year = date.getUTCFullYear().toString().slice(2);
  return `${day}${month}${year}`;
}

/**
 * Days to expiry from now
 */
export function daysToExpiry(expiry: Date): number {
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  return Math.max(0, diff / (1000 * 60 * 60 * 24));
}

/**
 * Group instruments by underlying and expiry
 */
export function groupOptionsByExpiry(
  instruments: ParsedInstrument[]
): Map<string, Map<string, ParsedInstrument[]>> {
  const grouped = new Map<string, Map<string, ParsedInstrument[]>>();

  for (const inst of instruments) {
    if (inst.type !== "option" || !inst.expiry) continue;

    const underlying = inst.underlying;
    const expiryKey = inst.expiry.toISOString().split("T")[0]!;

    if (!grouped.has(underlying)) {
      grouped.set(underlying, new Map());
    }
    const byExpiry = grouped.get(underlying)!;

    if (!byExpiry.has(expiryKey)) {
      byExpiry.set(expiryKey, []);
    }
    byExpiry.get(expiryKey)!.push(inst);
  }

  return grouped;
}
