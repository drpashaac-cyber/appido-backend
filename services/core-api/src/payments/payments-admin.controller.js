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
exports.PaymentsAdminController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const permissions_guard_1 = require("../authz/permissions.guard");
const require_permissions_decorator_1 = require("../authz/require-permissions.decorator");
const payments_service_1 = require("./payments.service");
class PolicyDto {
    enabled;
}
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PolicyDto.prototype, "enabled", void 0);
// Owner console — platform gateway policy (applies to ALL tenants).
let PaymentsAdminController = class PaymentsAdminController {
    payments;
    constructor(payments) {
        this.payments = payments;
    }
    list() {
        return this.payments.listGatewayPolicy();
    }
    set(method, body) {
        return this.payments.setGatewayPolicy(method, body.enabled);
    }
};
exports.PaymentsAdminController = PaymentsAdminController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PaymentsAdminController.prototype, "list", null);
__decorate([
    (0, common_1.Put)(":method"),
    __param(0, (0, common_1.Param)("method")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PolicyDto]),
    __metadata("design:returntype", void 0)
], PaymentsAdminController.prototype, "set", null);
exports.PaymentsAdminController = PaymentsAdminController = __decorate([
    (0, swagger_1.ApiTags)("owner"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1/owner/gateway-policy"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)("platform:overview"),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsAdminController);
//# sourceMappingURL=payments-admin.controller.js.map