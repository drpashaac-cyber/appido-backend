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
exports.OwnerAnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const permissions_guard_1 = require("../authz/permissions.guard");
const require_permissions_decorator_1 = require("../authz/require-permissions.decorator");
const owner_analytics_service_1 = require("./owner-analytics.service");
// Platform analytics dashboards. MRR (Appido subscription revenue) and GMV (platform volume)
// are reported separately and never conflated.
let OwnerAnalyticsController = class OwnerAnalyticsController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    overview() {
        return this.svc.overview();
    }
    mrr() {
        return this.svc.mrr();
    }
    gmv(days) {
        return this.svc.gmv(days ? Number(days) : undefined);
    }
    funnel() {
        return this.svc.funnel();
    }
    cohorts(months) {
        return this.svc.cohorts(months ? Number(months) : undefined);
    }
    conversion() {
        return this.svc.conversion();
    }
};
exports.OwnerAnalyticsController = OwnerAnalyticsController;
__decorate([
    (0, common_1.Get)("overview"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OwnerAnalyticsController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)("mrr"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OwnerAnalyticsController.prototype, "mrr", null);
__decorate([
    (0, common_1.Get)("gmv"),
    __param(0, (0, common_1.Query)("days")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OwnerAnalyticsController.prototype, "gmv", null);
__decorate([
    (0, common_1.Get)("funnel"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OwnerAnalyticsController.prototype, "funnel", null);
__decorate([
    (0, common_1.Get)("cohorts"),
    __param(0, (0, common_1.Query)("months")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OwnerAnalyticsController.prototype, "cohorts", null);
__decorate([
    (0, common_1.Get)("conversion"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OwnerAnalyticsController.prototype, "conversion", null);
exports.OwnerAnalyticsController = OwnerAnalyticsController = __decorate([
    (0, swagger_1.ApiTags)("owner-analytics"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1/owner/analytics"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)("analytics:read"),
    __metadata("design:paramtypes", [owner_analytics_service_1.OwnerAnalyticsService])
], OwnerAnalyticsController);
//# sourceMappingURL=owner-analytics.controller.js.map