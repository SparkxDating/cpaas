import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { AppError } from "@cpaas/common";
import { CurrentAuth } from "../../common/decorators/current-auth.decorator";
import type { AuthContext } from "../../common/guards/auth.guard";
import { MessagingService } from "../messaging/messaging.service";
import { PrismaService } from "../../prisma/prisma.service";

class CreateCallDto {
  @IsString()
  to!: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}

@ApiTags("calls")
@ApiBearerAuth()
@ApiSecurity("api-key")
@Controller("calls")
export class VoiceController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly prisma: PrismaService
  ) {}

  @Post()
  @ApiOperation({ summary: "Create outbound call" })
  create(@CurrentAuth() auth: AuthContext, @Body() body: CreateCallDto) {
    const projectId = body.projectId ?? auth.projectId;
    if (!projectId) throw new AppError("project_required", "projectId required", 400);
    return this.messaging.createCall({
      projectId,
      to: body.to,
      from: body.from,
    });
  }

  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Query("projectId") projectId?: string
  ) {
    const pid = projectId ?? auth.projectId;
    if (!pid) throw new AppError("project_required", "projectId required", 400);
    return this.prisma.call
      .findMany({ where: { projectId: pid }, orderBy: { createdAt: "desc" }, take: 50 })
      .then((data) => ({ data }));
  }
}
