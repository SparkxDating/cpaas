import { Injectable } from "@nestjs/common";
import { AppError, toE164 } from "@cpaas/common";
import { generateOtp, hashOtp, loadAuthConfig, safeEqualHex } from "@cpaas/auth";
import { VerificationChannel } from "@cpaas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { MessagingService } from "../messaging/messaging.service";

@Injectable()
export class VerifyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService
  ) {}

  async send(input: {
    projectId: string;
    to: string;
    channel?: VerificationChannel;
    template?: string;
    maxAttempts?: number;
    ttlSeconds?: number;
  }) {
    const channel = input.channel ?? VerificationChannel.SMS;
    const to =
      channel === VerificationChannel.EMAIL ? input.to.toLowerCase() : toE164(input.to);
    const ttl = input.ttlSeconds ?? 300;
    const code = generateOtp(6);
    const cfg = loadAuthConfig();

    const verification = await this.prisma.verification.create({
      data: {
        projectId: input.projectId,
        channel,
        to,
        otpHash: "pending",
        maxAttempts: input.maxAttempts ?? 5,
        expiresAt: new Date(Date.now() + ttl * 1000),
        status: "PENDING",
      },
    });

    const otpHash = hashOtp(code, cfg.otpPepper, verification.id);
    await this.prisma.verification.update({
      where: { id: verification.id },
      data: { otpHash },
    });

    const template = await this.prisma.otpTemplate.findFirst({
      where: {
        projectId: input.projectId,
        channel,
        isActive: true,
        ...(input.template ? { name: input.template } : { name: "default" }),
      },
    });

    const body = (template?.body ??
      "Your verification code is {{code}}. It expires in {{ttl}} minutes.")
      .replace("{{code}}", code)
      .replace("{{ttl}}", String(Math.ceil(ttl / 60)))
      .replace("{{app}}", "CPaaS");

    if (channel === VerificationChannel.SMS || channel === VerificationChannel.WHATSAPP) {
      const msg = await this.messaging.send({
        projectId: input.projectId,
        to,
        body,
        channel: channel === VerificationChannel.WHATSAPP ? "WHATSAPP" : "SMS",
      });
      await this.prisma.verification.update({
        where: { id: verification.id },
        data: { messageId: msg.id },
      });
    } else if (channel === VerificationChannel.EMAIL) {
      // Enqueue via messaging email path
      await this.messaging.sendEmail({
        projectId: input.projectId,
        to,
        subject: "Your verification code",
        textBody: body,
      });
    } else if (channel === VerificationChannel.VOICE) {
      await this.messaging.createCall({
        projectId: input.projectId,
        to,
        metadata: { type: "otp", codeLength: 6 },
      });
    }

    return {
      id: verification.id,
      status: "pending",
      channel,
      to,
      expiresAt: verification.expiresAt,
      // Dev convenience only when NODE_ENV=development
      ...(process.env.NODE_ENV === "development" ? { debugCode: code } : {}),
    };
  }

  async check(input: { projectId: string; id: string; code: string }) {
    const verification = await this.prisma.verification.findFirst({
      where: { id: input.id, projectId: input.projectId },
    });
    if (!verification) throw new AppError("not_found", "Verification not found", 404);

    if (verification.status === "APPROVED") {
      return { id: verification.id, status: "approved" };
    }
    if (verification.status !== "PENDING") {
      throw new AppError("invalid_state", `Verification is ${verification.status.toLowerCase()}`, 400);
    }
    if (verification.expiresAt < new Date()) {
      await this.prisma.verification.update({
        where: { id: verification.id },
        data: { status: "EXPIRED" },
      });
      throw new AppError("expired", "Verification code expired", 400);
    }
    if (verification.attempts >= verification.maxAttempts) {
      await this.prisma.verification.update({
        where: { id: verification.id },
        data: { status: "MAX_ATTEMPTS" },
      });
      throw new AppError("max_attempts", "Maximum attempts exceeded", 400);
    }

    const cfg = loadAuthConfig();
    const candidate = hashOtp(input.code, cfg.otpPepper, verification.id);
    const ok = safeEqualHex(candidate, verification.otpHash);

    await this.prisma.verification.update({
      where: { id: verification.id },
      data: {
        attempts: { increment: 1 },
        ...(ok
          ? { status: "APPROVED", approvedAt: new Date() }
          : verification.attempts + 1 >= verification.maxAttempts
            ? { status: "MAX_ATTEMPTS" }
            : {}),
      },
    });

    if (!ok) throw new AppError("invalid_code", "Invalid verification code", 400);
    return { id: verification.id, status: "approved" };
  }
}
