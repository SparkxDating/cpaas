export interface CpaasClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class Cpaas {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: CpaasClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "http://localhost:3001").replace(/\/$/, "");
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}/v1${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } })?.error?.message ?? res.statusText;
      throw new Error(msg);
    }
    return json as T;
  }

  verify = {
    send: (input: { to: string; channel?: string; template?: string }) =>
      this.request<{ id: string; status: string; expiresAt: string }>("POST", "/verify/send", input),
    check: (input: { id: string; code: string }) =>
      this.request<{ id: string; status: string }>("POST", "/verify/check", input),
  };

  messages = {
    create: (input: { to: string; body: string; from?: string; channel?: string }) =>
      this.request("POST", "/messages", input),
    list: () => this.request("GET", "/messages"),
  };

  calls = {
    create: (input: { to: string; from?: string }) => this.request("POST", "/calls", input),
  };

  email = {
    send: (input: { to: string; subject: string; text?: string; html?: string }) =>
      this.request("POST", "/email/send", input),
  };

  webhooks = {
    create: (input: { url: string; events: string[] }) => this.request("POST", "/webhooks", input),
    list: () => this.request("GET", "/webhooks"),
  };
}

export default Cpaas;
