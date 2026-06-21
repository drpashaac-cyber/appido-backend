import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlansModule } from "../plans/plans.module";
import { BillingController } from "./billing.controller";
import { BillingAdminController } from "./billing-admin.controller";
import { BillingCallbackController } from "./billing-callback.controller";
import { BillingService } from "./billing.service";

@Module({
  imports: [AuthModule, PlansModule],
  controllers: [BillingController, BillingAdminController, BillingCallbackController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
