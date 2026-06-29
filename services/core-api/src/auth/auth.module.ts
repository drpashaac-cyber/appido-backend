import { Module } from "@nestjs/common";
import { ConfigModule, APP_CONFIG } from "../config/config.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { MeController } from "./me.controller";
import { PasswordService } from "./password.service";
import { EmailService, ConsoleEmailService, ResendEmailService } from "./email.service";
import type { AppConfig } from "@appido/config";
import { AuthGuard } from "./auth.guard";
import { RolesGuard } from "./roles.guard";

@Module({
  imports: [ConfigModule],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    PasswordService,
    {
      provide: EmailService,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) =>
        cfg.RESEND_API_KEY ? new ResendEmailService(cfg) : new ConsoleEmailService(),
    },
    AuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}
