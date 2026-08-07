import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ProjectEnv } from "@cpaas/database";
import { AppError } from "@cpaas/common";
import { CurrentAuth } from "../../common/decorators/current-auth.decorator";
import type { AuthContext } from "../../common/guards/auth.guard";
import { ProjectsService } from "./projects.service";

class CreateProjectDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsEnum(ProjectEnv)
  environment?: ProjectEnv;
}

@ApiTags("projects")
@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query("organizationId") organizationId?: string) {
    const orgId = organizationId ?? auth.organizationId;
    if (!orgId) throw new AppError("org_required", "organizationId required", 400);
    return this.projects.list(orgId).then((data) => ({ data }));
  }

  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() body: CreateProjectDto) {
    const orgId = body.organizationId ?? auth.organizationId;
    if (!orgId) throw new AppError("org_required", "organizationId required", 400);
    return this.projects.create({
      organizationId: orgId,
      name: body.name,
      environment: body.environment,
    });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.projects.get(id);
  }
}
