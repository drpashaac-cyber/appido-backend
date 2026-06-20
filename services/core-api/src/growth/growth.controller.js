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
exports.GrowthController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const growth_service_1 = require("./growth.service");
class ScoreDto {
    limit;
    activeWithinDays;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(1000),
    __metadata("design:type", Number)
], ScoreDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(365),
    __metadata("design:type", Number)
], ScoreDto.prototype, "activeWithinDays", void 0);
class SegmentDto {
    name;
    criteria;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], SegmentDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SegmentDto.prototype, "criteria", void 0);
class CampaignDto {
    name;
    channelId;
    goal;
    bodyText;
    segmentId;
    criteria;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CampaignDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CampaignDto.prototype, "channelId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CampaignDto.prototype, "goal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CampaignDto.prototype, "bodyText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CampaignDto.prototype, "segmentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CampaignDto.prototype, "criteria", void 0);
class CopyDto {
    tone;
    language;
    product;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], CopyDto.prototype, "tone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], CopyDto.prototype, "language", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CopyDto.prototype, "product", void 0);
let GrowthController = class GrowthController {
    growth;
    constructor(growth) {
        this.growth = growth;
    }
    score(req, body) {
        return this.growth.enqueueScore(req.rls, body);
    }
    leads(req, minScore, limit) {
        return this.growth.listLeads(req.rls, {
            minScore: minScore != null ? Number(minScore) : undefined,
            limit: limit != null ? Number(limit) : undefined,
        });
    }
    segments(req) {
        return this.growth.listSegments(req.rls);
    }
    createSegment(req, body) {
        return this.growth.createSegment(req.rls, body);
    }
    deleteSegment(req, id) {
        return this.growth.deleteSegment(req.rls, id);
    }
    campaigns(req) {
        return this.growth.listCampaigns(req.rls);
    }
    createCampaign(req, body) {
        return this.growth.createCampaign(req.rls, body);
    }
    campaign(req, id) {
        return this.growth.getCampaign(req.rls, id);
    }
    copy(req, id, body) {
        return this.growth.generateCopy(req.rls, id, body);
    }
    send(req, id) {
        return this.growth.send(req.rls, id);
    }
};
exports.GrowthController = GrowthController;
__decorate([
    (0, common_1.Post)("score"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ScoreDto]),
    __metadata("design:returntype", void 0)
], GrowthController.prototype, "score", null);
__decorate([
    (0, common_1.Get)("leads"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)("minScore")),
    __param(2, (0, common_1.Query)("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], GrowthController.prototype, "leads", null);
__decorate([
    (0, common_1.Get)("segments"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GrowthController.prototype, "segments", null);
__decorate([
    (0, common_1.Post)("segments"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, SegmentDto]),
    __metadata("design:returntype", void 0)
], GrowthController.prototype, "createSegment", null);
__decorate([
    (0, common_1.Delete)("segments/:id"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GrowthController.prototype, "deleteSegment", null);
__decorate([
    (0, common_1.Get)("campaigns"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GrowthController.prototype, "campaigns", null);
__decorate([
    (0, common_1.Post)("campaigns"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CampaignDto]),
    __metadata("design:returntype", void 0)
], GrowthController.prototype, "createCampaign", null);
__decorate([
    (0, common_1.Get)("campaigns/:id"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GrowthController.prototype, "campaign", null);
__decorate([
    (0, common_1.Post)("campaigns/:id/copy"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CopyDto]),
    __metadata("design:returntype", void 0)
], GrowthController.prototype, "copy", null);
__decorate([
    (0, common_1.Post)("campaigns/:id/send"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GrowthController.prototype, "send", null);
exports.GrowthController = GrowthController = __decorate([
    (0, swagger_1.ApiTags)("growth"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1/growth"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("tenant_admin"),
    __metadata("design:paramtypes", [growth_service_1.GrowthService])
], GrowthController);
//# sourceMappingURL=growth.controller.js.map