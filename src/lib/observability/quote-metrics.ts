/**
 * In-memory quote pipeline metrics for observability.
 * Incremented from websocket and options chain; readable from client or API for dashboards.
 */

export interface QuotePipelineMetrics {
  messagesReceived: number;
  updatesDroppedByBackpressure: number;
  deadLetterChannelParse: number;
  reconnectAttempts: number;
  subscribeAckRetries: number;
  tickerUpdatesApplied: number;
}

const metrics: QuotePipelineMetrics = {
  messagesReceived: 0,
  updatesDroppedByBackpressure: 0,
  deadLetterChannelParse: 0,
  reconnectAttempts: 0,
  subscribeAckRetries: 0,
  tickerUpdatesApplied: 0,
};

export function getQuotePipelineMetrics(): Readonly<QuotePipelineMetrics> {
  return { ...metrics };
}

export function recordQuoteMessageReceived(): void {
  metrics.messagesReceived++;
}

export function recordQuoteUpdatesDroppedByBackpressure(count: number): void {
  metrics.updatesDroppedByBackpressure += count;
}

export function recordQuoteDeadLetterChannel(): void {
  metrics.deadLetterChannelParse++;
}

export function recordQuoteReconnectAttempt(): void {
  metrics.reconnectAttempts++;
}

export function recordQuoteSubscribeAckRetry(): void {
  metrics.subscribeAckRetries++;
}

export function recordQuoteTickerUpdatesApplied(count: number): void {
  metrics.tickerUpdatesApplied += count;
}
