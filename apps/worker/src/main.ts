import "./load-env";
import { Worker, Job } from "bullmq";
import nodemailer from "nodemailer";
import { createHash, randomUUID } from "crypto";
import { PrismaClient } from "@cpaas/database";
import { QUEUE_NAMES } from "@cpaas/common";
import { signWebhookPayload } from "@cpaas/auth";
import { createLogger } from "@cpaas/logger";
import { createRedis } from "@cpaas/events";

const logger = createLogger("worker");
const prisma = new PrismaClient();
const connection = createRedis();

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false,
});

async function processEmail(job: Job<{ emailId: string }>) {
  const email = await prisma.emailMessage.findUnique({ where: { id: job.data.emailId } });
  if (!email) return;

  try {
    const info = await mailer.sendMail({
      from: email.fromEmail,
      to: email.toEmail,
      cc: email.cc,
      bcc: email.bcc,
      subject: email.subject,
      text: email.textBody ?? undefined,
      html: email.htmlBody ?? undefined,
    });
    await prisma.emailMessage.update({
      where: { id: email.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerMessageId: info.messageId,
      },
    });
    logger.info("email_sent", { emailId: email.id });
  } catch (err) {
    await prisma.emailMessage.update({
      where: { id: email.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "send_failed",
      },
    });
    throw err;
  }
}

async function processVoice(job: Job<{ callId: string }>) {
  const call = await prisma.call.findUnique({ where: { id: job.data.callId } });
  if (!call) return;

  // Provider-agnostic call orchestration stub that records a completed call lifecycle
  await prisma.call.update({
    where: { id: call.id },
    data: {
      status: "IN_PROGRESS",
      startedAt: new Date(),
      providerCallId: `call_${randomUUID()}`,
    },
  });

  await prisma.call.update({
    where: { id: call.id },
    data: {
      status: "COMPLETED",
      endedAt: new Date(),
      durationSec: 1,
    },
  });
  logger.info("call_completed", { callId: call.id });
}

async function processWebhook(job: Job<{ projectId: string; event: string; payload: unknown }>) {
  const hooks = await prisma.webhook.findMany({
    where: {
      projectId: job.data.projectId,
      status: "ACTIVE",
      events: { has: job.data.event },
    },
  });

  for (const hook of hooks) {
    const body = JSON.stringify({
      id: randomUUID(),
      type: job.data.event,
      created: new Date().toISOString(),
      data: job.data.payload,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(hook.secret, body, timestamp);
    const idempotencyKey = createHash("sha256")
      .update(`${hook.id}:${job.data.event}:${body}`)
      .digest("hex");

    const existing = await prisma.webhookDelivery.findUnique({ where: { idempotencyKey } });
    if (existing?.status === "SUCCESS") continue;

    const delivery = existing
      ? existing
      : await prisma.webhookDelivery.create({
          data: {
            webhookId: hook.id,
            event: job.data.event,
            payload: JSON.parse(body),
            signature,
            idempotencyKey,
            status: "PENDING",
            nextRetryAt: new Date(),
          },
        });

    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cpaas-signature": signature,
          "x-cpaas-timestamp": String(timestamp),
          "x-cpaas-event": job.data.event,
          "idempotency-key": idempotencyKey,
        },
        body,
      });
      const responseBody = await res.text().catch(() => "");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${responseBody.slice(0, 200)}`);

      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SUCCESS",
          attempts: { increment: 1 },
          lastStatus: res.status,
          responseBody: responseBody.slice(0, 2000),
          deliveredAt: new Date(),
        },
      });
    } catch (err) {
      const attempts = delivery.attempts + 1;
      const maxAttempts = delivery.maxAttempts;
      const delaySec = Math.min(3600, 2 ** attempts * 5);
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts,
          lastError: err instanceof Error ? err.message : "failed",
          status: attempts >= maxAttempts ? "DLQ" : "FAILED",
          nextRetryAt:
            attempts >= maxAttempts ? null : new Date(Date.now() + delaySec * 1000),
        },
      });
      if (attempts < maxAttempts) throw err;
    }
  }
}

async function processSms(job: Job<{ messageId: string }>) {
  const message = await prisma.message.findUnique({ where: { id: job.data.messageId } });
  if (!message) return;
  if (message.status === "SCHEDULED" || message.status === "QUEUED") {
    // Mark for API-side resend / keep as queued for device pickup
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "QUEUED" },
    });
  }
}

async function markStaleDevicesOffline() {
  try {
    const cutoff = new Date(Date.now() - 2 * 60_000);
    const result = await prisma.device.updateMany({
      where: {
        status: "ONLINE",
        OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: cutoff } }],
      },
      data: { status: "OFFLINE" },
    });
    if (result.count > 0) {
      logger.info("devices_marked_offline", { count: result.count });
    }
  } catch (err) {
    logger.error("mark_stale_devices_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function startWorkers() {
  const common = { connection };

  new Worker(QUEUE_NAMES.EMAIL, processEmail, common);
  new Worker(QUEUE_NAMES.VOICE, processVoice, common);
  new Worker(QUEUE_NAMES.WEBHOOK, processWebhook, common);
  new Worker(QUEUE_NAMES.SMS, processSms, common);

  setInterval(() => {
    void markStaleDevicesOffline();
  }, 30_000);

  logger.info("workers_started", {
    queues: Object.values(QUEUE_NAMES),
  });
}

startWorkers();

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  connection.disconnect();
  process.exit(0);
});
