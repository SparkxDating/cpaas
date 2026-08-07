import { Injectable } from "@nestjs/common";
import { AppError, isEmail } from "@cpaas/common";
import { hashToken, randomUrlToken } from "@cpaas/auth";
import { OrgRole } from "@cpaas/database";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OrgsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.membership.findMany({
      where: { userId },
      include: { organization: true },
    });
  }

  async invite(orgId: string, invitedById: string, email: string, role: OrgRole) {
    if (!isEmail(email)) throw new AppError("invalid_email", "Invalid email", 422);
    const token = randomUrlToken();
    const invite = await this.prisma.orgInvite.create({
      data: {
        organizationId: orgId,
        email: email.toLowerCase(),
        role,
        invitedById,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
      },
    });
    return { invite, token };
  }

  async acceptInvite(token: string, userId: string) {
    const invite = await this.prisma.orgInvite.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new AppError("invalid_token", "Invalid invite", 400);
    }
    await this.prisma.$transaction([
      this.prisma.membership.upsert({
        where: {
          organizationId_userId: {
            organizationId: invite.organizationId,
            userId,
          },
        },
        create: {
          organizationId: invite.organizationId,
          userId,
          role: invite.role,
        },
        update: { role: invite.role },
      }),
      this.prisma.orgInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);
    return { ok: true, organizationId: invite.organizationId };
  }

  members(orgId: string) {
    return this.prisma.membership.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }
}
