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
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const payments_1 = require("@appido/payments");
const db_module_1 = require("../db/db.module");
const config_module_1 = require("../config/config.module");
const plans_service_1 = require("../plans/plans.service");
let BillingService = class BillingService {
    dbh;
    config;
    plans;
    constructor(dbh, config, plans) {
        this.dbh = dbh;
        this.config = config;
        this.plans = plans;
    }
    env() {
        return { tronApiKey: this.config.TRON_API_KEY, bscscanApiKey: this.config.BSCSCAN_API_KEY, tonApiKey: this.config.TON_API_KEY };
    }
    // Appido's OWN gateway (central, from config) — never a tenant's keys.
    gateway() {
        if (!this.config.APPIDO_PAY_SECRET)
            return null;
        try {
            return { method: this.config.APPIDO_PAY_METHOD, secret: JSON.parse(this.config.APPIDO_PAY_SECRET), env: this.env() };
        }
        catch {
            return null;
        }
    }
    async currentSubscription(ctx) {
        const now = new Date();
        const [sub] = await (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx
            .select({ plan: db_1.schema.subscriptions.plan, status: db_1.schema.subscriptions.status, periodEnd: db_1.schema.subscriptions.periodEnd })
            .from(db_1.schema.subscriptions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.subscriptions.status, "active"), (0, drizzle_orm_1.gt)(db_1.schema.subscriptions.periodEnd, now)))
            .orderBy((0, drizzle_orm_1.desc)(db_1.schema.subscriptions.createdAt))
            .limit(1));
        return { subscription: sub ?? null, plans: await this.plans.listPublic() };
    }
    async checkout(ctx, plan) {
        const gw = this.gateway();
        if (!gw)
            throw new common_1.ServiceUnavailableException("appido_billing_not_configured");
        const pr = await this.plans.pricing(plan);
        if (!pr || !pr.active)
            throw new common_1.BadRequestException("plan_unavailable");
        return (0, payments_1.createSubscriptionCheckout)(this.dbh.pool, {
            tenantId: ctx.tenantId,
            plan,
            pricing: { amountCents: pr.priceCents, currency: pr.currency, periodDays: pr.periodDays },
            gateway: gw,
            publicBaseUrl: this.config.PUBLIC_BASE_URL,
        });
    }
    async redeem(ctx, code) {
        const r = await (0, payments_1.redeemActivationCode)(this.dbh.pool, { tenantId: ctx.tenantId, code });
        return r;
    }
    // owner-only (billing:manage)
    issueCodes(_ctx, body) {
        return (0, payments_1.generateActivationCodes)(this.dbh.pool, body);
    }
    listCodes(_ctx) {
        return (0, payments_1.listActivationCodes)(this.dbh.pool);
    }
    // public ZarinPal return for an Appido subscription payment
    async zarinpalCallback(subscriptionId, authority, status) {
        const sub = await (0, db_1.runWithRls)(this.dbh.pool, { platform: true }, async (tx) => {
            const [r] = await tx.select().from(db_1.schema.subscriptions).where((0, drizzle_orm_1.eq)(db_1.schema.subscriptions.id, subscriptionId)).limit(1);
            return r ?? null;
        });
        if (!sub)
            return { ok: false };
        if (sub.status === "active")
            return { ok: true }; // idempotent
        if (status !== "OK")
            return { ok: false };
        const gw = this.gateway();
        if (!gw)
            return { ok: false };
        const provider = (0, payments_1.resolveProvider)(gw.method, gw.secret, gw.env);
        const v = await provider.verify({ amountCents: sub.amountCents, currency: sub.currency, providerRef: authority });
        if (v.status !== "confirmed")
            return { ok: false };
        const pr = await this.plans.pricing(sub.plan);
        await (0, payments_1.activateSubscription)(this.dbh.pool, { tenantId: sub.tenantId, subscriptionId, plan: sub.plan, periodDays: pr?.periodDays, providerRef: v.providerRef });
        return { ok: true };
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __param(1, (0, common_1.Inject)(config_module_1.APP_CONFIG)),
    __metadata("design:paramtypes", [Object, Object, plans_service_1.PlansService])
], BillingService);
//# sourceMappingURL=billing.service.js.map