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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const db_module_1 = require("../db/db.module");
const config_module_1 = require("../config/config.module");
const password_service_1 = require("./password.service");
const email_service_1 = require("./email.service");
const crypto_1 = require("./crypto");
const MAX_CODE_ATTEMPTS = 5;
let AuthService = class AuthService {
    dbh;
    config;
    passwords;
    email;
    constructor(dbh, config, passwords, email) {
        this.dbh = dbh;
        this.config = config;
        this.passwords = passwords;
        this.email = email;
    }
    get db() {
        return this.dbh.db;
    }
    async findUserByEmail(email) {
        const rows = await this.db
            .select()
            .from(db_1.schema.users)
            .where((0, drizzle_orm_1.eq)(db_1.schema.users.email, email.toLowerCase().trim()))
            .limit(1);
        return rows[0] ?? null;
    }
    /** Neutral by design — never reveals whether the email exists. */
    async startLogin(email) {
        const user = await this.findUserByEmail(email);
        if (user && user.status === "active" && user.method === "code") {
            await this.issueCode(user.id, user.email, "login");
        }
    }
    async loginWithPassword(email, password) {
        const user = await this.findUserByEmail(email);
        if (!user || user.status !== "active" || !user.passwordHash) {
            throw new common_1.UnauthorizedException("invalid_credentials");
        }
        const ok = await this.passwords.verify(user.passwordHash, password);
        if (!ok)
            throw new common_1.UnauthorizedException("invalid_credentials");
        if (user.twofaEnabled) {
            await this.issueCode(user.id, user.email, "twofa");
            return { next: "twofa" };
        }
        return this.createSession(user.id, user.mustRotate);
    }
    async loginWithCode(email, code) {
        const user = await this.findUserByEmail(email);
        if (!user || user.status !== "active")
            throw new common_1.UnauthorizedException("invalid_code");
        const rows = await this.db
            .select()
            .from(db_1.schema.loginCodes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loginCodes.userId, user.id), (0, drizzle_orm_1.inArray)(db_1.schema.loginCodes.purpose, ["login", "twofa"]), (0, drizzle_orm_1.isNull)(db_1.schema.loginCodes.consumedAt), (0, drizzle_orm_1.gt)(db_1.schema.loginCodes.expiresAt, new Date())))
            .orderBy((0, drizzle_orm_1.desc)(db_1.schema.loginCodes.createdAt))
            .limit(1);
        const rec = rows[0];
        if (!rec)
            throw new common_1.UnauthorizedException("invalid_code");
        if (rec.attempts >= MAX_CODE_ATTEMPTS)
            throw new common_1.UnauthorizedException("too_many_attempts");
        if (rec.codeHash !== (0, crypto_1.sha256)(code.trim())) {
            await this.db
                .update(db_1.schema.loginCodes)
                .set({ attempts: rec.attempts + 1 })
                .where((0, drizzle_orm_1.eq)(db_1.schema.loginCodes.id, rec.id));
            throw new common_1.UnauthorizedException("invalid_code");
        }
        await this.db
            .update(db_1.schema.loginCodes)
            .set({ consumedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.loginCodes.id, rec.id));
        return this.createSession(user.id, user.mustRotate);
    }
    // Self-serve sign-up: create a tenant (the business) + its first admin user, then a session.
    async register(input) {
        const email = (input.email ?? "").toLowerCase().trim();
        if (!email || !input.password)
            throw new common_1.BadRequestException("email_password_required");
        if (input.password.length < 8)
            throw new common_1.BadRequestException("password_too_short");
        const existing = await this.findUserByEmail(email);
        if (existing)
            throw new common_1.ConflictException("email_taken");
        const brand = (input.brand || input.name || email.split("@")[0] || "My business").trim().slice(0, 80);
        const passwordHash = await this.passwords.hash(input.password);
        const [tenant] = await this.db
            .insert(db_1.schema.tenants)
            .values({ name: brand })
            .returning({ id: db_1.schema.tenants.id });
        const [user] = await this.db
            .insert(db_1.schema.users)
            .values({
            email,
            name: (input.name || brand).trim().slice(0, 80),
            role: "tenant_admin",
            status: "active",
            method: "password",
            passwordHash,
            tenantId: tenant.id,
        })
            .returning({ id: db_1.schema.users.id });
        return this.createSession(user.id, false);
    }
    // Request a password reset: issue a reset-purpose code. Always resolves (no account enumeration).
    async requestPasswordReset(email) {
        const user = await this.findUserByEmail(email);
        if (user && user.status === "active")
            await this.issueCode(user.id, user.email, "reset");
    }
    // Confirm a password reset with the emailed code, set the new password, and revoke all sessions.
    async resetPassword(email, code, newPassword) {
        if (!newPassword || newPassword.length < 8)
            throw new common_1.BadRequestException("password_too_short");
        const user = await this.findUserByEmail(email);
        if (!user || user.status !== "active")
            throw new common_1.UnauthorizedException("invalid_code");
        const rows = await this.db
            .select()
            .from(db_1.schema.loginCodes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loginCodes.userId, user.id), (0, drizzle_orm_1.eq)(db_1.schema.loginCodes.purpose, "reset"), (0, drizzle_orm_1.isNull)(db_1.schema.loginCodes.consumedAt), (0, drizzle_orm_1.gt)(db_1.schema.loginCodes.expiresAt, new Date())))
            .orderBy((0, drizzle_orm_1.desc)(db_1.schema.loginCodes.createdAt))
            .limit(1);
        const rec = rows[0];
        if (!rec || rec.attempts >= MAX_CODE_ATTEMPTS)
            throw new common_1.UnauthorizedException("invalid_code");
        if (rec.codeHash !== (0, crypto_1.sha256)(code.trim())) {
            await this.db.update(db_1.schema.loginCodes).set({ attempts: rec.attempts + 1 }).where((0, drizzle_orm_1.eq)(db_1.schema.loginCodes.id, rec.id));
            throw new common_1.UnauthorizedException("invalid_code");
        }
        await this.db.update(db_1.schema.loginCodes).set({ consumedAt: new Date() }).where((0, drizzle_orm_1.eq)(db_1.schema.loginCodes.id, rec.id));
        const passwordHash = await this.passwords.hash(newPassword);
        await this.db.update(db_1.schema.users).set({ passwordHash, method: "password", mustRotate: false }).where((0, drizzle_orm_1.eq)(db_1.schema.users.id, user.id));
        await this.db.delete(db_1.schema.sessions).where((0, drizzle_orm_1.eq)(db_1.schema.sessions.userId, user.id)); // force re-login everywhere
    }
    async issueCode(userId, email, purpose) {
        const code = (0, crypto_1.newNumericCode)();
        const expiresAt = new Date(Date.now() + this.config.CODE_TTL_MINUTES * 60_000);
        await this.db.insert(db_1.schema.loginCodes).values({ userId, codeHash: (0, crypto_1.sha256)(code), purpose, expiresAt });
        await this.email.sendLoginCode(email, code, purpose);
    }
    async createSession(userId, mustRotate, ip, ua) {
        const { token, tokenHash } = (0, crypto_1.newSessionToken)();
        const expiresAt = new Date(Date.now() + this.config.SESSION_TTL_HOURS * 3_600_000);
        await this.db.insert(db_1.schema.sessions).values({ userId, tokenHash, expiresAt, ip, userAgent: ua });
        return { token, expiresAt, mustRotate };
    }
    async resolveSession(token) {
        const rows = await this.db
            .select()
            .from(db_1.schema.sessions)
            .where((0, drizzle_orm_1.eq)(db_1.schema.sessions.tokenHash, (0, crypto_1.sha256)(token)))
            .limit(1);
        const session = rows[0];
        if (!session || session.expiresAt.getTime() < Date.now())
            return null;
        const urows = await this.db.select().from(db_1.schema.users).where((0, drizzle_orm_1.eq)(db_1.schema.users.id, session.userId)).limit(1);
        const user = urows[0];
        if (!user || user.status !== "active")
            return null;
        const me = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: session.impersonatingTenantId ?? user.tenantId ?? null,
            mustRotate: user.mustRotate,
        };
        return { me, impersonating: !!session.impersonatingTenantId, expiresAt: session.expiresAt };
    }
    async logout(token) {
        await this.db.delete(db_1.schema.sessions).where((0, drizzle_orm_1.eq)(db_1.schema.sessions.tokenHash, (0, crypto_1.sha256)(token)));
    }
    async rotatePassword(userId, newPassword) {
        if (newPassword.length < 8)
            throw new common_1.BadRequestException("weak_password");
        const passwordHash = await this.passwords.hash(newPassword);
        await this.db
            .update(db_1.schema.users)
            .set({ passwordHash, mustRotate: false, method: "password" })
            .where((0, drizzle_orm_1.eq)(db_1.schema.users.id, userId));
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __param(1, (0, common_1.Inject)(config_module_1.APP_CONFIG)),
    __metadata("design:paramtypes", [Object, Object, password_service_1.PasswordService,
        email_service_1.EmailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map