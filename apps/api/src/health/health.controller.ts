import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Friendly root for phone/browser checks (LAN IP:3001). */
  @Public()
  @Get()
  root() {
    return {
      service: "cpaas-api",
      status: "ok",
      message: "CPaaS API is reachable",
      links: {
        health: "/health",
        docs: "/docs",
        verifySend: "POST /v1/verify/send",
        messages: "POST /v1/messages",
        deviceRegister: "POST /v1/device/register",
        devicePair: "POST /v1/device/pair",
      },
    };
  }

  @Public()
  @Get("health")
  async health() {
    let db = "up";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "down";
    }
    return {
      status: db === "up" ? "ok" : "degraded",
      service: "cpaas-api",
      time: new Date().toISOString(),
      checks: { database: db },
    };
  }
}
