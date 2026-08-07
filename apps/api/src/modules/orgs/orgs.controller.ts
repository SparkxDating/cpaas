import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsString } from "class-validator";
import { OrgRole } from "@cpaas/database";
import { AppError } from "@cpaas/common";
import { CurrentAuth } from "../../common/decorators/current-auth.decorator";
import type { AuthContext } from "../../common/guards/auth.guard";
import { OrgsService } from "./orgs.service";

class InviteDto {
  @IsEmail()
  email!: string;

  @IsEnum(OrgRole)
  role!: OrgRole;
}

class AcceptInviteDto {
  @IsString()
  token!: string;
}

@ApiTags("organizations")
@ApiBearerAuth()
@Controller("organizations")
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    if (!auth.userId) throw new AppError("jwt_required", "JWT required", 401);
    return this.orgs.listForUser(auth.userId).then((data) => ({ data }));
  }

  @Get(":orgId/members")
  members(@Param("orgId") orgId: string) {
    return this.orgs.members(orgId).then((data) => ({ data }));
  }

  @Post(":orgId/invites")
  invite(
    @CurrentAuth() auth: AuthContext,
    @Param("orgId") orgId: string,
    @Body() body: InviteDto
  ) {
    if (!auth.userId) throw new AppError("jwt_required", "JWT required", 401);
    return this.orgs.invite(orgId, auth.userId, body.email, body.role);
  }

  @Post("invites/accept")
  accept(@CurrentAuth() auth: AuthContext, @Body() body: AcceptInviteDto) {
    if (!auth.userId) throw new AppError("jwt_required", "JWT required", 401);
    return this.orgs.acceptInvite(body.token, auth.userId);
  }
}
