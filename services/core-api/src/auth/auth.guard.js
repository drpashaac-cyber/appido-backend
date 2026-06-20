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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@appido/types");
const auth_service_1 = require("./auth.service");
const constants_1 = require("./constants");
let AuthGuard = class AuthGuard {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    async canActivate(ctx) {
        const req = ctx.switchToHttp().getRequest();
        const token = req.cookies?.[constants_1.COOKIE_NAME];
        if (!token)
            throw new common_1.UnauthorizedException("no_session");
        const resolved = await this.auth.resolveSession(token);
        if (!resolved)
            throw new common_1.UnauthorizedException("invalid_session");
        req.user = resolved.me;
        req.rls = resolved.impersonating
            ? { platform: false, tenantId: resolved.me.tenantId }
            : (0, types_1.isPlatformRole)(resolved.me.role)
                ? { platform: true }
                : { platform: false, tenantId: resolved.me.tenantId };
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map