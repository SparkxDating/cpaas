import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@cpaas/common";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.SMS },
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.VOICE },
      { name: QUEUE_NAMES.WEBHOOK }
    ),
  ],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
