import { Injectable } from "@nestjs/common";
import { AppError } from "@cpaas/common";
import { generateDeviceToken, hashDeviceToken } from "@cpaas/auth";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: {
    projectId: string;
    name: string;
    appVersion?: string;
    osVersion?: string;
    model?: string;
    manufacturer?: string;
  }) {
    const token = generateDeviceToken();
    const device = await this.prisma.device.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        deviceTokenHash: token.hash,
        deviceTokenPrefix: token.prefix,
        status: "ONLINE",
        appVersion: input.appVersion,
        osVersion: input.osVersion,
        model: input.model,
        manufacturer: input.manufacturer,
        lastHeartbeatAt: new Date(),
        config: {
          pollIntervalSec: 5,
          maxBatch: 20,
          encryptPayloads: true,
        },
      },
    });

    return {
      id: device.id,
      name: device.name,
      deviceToken: token.raw,
      status: device.status,
      config: device.config,
    };
  }

  async heartbeat(
    deviceId: string,
    data: {
      batteryPercent?: number;
      isCharging?: boolean;
      networkType?: string;
      signalStrength?: number;
      simOperator?: string;
      simNumber?: string;
    }
  ) {
    const device = await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        status: "ONLINE",
        lastHeartbeatAt: new Date(),
        batteryPercent: data.batteryPercent,
        isCharging: data.isCharging,
        networkType: data.networkType,
        signalStrength: data.signalStrength,
        simOperator: data.simOperator,
        simNumber: data.simNumber,
      },
    });
    return {
      id: device.id,
      status: device.status,
      config: device.config,
      serverTime: new Date().toISOString(),
    };
  }

  async status(deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new AppError("not_found", "Device not found", 404);
    const pending = await this.prisma.deviceOutbox.count({
      where: { deviceId, status: "QUEUED" },
    });
    return { device, pendingOutbox: pending };
  }

  async pullOutbox(deviceId: string, limit = 20) {
    const items = await this.prisma.deviceOutbox.findMany({
      where: { deviceId, status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      take: Math.min(limit, 50),
    });
    return { data: items };
  }

  async reportSend(
    deviceId: string,
    items: Array<{
      outboxId: string;
      success: boolean;
      providerMessageId?: string;
      error?: string;
    }>
  ) {
    for (const item of items) {
      const row = await this.prisma.deviceOutbox.findFirst({
        where: { id: item.outboxId, deviceId },
      });
      if (!row) continue;
      await this.prisma.deviceOutbox.update({
        where: { id: row.id },
        data: {
          status: item.success ? "SENT" : "FAILED",
          sentAt: item.success ? new Date() : null,
          lastError: item.error,
          attempts: { increment: 1 },
        },
      });
      if (row.messageId) {
        await this.prisma.message.updateMany({
          where: { id: row.messageId },
          data: {
            status: item.success ? "SENT" : "FAILED",
            sentAt: item.success ? new Date() : null,
            errorMessage: item.error,
          },
        });
      }
    }
    return { ok: true };
  }

  async pushInbox(
    deviceId: string,
    messages: Array<{ fromNumber: string; body: string; receivedAt?: string }>
  ) {
    const created = await this.prisma.$transaction(
      messages.map((m) =>
        this.prisma.deviceInbox.create({
          data: {
            deviceId,
            fromNumber: m.fromNumber,
            body: m.body,
            receivedAt: m.receivedAt ? new Date(m.receivedAt) : new Date(),
          },
        })
      )
    );
    return { data: created };
  }

  async list(projectId: string) {
    return this.prisma.device.findMany({
      where: { projectId },
      orderBy: { lastHeartbeatAt: "desc" },
    });
  }

  resolveDeviceFromToken(token: string) {
    return this.prisma.device.findUnique({
      where: { deviceTokenHash: hashDeviceToken(token) },
    });
  }
}
