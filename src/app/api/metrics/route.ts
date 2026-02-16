import { NextResponse } from "next/server";
import { getOnboardingMetrics } from "@/lib/server/observability";
import { getQuotePipelineMetrics } from "@/lib/observability/quote-metrics";

/**
 * Metrics endpoint for dashboards and scraping.
 * Returns onboarding metrics (server) and quote pipeline metrics (client-updated, 0 on server unless reported).
 */

export async function GET() {
  const onboarding = getOnboardingMetrics();
  const quote = getQuotePipelineMetrics();
  return NextResponse.json({
    onboarding: {
      started: onboarding.started,
      completed: onboarding.completed,
      failed: onboarding.failed,
      successRate: onboarding.successRate,
      medianDurationMs: onboarding.medianDurationMs,
      failureReasons: onboarding.failureReasons,
    },
    quotePipeline: quote,
  });
}
