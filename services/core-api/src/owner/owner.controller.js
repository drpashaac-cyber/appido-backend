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
exports.OwnerController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const permissions_guard_1 = require("../authz/permissions.guard");
const require_permissions_decorator_1 = require("../authz/require-permissions.decorator");
const owner_service_1 = require("./owner.service");
let OwnerController = class OwnerController {
    owner;
    constructor(owner) {
        this.owner = owner;
    }
    overview(req) {
        return this.owner.overview(req.rls);
    }
    tenants(req) {
        return this.owner.tenants(req.rls);
    }
    leads(req) {
        return this.owner.leads(req.rls);
    }
    mrr(req) {
        return this.owner.mrr(req.rls);
    }
    gmv(req) {
        return this.owner.gmv(req.rls);
    }
    funnel(req) {
        return this.owner.funnel(req.rls);
    }
};
exports.OwnerController = OwnerController;
__decorate([
    (0, common_1.Get)("overview"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OwnerController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)("tenants"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OwnerController.prototype, "tenants", null);
__decorate([
    (0, common_1.Get)("leads"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OwnerController.prototype, "leads", null);
__decorate([
    (0, common_1.Get)("analytics/mrr"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OwnerController.prototype, "mrr", null);
__decorate([
    (0, common_1.Get)("analytics/gmv"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OwnerController.prototype, "gmv", null);
__decorate([
    (0, common_1.Get)("analytics/funnel"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OwnerController.prototype, "funnel", null);
exports.OwnerController = OwnerController = __decorate([
    (0, swagger_1.ApiTags)("owner"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1/owner"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)("platform:overview"),
    __metadata("design:paramtypes", [owner_service_1.OwnerService])
], OwnerController);
//# sourceMappingURL=owner.controller.js.map