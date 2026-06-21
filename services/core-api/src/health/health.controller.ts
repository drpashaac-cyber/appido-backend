import { Controller, Get, Inject } from "@nestjs/common";
import type { Redis } from "ioredis";
import type { DbHandle } from "@appido/db";
import { DB } from "../db/db.module";
import { REDIS } from "../redis/redis.module";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: DbHandle,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Liveness — process is up. */
  @Get()
  live(): { status: string; ts: string } {
    return { status: "ok", ts: new Date().toISOString() };
  }

  /** Readiness — dependencies reachable. */
  @Get("ready")
  async ready(): Promise<{ status: string; db: boolean; redis: boolean }> {
    const [db, redis] = await Promise.all([this.pingDb(), this.pingRedis()]);
    return { status: db && redis ? "ok" : "degraded", db, redis };
  }

  private async pingDb(): Promise<boolean> {
    try {
      await this.db.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  private async pingRedis(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === "PONG";
    } catch {
      return false;
    }
  }
}
