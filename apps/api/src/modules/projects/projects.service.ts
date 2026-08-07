import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { AppError, slugify } from "@cpaas/common";
import { ProjectEnv } from "@cpaas/database";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.project.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(input: {
    organizationId: string;
    name: string;
    environment?: ProjectEnv;
  }) {
    const slug = slugify(input.name);
    try {
      return await this.prisma.project.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          slug,
          environment: input.environment ?? ProjectEnv.TEST,
          webhookSecret: randomBytes(32).toString("hex"),
        },
      });
    } catch {
      throw new AppError("slug_conflict", "Project slug already exists", 409);
    }
  }

  async get(id: string) {
    const p = await this.prisma.project.findUnique({ where: { id } });
    if (!p) throw new AppError("not_found", "Project not found", 404);
    return p;
  }
}
