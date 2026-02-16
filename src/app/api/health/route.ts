import { NextResponse } from "next/server";

/**
 * Health check: upstream Derive API reachability.
 * Returns 200 when API responds, 503 when unreachable or error.
 */

const DERIVE_MAINNET = "https://api.lyra.finance";
const DERIVE_TESTNET = "https://api-demo.lyra.finance";

export async function GET() {
  const env = process.env.NEXT_PUBLIC_DERIVE_ENV || "mainnet";
  const baseUrl = env === "testnet" ? DERIVE_TESTNET : DERIVE_MAINNET;
  const url = `${baseUrl}/public/get_time`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { status: "unhealthy", error: `upstream ${res.status}` },
        { status: 503 }
      );
    }
    return NextResponse.json({ status: "ok", upstream: baseUrl });
  } catch (err) {
    return NextResponse.json(
      { status: "unhealthy", error: (err as Error).message },
      { status: 503 }
    );
  }
}
