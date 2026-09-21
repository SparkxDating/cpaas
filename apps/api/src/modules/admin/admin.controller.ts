import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin")
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("stats")
  async stats() {
    const since = new Date(Date.now() - 24 * 3600_000);
    const [
      users,
      orgs,
      projects,
      messages,
      devices,
      providers,
      messages24h,
      verifications24h,
      onlineDevices,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.organization.count(),
      this.prisma.project.count(),
      this.prisma.message.count(),
      this.prisma.device.count(),
      this.prisma.provider.count({ where: { isActive: true } }),
      this.prisma.message.count({ where: { createdAt: { gte: since } } }),
      this.prisma.verification.count({ where: { createdAt: { gte: since } } }),
      this.prisma.device.count({
        where: {
          status: "ONLINE",
          lastHeartbeatAt: { gte: new Date(Date.now() - 2 * 60_000) },
        },
      }),
    ]);
    return {
      users,
      orgs,
      projects,
      messages,
      devices,
      providers,
      messages24h,
      verifications24h,
      onlineDevices,
    };
  }

  @Get("users")
  users() {
    return this.prisma.user
      .findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { memberships: true } },
        },
      })
      .then((data) => ({ data }));
  }

  @Get("organizations")
  organizations() {
    return this.prisma.organization
      .findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { id: true, email: true, name: true } },
          wallet: { select: { balanceMinor: true, currency: true } },
          _count: { select: { projects: true, members: true } },
        },
      })
      .then((rows) => ({
        data: rows.map((o) => ({
          ...o,
          wallet: o.wallet
            ? {
                ...o.wallet,
                balanceMinor: o.wallet.balanceMinor.toString(),
              }
            : null,
        })),
      }));
  }

  @Get("devices")
  async devices() {
    const cutoff = new Date(Date.now() - 2 * 60_000);
    await this.prisma.device.updateMany({
      where: {
        status: "ONLINE",
        OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: cutoff } }],
      },
      data: { status: "OFFLINE" },
    });
    return this.prisma.device
      .findMany({
        take: 100,
        orderBy: { lastHeartbeatAt: "desc" },
        include: { project: { select: { id: true, name: true, slug: true } } },
      })
      .then((data) => ({ data }));
  }

  @Get("providers")
  providers() {
    return this.prisma.provider
      .findMany({
        orderBy: { basePriority: "asc" },
        select: {
          id: true,
          name: true,
          displayName: true,
          type: true,
          isActive: true,
          basePriority: true,
          healthScore: true,
          successRate: true,
          avgLatencyMs: true,
          lastHealthAt: true,
        },
      })
      .then((data) => ({ data }));
  }

  @Get("messages")
  messages(@Query("limit") limit?: string) {
    const take = Math.min(Number(limit) || 50, 200);
    return this.prisma.message
      .findMany({
        take,
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true } },
          provider: { select: { name: true, displayName: true } },
        },
      })
      .then((data) => ({ data }));
  }

  @Get("verifications")
  verifications(@Query("limit") limit?: string) {
    const take = Math.min(Number(limit) || 50, 200);
    return this.prisma.verification
      .findMany({
        take,
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true } },
        },
      })
      .then((data) => ({
        data: data.map((v) => ({
          id: v.id,
          projectId: v.projectId,
          project: v.project,
          channel: v.channel,
          status: v.status,
          to: v.to,
          attempts: v.attempts,
          sendCount: v.sendCount,
          expiresAt: v.expiresAt,
          approvedAt: v.approvedAt,
          createdAt: v.createdAt,
        })),
      }));
  }
}
