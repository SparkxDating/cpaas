export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function assert(condition: unknown, code: string, message: string, status = 400): asserts condition {
  if (!condition) {
    throw new AppError(code, message, status);
  }
}

export function toE164(input: string): string {
  const cleaned = input.replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) {
    throw new AppError("invalid_phone", "Phone number must be E.164 (start with +)", 422);
  }
  if (cleaned.length < 8 || cleaned.length > 16) {
    throw new AppError("invalid_phone", "Phone number length is invalid", 422);
  }
  return cleaned;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function moneyMinorToMajor(minor: number | bigint, currency = "USD"): string {
  const n = typeof minor === "bigint" ? Number(minor) : minor;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n / 100);
}

export function detectCountryFromE164(e164: string): string | null {
  // Minimal prefix map for routing; extend as needed
  if (e164.startsWith("+1")) return "US";
  if (e164.startsWith("+91")) return "IN";
  if (e164.startsWith("+44")) return "GB";
  if (e164.startsWith("+61")) return "AU";
  if (e164.startsWith("+971")) return "AE";
  if (e164.startsWith("+65")) return "SG";
  if (e164.startsWith("+81")) return "JP";
  if (e164.startsWith("+49")) return "DE";
  if (e164.startsWith("+33")) return "FR";
  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const QUEUE_NAMES = {
  SMS: "sms",
  EMAIL: "email",
  VOICE: "voice",
  WEBHOOK: "webhook",
  BILLING: "billing",
  DEVICE: "device",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const WEBHOOK_EVENTS = [
  "message.queued",
  "message.sent",
  "message.delivered",
  "message.failed",
  "verification.approved",
  "verification.failed",
  "call.completed",
  "call.failed",
  "email.sent",
  "email.failed",
  "device.online",
  "device.offline",
  "wallet.low_balance",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
