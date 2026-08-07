import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString } from "class-validator";
import { AppError } from "@cpaas/common";
import { CurrentAuth } from "../../common/decorators/current-auth.decorator";
import type { AuthContext } from "../../common/guards/auth.guard";
import { MessagingService } from "../messaging/messaging.service";

class SendEmailDto {
  @IsEmail()
  to!: string;

  @IsString()
  subject!: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsEmail()
  from?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}

@ApiTags("email")
@ApiBearerAuth()
@ApiSecurity("api-key")
@Controller("email")
export class EmailController {
  constructor(private readonly messaging: MessagingService) {}

  @Post("send")
  @ApiOperation({ summary: "Send email via configured provider" })
  send(@CurrentAuth() auth: AuthContext, @Body() body: SendEmailDto) {
    const projectId = body.projectId ?? auth.projectId;
    if (!projectId) throw new AppError("project_required", "projectId required", 400);
    return this.messaging.sendEmail({
      projectId,
      to: body.to,
      subject: body.subject,
      htmlBody: body.html,
      textBody: body.text,
      from: body.from,
    });
  }
}
