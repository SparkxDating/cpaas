import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, IsUrl } from "class-validator";
import { AppError } from "@cpaas/common";
import { CurrentAuth } from "../../common/decorators/current-auth.decorator";
import type { AuthContext } from "../../common/guards/auth.guard";
import { WebhooksService } from "./webhooks.service";

class CreateWebhookDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}

@ApiTags("webhooks")
@ApiBearerAuth()
@ApiSecurity("api-key")
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: "Create signed webhook endpoint" })
  create(@CurrentAuth() auth: AuthContext, @Body() body: CreateWebhookDto) {
    const projectId = body.projectId ?? auth.projectId;
    if (!projectId) throw new AppError("project_required", "projectId required", 400);
    return this.webhooks.create({
      projectId,
      url: body.url,
      events: body.events,
      description: body.description,
    });
  }

  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Query("projectId") projectId?: string
  ) {
    const pid = projectId ?? auth.projectId;
    if (!pid) throw new AppError("project_required", "projectId required", 400);
    return this.webhooks.list(pid).then((data) => ({ data }));
  }

  @Get("deliveries")
  deliveries(
    @CurrentAuth() auth: AuthContext,
    @Query("projectId") projectId?: string
  ) {
    const pid = projectId ?? auth.projectId;
    if (!pid) throw new AppError("project_required", "projectId required", 400);
    return this.webhooks.deliveries(pid).then((data) => ({ data }));
  }

  @Post(":id/disable")
  disable(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Query("projectId") projectId?: string
  ) {
    const pid = projectId ?? auth.projectId;
    if (!pid) throw new AppError("project_required", "projectId required", 400);
    return this.webhooks.disable(pid, id);
  }
}
