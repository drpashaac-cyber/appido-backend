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
exports.TelegramWebhookController = void 0;
const csrf_constants_1 = require("../security/csrf.constants");
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const telegram_service_1 = require("./telegram.service");
const secret_1 = require("./secret");
const queue_module_1 = require("../queue/queue.module");
let TelegramWebhookController = class TelegramWebhookController {
    tg;
    queue;
    constructor(tg, queue) {
        this.tg = tg;
        this.queue = queue;
    }
    async webhook(channelId, req, reply) {
        const raw = req.headers["x-telegram-bot-api-secret-token"];
        const provided = Array.isArray(raw) ? raw[0] : raw;
        const channel = await this.tg.getChannelForWebhook(channelId);
        if (!channel || !(0, secret_1.safeEqual)(provided, channel.botSecret)) {
            void reply.status(403);
            return { ok: false };
        }
        // Fast-ack: enqueue the raw update and return 200 immediately (Telegram retries on non-2xx).
        await this.queue.add("update", { channelId, tenantId: channel.tenantId, update: req.body });
        return { ok: true };
    }
};
exports.TelegramWebhookController = TelegramWebhookController;
__decorate([
    (0, common_1.Post)(":channelId"),
    __param(0, (0, common_1.Param)("channelId")),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TelegramWebhookController.prototype, "webhook", null);
exports.TelegramWebhookController = TelegramWebhookController = __decorate([
    (0, swagger_1.ApiExcludeController)(),
    (0, throttler_1.SkipThrottle)(),
    (0, csrf_constants_1.SkipCsrf)(),
    (0, common_1.Controller)("tg"),
    __param(1, (0, common_1.Inject)(queue_module_1.TG_INGEST_QUEUE)),
    __metadata("design:paramtypes", [telegram_service_1.TelegramService,
        bullmq_1.Queue])
], TelegramWebhookController);
//# sourceMappingURL=telegram-webhook.controller.js.map