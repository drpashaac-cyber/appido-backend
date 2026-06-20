import { Global, Module, type OnModuleDestroy, Inject } from "@nestjs/common";
import { createDb, type DbHandle } from "@appido/db";
import type { AppConfig } from "@appido/config";
import { APP_CONFIG } from "../config/config.module";

export const DB = Symbol("DB");

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): DbHandle => createDb(config.DATABASE_URL),
    },
  ],
  exports: [DB],
})
export class DbModule implements OnModuleDestroy {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}
  async onModuleDestroy(): Promise<void> {
    await this.handle.pool.end();
  }
}
