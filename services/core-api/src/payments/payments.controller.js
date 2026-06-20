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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const payments_1 = require("@appido/payments");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const payments_service_1 = require("./payments.service");
// Valid methods come from the payments registry — add a gateway there and it's accepted here too.
class CredentialDto {
    method;
    kind;
    secret;
}
__decorate([
    (0, class_validator_1.IsIn)((0, payments_1.registeredMethods)()),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CredentialDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsIn)(["key", "wallet", "manual"]),
    __metadata("design:type", String)
], CredentialDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CredentialDto.prototype, "secret", void 0);
class EnabledDto {
    enabled;
}
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EnabledDto.prototype, "enabled", void 0);
let PaymentsController = class PaymentsController {
    payments;
    constructor(payments) {
        this.payments = payments;
    }
    /** Gateway catalog (incl. "coming soon", with platform policy applied) — the dashboard renders its grid from this. */
    methods() {
        return this.payments.catalogWithPolicy();
    }
    list(req) {
        return this.payments.listCredentials(req.rls);
    }
    upsert(req, body) {
        return this.payments.upsertCredential(req.rls, body);
    }
    setEnabled(req, id, body) {
        return this.payments.setEnabled(req.rls, id, body.enabled);
    }
    remove(req, id) {
        return this.payments.deleteCredential(req.rls, id);
    }
    confirm(req, id) {
        return this.payments.confirmManual(req.rls, id);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Get)("methods"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "methods", null);
__decorate([
    (0, common_1.Get)("credentials"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)("credentials"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CredentialDto]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "upsert", null);
__decorate([
    (0, common_1.Patch)("credentials/:id"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, EnabledDto]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "setEnabled", null);
__decorate([
    (0, common_1.Delete)("credentials/:id"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)("transactions/:id/confirm"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "confirm", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, swagger_1.ApiTags)("payments"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1/payments"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("tenant_admin"),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map