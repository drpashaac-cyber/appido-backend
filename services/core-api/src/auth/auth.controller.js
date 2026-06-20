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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const config_module_1 = require("../config/config.module");
const auth_service_1 = require("./auth.service");
const auth_guard_1 = require("./auth.guard");
const constants_1 = require("./constants");
const csrf_constants_1 = require("../security/csrf.constants");
const node_crypto_1 = require("node:crypto");
const throttler_1 = require("@nestjs/throttler");
let AuthController = class AuthController {
    auth;
    config;
    constructor(auth, config) {
        this.auth = auth;
        this.config = config;
    }
    setSession(reply, token, expires) {
        reply.setCookie(constants_1.COOKIE_NAME, token, {
            httpOnly: true,
            secure: this.config.COOKIE_SECURE,
            sameSite: this.config.COOKIE_SAMESITE,
            domain: this.config.COOKIE_DOMAIN,
            path: "/",
            expires,
        });
        reply.setCookie(csrf_constants_1.CSRF_COOKIE, (0, node_crypto_1.randomBytes)(18).toString("base64url"), {
            httpOnly: false, // readable by the SPA to echo as X-CSRF-Token
            secure: this.config.COOKIE_SECURE,
            sameSite: this.config.COOKIE_SAMESITE,
            domain: this.config.COOKIE_DOMAIN,
            path: "/",
            expires,
        });
    }
    // (Re)issue a CSRF token cookie for the SPA.
    csrf(reply) {
        reply.setCookie(csrf_constants_1.CSRF_COOKIE, (0, node_crypto_1.randomBytes)(18).toString("base64url"), {
            httpOnly: false,
            secure: this.config.COOKIE_SECURE,
            sameSite: this.config.COOKIE_SAMESITE,
            domain: this.config.COOKIE_DOMAIN,
            path: "/",
        });
        return { ok: true };
    }
    async start(body) {
        if (!body.email)
            throw new common_1.BadRequestException("email_required");
        await this.auth.startLogin(body.email);
        return { ok: true };
    }
    async password(body, reply) {
        if (!body.email || !body.password)
            throw new common_1.BadRequestException("email_password_required");
        const r = await this.auth.loginWithPassword(body.email, body.password);
        if ("next" in r)
            return { ok: true, next: r.next };
        this.setSession(reply, r.token, r.expiresAt);
        return { ok: true, mustRotate: r.mustRotate };
    }
    async register(body, reply) {
        if (!body.email || !body.password)
            throw new common_1.BadRequestException("email_password_required");
        const r = await this.auth.register({ email: body.email, password: body.password, name: body.name, brand: body.brand });
        this.setSession(reply, r.token, r.expiresAt);
        return { ok: true, mustRotate: r.mustRotate };
    }
    async forgotPassword(body) {
        if (body.email)
            await this.auth.requestPasswordReset(body.email);
        return { ok: true }; // always ok — never reveal whether the email exists
    }
    async resetPassword(body) {
        if (!body.email || !body.code || !body.newPassword)
            throw new common_1.BadRequestException("missing_fields");
        await this.auth.resetPassword(body.email, body.code, body.newPassword);
        return { ok: true };
    }
    async code(body, reply) {
        if (!body.email || !body.code)
            throw new common_1.BadRequestException("email_code_required");
        const r = await this.auth.loginWithCode(body.email, body.code);
        this.setSession(reply, r.token, r.expiresAt);
        return { ok: true, mustRotate: r.mustRotate };
    }
    async logout(req, reply) {
        const token = req.cookies?.[constants_1.COOKIE_NAME];
        if (token)
            await this.auth.logout(token);
        reply.clearCookie(constants_1.COOKIE_NAME, { path: "/" });
        reply.clearCookie(csrf_constants_1.CSRF_COOKIE, { path: "/" });
        return { ok: true };
    }
    async rotate(req, body) {
        if (!body.newPassword)
            throw new common_1.BadRequestException("password_required");
        await this.auth.rotatePassword(req.user.id, body.newPassword);
        return { ok: true };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Get)("csrf"),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], AuthController.prototype, "csrf", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 10 } }),
    (0, common_1.Post)("login/start"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "start", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 10 } }),
    (0, common_1.Post)("login/password"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "password", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 5 } }),
    (0, common_1.Post)("register"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 5 } }),
    (0, common_1.Post)("password/forgot"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 5 } }),
    (0, common_1.Post)("password/reset"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 10 } }),
    (0, common_1.Post)("login/code"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "code", null);
__decorate([
    (0, common_1.Post)("logout"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)("password/rotate"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "rotate", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)("auth"),
    __param(1, (0, common_1.Inject)(config_module_1.APP_CONFIG)),
    __metadata("design:paramtypes", [auth_service_1.AuthService, Object])
], AuthController);
//# sourceMappingURL=auth.controller.js.map