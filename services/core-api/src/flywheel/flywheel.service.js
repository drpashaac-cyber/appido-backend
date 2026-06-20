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
exports.FlywheelService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const ai_1 = require("@appido/ai");
const db_module_1 = require("../db/db.module");
const queue_module_1 = require("../queue/queue.module");
let FlywheelService = class FlywheelService {
    dbh;
    growthQueue;
    constructor(dbh, growthQueue) {
        this.dbh = dbh;
        this.growthQueue = growthQueue;
    }
    // tenant: my AI conversion stats per task
    stats(ctx) {
        return (0, ai_1.flywheelStats)(this.dbh.pool, ctx.tenantId);
    }
    // ---- owner-curated golden sets (platform-only) ----
    listGolden(_ctx, task) {
        return (0, db_1.runWithRls)(this.dbh.pool, { platform: true }, (tx) => task
            ? tx.select().from(db_1.schema.goldenCases).where((0, drizzle_orm_1.eq)(db_1.schema.goldenCases.task, task)).orderBy((0, drizzle_orm_1.desc)(db_1.schema.goldenCases.createdAt)).limit(500)
            : tx.select().from(db_1.schema.goldenCases).orderBy((0, drizzle_orm_1.desc)(db_1.schema.goldenCases.createdAt)).limit(500));
    }
    async addGolden(_ctx, body) {
        const [row] = await (0, db_1.runWithRls)(this.dbh.pool, { platform: true }, (tx) => tx.insert(db_1.schema.goldenCases).values({ task: body.task, input: body.input, expected: body.expected, note: body.note ?? null }).returning({ id: db_1.schema.goldenCases.id }));
        return { id: row.id };
    }
    // ---- evals ----
    listEvals(_ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, { platform: true }, (tx) => tx.select().from(db_1.schema.evalRuns).orderBy((0, drizzle_orm_1.desc)(db_1.schema.evalRuns.at)).limit(100));
    }
    async enqueueEval(_ctx, body) {
        await this.growthQueue.add("run-eval", { task: body.task, model: body.model });
        return { accepted: true };
    }
};
exports.FlywheelService = FlywheelService;
exports.FlywheelService = FlywheelService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __param(1, (0, common_1.Inject)(queue_module_1.GROWTH_QUEUE)),
    __metadata("design:paramtypes", [Object, bullmq_1.Queue])
], FlywheelService);
//# sourceMappingURL=flywheel.service.js.map