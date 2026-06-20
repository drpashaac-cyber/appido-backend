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
exports.CsrfGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const constants_1 = require("../auth/constants");
const csrf_constants_1 = require("./csrf.constants");
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Double-submit CSRF protection. Enforced only for cookie-authenticated, state-changing
// requests: a readable `appido_csrf` cookie must match the `X-CSRF-Token` header. Requests
// without a session cookie (public/webhook/API) carry no ambient auth, so CSRF does not apply.
let CsrfGuard = class CsrfGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(ctx) {
        if (ctx.getType() !== "http")
            return true;
        const req = ctx.switchToHttp().getRequest();
        if (SAFE_METHODS.has(req.method))
            return true;
        if (this.reflector.getAllAndOverride(csrf_constants_1.SKIP_CSRF, [ctx.getHandler(), ctx.getClass()]))
            return true;
        const cookies = req.cookies ?? {};
        if (!cookies[constants_1.COOKIE_NAME])
            return true; // not cookie-authenticated → CSRF not applicable
        const header = req.headers["x-csrf-token"] ?? "";
        const cookie = cookies[csrf_constants_1.CSRF_COOKIE] ?? "";
        if (!cookie || !header || header !== cookie)
            throw new common_1.ForbiddenException("csrf_failed");
        return true;
    }
};
exports.CsrfGuard = CsrfGuard;
exports.CsrfGuard = CsrfGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], CsrfGuard);
//# sourceMappingURL=csrf.guard.js.map