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
exports.TelegramService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const drizzle_orm_1 = require("drizzle-orm");
const telegram_1 = require("@appido/telegram");
const crypto_1 = require("@appido/crypto");
const db_1 = require("@appido/db");
const db_module_1 = require("../db/db.module");
const config_module_1 = require("../config/config.module");
const crypto_module_1 = require("../crypto/crypto.module");
const audit_service_1 = require("../audit/audit.service");
const ALLOWED_UPDATES = ["message", "edited_message", "my_chat_member", "chat_member", "callback_query"];
let TelegramService = class TelegramService {
    dbh;
    cipher;
    config;
    audit;
    constructor(dbh, cipher, config, audit) {
        this.dbh = dbh;
        this.cipher = cipher;
        this.config = config;
        this.audit = audit;
    }
    api(token) {
        return new telegram_1.TelegramApi(token, this.config.TELEGRAM_API_BASE);
    }
    /** Step in the ChannelWizard: prove the pasted token is a real, live bot. */
    async verifyToken(token) {
        const me = await this.api(token).getMe();
        return { botId: me.id, username: me.username, firstName: me.first_name };
    }
    /** Create the channel, store the token encrypted, and register the webhook. */
    async connect(ctx, actorUserId, dto) {
        if (!ctx.tenantId)
            throw new common_1.BadRequestException("connect must run in a tenant context");
        const me = await this.api(dto.token).getMe();
        const secret = (0, node_crypto_1.randomBytes)(32).toString("base64url"); // valid Telegram secret_token charset
        const tokenEnc = this.cipher.encrypt(dto.token);
        const channelId = await (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const [row] = await tx
                .insert(db_1.schema.channels)
                .values({
                tenantId: ctx.tenantId,
                name: dto.name ?? me.username ?? "Telegram bot",
                username: me.username ? `@${me.username}` : null,
                botTokenEnc: tokenEnc,
                botSecret: secret,
                botId: me.id,
                botUsername: me.username ?? null,
                aiModel: "claude",
                connectedAt: new Date(),
            })
                .returning({ id: db_1.schema.channels.id });
            return row.id;
        });
        const webhookUrl = `${this.config.PUBLIC_BASE_URL}/tg/${channelId}`;
        await this.api(dto.token).setWebhook({
            url: webhookUrl,
            secretToken: secret,
            allowedUpdates: ALLOWED_UPDATES,
            dropPendingUpdates: true,
        });
        const info = await this.api(dto.token).getWebhookInfo();
        await this.audit.record({
            actorUserId,
            tenantId: ctx.tenantId,
            action: "telegram.connect",
            target: channelId,
            meta: { botId: me.id, username: me.username },
        });
        return { channelId, webhookUrl, ok: info.url === webhookUrl, botUsername: me.username ?? null };
    }
    async status(ctx, channelId) {
        const token = await this.tokenFor(ctx, channelId);
        const info = await this.api(token).getWebhookInfo();
        return {
            url: info.url,
            pendingUpdates: info.pending_update_count,
            lastError: info.last_error_message ?? null,
        };
    }
    async disconnect(ctx, actorUserId, channelId) {
        const token = await this.tokenFor(ctx, channelId);
        await this.api(token).deleteWebhook(true);
        await (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx.update(db_1.schema.channels).set({ botSecret: null, connectedAt: null }).where((0, drizzle_orm_1.eq)(db_1.schema.channels.id, channelId)));
        await this.audit.record({ actorUserId, tenantId: ctx.tenantId ?? null, action: "telegram.disconnect", target: channelId });
        return { ok: true };
    }
    async tokenFor(ctx, channelId) {
        const enc = await (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const [row] = await tx
                .select({ enc: db_1.schema.channels.botTokenEnc })
                .from(db_1.schema.channels)
                .where((0, drizzle_orm_1.eq)(db_1.schema.channels.id, channelId))
                .limit(1);
            return row?.enc ?? null;
        });
        if (!enc)
            throw new common_1.NotFoundException("channel_or_token_not_found");
        return this.cipher.decrypt(enc);
    }
    /** Webhook resolver — trusted system path, platform RLS context. */
    async getChannelForWebhook(channelId) {
        const rows = await (0, db_1.runWithRls)(this.dbh.pool, { platform: true }, (tx) => tx
            .select({ tenantId: db_1.schema.channels.tenantId, botSecret: db_1.schema.channels.botSecret })
            .from(db_1.schema.channels)
            .where((0, drizzle_orm_1.eq)(db_1.schema.channels.id, channelId))
            .limit(1));
        return rows[0] ?? null;
    }
};
exports.TelegramService = TelegramService;
exports.TelegramService = TelegramService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __param(1, (0, common_1.Inject)(crypto_module_1.SECRET_CIPHER)),
    __param(2, (0, common_1.Inject)(config_module_1.APP_CONFIG)),
    __metadata("design:paramtypes", [Object, crypto_1.SecretCipher, Object, audit_service_1.AuditService])
], TelegramService);
//# sourceMappingURL=telegram.service.js.map