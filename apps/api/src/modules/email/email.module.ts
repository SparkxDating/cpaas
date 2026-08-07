import { Module } from "@nestjs/common";
import { EmailController } from "./email.controller";
import { MessagingModule } from "../messaging/messaging.module";

@Module({
  imports: [MessagingModule],
  controllers: [EmailController],
})
export class EmailModule {}
