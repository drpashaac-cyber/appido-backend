import { SkipCsrf } from "../security/csrf.constants";
import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { schema, type DbHandle } from "@appido/db";
import { DB } from "../db/db.module";
import { TrackDto } from "../common/dto/track.dto";

@ApiTags("analytics")
@Controller("api")
export class AnalyticsController {
  constructor(@Inject(DB) private readonly dbh: DbHandle) {}

  /** Public funnel event from the landing page (not tenant-scoped). */
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @SkipCsrf()
  @Post("track")
  async track(@Body() body: TrackDto): Promise<{ ok: true }> {
    await this.dbh.db.insert(schema.analyticsEvents).values({
      name: body.name,
      anonId: body.anonId,
      props: (body.props ?? null) as Record<string, unknown> | null,
    });
    return { ok: true };
  }
}
