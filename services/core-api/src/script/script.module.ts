import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ScriptAdminController } from "./script-admin.controller";
import { ScriptController } from "./script.controller";
import { ScriptService } from "./script.service";

@Module({
  imports: [AuthModule],
  controllers: [ScriptController, ScriptAdminController],
  providers: [ScriptService],
  exports: [ScriptService],
})
export class ScriptModule {}
