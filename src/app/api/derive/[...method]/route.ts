import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for Derive API calls.
 * Bypasses CORS restrictions by proxying through Next.js server.
 *
 * Usage: POST /api/derive/public/get_instruments
 *        Body: { currency: "ETH", instrument_type: "perp", expired: false }
 *
 * The [...method] catch-all captures the full API path like "public/get_instruments"
 * and forwards to https://api.lyra.finance/public/get_instruments
 */

const DERIVE_API_URLS: Record<string, string> = {
  mainnet: "https://api.lyra.finance",
  testnet: "https://api-demo.lyra.finance",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ method: string[] }> }
) {
  const { method } = await params;
  const methodPath = method.join("/");
  const env = request.headers.get("x-derive-env") || "mainnet";
  const baseUrl = DERIVE_API_URLS[env] || DERIVE_API_URLS.mainnet;
  const url = `${baseUrl}/${methodPath}`;

  try {
    const body = await request.json().catch(() => ({}));

    // Forward auth headers if present
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const lyraWallet = request.headers.get("x-lyrawallet");
    const lyraTimestamp = request.headers.get("x-lyratimestamp");
    const lyraSignature = request.headers.get("x-lyrasignature");

    if (lyraWallet) headers["X-LyraWallet"] = lyraWallet;
    if (lyraTimestamp) headers["X-LyraTimestamp"] = lyraTimestamp;
    if (lyraSignature) headers["X-LyraSignature"] = lyraSignature;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`[Derive Proxy] Error proxying ${methodPath}:`, error);
    return NextResponse.json(
      { error: { code: -1, message: `Proxy error: ${(error as Error).message}` } },
      { status: 502 }
    );
  }
}
