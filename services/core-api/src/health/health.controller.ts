import { Controller, Get, Inject } from "@nestjs/common";
import { Socket } from "node:net";
import type { DbHandle } from "@appido/db";
import { DB } from "../db/db.module";

@Controller("health")
export class HealthController {
  constructor(@Inject(DB) private readonly db: DbHandle) {}

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
    let url: URL;
    try {
      url = new URL(process.env.REDIS_URL || "redis://redis:6379");
    } catch {
      return false;
    }

    const host = url.hostname || "redis";
    const port = Number(url.port || 6379);

    return new Promise<boolean>((resolve) => {
      const socket = new Socket();
      let done = false;

      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        socket.destroy();
        resolve(ok);
      };

      socket.setTimeout(1500);
      socket.once("connect", () => {
        socket.write("*1\r\n$4\r\nPING\r\n");
      });
      socket.once("data", (buf) => {
        finish(buf.toString("utf8").includes("PONG"));
      });
      socket.once("timeout", () => finish(false));
      socket.once("error", () => finish(false));
      socket.connect(port, host);
    });
  }
}
