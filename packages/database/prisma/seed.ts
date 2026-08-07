import { PrismaClient, OrgRole, ProjectEnv, ProviderName, ProviderType, MessageChannel } from "@prisma/client";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

function hashApiKey(raw: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}${raw}`).digest("hex");
}

function generateApiKey(env: "test" | "live"): { raw: string; prefix: string; lastFour: string } {
  const body = randomBytes(24).toString("base64url");
  const raw = `sk_${env}_${body}`;
  return { raw, prefix: raw.slice(0, 12), lastFour: raw.slice(-4) };
}

async function main() {
  const pepper = process.env.API_KEY_PEPPER ?? "change-me-api-key-pepper-min-32-chars!!";

  const permissions = [
    "org:read",
    "org:write",
    "project:read",
    "project:write",
    "keys:read",
    "keys:write",
    "messages:send",
    "messages:read",
    "verify:send",
    "verify:check",
    "calls:write",
    "email:send",
    "webhooks:write",
    "billing:read",
    "billing:write",
    "devices:write",
    "analytics:read",
    "admin:platform",
  ];

  for (const code of permissions) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, description: code },
      update: {},
    });
  }

  const ownerRole = await prisma.role.upsert({
    where: { name: "owner" },
    create: { name: "owner", description: "Organization owner", isSystem: true },
    update: {},
  });

  const allPerms = await prisma.permission.findMany();
  for (const p of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: ownerRole.id, permissionId: p.id } },
      create: { roleId: ownerRole.id, permissionId: p.id },
      update: {},
    });
  }

  const adminHash = await argon2.hash("ChangeMeAdmin123!");
  const devHash = await argon2.hash("ChangeMeDev123!");

  const admin = await prisma.user.upsert({
    where: { email: "admin@cpaas.local" },
    create: {
      email: "admin@cpaas.local",
      name: "Platform Admin",
      passwordHash: adminHash,
      emailVerifiedAt: new Date(),
    },
    update: { passwordHash: adminHash, emailVerifiedAt: new Date() },
  });

  const dev = await prisma.user.upsert({
    where: { email: "dev@cpaas.local" },
    create: {
      email: "dev@cpaas.local",
      name: "Demo Developer",
      passwordHash: devHash,
      emailVerifiedAt: new Date(),
    },
    update: { passwordHash: devHash, emailVerifiedAt: new Date() },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "acme" },
    create: {
      name: "Acme Communications",
      slug: "acme",
      ownerId: dev.id,
      billingEmail: "billing@acme.local",
      country: "US",
    },
    update: {},
  });

  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: dev.id } },
    create: { organizationId: org.id, userId: dev.id, role: OrgRole.OWNER },
    update: { role: OrgRole.OWNER },
  });

  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: admin.id } },
    create: { organizationId: org.id, userId: admin.id, role: OrgRole.ADMIN },
    update: {},
  });

  await prisma.wallet.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      currency: "USD",
      balanceMinor: BigInt(100_00),
    },
    update: { balanceMinor: BigInt(100_00) },
  });

  const project = await prisma.project.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "default" } },
    create: {
      organizationId: org.id,
      name: "Default",
      slug: "default",
      environment: ProjectEnv.TEST,
      defaultCountry: "US",
      webhookSecret: randomBytes(32).toString("hex"),
      rateLimitRpm: 600,
    },
    update: {},
  });

  const providers: Array<{
    name: ProviderName;
    type: ProviderType;
    displayName: string;
    basePriority: number;
  }> = [
    { name: ProviderName.ANDROID_GATEWAY, type: ProviderType.SMS, displayName: "Android Gateway", basePriority: 10 },
    { name: ProviderName.MSG91, type: ProviderType.SMS, displayName: "MSG91", basePriority: 20 },
    { name: ProviderName.SPRINGEDGE, type: ProviderType.SMS, displayName: "SpringEdge", basePriority: 30 },
    { name: ProviderName.EXOTEL, type: ProviderType.MULTI, displayName: "Exotel", basePriority: 40 },
    { name: ProviderName.TWILIO, type: ProviderType.MULTI, displayName: "Twilio", basePriority: 50 },
    { name: ProviderName.VONAGE, type: ProviderType.MULTI, displayName: "Vonage", basePriority: 60 },
    { name: ProviderName.PLIVO, type: ProviderType.MULTI, displayName: "Plivo", basePriority: 70 },
    { name: ProviderName.TEXTBEE, type: ProviderType.SMS, displayName: "TextBee", basePriority: 80 },
    { name: ProviderName.SMTP, type: ProviderType.EMAIL, displayName: "SMTP", basePriority: 10 },
    { name: ProviderName.SENDGRID, type: ProviderType.EMAIL, displayName: "SendGrid", basePriority: 20 },
    { name: ProviderName.MAILGUN, type: ProviderType.EMAIL, displayName: "Mailgun", basePriority: 30 },
    { name: ProviderName.SES, type: ProviderType.EMAIL, displayName: "Amazon SES", basePriority: 40 },
  ];

  for (const p of providers) {
    await prisma.provider.upsert({
      where: { name: p.name },
      create: { ...p, isActive: true, healthScore: 1, successRate: 1 },
      update: { displayName: p.displayName, basePriority: p.basePriority, isActive: true },
    });
  }

  const android = await prisma.provider.findUniqueOrThrow({ where: { name: ProviderName.ANDROID_GATEWAY } });
  const msg91 = await prisma.provider.findUniqueOrThrow({ where: { name: ProviderName.MSG91 } });
  const spring = await prisma.provider.findUniqueOrThrow({ where: { name: ProviderName.SPRINGEDGE } });
  const twilio = await prisma.provider.findUniqueOrThrow({ where: { name: ProviderName.TWILIO } });

  const routeDefs = [
    { providerId: android.id, priority: 10, costMinor: 0 },
    { providerId: msg91.id, priority: 20, costMinor: 1 },
    { providerId: spring.id, priority: 30, costMinor: 1 },
    { providerId: twilio.id, priority: 50, costMinor: 2 },
  ];

  for (const r of routeDefs) {
    const existing = await prisma.route.findFirst({
      where: { projectId: project.id, providerId: r.providerId, channel: MessageChannel.SMS, country: null },
    });
    if (!existing) {
      await prisma.route.create({
        data: {
          projectId: project.id,
          providerId: r.providerId,
          channel: MessageChannel.SMS,
          priority: r.priority,
          costMinor: r.costMinor,
          isActive: true,
        },
      });
    }
  }

  await prisma.otpTemplate.upsert({
    where: {
      projectId_name_channel: {
        projectId: project.id,
        name: "default",
        channel: "SMS",
      },
    },
    create: {
      projectId: project.id,
      name: "default",
      channel: "SMS",
      body: "Your {{app}} verification code is {{code}}. It expires in {{ttl}} minutes.",
      locale: "en",
    },
    update: {},
  });

  await prisma.pricingPlan.upsert({
    where: { code: "starter" },
    create: {
      code: "starter",
      name: "Starter",
      description: "Pay as you go",
      smsPriceMinor: 1,
      mmsPriceMinor: 3,
      voicePriceMinor: 2,
      emailPriceMinor: 0,
      otpPriceMinor: 1,
    },
    update: {},
  });

  const existingKey = await prisma.apiKey.findFirst({
    where: { projectId: project.id, name: "Seed Test Key" },
  });

  let rawKey: string;
  if (!existingKey) {
    const generated = generateApiKey("test");
    rawKey = generated.raw;
    await prisma.apiKey.create({
      data: {
        projectId: project.id,
        name: "Seed Test Key",
        prefix: generated.prefix,
        keyHash: hashApiKey(generated.raw, pepper),
        lastFour: generated.lastFour,
        environment: ProjectEnv.TEST,
        scopes: ["*"],
        rateLimitRpm: 600,
      },
    });
  } else {
    rawKey = "(existing key — rotate in dashboard to obtain a new secret)";
  }

  console.log("Seed complete");
  console.log("Admin: admin@cpaas.local / ChangeMeAdmin123!");
  console.log("Dev:   dev@cpaas.local / ChangeMeDev123!");
  console.log("Org:   acme");
  console.log("Project:", project.id);
  console.log("API Key:", rawKey);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
