import { Module } from "@nestjs/common";
import { VoiceController } from "./voice.controller";
import { MessagingModule } from "../messaging/messaging.module";

@Module({
  imports: [MessagingModule],
  controllers: [VoiceController],
})
export class VoiceModule {}
