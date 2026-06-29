import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { schema, type DbHandle } from "@appido/db";
import type { AppConfig } from "@appido/config";
import type { Me } from "@appido/types";
import { DB } from "../db/db.module";
import { APP_CONFIG } from "../config/config.module";
import { PasswordService } from "./password.service";
import { EmailService } from "./email.service";
import { newSessionToken, sha256, newNumericCode } from "./crypto";

const MAX_CODE_ATTEMPTS = 5;

export interface SessionResult {
  token: string;
  expiresAt: Date;
  mustRotate: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly dbh: DbHandle,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly passwords: PasswordService,
    private readonly email: EmailService,
  ) {}

  private get db() {
    return this.dbh.db;
  }

  private async findUserByEmail(email: string) {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase().trim()))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Neutral by design — never reveals whether the email exists. */
  async startLogin(email: string): Promise<void> {
    const user = await this.findUserByEmail(email);
    if (user && user.status === "active" && user.method === "code") {
      await this.issueCode(user.id, user.email, "login");
    }
  }

  async loginWithPassword(email: string, password: string): Promise<{ next: "twofa" } | SessionResult> {
    const user = await this.findUserByEmail(email);
    if (!user || user.status !== "active" || !user.passwordHash) {
      throw new UnauthorizedException("invalid_credentials");
    }
    const ok = await this.passwords.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException("invalid_credentials");
    if (user.twofaEnabled) {
      await this.issueCode(user.id, user.email, "twofa");
      return { next: "twofa" };
    }
    return this.createSession(user.id, user.mustRotate);
  }

  async loginWithCode(email: string, code: string): Promise<SessionResult> {
    const user = await this.findUserByEmail(email);
    if (!user || user.status !== "active") throw new UnauthorizedException("invalid_code");
    const rows = await this.db
      .select()
      .from(schema.loginCodes)
      .where(
        and(
          eq(schema.loginCodes.userId, user.id),
          inArray(schema.loginCodes.purpose, ["login", "twofa"]),
          isNull(schema.loginCodes.consumedAt),
          gt(schema.loginCodes.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(schema.loginCodes.createdAt))
      .limit(1);
    const rec = rows[0];
    if (!rec) throw new UnauthorizedException("invalid_code");
    if (rec.attempts >= MAX_CODE_ATTEMPTS) throw new UnauthorizedException("too_many_attempts");
    if (rec.codeHash !== sha256(code.trim())) {
      await this.db
        .update(schema.loginCodes)
        .set({ attempts: rec.attempts + 1 })
        .where(eq(schema.loginCodes.id, rec.id));
      throw new UnauthorizedException("invalid_code");
    }
    await this.db
      .update(schema.loginCodes)
      .set({ consumedAt: new Date() })
      .where(eq(schema.loginCodes.id, rec.id));
    return this.createSession(user.id, user.mustRotate);
  }

  // Self-serve sign-up: create a tenant (the business) + its first admin user, then a session.
  async register(input: { email: string; password: string; name?: string; brand?: string }): Promise<SessionResult> {
    const email = (input.email ?? "").toLowerCase().trim();
    if (!email || !input.password) throw new BadRequestException("email_password_required");
    if (input.password.length < 8) throw new BadRequestException("password_too_short");
    const existing = await this.findUserByEmail(email);
    if (existing) throw new ConflictException("email_taken");
    const brand = (input.brand || input.name || email.split("@")[0] || "My business").trim().slice(0, 80);
    const passwordHash = await this.passwords.hash(input.password);
    const [tenant] = await this.db
      .insert(schema.tenants)
      .values({ name: brand })
      .returning({ id: schema.tenants.id });
    const [user] = await this.db
      .insert(schema.users)
      .values({
        email,
        name: (input.name || brand).trim().slice(0, 80),
        role: "tenant_admin",
        status: "active",
        method: "password",
        passwordHash,
        tenantId: tenant.id,
      })
      .returning({ id: schema.users.id });
    return this.createSession(user.id, false);
  }

  // Request a password reset: issue a reset-purpose code. Always resolves (no account enumeration).
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.findUserByEmail(email);
    if (user && user.status === "active") await this.issueCode(user.id, user.email, "reset");
  }

  // Confirm a password reset with the emailed code, set the new password, and revoke all sessions.
  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) throw new BadRequestException("password_too_short");
    const user = await this.findUserByEmail(email);
    if (!user || user.status !== "active") throw new UnauthorizedException("invalid_code");
    const rows = await this.db
      .select()
      .from(schema.loginCodes)
      .where(
        and(
          eq(schema.loginCodes.userId, user.id),
          eq(schema.loginCodes.purpose, "reset"),
          isNull(schema.loginCodes.consumedAt),
          gt(schema.loginCodes.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(schema.loginCodes.createdAt))
      .limit(1);
    const rec = rows[0];
    if (!rec || rec.attempts >= MAX_CODE_ATTEMPTS) throw new UnauthorizedException("invalid_code");
    if (rec.codeHash !== sha256(code.trim())) {
      await this.db.update(schema.loginCodes).set({ attempts: rec.attempts + 1 }).where(eq(schema.loginCodes.id, rec.id));
      throw new UnauthorizedException("invalid_code");
    }
    await this.db.update(schema.loginCodes).set({ consumedAt: new Date() }).where(eq(schema.loginCodes.id, rec.id));
    const passwordHash = await this.passwords.hash(newPassword);
    await this.db.update(schema.users).set({ passwordHash, method: "password", mustRotate: false }).where(eq(schema.users.id, user.id));
    await this.db.delete(schema.sessions).where(eq(schema.sessions.userId, user.id)); // force re-login everywhere
  }

  private async issueCode(userId: string, email: string, purpose: "login" | "twofa" | "reset"): Promise<void> {
    const code = newNumericCode();
    const expiresAt = new Date(Date.now() + this.config.CODE_TTL_MINUTES * 60_000);
    await this.db.insert(schema.loginCodes).values({ userId, codeHash: sha256(code), purpose, expiresAt });
    await this.email.sendLoginCode(email, code, purpose);
  }

  private async createSession(userId: string, mustRotate: boolean, ip?: string, ua?: string): Promise<SessionResult> {
    const { token, tokenHash } = newSessionToken();
    const expiresAt = new Date(Date.now() + this.config.SESSION_TTL_HOURS * 3_600_000);
    await this.db.insert(schema.sessions).values({ userId, tokenHash, expiresAt, ip, userAgent: ua });
    return { token, expiresAt, mustRotate };
  }

  async resolveSession(token: string): Promise<{ me: Me; impersonating: boolean; expiresAt: Date } | null> {
    const rows = await this.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.tokenHash, sha256(token)))
      .limit(1);
    const session = rows[0];
    if (!session || session.expiresAt.getTime() < Date.now()) return null;
    const urows = await this.db.select().from(schema.users).where(eq(schema.users.id, session.userId)).limit(1);
    const user = urows[0];
    if (!user || user.status !== "active") return null;
    const me: Me = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: session.impersonatingTenantId ?? user.tenantId ?? null,
      mustRotate: user.mustRotate,
    };
    return { me, impersonating: !!session.impersonatingTenantId, expiresAt: session.expiresAt };
  }

  async logout(token: string): Promise<void> {
    await this.db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token)));
  }

  async rotatePassword(userId: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) throw new BadRequestException("weak_password");
    const passwordHash = await this.passwords.hash(newPassword);
    await this.db
      .update(schema.users)
      .set({ passwordHash, mustRotate: false, method: "password" })
      .where(eq(schema.users.id, userId));
  }
}
