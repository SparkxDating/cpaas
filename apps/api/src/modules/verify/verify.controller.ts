import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { VerificationChannel } from "@cpaas/database";
import { AppError } from "@cpaas/common";
import { CurrentAuth } from "../../common/decorators/current-auth.decorator";
import type { AuthContext } from "../../common/guards/auth.guard";
import { VerifyService } from "./verify.service";

class VerifySendDto {
  @IsString()
  to!: string;

  @IsOptional()
  @IsEnum(VerificationChannel)
  channel?: VerificationChannel;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  template?: string;
}

class VerifyCheckDto {
  @IsString()
  id!: string;

  @IsString()
  @MinLength(4)
  code!: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}

@ApiTags("verify")
@ApiBearerAuth()
@ApiSecurity("api-key")
@Controller("verify")
export class VerifyController {
  constructor(private readonly verify: VerifyService) {}

  @Post("send")
  @ApiOperation({ summary: "Send OTP verification" })
  send(@CurrentAuth() auth: AuthContext, @Body() body: VerifySendDto) {
    const projectId = body.projectId ?? auth.projectId;
    if (!projectId) throw new AppError("project_required", "projectId required", 400);
    return this.verify.send({
      projectId,
      to: body.to,
      channel: body.channel,
      template: body.template,
    });
  }

  @Post("check")
  @ApiOperation({ summary: "Check OTP verification code" })
  check(@CurrentAuth() auth: AuthContext, @Body() body: VerifyCheckDto) {
    const projectId = body.projectId ?? auth.projectId;
    if (!projectId) throw new AppError("project_required", "projectId required", 400);
    return this.verify.check({
      projectId,
      id: body.id,
      code: body.code,
    });
  }
}
