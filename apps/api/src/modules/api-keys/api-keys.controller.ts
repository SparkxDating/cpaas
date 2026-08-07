import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { ProjectEnv } from "@cpaas/database";
import { AppError } from "@cpaas/common";
import { CurrentAuth } from "../../common/decorators/current-auth.decorator";
import type { AuthContext } from "../../common/guards/auth.guard";
import { ApiKeysService } from "./api-keys.service";

class CreateKeyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsEnum(ProjectEnv)
  environment?: ProjectEnv;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimitRpm?: number;
}

@ApiTags("api-keys")
@ApiBearerAuth()
@Controller("api-keys")
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query("projectId") projectId?: string) {
    const pid = projectId ?? auth.projectId;
    if (!pid) throw new AppError("project_required", "projectId required", 400);
    return this.keys.list(pid).then((data) => ({ data }));
  }

  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() body: CreateKeyDto) {
    const projectId = body.projectId ?? auth.projectId;
    if (!projectId) throw new AppError("project_required", "projectId required", 400);
    return this.keys.create({ projectId, ...body });
  }

  @Post(":id/rotate")
  rotate(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Query("projectId") projectId?: string
  ) {
    const pid = projectId ?? auth.projectId;
    if (!pid) throw new AppError("project_required", "projectId required", 400);
    return this.keys.rotate(pid, id);
  }

  @Post(":id/disable")
  disable(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Query("projectId") projectId?: string
  ) {
    const pid = projectId ?? auth.projectId;
    if (!pid) throw new AppError("project_required", "projectId required", 400);
    return this.keys.disable(pid, id);
  }
}
