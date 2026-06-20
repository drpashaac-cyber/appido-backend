import { Inject, Injectable } from "@nestjs/common";
import { cohorts, conversion, funnel, gmv, mrr, overview } from "@appido/analytics";
import type { DbHandle } from "@appido/db";
import { DB } from "../db/db.module";

@Injectable()
export class OwnerAnalyticsService {
  constructor(@Inject(DB) private readonly dbh: DbHandle) {}

  overview() {
    return overview(this.dbh.pool);
  }
  mrr() {
    return mrr(this.dbh.pool);
  }
  gmv(days?: number) {
    return gmv(this.dbh.pool, days);
  }
  funnel() {
    return funnel(this.dbh.pool);
  }
  cohorts(months?: number) {
    return cohorts(this.dbh.pool, months);
  }
  conversion() {
    return conversion(this.dbh.pool);
  }
}
