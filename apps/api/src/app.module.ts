import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { MetricsModule } from "./metrics/metrics.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrgsModule } from "./modules/orgs/orgs.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { ApiKeysModule } from "./modules/api-keys/api-keys.module";
import { VerifyModule } from "./modules/verify/verify.module";
import { MessagingModule } from "./modules/messaging/messaging.module";
import { VoiceModule } from "./modules/voice/voice.module";
import { EmailModule } from "./modules/email/email.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { BillingModule } from "./modules/billing/billing.module";
import { DevicesModule } from "./modules/devices/devices.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AuthGuard } from "./common/guards/auth.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? "redis://localhost:6379",
      },
    }),
    PrismaModule,
    HealthModule,
    MetricsModule,
    AuthModule,
    OrgsModule,
    ProjectsModule,
    ApiKeysModule,
    ProvidersModule,
    VerifyModule,
    MessagingModule,
    VoiceModule,
    EmailModule,
    WebhooksModule,
    BillingModule,
    DevicesModule,
    AnalyticsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
