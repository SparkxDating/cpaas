import { Injectable } from "@nestjs/common";
import { AppError, isEmail, slugify } from "@cpaas/common";
import {
  hashPassword,
  hashToken,
  loadAuthConfig,
  randomUrlToken,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from "@cpaas/auth";
import { OrgRole } from "@cpaas/database";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: {
    email: string;
    password: string;
    name?: string;
    organizationName?: string;
  }) {
    if (!isEmail(input.email)) throw new AppError("invalid_email", "Invalid email", 422);
    if (input.password.length < 10) {
      throw new AppError("weak_password", "Password must be at least 10 characters", 422);
    }

    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) throw new AppError("email_taken", "Email already registered", 409);

    const passwordHash = await hashPassword(input.password);
    const emailToken = randomUrlToken();

    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        emailVerifications: {
          create: {
            tokenHash: hashToken(emailToken),
            expiresAt: new Date(Date.now() + 24 * 3600_000),
          },
        },
      },
    });

    const orgName = input.organizationName ?? `${input.name ?? "My"} Org`;
    const slug = slugify(orgName) + "-" + user.id.slice(-6);
    const org = await this.prisma.organization.create({
      data: {
        name: orgName,
        slug,
        ownerId: user.id,
        billingEmail: user.email,
        members: {
          create: { userId: user.id, role: OrgRole.OWNER },
        },
        wallet: { create: { currency: "USD", balanceMinor: BigInt(0) } },
        projects: {
          create: {
            name: "Default",
            slug: "default",
            environment: "TEST",
            webhookSecret: randomUrlToken(),
          },
        },
      },
      include: { projects: true },
    });

    const tokens = await this.issueTokens(user.id, user.email, org.id);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      organization: { id: org.id, name: org.name, slug: org.slug },
      project: org.projects[0],
      emailVerificationToken: emailToken,
      ...tokens,
    };
  }

  async login(email: string, password: string, meta?: { ua?: string; ip?: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.status !== "ACTIVE") {
      throw new AppError("invalid_credentials", "Invalid email or password", 401);
    }
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) throw new AppError("invalid_credentials", "Invalid email or password", 401);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      membership?.organizationId,
      meta
    );

    return {
      user: { id: user.id, email: user.email, name: user.name, mfaEnabled: user.mfaEnabled },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const cfg = loadAuthConfig();
    let payload;
    try {
      payload = verifyRefreshToken(cfg, refreshToken);
    } catch {
      throw new AppError("invalid_refresh", "Invalid refresh token", 401);
    }

    const hash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppError("invalid_refresh", "Refresh token revoked or expired", 401);
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(payload.sub, payload.email, payload.orgId, {
      familyId: stored.familyId,
    });
  }

  async logout(refreshToken: string) {
    const hash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always return ok to avoid enumeration
    if (!user) return { ok: true, token: null as string | null };

    const token = randomUrlToken();
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    return { ok: true, token };
  }

  async resetPassword(token: string, password: string) {
    if (password.length < 10) {
      throw new AppError("weak_password", "Password must be at least 10 characters", 422);
    }
    const row = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new AppError("invalid_token", "Invalid or expired reset token", 400);
    }
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      this.prisma.passwordReset.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async verifyEmail(token: string) {
    const row = await this.prisma.emailVerification.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new AppError("invalid_token", "Invalid or expired verification token", 400);
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerification.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  private async issueTokens(
    userId: string,
    email: string,
    orgId?: string,
    meta?: { ua?: string; ip?: string; familyId?: string }
  ) {
    const cfg = loadAuthConfig();
    const familyId = meta?.familyId ?? randomUrlToken();
    const accessToken = signAccessToken(cfg, { sub: userId, email, orgId });
    const refreshToken = signRefreshToken(cfg, { sub: userId, email, orgId, sid: familyId });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
        userAgent: meta?.ua,
        ipAddress: meta?.ip,
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: cfg.accessTtl,
    };
  }
}
