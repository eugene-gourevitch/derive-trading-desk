import { NextRequest, NextResponse } from "next/server";
import { getOnboardingSigner } from "@/lib/server/signer";
import { startOnboarding, recordToStatus } from "@/lib/server/onboarding";
import { checkRateLimit, auditLog } from "@/lib/server/security";
import type { DeriveEnvironment } from "@/lib/derive/constants";

export async function POST(request: NextRequest) {
  const limit = await checkRateLimit(request);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: limit.retryAfter },
      { status: 429, headers: limit.retryAfter ? { "Retry-After": String(limit.retryAfter) } : undefined }
    );
  }

  const signer = getOnboardingSigner();
  if (!signer) {
    return NextResponse.json(
      { error: "Onboarding signer not configured (set ONBOARDING_SIGNER_PRIVATE_KEY or KMS)" },
      { status: 503 }
    );
  }

  let env: DeriveEnvironment = "mainnet";
  try {
    const body = await request.json().catch(() => ({}));
    if (body.environment === "testnet") env = "testnet";
  } catch {
    // keep default
  }

  try {
    const record = await startOnboarding(signer, env);
    auditLog("onboarding_start", {
      onboardingId: record.id,
      wallet: record.wallet,
      state: record.state,
      keyVersion: signer.getKeyVersion?.(),
    });
    const status = recordToStatus(record);
    return NextResponse.json({
      id: record.id,
      status,
      state: record.state,
      subaccountId: record.subaccountId,
      transactionId: record.transactionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    auditLog("onboarding_failed", { error: message });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
