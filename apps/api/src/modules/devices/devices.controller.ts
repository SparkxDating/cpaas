import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { AppError } from "@cpaas/common";
import { CurrentAuth } from "../../common/decorators/current-auth.decorator";
import type { AuthContext } from "../../common/guards/auth.guard";
import { DevicesService } from "./devices.service";

class RegisterDeviceDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  osVersion?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;
}

class HeartbeatDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryPercent?: number;

  @IsOptional()
  @IsBoolean()
  isCharging?: boolean;

  @IsOptional()
  @IsString()
  networkType?: string;

  @IsOptional()
  @IsInt()
  signalStrength?: number;

  @IsOptional()
  @IsString()
  simOperator?: string;

  @IsOptional()
  @IsString()
  simNumber?: string;
}

class OutboxReportItem {
  @IsString()
  outboxId!: string;

  @IsBoolean()
  success!: boolean;

  @IsOptional()
  @IsString()
  providerMessageId?: string;

  @IsOptional()
  @IsString()
  error?: string;
}

class OutboxReportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutboxReportItem)
  items!: OutboxReportItem[];
}

class InboxItem {
  @IsString()
  fromNumber!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  receivedAt?: string;
}

class InboxDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InboxItem)
  messages!: InboxItem[];
}

@ApiTags("device")
@Controller("device")
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @ApiBearerAuth()
  @ApiSecurity("api-key")
  @Post("register")
  @ApiOperation({ summary: "Register Android SMS gateway device" })
  register(@CurrentAuth() auth: AuthContext, @Body() body: RegisterDeviceDto) {
    const projectId = body.projectId ?? auth.projectId;
    if (!projectId) throw new AppError("project_required", "projectId required", 400);
    return this.devices.register({ projectId, ...body });
  }

  @Post("heartbeat")
  @ApiOperation({ summary: "Device heartbeat" })
  heartbeat(@CurrentAuth() auth: AuthContext, @Body() body: HeartbeatDto) {
    if (!auth.deviceId) throw new AppError("device_auth_required", "Use X-Device-Token", 401);
    return this.devices.heartbeat(auth.deviceId, body);
  }

  @Get("status")
  status(@CurrentAuth() auth: AuthContext) {
    if (!auth.deviceId) throw new AppError("device_auth_required", "Use X-Device-Token", 401);
    return this.devices.status(auth.deviceId);
  }

  @Get("outbox")
  @ApiOperation({ summary: "Pull pending SMS jobs for device" })
  outbox(@CurrentAuth() auth: AuthContext) {
    if (!auth.deviceId) throw new AppError("device_auth_required", "Use X-Device-Token", 401);
    return this.devices.pullOutbox(auth.deviceId);
  }

  @Post("send")
  @ApiOperation({ summary: "Report SMS send results from device" })
  sendReport(@CurrentAuth() auth: AuthContext, @Body() body: OutboxReportDto) {
    if (!auth.deviceId) throw new AppError("device_auth_required", "Use X-Device-Token", 401);
    return this.devices.reportSend(auth.deviceId, body.items);
  }

  @Post("inbox")
  @ApiOperation({ summary: "Upload incoming SMS from device" })
  inbox(@CurrentAuth() auth: AuthContext, @Body() body: InboxDto) {
    if (!auth.deviceId) throw new AppError("device_auth_required", "Use X-Device-Token", 401);
    return this.devices.pushInbox(auth.deviceId, body.messages);
  }

  @ApiBearerAuth()
  @ApiSecurity("api-key")
  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Query("projectId") projectId?: string
  ) {
    const pid = projectId ?? auth.projectId;
    if (!pid) throw new AppError("project_required", "projectId required", 400);
    return this.devices.list(pid).then((data) => ({ data }));
  }
}
