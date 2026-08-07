import type {
  BalanceResult,
  DeliveryStatusResult,
  HealthCheckResult,
  SendSmsInput,
  SendSmsResult,
  SmsProviderAdapter,
} from "../provider.interface";
import type { PrismaService } from "../../../prisma/prisma.service";

/**
 * Routes SMS through registered Android gateway devices (DeviceOutbox).
 */
export class AndroidGatewayAdapter implements SmsProviderAdapter {
  readonly name = "ANDROID_GATEWAY";

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectId: string
  ) {}

  async sendSMS(input: SendSmsInput): Promise<SendSmsResult> {
    const device = await this.prisma.device.findFirst({
      where: {
        projectId: this.projectId,
        status: "ONLINE",
        lastHeartbeatAt: { gte: new Date(Date.now() - 2 * 60_000) },
      },
      orderBy: { lastHeartbeatAt: "desc" },
    });

    if (!device) {
      return {
        providerMessageId: "",
        status: "failed",
        raw: { error: "no_online_device" },
      };
    }

    const outbox = await this.prisma.deviceOutbox.create({
      data: {
        deviceId: device.id,
        toNumber: input.to,
        body: input.body,
        status: "QUEUED",
      },
    });

    return {
      providerMessageId: outbox.id,
      status: "queued",
      raw: { deviceId: device.id, outboxId: outbox.id },
    };
  }

  async checkBalance(): Promise<BalanceResult> {
    const online = await this.prisma.device.count({
      where: {
        projectId: this.projectId,
        status: "ONLINE",
        lastHeartbeatAt: { gte: new Date(Date.now() - 2 * 60_000) },
      },
    });
    return { currency: "DEV", balance: online, raw: { onlineDevices: online } };
  }

  async deliveryStatus(providerMessageId: string): Promise<DeliveryStatusResult> {
    const row = await this.prisma.deviceOutbox.findUnique({ where: { id: providerMessageId } });
    return {
      providerMessageId,
      status: row?.status?.toLowerCase() ?? "unknown",
      raw: row,
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    const online = await this.prisma.device.count({
      where: {
        projectId: this.projectId,
        status: "ONLINE",
        lastHeartbeatAt: { gte: new Date(Date.now() - 2 * 60_000) },
      },
    });
    return {
      healthy: online > 0,
      latencyMs: Date.now() - started,
      message: `${online} online device(s)`,
    };
  }
}
