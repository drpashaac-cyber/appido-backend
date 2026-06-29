import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDb } from "@appido/db";

export const DB = Symbol("DB");

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>("DATABASE_URL")!;
        return createDb(connectionString);
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
