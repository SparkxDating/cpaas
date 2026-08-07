import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { AppError } from "@cpaas/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    projectId: string;
    url: string;
    events: string[];
    description?: string;
  }) {
    if (!input.url.startsWith("https://") && process.env.NODE_ENV === "production") {
      throw new AppError("invalid_url", "Webhook URL must be HTTPS in production", 422);
    }
    return this.prisma.webhook.create({
      data: {
        projectId: input.projectId,
        url: input.url,
        secret: randomBytes(32).toString("hex"),
        events: input.events,
        description: input.description,
      },
    });
  }

  async list(projectId: string) {
    return this.prisma.webhook.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async deliveries(projectId: string, take = 50) {
    return this.prisma.webhookDelivery.findMany({
      where: { webhook: { projectId } },
      orderBy: { createdAt: "desc" },
      take: Math.min(take, 200),
      include: { webhook: { select: { url: true, id: true } } },
    });
  }

  async disable(projectId: string, id: string) {
    const wh = await this.prisma.webhook.findFirst({ where: { id, projectId } });
    if (!wh) throw new AppError("not_found", "Webhook not found", 404);
    return this.prisma.webhook.update({
      where: { id },
      data: { status: "DISABLED" },
    });
  }
}
