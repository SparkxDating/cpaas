import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AppError } from "@cpaas/common";
import { CurrentAuth } from "../../common/decorators/current-auth.decorator";
import type { AuthContext } from "../../common/guards/auth.guard";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("analytics")
@ApiBearerAuth()
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("overview")
  async overview(
    @CurrentAuth() auth: AuthContext,
    @Query("projectId") projectId?: string
  ) {
    const pid = projectId ?? auth.projectId;
    if (!pid) throw new AppError("project_required", "projectId required", 400);

    const since = new Date(Date.now() - 30 * 24 * 3600_000);
    const [messages, delivered, failed, verifications, usage] = await Promise.all([
      this.prisma.message.count({ where: { projectId: pid, createdAt: { gte: since } } }),
      this.prisma.message.count({
        where: { projectId: pid, status: "DELIVERED", createdAt: { gte: since } },
      }),
      this.prisma.message.count({
        where: { projectId: pid, status: "FAILED", createdAt: { gte: since } },
      }),
      this.prisma.verification.count({
        where: { projectId: pid, createdAt: { gte: since } },
      }),
      this.prisma.usageRecord.aggregate({
        where: { projectId: pid, recordedAt: { gte: since } },
        _sum: { totalMinor: true },
      }),
    ]);

    const deliveryRate = messages === 0 ? 0 : delivered / messages;

    const byProvider = await this.prisma.usageRecord.groupBy({
      by: ["provider"],
      where: { projectId: pid, recordedAt: { gte: since } },
      _sum: { totalMinor: true, quantity: true },
      _count: true,
    });

    return {
      periodDays: 30,
      messages,
      delivered,
      failed,
      deliveryRate,
      verifications,
      spendMinor: usage._sum.totalMinor ?? 0,
      providers: byProvider,
    };
  }
}
