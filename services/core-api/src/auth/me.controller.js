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
exports.MeController = void 0;
const common_1 = require("@nestjs/common");
const authz_1 = require("@appido/authz");
const auth_guard_1 = require("./auth.guard");
const auth_service_1 = require("./auth.service");
const constants_1 = require("./constants");
let MeController = class MeController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    me(req) {
        return { ...req.user, permissions: (0, authz_1.permissionsForRole)(req.user.role) };
    }
    async session(req) {
        const token = req.cookies?.[constants_1.COOKIE_NAME];
        if (!token)
            return { authenticated: false };
        const resolved = await this.auth.resolveSession(token);
        if (!resolved)
            return { authenticated: false };
        return {
            authenticated: true,
            expiresAt: resolved.expiresAt.toISOString(),
            impersonating: resolved.impersonating,
        };
    }
};
exports.MeController = MeController;
__decorate([
    (0, common_1.Get)("me"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], MeController.prototype, "me", null);
__decorate([
    (0, common_1.Get)("session"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "session", null);
exports.MeController = MeController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], MeController);
//# sourceMappingURL=me.controller.js.map