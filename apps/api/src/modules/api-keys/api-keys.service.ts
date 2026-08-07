import { Injectable } from "@nestjs/common";
import { AppError } from "@cpaas/common";
import { generateApiKey, hashApiKey, loadAuthConfig } from "@cpaas/auth";
import { ProjectEnv } from "@cpaas/database";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    projectId: string;
    name: string;
    environment?: ProjectEnv;
    scopes?: string[];
    rateLimitRpm?: number;
  }) {
    const project = await this.prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new AppError("not_found", "Project not found", 404);

    const env = (input.environment ?? project.environment) === ProjectEnv.LIVE ? "live" : "test";
    const generated = generateApiKey(env);
    const cfg = loadAuthConfig();

    const key = await this.prisma.apiKey.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        prefix: generated.prefix,
        keyHash: hashApiKey(generated.raw, cfg.apiKeyPepper),
        lastFour: generated.lastFour,
        environment: env === "live" ? ProjectEnv.LIVE : ProjectEnv.TEST,
        scopes: input.scopes ?? ["*"],
        rateLimitRpm: input.rateLimitRpm,
      },
    });

    return {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      lastFour: key.lastFour,
      environment: key.environment,
      scopes: key.scopes,
      // returned only once
      secret: generated.raw,
    };
  }

  list(projectId: string) {
    return this.prisma.apiKey.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastFour: true,
        environment: true,
        status: true,
        scopes: true,
        rateLimitRpm: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async rotate(projectId: string, id: string) {
    const existing = await this.prisma.apiKey.findFirst({ where: { id, projectId } });
    if (!existing) throw new AppError("not_found", "API key not found", 404);

    await this.prisma.apiKey.update({
      where: { id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });

    return this.create({
      projectId,
      name: `${existing.name} (rotated)`,
      environment: existing.environment,
      scopes: existing.scopes,
      rateLimitRpm: existing.rateLimitRpm ?? undefined,
    });
  }

  async disable(projectId: string, id: string) {
    const existing = await this.prisma.apiKey.findFirst({ where: { id, projectId } });
    if (!existing) throw new AppError("not_found", "API key not found", 404);
    return this.prisma.apiKey.update({
      where: { id },
      data: { status: "DISABLED" },
    });
  }
}
