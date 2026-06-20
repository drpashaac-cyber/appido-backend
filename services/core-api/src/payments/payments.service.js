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
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const crypto_1 = require("@appido/crypto");
const payments_1 = require("@appido/payments");
const db_module_1 = require("../db/db.module");
const config_module_1 = require("../config/config.module");
const crypto_module_1 = require("../crypto/crypto.module");
let PaymentsService = class PaymentsService {
    dbh;
    cipher;
    config;
    constructor(dbh, cipher, config) {
        this.dbh = dbh;
        this.cipher = cipher;
        this.config = config;
    }
    env() {
        return { tronApiKey: this.config.TRON_API_KEY, bscscanApiKey: this.config.BSCSCAN_API_KEY, tonApiKey: this.config.TON_API_KEY };
    }
    /** Gateway catalog from the registry (incl. "coming soon"); no secrets, safe to expose. */
    catalog() {
        return (0, payments_1.paymentCatalog)();
    }
    /** method -> enabled for any policy rows present (absent = enabled). */
    async gatewayPolicyMap() {
        const rows = await (0, db_1.runWithRls)(this.dbh.pool, { platform: true }, (tx) => tx.select({ method: db_1.schema.appidoGatewayPolicy.method, enabled: db_1.schema.appidoGatewayPolicy.enabled }).from(db_1.schema.appidoGatewayPolicy));
        const map = {};
        for (const r of rows)
            map[r.method] = r.enabled;
        return map;
    }
    /** Tenant-facing catalog with the platform policy applied (adds platformEnabled). */
    async catalogWithPolicy() {
        const pol = await this.gatewayPolicyMap();
        return (0, payments_1.paymentCatalog)().map((g) => ({ ...g, platformEnabled: pol[g.method] !== false }));
    }
    /** Owner view — every registry method with its platform on/off state. */
    async listGatewayPolicy() {
        const pol = await this.gatewayPolicyMap();
        return (0, payments_1.paymentCatalog)().map((g) => ({ method: g.method, label: g.label, group: g.group, crypto: !!g.crypto, available: g.available, enabled: pol[g.method] !== false }));
    }
    /** Owner sets a method on/off for all tenants. */
    async setGatewayPolicy(method, enabled) {
        if (!(0, payments_1.gatewayDef)(method))
            throw new common_1.BadRequestException("payment_method_unknown");
        await (0, db_1.runWithRls)(this.dbh.pool, { platform: true }, (tx) => tx
            .insert(db_1.schema.appidoGatewayPolicy)
            .values({ method, enabled, updatedAt: new Date() })
            .onConflictDoUpdate({ target: db_1.schema.appidoGatewayPolicy.method, set: { enabled, updatedAt: new Date() } }));
        return { method, enabled };
    }
    listCredentials(ctx) {
        // never returns secret_enc
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx
            .select({
            id: db_1.schema.paymentCredentials.id,
            method: db_1.schema.paymentCredentials.method,
            kind: db_1.schema.paymentCredentials.kind,
            enabled: db_1.schema.paymentCredentials.enabled,
            verifiedAt: db_1.schema.paymentCredentials.verifiedAt,
            createdAt: db_1.schema.paymentCredentials.createdAt,
        })
            .from(db_1.schema.paymentCredentials));
    }
    async upsertCredential(ctx, input) {
        const def = (0, payments_1.gatewayDef)(input.method);
        if (!def)
            throw new common_1.BadRequestException("payment_method_unknown");
        if (!def.available)
            throw new common_1.BadRequestException("payment_method_coming_soon");
        const pol = await this.gatewayPolicyMap();
        if (pol[input.method] === false)
            throw new common_1.BadRequestException("payment_method_disabled");
        const secretEnc = input.kind === "manual" ? null : this.cipher.encrypt(JSON.stringify(input.secret ?? {}));
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const [existing] = await tx
                .select({ id: db_1.schema.paymentCredentials.id })
                .from(db_1.schema.paymentCredentials)
                .where((0, drizzle_orm_1.eq)(db_1.schema.paymentCredentials.method, input.method))
                .limit(1);
            if (existing) {
                await tx
                    .update(db_1.schema.paymentCredentials)
                    .set({ kind: input.kind, secretEnc, verifiedAt: null })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.paymentCredentials.id, existing.id));
                return { id: existing.id, updated: true };
            }
            const [row] = await tx
                .insert(db_1.schema.paymentCredentials)
                .values({ tenantId: ctx.tenantId, method: input.method, kind: input.kind, secretEnc, enabled: false })
                .returning({ id: db_1.schema.paymentCredentials.id });
            return { id: row.id, updated: false };
        });
    }
    async setEnabled(ctx, id, enabled) {
        const rows = await (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx.update(db_1.schema.paymentCredentials).set({ enabled }).where((0, drizzle_orm_1.eq)(db_1.schema.paymentCredentials.id, id)).returning({ id: db_1.schema.paymentCredentials.id }));
        if (rows.length === 0)
            throw new common_1.NotFoundException("credential_not_found");
        return { ok: true, enabled };
    }
    async deleteCredential(ctx, id) {
        await (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx.delete(db_1.schema.paymentCredentials).where((0, drizzle_orm_1.eq)(db_1.schema.paymentCredentials.id, id)));
        return { ok: true };
    }
    /** Tenant marks an offline/manual payment as received. */
    async confirmManual(ctx, transactionId) {
        return (0, payments_1.finalizeTransaction)(this.dbh.pool, this.cipher, { tenantId: ctx.tenantId, transactionId });
    }
    /** Public gateway return (browser redirect): verify with the tenant's own gateway, then finalize.
     *  Works for every redirect gateway (ZarinPal/IDPay/NextPay/Stripe/PayPal). verify() is the
     *  authoritative server-to-server check; query params only short-circuit explicit cancellation. */
    async gatewayCallback(transactionId, query) {
        const trx = await (0, db_1.runWithRls)(this.dbh.pool, { platform: true }, async (t) => {
            const [r] = await t.select().from(db_1.schema.transactions).where((0, drizzle_orm_1.eq)(db_1.schema.transactions.id, transactionId)).limit(1);
            return r ?? null;
        });
        if (!trx)
            return { ok: false };
        if (trx.status !== "pending")
            return { ok: trx.status === "ok" }; // idempotent
        const method = trx.gateway;
        const fail = () => (0, db_1.runWithRls)(this.dbh.pool, { platform: false, tenantId: trx.tenantId }, (t) => t.update(db_1.schema.transactions).set({ status: "fail" }).where((0, drizzle_orm_1.eq)(db_1.schema.transactions.id, transactionId)));
        const statusQ = (query.Status ?? query.status ?? "").toLowerCase();
        if (statusQ === "nok" || statusQ === "cancel" || statusQ === "canceled" || statusQ === "failed") {
            await fail();
            return { ok: false };
        }
        const cred = await (0, db_1.runWithRls)(this.dbh.pool, { platform: false, tenantId: trx.tenantId }, async (t) => {
            const [c] = await t.select().from(db_1.schema.paymentCredentials).where((0, drizzle_orm_1.eq)(db_1.schema.paymentCredentials.method, method)).limit(1);
            return c ?? null;
        });
        if (!cred?.secretEnc) {
            await fail();
            return { ok: false };
        }
        const secret = JSON.parse(this.cipher.decrypt(cred.secretEnc));
        const provider = (0, payments_1.resolveProvider)(method, secret, this.env());
        const providerRef = trx.providerRef ?? query.Authority ?? query.authority ?? query.id ?? query.token ?? undefined;
        const v = await provider.verify({ amountCents: trx.amountCents, currency: trx.currency, providerRef, reference: transactionId });
        if (v.status === "confirmed") {
            await (0, payments_1.finalizeTransaction)(this.dbh.pool, this.cipher, { tenantId: trx.tenantId, transactionId, providerRef: v.providerRef });
            return { ok: true };
        }
        await fail();
        return { ok: false };
    }
    /** Back-compat ZarinPal return → generic callback. */
    async zarinpalCallback(transactionId, authority, status) {
        return this.gatewayCallback(transactionId, { Authority: authority, Status: status });
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __param(1, (0, common_1.Inject)(crypto_module_1.SECRET_CIPHER)),
    __param(2, (0, common_1.Inject)(config_module_1.APP_CONFIG)),
    __metadata("design:paramtypes", [Object, crypto_1.SecretCipher, Object])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map