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
exports.ChannelsController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const db_module_1 = require("../db/db.module");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
class AiConfigDto {
    aiModel;
    aiEnabled;
    aiBudgetCents;
    onboardingEnabled;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["claude", "gpt", "gemini"]),
    __metadata("design:type", String)
], AiConfigDto.prototype, "aiModel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AiConfigDto.prototype, "aiEnabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AiConfigDto.prototype, "aiBudgetCents", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AiConfigDto.prototype, "onboardingEnabled", void 0);
/** RLS-scoped channels for the dashboard. Returns a SAFE projection (never the encrypted bot token)
 * plus each channel's GMV (sum of its OK transactions). */
let ChannelsController = class ChannelsController {
    dbh;
    constructor(dbh) {
        this.dbh = dbh;
    }
    list(req) {
        return (0, db_1.runWithRls)(this.dbh.pool, req.rls, (tx) => tx
            .select({
            id: db_1.schema.channels.id,
            name: db_1.schema.channels.name,
            username: db_1.schema.channels.username,
            members: db_1.schema.channels.members,
            botUsername: db_1.schema.channels.botUsername,
            connectedAt: db_1.schema.channels.connectedAt,
            aiModel: db_1.schema.channels.aiModel,
            aiEnabled: db_1.schema.channels.aiEnabled,
            onboardingEnabled: db_1.schema.channels.onboardingEnabled,
            aiBudgetCents: db_1.schema.channels.aiBudgetCents,
            createdAt: db_1.schema.channels.createdAt,
            revCents: (0, drizzle_orm_1.sql) `(SELECT coalesce(sum(amount_cents),0)::bigint FROM transactions tx2 WHERE tx2.channel_id = ${db_1.schema.channels.id} AND tx2.status='ok')`,
        })
            .from(db_1.schema.channels)
            .orderBy((0, drizzle_orm_1.desc)(db_1.schema.channels.createdAt)));
    }
    // The channel's AI config is the single source of truth: the dashboard edits it here, the owner
    // console reads the same fields per tenant. RLS guarantees the channel belongs to this tenant.
    async updateAi(req, id, body) {
        const set = {};
        if (body.aiModel !== undefined)
            set.aiModel = body.aiModel;
        if (body.aiEnabled !== undefined)
            set.aiEnabled = body.aiEnabled;
        if (body.aiBudgetCents !== undefined)
            set.aiBudgetCents = body.aiBudgetCents;
        if (body.onboardingEnabled !== undefined)
            set.onboardingEnabled = body.onboardingEnabled;
        if (Object.keys(set).length === 0)
            throw new common_1.BadRequestException("no_changes");
        const rows = await (0, db_1.runWithRls)(this.dbh.pool, req.rls, (tx) => tx
            .update(db_1.schema.channels)
            .set(set)
            .where((0, drizzle_orm_1.eq)(db_1.schema.channels.id, id))
            .returning({ id: db_1.schema.channels.id, aiModel: db_1.schema.channels.aiModel, aiEnabled: db_1.schema.channels.aiEnabled, aiBudgetCents: db_1.schema.channels.aiBudgetCents, onboardingEnabled: db_1.schema.channels.onboardingEnabled }));
        if (!rows.length)
            throw new common_1.NotFoundException("channel_not_found");
        return rows[0];
    }
};
exports.ChannelsController = ChannelsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(":id/ai"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("tenant_admin"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, AiConfigDto]),
    __metadata("design:returntype", Promise)
], ChannelsController.prototype, "updateAi", null);
exports.ChannelsController = ChannelsController = __decorate([
    (0, common_1.Controller)("channels"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __metadata("design:paramtypes", [Object])
], ChannelsController);
//# sourceMappingURL=channels.controller.js.map