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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpsService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const db_module_1 = require("../db/db.module");
const config_module_1 = require("../config/config.module");
const queue_module_1 = require("../queue/queue.module");
let OpsService = class OpsService {
    dbh;
    config;
    growthQueue;
    constructor(dbh, config, growthQueue) {
        this.dbh = dbh;
        this.config = config;
        this.growthQueue = growthQueue;
    }
    listDeadLetters(_ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, { platform: true }, (tx) => tx.select().from(db_1.schema.deadLetters).orderBy((0, drizzle_orm_1.desc)(db_1.schema.deadLetters.failedAt)).limit(200));
    }
    async replay(_ctx, id) {
        const [dl] = await (0, db_1.runWithRls)(this.dbh.pool, { platform: true }, (tx) => tx.select().from(db_1.schema.deadLetters).where((0, drizzle_orm_1.eq)(db_1.schema.deadLetters.id, id)).limit(1));
        if (!dl)
            throw new common_1.NotFoundException("dead_letter_not_found");
        const conn = new ioredis_1.default(this.config.REDIS_URL, { maxRetriesPerRequest: null });
        const q = new bullmq_1.Queue(dl.queue, { connection: conn });
        try {
            await q.add(dl.jobName ?? "job", (dl.payload ?? {}));
        }
        finally {
            await q.close();
            await conn.quit();
        }
        await (0, db_1.runWithRls)(this.dbh.pool, { platform: true }, (tx) => tx.update(db_1.schema.deadLetters).set({ replayedAt: new Date() }).where((0, drizzle_orm_1.eq)(db_1.schema.deadLetters.id, id)));
        return { ok: true };
    }
    async rotateSecrets(_ctx) {
        await this.growthQueue.add("rotate-secrets", {});
        return { accepted: true };
    }
};
exports.OpsService = OpsService;
exports.OpsService = OpsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __param(1, (0, common_1.Inject)(config_module_1.APP_CONFIG)),
    __param(2, (0, common_1.Inject)(queue_module_1.GROWTH_QUEUE)),
    __metadata("design:paramtypes", [Object, Object, bullmq_1.Queue])
], OpsService);
//# sourceMappingURL=ops.service.js.map