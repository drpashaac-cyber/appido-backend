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
exports.TenantDataService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const crypto_1 = require("@appido/crypto");
const telegram_1 = require("@appido/telegram");
const db_module_1 = require("../db/db.module");
const crypto_module_1 = require("../crypto/crypto.module");
const pagination_1 = require("../common/pagination");
const FAR_FUTURE = new Date(8640000000000000);
const n = (v) => Number(v ?? 0);
async function rows(tx, q) {
    const res = (await tx.execute(q));
    if (Array.isArray(res))
        return res;
    const r = res.rows;
    return (Array.isArray(r) ? r : []);
}
let TenantDataService = class TenantDataService {
    dbh;
    cipher;
    constructor(dbh, cipher) {
        this.dbh = dbh;
        this.cipher = cipher;
    }
    customers(ctx, limit, cursor) {
        const lim = (0, pagination_1.clampLimit)(limit);
        const cur = (0, pagination_1.cursorToDate)(cursor) ?? FAR_FUTURE;
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const rows = await tx
                .select()
                .from(db_1.schema.customers)
                .where((0, drizzle_orm_1.lt)(db_1.schema.customers.createdAt, cur))
                .orderBy((0, drizzle_orm_1.desc)(db_1.schema.customers.createdAt))
                .limit(lim + 1);
            return (0, pagination_1.buildPage)(rows, lim, (r) => r.createdAt);
        });
    }
    customerDetail(ctx, id) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const [customer] = await tx.select().from(db_1.schema.customers).where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, id)).limit(1);
            if (!customer)
                throw new common_1.NotFoundException("customer_not_found");
            const timeline = await tx
                .select()
                .from(db_1.schema.events)
                .where((0, drizzle_orm_1.eq)(db_1.schema.events.customerId, id))
                .orderBy((0, drizzle_orm_1.desc)(db_1.schema.events.at))
                .limit(50);
            return { customer, timeline };
        });
    }
    products(ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx
            .select({
            id: db_1.schema.products.id,
            name: db_1.schema.products.name,
            priceCents: db_1.schema.products.priceCents,
            currency: db_1.schema.products.currency,
            durationDays: db_1.schema.products.durationDays,
            description: db_1.schema.products.description,
            doc: db_1.schema.products.doc,
            active: db_1.schema.products.active,
            createdAt: db_1.schema.products.createdAt,
            sales: (0, drizzle_orm_1.sql) `(SELECT count(*)::int FROM transactions tx2 WHERE tx2.product_id = ${db_1.schema.products.id} AND tx2.status = 'ok')`,
        })
            .from(db_1.schema.products)
            .orderBy((0, drizzle_orm_1.desc)(db_1.schema.products.createdAt)));
    }
    transactions(ctx, limit, cursor) {
        const lim = (0, pagination_1.clampLimit)(limit);
        const cur = (0, pagination_1.cursorToDate)(cursor) ?? FAR_FUTURE;
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const rows = await tx
                .select({
                id: db_1.schema.transactions.id,
                amountCents: db_1.schema.transactions.amountCents,
                currency: db_1.schema.transactions.currency,
                gateway: db_1.schema.transactions.gateway,
                status: db_1.schema.transactions.status,
                customerId: db_1.schema.transactions.customerId,
                productId: db_1.schema.transactions.productId,
                customerName: db_1.schema.customers.name,
                at: db_1.schema.transactions.at,
            })
                .from(db_1.schema.transactions)
                .leftJoin(db_1.schema.customers, (0, drizzle_orm_1.eq)(db_1.schema.customers.id, db_1.schema.transactions.customerId))
                .where((0, drizzle_orm_1.lt)(db_1.schema.transactions.at, cur))
                .orderBy((0, drizzle_orm_1.desc)(db_1.schema.transactions.at))
                .limit(lim + 1);
            return (0, pagination_1.buildPage)(rows, lim, (r) => r.at);
        });
    }
    // Conversation list for the inbox/CRM: ONE row per customer (their latest message + key fields),
    // most-recent first. Customers without messages sort last (last=null).
    inbox(ctx, limit) {
        const lim = (0, pagination_1.clampLimit)(limit);
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => rows(tx, (0, drizzle_orm_1.sql) `SELECT q.* FROM (
              SELECT DISTINCT ON (c.id)
                c.id AS "customerId", c.name, c.handle, c.tag, c.intent, c.segment,
                c.ai_managed AS "aiManaged", c.is_vip AS "isVip",
                m.body AS last, m.author, m.direction, m.at,
                (SELECT count(*) FROM messages mu WHERE mu.customer_id = c.id AND mu.direction = 'in' AND mu.read_at IS NULL)::int AS unread
              FROM customers c
              LEFT JOIN messages m ON m.customer_id = c.id
              ORDER BY c.id, m.at DESC NULLS LAST
            ) q
            ORDER BY q.at DESC NULLS LAST
            LIMIT ${lim}`));
    }
    // Full chat thread for one customer (oldest → newest) — powers the inbox conversation pane.
    messages(ctx, id, limit) {
        const lim = (0, pagination_1.clampLimit)(limit);
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx
            .select({
            id: db_1.schema.messages.id,
            direction: db_1.schema.messages.direction,
            author: db_1.schema.messages.author,
            body: db_1.schema.messages.body,
            at: db_1.schema.messages.at,
        })
            .from(db_1.schema.messages)
            .where((0, drizzle_orm_1.eq)(db_1.schema.messages.customerId, id))
            .orderBy((0, drizzle_orm_1.asc)(db_1.schema.messages.at))
            .limit(lim));
    }
    // Operator manual reply: send via the channel's Telegram bot and record it as a human message.
    async sendReply(ctx, customerId, text) {
        const body = (text ?? "").trim();
        if (!body)
            throw new common_1.BadRequestException("empty_message");
        if (body.length > 4000)
            throw new common_1.BadRequestException("message_too_long");
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const [customer] = await tx
                .select({ tgUserId: db_1.schema.customers.tgUserId, channelId: db_1.schema.customers.channelId })
                .from(db_1.schema.customers)
                .where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId))
                .limit(1);
            if (!customer)
                throw new common_1.NotFoundException("customer_not_found");
            if (!customer.channelId)
                throw new common_1.BadRequestException("customer_has_no_channel");
            const [channel] = await tx
                .select({ botTokenEnc: db_1.schema.channels.botTokenEnc })
                .from(db_1.schema.channels)
                .where((0, drizzle_orm_1.eq)(db_1.schema.channels.id, customer.channelId))
                .limit(1);
            if (!channel?.botTokenEnc)
                throw new common_1.BadRequestException("channel_not_connected");
            if (customer.tgUserId != null) {
                const telegram = new telegram_1.TelegramApi(this.cipher.decrypt(channel.botTokenEnc));
                await telegram.sendMessage(customer.tgUserId, body);
            }
            const [row] = await tx
                .insert(db_1.schema.messages)
                .values({ tenantId: ctx.tenantId, channelId: customer.channelId, customerId, direction: "out", body, author: "human" })
                .returning({ id: db_1.schema.messages.id, at: db_1.schema.messages.at });
            await tx.insert(db_1.schema.events).values({ tenantId: ctx.tenantId, customerId, type: "message" });
            return { id: row.id, at: row.at, direction: "out", author: "human", body };
        });
    }
    // Mark a customer's inbound messages as read (clears the inbox unread badge).
    async markRead(ctx, customerId) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            await tx
                .update(db_1.schema.messages)
                .set({ readAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.messages.customerId, customerId), (0, drizzle_orm_1.eq)(db_1.schema.messages.direction, "in"), (0, drizzle_orm_1.sql) `${db_1.schema.messages.readAt} IS NULL`));
            return { ok: true };
        });
    }
    // ---- Per-customer consent (governance) ----
    listConsent(ctx, customerId) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx
            .select({ purpose: db_1.schema.customerConsent.purpose, granted: db_1.schema.customerConsent.granted, source: db_1.schema.customerConsent.source, at: db_1.schema.customerConsent.at })
            .from(db_1.schema.customerConsent)
            .where((0, drizzle_orm_1.eq)(db_1.schema.customerConsent.customerId, customerId)));
    }
    async setConsent(ctx, customerId, input) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const [cust] = await tx.select({ id: db_1.schema.customers.id }).from(db_1.schema.customers).where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId)).limit(1);
            if (!cust)
                throw new common_1.NotFoundException("customer_not_found");
            const source = input.source ?? "operator";
            await tx
                .insert(db_1.schema.customerConsent)
                .values({ tenantId: ctx.tenantId, customerId, purpose: input.purpose, granted: input.granted, source, at: new Date() })
                .onConflictDoUpdate({
                target: [db_1.schema.customerConsent.tenantId, db_1.schema.customerConsent.customerId, db_1.schema.customerConsent.purpose],
                set: { granted: input.granted, source, at: new Date() },
            });
            return tx
                .select({ purpose: db_1.schema.customerConsent.purpose, granted: db_1.schema.customerConsent.granted, source: db_1.schema.customerConsent.source, at: db_1.schema.customerConsent.at })
                .from(db_1.schema.customerConsent)
                .where((0, drizzle_orm_1.eq)(db_1.schema.customerConsent.customerId, customerId));
        });
    }
    // DSAR: machine-readable export of everything held about a customer.
    async exportCustomer(ctx, customerId) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const [customer] = await tx.select().from(db_1.schema.customers).where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId)).limit(1);
            if (!customer)
                throw new common_1.NotFoundException("customer_not_found");
            const messages = await tx
                .select({ direction: db_1.schema.messages.direction, body: db_1.schema.messages.body, author: db_1.schema.messages.author, at: db_1.schema.messages.at })
                .from(db_1.schema.messages)
                .where((0, drizzle_orm_1.eq)(db_1.schema.messages.customerId, customerId))
                .orderBy((0, drizzle_orm_1.asc)(db_1.schema.messages.at));
            const events = await tx
                .select({ type: db_1.schema.events.type, amountCents: db_1.schema.events.amountCents, currency: db_1.schema.events.currency, meta: db_1.schema.events.meta, at: db_1.schema.events.at })
                .from(db_1.schema.events)
                .where((0, drizzle_orm_1.eq)(db_1.schema.events.customerId, customerId))
                .orderBy((0, drizzle_orm_1.asc)(db_1.schema.events.at));
            const consent = await tx
                .select({ purpose: db_1.schema.customerConsent.purpose, granted: db_1.schema.customerConsent.granted, source: db_1.schema.customerConsent.source, at: db_1.schema.customerConsent.at })
                .from(db_1.schema.customerConsent)
                .where((0, drizzle_orm_1.eq)(db_1.schema.customerConsent.customerId, customerId));
            const transactions = await tx
                .select({ status: db_1.schema.transactions.status, amountCents: db_1.schema.transactions.amountCents, currency: db_1.schema.transactions.currency, at: db_1.schema.transactions.createdAt })
                .from(db_1.schema.transactions)
                .where((0, drizzle_orm_1.eq)(db_1.schema.transactions.customerId, customerId))
                .orderBy((0, drizzle_orm_1.asc)(db_1.schema.transactions.createdAt));
            return {
                exportedAt: new Date().toISOString(),
                customer: {
                    id: customer.id,
                    name: customer.name,
                    handle: customer.handle,
                    phone: customer.phone,
                    email: customer.email,
                    tag: customer.tag,
                    intent: customer.intent,
                    locale: customer.locale,
                    profile: customer.profile,
                    createdAt: customer.createdAt,
                },
                messages,
                events,
                consent,
                transactions,
            };
        });
    }
    // Right to erasure: deletes the customer; FK cascades remove messages/events/consent/identities.
    async deleteCustomer(ctx, customerId) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const res = await tx.delete(db_1.schema.customers).where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId)).returning({ id: db_1.schema.customers.id });
            if (!res.length)
                throw new common_1.NotFoundException("customer_not_found");
            return { ok: true, deleted: res[0].id };
        });
    }
};
exports.TenantDataService = TenantDataService;
exports.TenantDataService = TenantDataService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __param(1, (0, common_1.Inject)(crypto_module_1.SECRET_CIPHER)),
    __metadata("design:paramtypes", [Object, crypto_1.SecretCipher])
], TenantDataService);
//# sourceMappingURL=tenant-data.service.js.map