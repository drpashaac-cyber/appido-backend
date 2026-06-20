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
exports.SettingsAdminController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const permissions_guard_1 = require("../authz/permissions.guard");
const require_permissions_decorator_1 = require("../authz/require-permissions.decorator");
const settings_service_1 = require("./settings.service");
class SettingsDto {
    trialDays;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(365),
    __metadata("design:type", Number)
], SettingsDto.prototype, "trialDays", void 0);
// Owner console — manage platform settings shared with the landing + dashboard.
let SettingsAdminController = class SettingsAdminController {
    settings;
    constructor(settings) {
        this.settings = settings;
    }
    get() {
        return this.settings.ownerView();
    }
    async set(body) {
        if (body.trialDays !== undefined)
            await this.settings.setTrialDays(body.trialDays);
        return this.settings.ownerView();
    }
};
exports.SettingsAdminController = SettingsAdminController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SettingsAdminController.prototype, "get", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SettingsDto]),
    __metadata("design:returntype", Promise)
], SettingsAdminController.prototype, "set", null);
exports.SettingsAdminController = SettingsAdminController = __decorate([
    (0, swagger_1.ApiTags)("owner"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1/owner/settings"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)("platform:overview"),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], SettingsAdminController);
//# sourceMappingURL=settings-admin.controller.js.map