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
exports.BillingAdminController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const permissions_guard_1 = require("../authz/permissions.guard");
const require_permissions_decorator_1 = require("../authz/require-permissions.decorator");
const billing_service_1 = require("./billing.service");
class IssueCodesDto {
    plan;
    durationDays;
    count;
    note;
}
__decorate([
    (0, class_validator_1.IsIn)(["start", "pro"]),
    __metadata("design:type", String)
], IssueCodesDto.prototype, "plan", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(3650),
    __metadata("design:type", Number)
], IssueCodesDto.prototype, "durationDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], IssueCodesDto.prototype, "count", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], IssueCodesDto.prototype, "note", void 0);
// Platform owner / finance issues + lists Appido subscription activation codes.
let BillingAdminController = class BillingAdminController {
    billing;
    constructor(billing) {
        this.billing = billing;
    }
    issue(req, body) {
        return this.billing.issueCodes(req.rls, body);
    }
    list(req) {
        return this.billing.listCodes(req.rls);
    }
};
exports.BillingAdminController = BillingAdminController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, IssueCodesDto]),
    __metadata("design:returntype", void 0)
], BillingAdminController.prototype, "issue", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingAdminController.prototype, "list", null);
exports.BillingAdminController = BillingAdminController = __decorate([
    (0, swagger_1.ApiTags)("owner-billing"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1/owner/activation-codes"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)("billing:manage"),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], BillingAdminController);
//# sourceMappingURL=billing-admin.controller.js.map