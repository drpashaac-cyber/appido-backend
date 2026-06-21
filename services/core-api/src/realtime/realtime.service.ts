import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { Redis } from "ioredis";
import { Subject, Observable } from "rxjs";
import type { RealtimeEvent } from "@appido/types";
import { REDIS, REDIS_SUB } from "../redis/redis.module";

const CHANNEL_PREFIX = "rt:";

/**
 * Live data backbone. publish() fans out across all API instances via Redis
 * pub/sub; stream() returns a per-connection Observable scoped to one tenant.
 * Events get published by each domain as it ships (messages P3, usage P4, payments P5).
 */
@Injectable()
export class RealtimeService implements OnModuleInit {
  private readonly subjects = new Map<string, Set<Subject<RealtimeEvent>>>();

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(REDIS_SUB) private readonly sub: Redis,
  ) {}

  onModuleInit(): void {
    void this.sub.psubscribe(`${CHANNEL_PREFIX}*`);
    this.sub.on("pmessage", (_pattern: string, channel: string, message: string) => {
      const tenantId = channel.slice(CHANNEL_PREFIX.length);
      const listeners = this.subjects.get(tenantId);
      if (!listeners?.size) return;
      let event: RealtimeEvent;
      try {
        event = JSON.parse(message) as RealtimeEvent;
      } catch {
        return;
      }
      for (const s of listeners) s.next(event);
    });
  }

  async publish(event: RealtimeEvent): Promise<void> {
    await this.redis.publish(`${CHANNEL_PREFIX}${event.tenantId}`, JSON.stringify(event));
  }

  stream(tenantId: string): Observable<RealtimeEvent> {
    const subject = new Subject<RealtimeEvent>();
    const set = this.subjects.get(tenantId) ?? new Set<Subject<RealtimeEvent>>();
    set.add(subject);
    this.subjects.set(tenantId, set);
    return new Observable<RealtimeEvent>((subscriber) => {
      const sub = subject.subscribe(subscriber);
      return () => {
        sub.unsubscribe();
        set.delete(subject);
        if (set.size === 0) this.subjects.delete(tenantId);
      };
    });
  }
}
