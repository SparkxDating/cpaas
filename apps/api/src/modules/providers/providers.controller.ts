import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service";
import { CurrentAuth } from "../../common/decorators/current-auth.decorator";
import type { AuthContext } from "../../common/guards/auth.guard";

@ApiTags("providers")
@ApiBearerAuth()
@ApiSecurity("api-key")
@Controller("providers")
export class ProvidersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentAuth() _auth: AuthContext) {
    const providers = await this.prisma.provider.findMany({
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
    });
    return { data: providers };
  }
}
