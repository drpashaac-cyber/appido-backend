import { Module } from "@nestjs/common";
import { QueueModule } from "../queue/queue.module";
import { TelegramService } from "./telegram.service";
import { TelegramController } from "./telegram.controller";
import { TelegramWebhookController } from "./telegram-webhook.controller";
import { AuthModule } from "../auth/auth.module";
@Module({
  imports: [AuthModule, QueueModule],
  controllers: [TelegramController, TelegramWebhookController],
  providers: [TelegramService],
})
export class TelegramModule {}