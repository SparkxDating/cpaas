import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { AppError, QUEUE_NAMES, detectCountryFromE164, toE164 } from "@cpaas/common";
import { MessageChannel, MessageStatus } from "@cpaas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { ProviderRouterService } from "../providers/router.service";

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ProviderRouterService,
    @InjectQueue(QUEUE_NAMES.SMS) private readonly smsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.VOICE) private readonly voiceQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WEBHOOK) private readonly webhookQueue: Queue
  ) {}

  async send(input: {
    projectId: string;
    to: string;
    body: string;
    from?: string;
    channel?: "SMS" | "MMS" | "WHATSAPP" | "RCS";
    mediaUrls?: string[];
    scheduledAt?: Date;
    metadata?: Record<string, unknown>;
  }) {
    const to = toE164(input.to);
    const channel = (input.channel ?? "SMS") as MessageChannel;
    const country = detectCountryFromE164(to);

    if (input.scheduledAt && input.scheduledAt > new Date()) {
      const message = await this.prisma.message.create({
        data: {
          projectId: input.projectId,
          channel,
          toNumber: to,
          fromNumber: input.from,
          body: input.body,
          mediaUrls: input.mediaUrls ?? [],
          country: country ?? undefined,
          status: MessageStatus.SCHEDULED,
          scheduledAt: input.scheduledAt,
          metadata: input.metadata as object | undefined,
        },
      });
      await this.smsQueue.add(
        "send",
        { messageId: message.id },
        { delay: input.scheduledAt.getTime() - Date.now() }
      );
      return message;
    }

    const message = await this.prisma.message.create({
      data: {
        projectId: input.projectId,
        channel,
        toNumber: to,
        fromNumber: input.from,
        body: input.body,
        mediaUrls: input.mediaUrls ?? [],
        country: country ?? undefined,
        status: MessageStatus.QUEUED,
        metadata: input.metadata as object | undefined,
      },
    });

    // Immediate send path (also worker can reprocess)
    const { result, decision } = await this.router.sendSms(input.projectId, {
      to,
      from: input.from,
      body: input.body,
      mediaUrls: input.mediaUrls,
    });

    if (!decision) {
      const failed = await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.FAILED,
          errorCode: "no_provider",
          errorMessage: "No healthy provider available",
        },
      });
      await this.enqueueWebhook(input.projectId, "message.failed", failed);
      return failed;
    }

    const deviceIdFromRaw =
      decision.providerName === "ANDROID_GATEWAY" &&
      result.raw &&
      typeof result.raw === "object" &&
      "deviceId" in result.raw
        ? String((result.raw as { deviceId: string }).deviceId)
        : undefined;

    const updated = await this.prisma.message.update({
      where: { id: message.id },
      data: {
        providerId: decision.providerId,
        providerMessageId: result.providerMessageId || null,
        status:
          result.status === "failed"
            ? MessageStatus.FAILED
            : result.status === "sent"
              ? MessageStatus.SENT
              : MessageStatus.SENDING,
        priceMinor: decision.costMinor,
        currency: "USD",
        sentAt: result.status === "sent" ? new Date() : null,
        errorMessage:
          result.status === "failed"
            ? String(
                (result.raw as { error?: string } | undefined)?.error ??
                  "provider_failed"
              )
            : null,
        deviceId: deviceIdFromRaw,
      },
    });

    // Link outbox row back to the message so device delivery reports update it
    if (
      decision.providerName === "ANDROID_GATEWAY" &&
      result.providerMessageId
    ) {
      await this.prisma.deviceOutbox.updateMany({
        where: { id: result.providerMessageId },
        data: { messageId: updated.id },
      });
    }

    await this.prisma.usageRecord.create({
      data: {
        projectId: input.projectId,
        product: channel.toLowerCase(),
        quantity: 1,
        unitPriceMinor: decision.costMinor,
        totalMinor: decision.costMinor,
        currency: "USD",
        resourceId: updated.id,
        country: country ?? undefined,
        provider: decision.providerName,
      },
    });

    await this.debitWallet(input.projectId, decision.costMinor, updated.id);

    await this.enqueueWebhook(
      input.projectId,
      result.status === "failed"
        ? "message.failed"
        : result.status === "sent"
          ? "message.sent"
          : "message.queued",
      updated
    );

    return updated;
  }

  async sendEmail(input: {
    projectId: string;
    to: string;
    subject: string;
    htmlBody?: string;
    textBody?: string;
    from?: string;
  }) {
    const email = await this.prisma.emailMessage.create({
      data: {
        projectId: input.projectId,
        toEmail: input.to,
        fromEmail: input.from ?? process.env.SMTP_FROM ?? "noreply@cpaas.local",
        subject: input.subject,
        htmlBody: input.htmlBody,
        textBody: input.textBody,
        status: "QUEUED",
        cc: [],
        bcc: [],
      },
    });
    await this.emailQueue.add("send", { emailId: email.id });
    return email;
  }

  async createCall(input: {
    projectId: string;
    to: string;
    from?: string;
    metadata?: Record<string, unknown>;
  }) {
    const to = toE164(input.to);
    const call = await this.prisma.call.create({
      data: {
        projectId: input.projectId,
        toNumber: to,
        fromNumber: input.from,
        status: "QUEUED",
        metadata: input.metadata as object | undefined,
      },
    });
    await this.voiceQueue.add("outbound", { callId: call.id });
    return call;
  }

  async listMessages(projectId: string, take = 50) {
    return this.prisma.message.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: Math.min(take, 200),
    });
  }

  private async debitWallet(projectId: string, amountMinor: number, messageId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { organization: { include: { wallet: true } } },
    });
    const wallet = project?.organization.wallet;
    if (!wallet) return;

    // Soft balance check for LIVE projects
    if (project.environment === "LIVE" && wallet.balanceMinor < BigInt(amountMinor)) {
      throw new AppError("insufficient_funds", "Wallet balance too low", 402);
    }

    const balanceAfter = wallet.balanceMinor - BigInt(amountMinor);
    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balanceMinor: balanceAfter },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "DEBIT",
          amountMinor: BigInt(amountMinor),
          balanceAfter,
          currency: wallet.currency,
          description: "SMS message",
          referenceType: "message",
          referenceId: messageId,
        },
      }),
    ]);
  }

  private async enqueueWebhook(projectId: string, event: string, payload: unknown) {
    await this.webhookQueue.add("deliver", { projectId, event, payload });
  }
}
