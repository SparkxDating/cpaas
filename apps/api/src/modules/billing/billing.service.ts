import { Injectable } from "@nestjs/common";
import { AppError } from "@cpaas/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(organizationId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { organizationId } });
    if (!wallet) throw new AppError("not_found", "Wallet not found", 404);
    return {
      ...wallet,
      balanceMinor: wallet.balanceMinor.toString(),
      holdMinor: wallet.holdMinor.toString(),
    };
  }

  async recharge(organizationId: string, amountMinor: number, reference?: string) {
    if (amountMinor <= 0) throw new AppError("invalid_amount", "Amount must be positive", 422);
    const wallet = await this.prisma.wallet.findUnique({ where: { organizationId } });
    if (!wallet) throw new AppError("not_found", "Wallet not found", 404);

    const balanceAfter = wallet.balanceMinor + BigInt(amountMinor);
    const [updated] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balanceMinor: balanceAfter },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "CREDIT",
          amountMinor: BigInt(amountMinor),
          balanceAfter,
          currency: wallet.currency,
          description: "Wallet recharge",
          referenceType: "recharge",
          referenceId: reference,
        },
      }),
      this.prisma.payment.create({
        data: {
          organizationId,
          status: "SUCCEEDED",
          amountMinor: BigInt(amountMinor),
          currency: wallet.currency,
          provider: "manual",
          providerRef: reference,
        },
      }),
    ]);

    return {
      ...updated,
      balanceMinor: updated.balanceMinor.toString(),
      holdMinor: updated.holdMinor.toString(),
    };
  }

  async transactions(organizationId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { organizationId } });
    if (!wallet) throw new AppError("not_found", "Wallet not found", 404);
    const rows = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => ({
      ...r,
      amountMinor: r.amountMinor.toString(),
      balanceAfter: r.balanceAfter.toString(),
    }));
  }

  async invoices(organizationId: string) {
    const rows = await this.prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      ...r,
      subtotalMinor: r.subtotalMinor.toString(),
      taxMinor: r.taxMinor.toString(),
      totalMinor: r.totalMinor.toString(),
    }));
  }
}
