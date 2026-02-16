/**
 * Cryptographically secure random for nonces and tokens.
 * Uses crypto.getRandomValues (browser and Node 19+).
 */

/**
 * Returns a secure random integer in [0, max).
 * Uses rejection-free modulo; slight bias for max not dividing 2^32 is acceptable for nonce use.
 */
export function secureRandomInt(max: number): number {
  if (max <= 0 || max > 2 ** 32) throw new RangeError("secureRandomInt: max must be in (0, 2^32]");
  const array = new Uint32Array(1);
  getCrypto().getRandomValues(array);
  return array[0] % max;
}

/**
 * Returns a secure random hex string of length byteCount*2 (e.g. 4 -> 8 hex chars).
 */
export function secureRandomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  getCrypto().getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getCrypto(): Crypto {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    return globalThis.crypto;
  }
  throw new Error("secureRandomInt: crypto.getRandomValues not available");
}
