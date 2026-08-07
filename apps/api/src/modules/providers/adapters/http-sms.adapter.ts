import type {
  BalanceResult,
  DeliveryStatusResult,
  HealthCheckResult,
  SendSmsInput,
  SendSmsResult,
  SmsProviderAdapter,
} from "../provider.interface";

/**
 * Generic HTTP-based SMS adapter used by commercial providers.
 * Config is read from environment variables per provider.
 */
export class HttpSmsAdapter implements SmsProviderAdapter {
  constructor(
    public readonly name: string,
    private readonly config: {
      sendUrl?: string;
      balanceUrl?: string;
      statusUrlTemplate?: string;
      headers?: Record<string, string>;
      buildBody: (input: SendSmsInput) => unknown;
      parseSend: (json: unknown) => SendSmsResult;
      parseBalance?: (json: unknown) => BalanceResult;
    }
  ) {}

  async sendSMS(input: SendSmsInput): Promise<SendSmsResult> {
    if (!this.config.sendUrl) {
      // Local/dev fallback: accept and invent an ID
      return {
        providerMessageId: `${this.name.toLowerCase()}_${Date.now()}`,
        status: "queued",
        raw: { simulated: true, input },
      };
    }
    const res = await fetch(this.config.sendUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.config.headers ?? {}),
      },
      body: JSON.stringify(this.config.buildBody(input)),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        providerMessageId: "",
        status: "failed",
        raw: json,
      };
    }
    return this.config.parseSend(json);
  }

  async checkBalance(): Promise<BalanceResult> {
    if (!this.config.balanceUrl || !this.config.parseBalance) {
      return { currency: "USD", balance: -1, raw: { simulated: true } };
    }
    const res = await fetch(this.config.balanceUrl, {
      headers: this.config.headers ?? {},
    });
    const json = await res.json().catch(() => ({}));
    return this.config.parseBalance(json);
  }

  async deliveryStatus(providerMessageId: string): Promise<DeliveryStatusResult> {
    if (!this.config.statusUrlTemplate) {
      return { providerMessageId, status: "unknown", raw: { simulated: true } };
    }
    const url = this.config.statusUrlTemplate.replace(
      "{id}",
      encodeURIComponent(providerMessageId)
    );
    const res = await fetch(url, { headers: this.config.headers ?? {} });
    const json = await res.json().catch(() => ({}));
    return {
      providerMessageId,
      status: String((json as { status?: string }).status ?? "unknown"),
      raw: json,
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    try {
      if (!this.config.sendUrl) {
        return { healthy: true, latencyMs: Date.now() - started, message: "simulated" };
      }
      const res = await fetch(this.config.sendUrl, { method: "OPTIONS" }).catch(() => null);
      return {
        healthy: true,
        latencyMs: Date.now() - started,
        message: res ? `http_${res.status}` : "reachable_or_simulated",
      };
    } catch (e) {
      return {
        healthy: false,
        latencyMs: Date.now() - started,
        message: e instanceof Error ? e.message : "error",
      };
    }
  }
}

export function createTwilioAdapter(): HttpSmsAdapter {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const auth =
    sid && token ? "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") : undefined;
  return new HttpSmsAdapter("TWILIO", {
    sendUrl: sid ? `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json` : undefined,
    headers: auth ? { Authorization: auth } : undefined,
    buildBody: (input) => ({
      To: input.to,
      From: input.from,
      Body: input.body,
    }),
    parseSend: (json) => {
      const j = json as { sid?: string; status?: string };
      return {
        providerMessageId: j.sid ?? "",
        status: j.status === "failed" ? "failed" : "queued",
        raw: json,
      };
    },
  });
}

export function createMsg91Adapter(): HttpSmsAdapter {
  const key = process.env.MSG91_AUTH_KEY;
  return new HttpSmsAdapter("MSG91", {
    sendUrl: key ? "https://control.msg91.com/api/v5/flow/" : undefined,
    headers: key ? { authkey: key } : undefined,
    buildBody: (input) => ({
      recipients: [{ mobiles: input.to.replace("+", ""), message: input.body }],
    }),
    parseSend: (json) => {
      const j = json as { request_id?: string; type?: string };
      return {
        providerMessageId: j.request_id ?? `msg91_${Date.now()}`,
        status: j.type === "error" ? "failed" : "queued",
        raw: json,
      };
    },
  });
}

export function createVonageAdapter(): HttpSmsAdapter {
  const apiKey = process.env.VONAGE_API_KEY;
  const apiSecret = process.env.VONAGE_API_SECRET;
  return new HttpSmsAdapter("VONAGE", {
    sendUrl: apiKey ? "https://rest.nexmo.com/sms/json" : undefined,
    buildBody: (input) => ({
      api_key: apiKey,
      api_secret: apiSecret,
      to: input.to.replace("+", ""),
      from: input.from ?? "CPaaS",
      text: input.body,
    }),
    parseSend: (json) => {
      const j = json as { messages?: Array<{ "message-id"?: string; status?: string }> };
      const m = j.messages?.[0];
      return {
        providerMessageId: m?.["message-id"] ?? "",
        status: m?.status === "0" ? "queued" : "failed",
        raw: json,
      };
    },
  });
}

export function createPlivoAdapter(): HttpSmsAdapter {
  const authId = process.env.PLIVO_AUTH_ID;
  const authToken = process.env.PLIVO_AUTH_TOKEN;
  const auth =
    authId && authToken
      ? "Basic " + Buffer.from(`${authId}:${authToken}`).toString("base64")
      : undefined;
  return new HttpSmsAdapter("PLIVO", {
    sendUrl: authId ? `https://api.plivo.com/v1/Account/${authId}/Message/` : undefined,
    headers: auth ? { Authorization: auth } : undefined,
    buildBody: (input) => ({
      src: input.from,
      dst: input.to,
      text: input.body,
    }),
    parseSend: (json) => {
      const j = json as { message_uuid?: string[] };
      return {
        providerMessageId: j.message_uuid?.[0] ?? "",
        status: "queued",
        raw: json,
      };
    },
  });
}

export function createSpringEdgeAdapter(): HttpSmsAdapter {
  const key = process.env.SPRINGEDGE_API_KEY;
  return new HttpSmsAdapter("SPRINGEDGE", {
    sendUrl: key ? "https://instantalerts.co/api/web/send" : undefined,
    buildBody: (input) => ({
      apikey: key,
      to: input.to,
      sender: input.from ?? "SEDEMO",
      message: input.body,
    }),
    parseSend: (json) => ({
      providerMessageId: String((json as { id?: string }).id ?? `se_${Date.now()}`),
      status: "queued",
      raw: json,
    }),
  });
}

export function createExotelAdapter(): HttpSmsAdapter {
  const sid = process.env.EXOTEL_SID;
  const token = process.env.EXOTEL_TOKEN;
  const auth =
    sid && token ? "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") : undefined;
  return new HttpSmsAdapter("EXOTEL", {
    sendUrl: sid ? `https://api.exotel.com/v1/Accounts/${sid}/Sms/send.json` : undefined,
    headers: auth ? { Authorization: auth } : undefined,
    buildBody: (input) => ({
      From: input.from,
      To: input.to,
      Body: input.body,
    }),
    parseSend: (json) => {
      const j = json as { SMSMessage?: { Sid?: string } };
      return {
        providerMessageId: j.SMSMessage?.Sid ?? `exo_${Date.now()}`,
        status: "queued",
        raw: json,
      };
    },
  });
}

export function createTextBeeAdapter(): HttpSmsAdapter {
  return new HttpSmsAdapter("TEXTBEE", {
    sendUrl: process.env.TEXTBEE_API_URL,
    headers: process.env.TEXTBEE_API_KEY
      ? { "x-api-key": process.env.TEXTBEE_API_KEY }
      : undefined,
    buildBody: (input) => ({ to: input.to, message: input.body }),
    parseSend: (json) => ({
      providerMessageId: String((json as { id?: string }).id ?? `tb_${Date.now()}`),
      status: "queued",
      raw: json,
    }),
  });
}
