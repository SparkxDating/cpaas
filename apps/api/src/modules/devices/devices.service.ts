import { Injectable } from "@nestjs/common";
import { networkInterfaces } from "os";
import { AppError } from "@cpaas/common";
import {
  generateDeviceToken,
  generatePairingCode,
  hashDeviceToken,
  hashToken,
  normalizePairingCode,
} from "@cpaas/auth";
import { PrismaService } from "../../prisma/prisma.service";

const HEARTBEAT_STALE_MS = 2 * 60_000;
const PAIRING_TTL_MS = 10 * 60_000;
const OUTBOX_RECLAIM_MS = 2 * 60_000;

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  lanIps(port = Number(process.env.PORT ?? 3001)) {
    const ips: string[] = [];
    for (const addrs of Object.values(networkInterfaces())) {
      for (const addr of addrs ?? []) {
        const family = String(addr.family);
        const isV4 = family === "IPv4" || family === "4";
        if (!isV4 || addr.internal) continue;
        if (addr.address.startsWith("169.254.")) continue;
        ips.push(addr.address);
      }
    }
    return {
      ips,
      port,
      urls: ips.map((ip) => `http://${ip}:${port}`),
    };
  }

  async createPairing(projectId: string, apiBaseHint?: string) {
    const generated = generatePairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    await this.prisma.devicePairing.create({
      data: {
        projectId,
        codeHash: generated.hash,
        codePrefix: generated.prefix,
        expiresAt,
        apiBaseHint,
      },
    });
    const lan = this.lanIps();
    const apiBase = apiBaseHint || lan.urls[0] || `http://<LAN-IP>:${lan.port}`;
    return {
      code: generated.raw,
      expiresAt,
      ttlSeconds: Math.round(PAIRING_TTL_MS / 1000),
      apiBases: lan.urls,
      payload: {
        apiBase,
        pairingCode: generated.raw,
      },
    };
  }

  async pairWithCode(input: {
    code: string;
    name: string;
    appVersion?: string;
    osVersion?: string;
    model?: string;
    manufacturer?: string;
  }) {
    const compact = normalizePairingCode(input.code);
    if (compact.length < 6) {
      throw new AppError("invalid_pairing_code", "Pairing code is invalid", 400);
    }
    const pairing = await this.prisma.devicePairing.findUnique({
      where: { codeHash: hashToken(compact) },
    });
    if (!pairing) {
      throw new AppError("invalid_pairing_code", "Pairing code is invalid", 401);
    }
    if (pairing.usedAt) {
      throw new AppError("pairing_used", "Pairing code already used", 409);
    }
    if (pairing.expiresAt.getTime() <= Date.now()) {
      throw new AppError("pairing_expired", "Pairing code expired — generate a new one", 410);
    }

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.devicePairing.updateMany({
        where: {
          id: pairing.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new AppError("pairing_used", "Pairing code already used", 409);
      }

      const token = generateDeviceToken();
      const device = await tx.device.create({
        data: {
          projectId: pairing.projectId,
          name: input.name,
          deviceTokenHash: token.hash,
          deviceTokenPrefix: token.prefix,
          status: "PENDING",
          appVersion: input.appVersion,
          osVersion: input.osVersion,
          model: input.model,
          manufacturer: input.manufacturer,
          config: {
            pollIntervalSec: 5,
            maxBatch: 20,
            encryptPayloads: true,
          },
        },
      });

      await tx.devicePairing.update({
        where: { id: pairing.id },
        data: { usedByDeviceId: device.id },
      });

      return {
        id: device.id,
        name: device.name,
        deviceToken: token.raw,
        status: device.status,
        config: device.config,
      };
    });
  }

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
        status: "PENDING",
        appVersion: input.appVersion,
        osVersion: input.osVersion,
        model: input.model,
        manufacturer: input.manufacturer,
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
    const existing = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!existing) throw new AppError("not_found", "Device not found", 404);
    if (existing.status === "DISABLED") {
      throw new AppError("device_disabled", "Device is disabled", 403);
    }

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
    await this.markStale();
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new AppError("not_found", "Device not found", 404);
    const pending = await this.prisma.deviceOutbox.count({
      where: { deviceId, status: { in: ["QUEUED", "SENDING"] } },
    });
    return { device, pendingOutbox: pending };
  }

  async pullOutbox(deviceId: string, limit = 20) {
    const take = Math.min(limit, 50);
    await this.prisma.deviceOutbox.updateMany({
      where: {
        deviceId,
        status: "SENDING",
        updatedAt: { lt: new Date(Date.now() - OUTBOX_RECLAIM_MS) },
        attempts: { lt: 5 },
      },
      data: { status: "QUEUED" },
    });

    const queued = await this.prisma.deviceOutbox.findMany({
      where: { deviceId, status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      take,
    });
    if (queued.length === 0) return { data: [] };

    const ids = queued.map((row) => row.id);
    await this.prisma.deviceOutbox.updateMany({
      where: { id: { in: ids }, deviceId, status: "QUEUED" },
      data: { status: "SENDING" },
    });

    return { data: queued };
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
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new AppError("not_found", "Device not found", 404);

    const created = await this.prisma.$transaction(async (tx) => {
      const inboxRows = [];
      for (const m of messages) {
        const receivedAt = m.receivedAt ? new Date(m.receivedAt) : new Date();
        const inbox = await tx.deviceInbox.create({
          data: {
            deviceId,
            fromNumber: m.fromNumber,
            body: m.body,
            receivedAt,
          },
        });
        await tx.message.create({
          data: {
            projectId: device.projectId,
            deviceId,
            channel: "SMS",
            direction: "INBOUND",
            status: "DELIVERED",
            fromNumber: m.fromNumber,
            toNumber: device.simNumber ?? device.name,
            body: m.body,
            deliveredAt: receivedAt,
          },
        });
        inboxRows.push(inbox);
      }
      return inboxRows;
    });
    return { data: created };
  }

  async list(projectId: string) {
    await this.markStale(projectId);
    const devices = await this.prisma.device.findMany({
      where: { projectId },
      orderBy: { lastHeartbeatAt: "desc" },
      include: {
        _count: {
          select: {
            outbox: { where: { status: { in: ["QUEUED", "SENDING"] } } },
          },
        },
      },
    });
    return devices.map(({ _count, ...device }) => ({
      ...device,
      pendingOutbox: _count.outbox,
    }));
  }

  async setDisabled(projectId: string, deviceId: string, disabled: boolean) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, projectId },
    });
    if (!device) throw new AppError("not_found", "Device not found", 404);
    return this.prisma.device.update({
      where: { id: deviceId },
      data: { status: disabled ? "DISABLED" : "OFFLINE" },
    });
  }

  async markStale(projectId?: string) {
    const cutoff = new Date(Date.now() - HEARTBEAT_STALE_MS);
    await this.prisma.device.updateMany({
      where: {
        ...(projectId ? { projectId } : {}),
        status: "ONLINE",
        OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: cutoff } }],
      },
      data: { status: "OFFLINE" },
    });
  }

  resolveDeviceFromToken(token: string) {
    return this.prisma.device.findUnique({
      where: { deviceTokenHash: hashDeviceToken(token) },
    });
  }
}
