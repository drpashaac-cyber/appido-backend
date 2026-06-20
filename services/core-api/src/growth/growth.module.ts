import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { GrowthController } from "./growth.controller";
import { GrowthService } from "./growth.service";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [GrowthController],
  providers: [GrowthService],
  exports: [GrowthService],
})
export class GrowthModule {}
