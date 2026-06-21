import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

export const DB = Symbol("DB");

// یک کلاس ساده برای DbHandle
class DbHandle {
  constructor(public readonly pool: Pool) {}

  async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const pool = new Pool({
          connectionString: configService.get("DATABASE_URL"),
        });
        return new DbHandle(pool);
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}