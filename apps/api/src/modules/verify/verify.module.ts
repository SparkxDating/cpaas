import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@cpaas/common";
import { VerifyController } from "./verify.controller";
import { VerifyService } from "./verify.service";
import { MessagingModule } from "../messaging/messaging.module";

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.SMS }),
    MessagingModule,
  ],
  controllers: [VerifyController],
  providers: [VerifyService],
  exports: [VerifyService],
})
export class VerifyModule {}
