import { Global, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { loadConfig, type AppConfig } from "@appido/config";

export const APP_CONFIG = "APP_CONFIG"; // <--- اضافه کنید

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      load: [loadConfig],
      isGlobal: true,
    }),
  ],
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => loadConfig(),
    },
  ],
  exports: [NestConfigModule, APP_CONFIG], // <--- APP_CONFIG را به exports اضافه کنید
})
export class ConfigModule {}