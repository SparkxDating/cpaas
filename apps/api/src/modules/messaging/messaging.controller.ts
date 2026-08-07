import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, IsISO8601 } from "class-validator";
import { AppError } from "@cpaas/common";
import { CurrentAuth } from "../../common/decorators/current-auth.decorator";
import type { AuthContext } from "../../common/guards/auth.guard";
import { MessagingService } from "./messaging.service";

class SendMessageDto {
  @IsString()
  to!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  channel?: "SMS" | "MMS" | "WHATSAPP" | "RCS";

  @IsOptional()
  @IsArray()
  mediaUrls?: string[];

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}

@ApiTags("messages")
@ApiBearerAuth()
@ApiSecurity("api-key")
@Controller("messages")
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Post()
  @ApiOperation({ summary: "Send SMS/MMS/WhatsApp/RCS message" })
  send(@CurrentAuth() auth: AuthContext, @Body() body: SendMessageDto) {
    const projectId = body.projectId ?? auth.projectId;
    if (!projectId) throw new AppError("project_required", "projectId required", 400);
    return this.messaging.send({
      projectId,
      to: body.to,
      body: body.body,
      from: body.from,
      channel: body.channel,
      mediaUrls: body.mediaUrls,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    });
  }

  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Query("projectId") projectId?: string,
    @Query("limit") limit?: string
  ) {
    const pid = projectId ?? auth.projectId;
    if (!pid) throw new AppError("project_required", "projectId required", 400);
    return this.messaging.listMessages(pid, limit ? Number(limit) : 50).then((data) => ({ data }));
  }
}
