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
exports.GovernanceAdminController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const permissions_guard_1 = require("../authz/permissions.guard");
const require_permissions_decorator_1 = require("../authz/require-permissions.decorator");
const audit_service_1 = require("../audit/audit.service");
const settings_service_1 = require("./settings.service");
class GovernanceDto {
    requireOptin;
    aiRequiresConsent;
    piiRedaction;
    dataRetentionDays;
    residency;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GovernanceDto.prototype, "requireOptin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GovernanceDto.prototype, "aiRequiresConsent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["off", "mask_before_llm", "mask_at_rest"]),
    __metadata("design:type", String)
], GovernanceDto.prototype, "piiRedaction", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(3650),
    __metadata("design:type", Number)
], GovernanceDto.prototype, "dataRetentionDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["global", "eu", "us", "ir", "ru"]),
    __metadata("design:type", String)
], GovernanceDto.prototype, "residency", void 0);
// Owner console — platform compliance policy (consent, PII handling, residency, retention).
let GovernanceAdminController = class GovernanceAdminController {
    settings;
    audit;
    constructor(settings, audit) {
        this.settings = settings;
        this.audit = audit;
    }
    get() {
        return this.settings.governanceView();
    }
    async set(req, body) {
        const next = await this.settings.setGovernance(body);
        await this.audit.record({ actorUserId: req.user?.id, action: "governance.update", target: "platform", meta: body });
        return next;
    }
};
exports.GovernanceAdminController = GovernanceAdminController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GovernanceAdminController.prototype, "get", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GovernanceDto]),
    __metadata("design:returntype", Promise)
], GovernanceAdminController.prototype, "set", null);
exports.GovernanceAdminController = GovernanceAdminController = __decorate([
    (0, swagger_1.ApiTags)("owner"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1/owner/governance"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)("platform:overview"),
    __metadata("design:paramtypes", [settings_service_1.SettingsService, audit_service_1.AuditService])
], GovernanceAdminController);
//# sourceMappingURL=governance-admin.controller.js.map