import { NextRequest, NextResponse } from "next/server";
import { getOnboarding, recordToStatus } from "@/lib/server/onboarding";
import { checkRateLimit } from "@/lib/server/security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limit = await checkRateLimit(request);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: limit.retryAfter },
      { status: 429, headers: limit.retryAfter ? { "Retry-After": String(limit.retryAfter) } : undefined }
    );
  }
  const { id } = await params;
  const record = await getOnboarding(id);
  const status = recordToStatus(record);
  return NextResponse.json({
    id,
    status,
    state: record?.state,
    subaccountId: record?.subaccountId,
    transactionId: record?.transactionId,
    error: record?.error,
  });
}
