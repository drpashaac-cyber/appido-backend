import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiPublicController } from "./ai-public.controller";
import { AiService } from "./ai.service";
import { AuthModule } from "../auth/auth.module";

@Module({ imports: [AuthModule], controllers: [AiController, AiPublicController], providers: [AiService], exports: [AiService] })
export class AiModule {}
