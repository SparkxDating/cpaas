export interface SendSmsInput {
  to: string;
  from?: string;
  body: string;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
}

export interface SendSmsResult {
  providerMessageId: string;
  status: "queued" | "sent" | "failed";
  raw?: unknown;
}

export interface BalanceResult {
  currency: string;
  balance: number;
  raw?: unknown;
}

export interface DeliveryStatusResult {
  providerMessageId: string;
  status: string;
  raw?: unknown;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  message?: string;
}

export interface SmsProviderAdapter {
  readonly name: string;
  sendSMS(input: SendSmsInput): Promise<SendSmsResult>;
  checkBalance(): Promise<BalanceResult>;
  deliveryStatus(providerMessageId: string): Promise<DeliveryStatusResult>;
  healthCheck(): Promise<HealthCheckResult>;
}
