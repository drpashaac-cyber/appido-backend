import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { asc, eq, type InferSelectModel } from "drizzle-orm";
import { runWithRls, schema, type DbHandle } from "@appido/db";
import { DB } from "../db/db.module";

const PLATFORM = { platform: true as const };
type PlanRow = InferSelectModel<typeof schema.appidoPlans>;
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const slug = (s?: string): string => (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export interface PlanInput {
  key?: string; name?: string; descFa?: string | null; descEn?: string | null;
  priceCents?: number; annualCents?: number | null; currency?: string; periodDays?: number;
  featuresFa?: string[]; featuresEn?: string[]; popular?: boolean; active?: boolean; sortOrder?: number;
}

@Injectable()
export class PlansService {
  constructor(@Inject(DB) private readonly dbh: DbHandle) {}

  private toPublic(r: PlanRow) {
    return {
      key: r.key, name: r.name, descFa: r.descFa, descEn: r.descEn,
      priceCents: r.priceCents, annualCents: r.annualCents, currency: r.currency, periodDays: r.periodDays,
      featuresFa: strArr(r.featuresFa), featuresEn: strArr(r.featuresEn), popular: r.popular,
    };
  }
  private toAdmin(r: PlanRow) {
    return { id: r.id, ...this.toPublic(r), active: r.active, sortOrder: r.sortOrder, updatedAt: r.updatedAt };
  }

  /** Active plans for the landing page + dashboard (public, no secrets). */
  listPublic() {
    return runWithRls(this.dbh.pool, PLATFORM, async (tx) => {
      const rows = await tx.select().from(schema.appidoPlans).where(eq(schema.appidoPlans.active, true))
        .orderBy(asc(schema.appidoPlans.sortOrder), asc(schema.appidoPlans.priceCents));
      return rows.map((r) => this.toPublic(r));
    });
  }

  /** All plans incl. inactive — owner console. */
  listAll() {
    return runWithRls(this.dbh.pool, PLATFORM, async (tx) => {
      const rows = await tx.select().from(schema.appidoPlans)
        .orderBy(asc(schema.appidoPlans.sortOrder), asc(schema.appidoPlans.priceCents));
      return rows.map((r) => this.toAdmin(r));
    });
  }

  create(input: PlanInput) {
    return runWithRls(this.dbh.pool, PLATFORM, async (tx) => {
      const key = slug(input.key) || slug(input.name) || "plan-" + Date.now();
      const [row] = await tx.insert(schema.appidoPlans).values({
        key, name: input.name || "Plan", descFa: input.descFa ?? null, descEn: input.descEn ?? null,
        priceCents: Math.max(0, Math.round(input.priceCents ?? 0)),
        annualCents: input.annualCents ?? null, currency: input.currency || "USD",
        periodDays: input.periodDays ?? 30, featuresFa: input.featuresFa ?? [], featuresEn: input.featuresEn ?? [],
        popular: !!input.popular, active: input.active ?? true, sortOrder: input.sortOrder ?? 99,
      }).returning();
      return this.toAdmin(row);
    });
  }

  update(id: string, patch: PlanInput) {
    return runWithRls(this.dbh.pool, PLATFORM, async (tx) => {
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.descFa !== undefined) set.descFa = patch.descFa;
      if (patch.descEn !== undefined) set.descEn = patch.descEn;
      if (patch.priceCents !== undefined) set.priceCents = Math.max(0, Math.round(patch.priceCents));
      if (patch.annualCents !== undefined) set.annualCents = patch.annualCents;
      if (patch.currency !== undefined) set.currency = patch.currency;
      if (patch.periodDays !== undefined) set.periodDays = patch.periodDays;
      if (patch.featuresFa !== undefined) set.featuresFa = patch.featuresFa;
      if (patch.featuresEn !== undefined) set.featuresEn = patch.featuresEn;
      if (patch.popular !== undefined) set.popular = !!patch.popular;
      if (patch.active !== undefined) set.active = !!patch.active;
      if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder;
      const [row] = await tx.update(schema.appidoPlans).set(set).where(eq(schema.appidoPlans.id, id)).returning();
      if (!row) throw new NotFoundException("plan_not_found");
      return this.toAdmin(row);
    });
  }

  /** Soft delete — keeps existing subscriptions valid and hides the plan from landing/checkout. */
  remove(id: string) {
    return runWithRls(this.dbh.pool, PLATFORM, async (tx) => {
      const [row] = await tx.update(schema.appidoPlans).set({ active: false, updatedAt: new Date() })
        .where(eq(schema.appidoPlans.id, id)).returning({ id: schema.appidoPlans.id });
      if (!row) throw new NotFoundException("plan_not_found");
      return { ok: true as const };
    });
  }

  /** Checkout pricing — the DB catalog is the source of truth (null if the key is unknown/inactive). */
  pricing(key: string): Promise<{ priceCents: number; currency: string; periodDays: number; active: boolean } | null> {
    return runWithRls(this.dbh.pool, PLATFORM, async (tx) => {
      const [row] = await tx
        .select({ priceCents: schema.appidoPlans.priceCents, currency: schema.appidoPlans.currency, periodDays: schema.appidoPlans.periodDays, active: schema.appidoPlans.active })
        .from(schema.appidoPlans)
        .where(eq(schema.appidoPlans.key, key))
        .limit(1);
      return row ?? null;
    });
  }
}
