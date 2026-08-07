import { Injectable } from "@nestjs/common";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpRequests: Counter<string>;
  readonly httpDuration: Histogram<string>;
  readonly messagesSent: Counter<string>;
  readonly verifications: Counter<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });
    this.httpRequests = new Counter({
      name: "cpaas_http_requests_total",
      help: "HTTP requests",
      labelNames: ["method", "path", "status"],
      registers: [this.registry],
    });
    this.httpDuration = new Histogram({
      name: "cpaas_http_duration_seconds",
      help: "HTTP duration",
      labelNames: ["method", "path"],
      registers: [this.registry],
    });
    this.messagesSent = new Counter({
      name: "cpaas_messages_sent_total",
      help: "Messages sent",
      labelNames: ["channel", "provider", "status"],
      registers: [this.registry],
    });
    this.verifications = new Counter({
      name: "cpaas_verifications_total",
      help: "Verification outcomes",
      labelNames: ["channel", "status"],
      registers: [this.registry],
    });
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
