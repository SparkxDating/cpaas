import { Injectable } from "@nestjs/common";
import { MessageChannel, ProviderName } from "@cpaas/database";
import { detectCountryFromE164 } from "@cpaas/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { SendSmsInput, SendSmsResult, SmsProviderAdapter } from "./provider.interface";
import { AndroidGatewayAdapter } from "./adapters/android-gateway.adapter";
import {
  createExotelAdapter,
  createMsg91Adapter,
  createPlivoAdapter,
  createSpringEdgeAdapter,
  createTextBeeAdapter,
  createTwilioAdapter,
  createVonageAdapter,
} from "./adapters/http-sms.adapter";

export interface RouteDecision {
  providerName: ProviderName;
  providerId: string;
  adapter: SmsProviderAdapter;
  costMinor: number;
}

@Injectable()
export class ProviderRouterService {
  private readonly commercial = new Map<string, SmsProviderAdapter>();

  constructor(private readonly prisma: PrismaService) {
    this.commercial.set("TWILIO", createTwilioAdapter());
    this.commercial.set("MSG91", createMsg91Adapter());
    this.commercial.set("VONAGE", createVonageAdapter());
    this.commercial.set("PLIVO", createPlivoAdapter());
    this.commercial.set("SPRINGEDGE", createSpringEdgeAdapter());
    this.commercial.set("EXOTEL", createExotelAdapter());
    this.commercial.set("TEXTBEE", createTextBeeAdapter());
  }

  async selectSmsRoute(projectId: string, to: string): Promise<RouteDecision | null> {
    const country = detectCountryFromE164(to);

    const routes = await this.prisma.route.findMany({
      where: {
        projectId,
        channel: MessageChannel.SMS,
        isActive: true,
        OR: [{ country: null }, ...(country ? [{ country }] : [])],
        provider: { isActive: true },
      },
      include: { provider: true },
      orderBy: [{ priority: "asc" }, { costMinor: "asc" }],
    });

    // Score: priority (lower better), cost, health, success rate
    const scored = routes
      .map((r) => {
        const health = r.provider.healthScore ?? 1;
        const success = r.provider.successRate ?? 1;
        const score =
          r.priority * 10 +
          r.costMinor * 5 +
          (1 - health) * 50 +
          (1 - success) * 50;
        return { route: r, score };
      })
      .sort((a, b) => a.score - b.score);

    for (const { route } of scored) {
      const name = route.provider.name;
      let adapter: SmsProviderAdapter | undefined;

      if (name === ProviderName.ANDROID_GATEWAY) {
        adapter = new AndroidGatewayAdapter(this.prisma, projectId);
        const health = await adapter.healthCheck();
        if (!health.healthy) continue;
      } else {
        adapter = this.commercial.get(name);
      }

      if (!adapter) continue;

      return {
        providerName: name,
        providerId: route.providerId,
        adapter,
        costMinor: route.costMinor,
      };
    }

    // Absolute fallback chain if no routes configured
    const fallbackOrder: ProviderName[] = [
      ProviderName.ANDROID_GATEWAY,
      ProviderName.MSG91,
      ProviderName.SPRINGEDGE,
      ProviderName.TWILIO,
      ProviderName.VONAGE,
      ProviderName.PLIVO,
      ProviderName.TEXTBEE,
    ];

    for (const name of fallbackOrder) {
      const provider = await this.prisma.provider.findUnique({ where: { name } });
      if (!provider?.isActive) continue;

      let adapter: SmsProviderAdapter;
      if (name === ProviderName.ANDROID_GATEWAY) {
        adapter = new AndroidGatewayAdapter(this.prisma, projectId);
        const health = await adapter.healthCheck();
        if (!health.healthy) continue;
      } else {
        const c = this.commercial.get(name);
        if (!c) continue;
        adapter = c;
      }

      return {
        providerName: name,
        providerId: provider.id,
        adapter,
        costMinor: 1,
      };
    }

    return null;
  }

  async sendSms(projectId: string, input: SendSmsInput): Promise<{
    result: SendSmsResult;
    decision: RouteDecision;
  }> {
    const decision = await this.selectSmsRoute(projectId, input.to);
    if (!decision) {
      return {
        decision: null as unknown as RouteDecision,
        result: { providerMessageId: "", status: "failed", raw: { error: "no_provider" } },
      };
    }
    const result = await decision.adapter.sendSMS(input);
    return { result, decision };
  }
}
