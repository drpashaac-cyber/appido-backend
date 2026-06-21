import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsAdminController } from "./payments-admin.controller";
import { PayCallbackController } from "./pay-callback.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController, PayCallbackController, PaymentsAdminController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
