import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OwnerAnalyticsController } from "./owner-analytics.controller";
import { OwnerAnalyticsService } from "./owner-analytics.service";

@Module({
  imports: [AuthModule],
  controllers: [OwnerAnalyticsController],
  providers: [OwnerAnalyticsService],
  exports: [OwnerAnalyticsService],
})
export class OwnerAnalyticsModule {}
