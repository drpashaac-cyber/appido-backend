import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RealtimeService } from "./realtime.service";
import { RealtimeController } from "./realtime.controller";

@Module({
  imports: [AuthModule],
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
