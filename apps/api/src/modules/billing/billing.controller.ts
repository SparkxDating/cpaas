import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min } from "class-validator";
import { AppError } from "@cpaas/common";
import { CurrentAuth } from "../../common/decorators/current-auth.decorator";
import type { AuthContext } from "../../common/guards/auth.guard";
import { BillingService } from "./billing.service";

class RechargeDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;
}

@ApiTags("billing")
@ApiBearerAuth()
@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("wallet")
  wallet(@CurrentAuth() auth: AuthContext) {
    if (!auth.organizationId) throw new AppError("org_required", "organization context required", 400);
    return this.billing.getWallet(auth.organizationId);
  }

  @Post("wallet/recharge")
  recharge(@CurrentAuth() auth: AuthContext, @Body() body: RechargeDto) {
    const orgId = body.organizationId ?? auth.organizationId;
    if (!orgId) throw new AppError("org_required", "organization context required", 400);
    return this.billing.recharge(orgId, body.amountMinor, body.reference);
  }

  @Get("transactions")
  transactions(@CurrentAuth() auth: AuthContext) {
    if (!auth.organizationId) throw new AppError("org_required", "organization context required", 400);
    return this.billing.transactions(auth.organizationId).then((data) => ({ data }));
  }

  @Get("invoices")
  invoices(@CurrentAuth() auth: AuthContext) {
    if (!auth.organizationId) throw new AppError("org_required", "organization context required", 400);
    return this.billing.invoices(auth.organizationId).then((data) => ({ data }));
  }
}
