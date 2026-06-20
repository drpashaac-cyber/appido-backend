"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlansService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const db_module_1 = require("../db/db.module");
const PLATFORM = { platform: true };
const strArr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
const slug = (s) => (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
let PlansService = class PlansService {
    dbh;
    constructor(dbh) {
        this.dbh = dbh;
    }
    toPublic(r) {
        return {
            key: r.key, name: r.name, descFa: r.descFa, descEn: r.descEn,
            priceCents: r.priceCents, annualCents: r.annualCents, currency: r.currency, periodDays: r.periodDays,
            featuresFa: strArr(r.featuresFa), featuresEn: strArr(r.featuresEn), popular: r.popular,
        };
    }
    toAdmin(r) {
        return { id: r.id, ...this.toPublic(r), active: r.active, sortOrder: r.sortOrder, updatedAt: r.updatedAt };
    }
    /** Active plans for the landing page + dashboard (public, no secrets). */
    listPublic() {
        return (0, db_1.runWithRls)(this.dbh.pool, PLATFORM, async (tx) => {
            const rows = await tx.select().from(db_1.schema.appidoPlans).where((0, drizzle_orm_1.eq)(db_1.schema.appidoPlans.active, true))
                .orderBy((0, drizzle_orm_1.asc)(db_1.schema.appidoPlans.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.appidoPlans.priceCents));
            return rows.map((r) => this.toPublic(r));
        });
    }
    /** All plans incl. inactive — owner console. */
    listAll() {
        return (0, db_1.runWithRls)(this.dbh.pool, PLATFORM, async (tx) => {
            const rows = await tx.select().from(db_1.schema.appidoPlans)
                .orderBy((0, drizzle_orm_1.asc)(db_1.schema.appidoPlans.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.appidoPlans.priceCents));
            return rows.map((r) => this.toAdmin(r));
        });
    }
    create(input) {
        return (0, db_1.runWithRls)(this.dbh.pool, PLATFORM, async (tx) => {
            const key = slug(input.key) || slug(input.name) || "plan-" + Date.now();
            const [row] = await tx.insert(db_1.schema.appidoPlans).values({
                key, name: input.name || "Plan", descFa: input.descFa ?? null, descEn: input.descEn ?? null,
                priceCents: Math.max(0, Math.round(input.priceCents ?? 0)),
                annualCents: input.annualCents ?? null, currency: input.currency || "USD",
                periodDays: input.periodDays ?? 30, featuresFa: input.featuresFa ?? [], featuresEn: input.featuresEn ?? [],
                popular: !!input.popular, active: input.active ?? true, sortOrder: input.sortOrder ?? 99,
            }).returning();
            return this.toAdmin(row);
        });
    }
    update(id, patch) {
        return (0, db_1.runWithRls)(this.dbh.pool, PLATFORM, async (tx) => {
            const set = { updatedAt: new Date() };
            if (patch.name !== undefined)
                set.name = patch.name;
            if (patch.descFa !== undefined)
                set.descFa = patch.descFa;
            if (patch.descEn !== undefined)
                set.descEn = patch.descEn;
            if (patch.priceCents !== undefined)
                set.priceCents = Math.max(0, Math.round(patch.priceCents));
            if (patch.annualCents !== undefined)
                set.annualCents = patch.annualCents;
            if (patch.currency !== undefined)
                set.currency = patch.currency;
            if (patch.periodDays !== undefined)
                set.periodDays = patch.periodDays;
            if (patch.featuresFa !== undefined)
                set.featuresFa = patch.featuresFa;
            if (patch.featuresEn !== undefined)
                set.featuresEn = patch.featuresEn;
            if (patch.popular !== undefined)
                set.popular = !!patch.popular;
            if (patch.active !== undefined)
                set.active = !!patch.active;
            if (patch.sortOrder !== undefined)
                set.sortOrder = patch.sortOrder;
            const [row] = await tx.update(db_1.schema.appidoPlans).set(set).where((0, drizzle_orm_1.eq)(db_1.schema.appidoPlans.id, id)).returning();
            if (!row)
                throw new common_1.NotFoundException("plan_not_found");
            return this.toAdmin(row);
        });
    }
    /** Soft delete — keeps existing subscriptions valid and hides the plan from landing/checkout. */
    remove(id) {
        return (0, db_1.runWithRls)(this.dbh.pool, PLATFORM, async (tx) => {
            const [row] = await tx.update(db_1.schema.appidoPlans).set({ active: false, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.appidoPlans.id, id)).returning({ id: db_1.schema.appidoPlans.id });
            if (!row)
                throw new common_1.NotFoundException("plan_not_found");
            return { ok: true };
        });
    }
    /** Checkout pricing — the DB catalog is the source of truth (null if the key is unknown/inactive). */
    pricing(key) {
        return (0, db_1.runWithRls)(this.dbh.pool, PLATFORM, async (tx) => {
            const [row] = await tx
                .select({ priceCents: db_1.schema.appidoPlans.priceCents, currency: db_1.schema.appidoPlans.currency, periodDays: db_1.schema.appidoPlans.periodDays, active: db_1.schema.appidoPlans.active })
                .from(db_1.schema.appidoPlans)
                .where((0, drizzle_orm_1.eq)(db_1.schema.appidoPlans.key, key))
                .limit(1);
            return row ?? null;
        });
    }
};
exports.PlansService = PlansService;
exports.PlansService = PlansService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __metadata("design:paramtypes", [Object])
], PlansService);
//# sourceMappingURL=plans.service.js.map