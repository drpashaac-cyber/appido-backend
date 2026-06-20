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
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const permissions_guard_1 = require("../authz/permissions.guard");
const require_permissions_decorator_1 = require("../authz/require-permissions.decorator");
const ai_service_1 = require("./ai.service");
class AiConfigDto {
    channelId;
    model;
    tone;
    goal;
    languages;
    guardrails;
    enabled;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AiConfigDto.prototype, "channelId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["claude", "gpt", "gemini"]),
    __metadata("design:type", String)
], AiConfigDto.prototype, "model", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], AiConfigDto.prototype, "tone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AiConfigDto.prototype, "goal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AiConfigDto.prototype, "languages", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AiConfigDto.prototype, "guardrails", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AiConfigDto.prototype, "enabled", void 0);
class KnowledgeDto {
    source;
    sourceId;
    text;
}
__decorate([
    (0, class_validator_1.IsIn)(["file", "product"]),
    __metadata("design:type", String)
], KnowledgeDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], KnowledgeDto.prototype, "sourceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50_000),
    __metadata("design:type", String)
], KnowledgeDto.prototype, "text", void 0);
class AdvisorDto {
    question;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdvisorDto.prototype, "question", void 0);
class AiTestDto {
    message;
    customerId;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AiTestDto.prototype, "message", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AiTestDto.prototype, "customerId", void 0);
let AiController = class AiController {
    ai;
    constructor(ai) {
        this.ai = ai;
    }
    getConfig(req, channelId) {
        return this.ai.getConfig(req.rls, channelId);
    }
    updateConfig(req, body) {
        return this.ai.updateConfig(req.rls, body);
    }
    listKnowledge(req) {
        return this.ai.listKnowledge(req.rls);
    }
    addKnowledge(req, body) {
        return this.ai.indexKnowledge(req.rls, body);
    }
    advisor(req, body) {
        return this.ai.advisor(req.rls, body.question);
    }
    test(req, body) {
        return this.ai.test(req.rls, body.message, body.customerId);
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Get)("config"),
    (0, require_permissions_decorator_1.RequirePermissions)("ai:configure"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)("channelId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Put)("config"),
    (0, require_permissions_decorator_1.RequirePermissions)("ai:configure"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, AiConfigDto]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Get)("knowledge"),
    (0, require_permissions_decorator_1.RequirePermissions)("ai:configure"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "listKnowledge", null);
__decorate([
    (0, common_1.Post)("knowledge"),
    (0, require_permissions_decorator_1.RequirePermissions)("ai:configure"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, KnowledgeDto]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "addKnowledge", null);
__decorate([
    (0, common_1.Post)("advisor"),
    (0, require_permissions_decorator_1.RequirePermissions)("analytics:read"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, AdvisorDto]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "advisor", null);
__decorate([
    (0, common_1.Post)("test"),
    (0, require_permissions_decorator_1.RequirePermissions)("ai:configure"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, AiTestDto]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "test", null);
exports.AiController = AiController = __decorate([
    (0, swagger_1.ApiTags)("ai"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1/ai"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [ai_service_1.AiService])
], AiController);
//# sourceMappingURL=ai.controller.js.map