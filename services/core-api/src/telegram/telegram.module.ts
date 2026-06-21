import { Module } from "@nestjs/common";
import { QueueModule } from "../queue/queue.module";
import { TelegramService } from "./telegram.service";
import { TelegramController } from "./telegram.controller";
// import { TelegramWebhookController } from "./telegram-webhook.controller"; // <--- کامنت شد
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [TelegramController], // <--- TelegramWebhookController حذف شد
  providers: [TelegramService],
})
export class TelegramModule {}