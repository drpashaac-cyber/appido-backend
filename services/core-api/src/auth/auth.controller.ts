import { BadRequestException, Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "@appido/config";
import { APP_CONFIG } from "../config/config.module";
import { AuthService } from "./auth.service";
import { AuthGuard, type AuthedRequest } from "./auth.guard";
import { COOKIE_NAME } from "./constants";
import { CSRF_COOKIE } from "../security/csrf.constants";
import { randomBytes } from "node:crypto";
import { Throttle } from "@nestjs/throttler";

interface Cred {
  email?: string;
  password?: string;
  code?: string;
  newPassword?: string;
  name?: string;
  brand?: string;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private setSession(reply: FastifyReply, token: string, expires: Date): void {
    reply.setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: this.config.COOKIE_SAMESITE,
      domain: this.config.COOKIE_DOMAIN,
      path: "/",
      expires,
    });
    reply.setCookie(CSRF_COOKIE, randomBytes(18).toString("base64url"), {
      httpOnly: false,
      secure: this.config.COOKIE_SECURE,
      sameSite: this.config.COOKIE_SAMESITE,
      domain: this.config.COOKIE_DOMAIN,
      path: "/",
      expires,
    });
  }

  @Get("csrf")
  csrf(@Res({ passthrough: true }) reply: FastifyReply): { ok: true } {
    reply.setCookie(CSRF_COOKIE, randomBytes(18).toString("base64url"), {
      httpOnly: false,
      secure: this.config.COOKIE_SECURE,
      sameSite: this.config.COOKIE_SAMESITE,
      domain: this.config.COOKIE_DOMAIN,
      path: "/",
    });
    return { ok: true };
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post("login/start")
  async start(@Body() body: Cred): Promise<{ ok: true }> {
    if (!body.email) throw new BadRequestException("email_required");
    await this.auth.startLogin(body.email);
    return { ok: true };
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post("login/password")
  async password(@Body() body: Cred, @Res({ passthrough: true }) reply: FastifyReply) {
    if (!body.email || !body.password) throw new BadRequestException("email_password_required");
    const r = await this.auth.loginWithPassword(body.email, body.password);
    if ("next" in r) return { ok: true as const, next: r.next };
    this.setSession(reply, r.token, r.expiresAt);
    return { ok: true as const, mustRotate: r.mustRotate };
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post("register")
  async register(@Body() body: Cred, @Res({ passthrough: true }) reply: FastifyReply) {
    if (!body.email || !body.password) throw new BadRequestException("email_password_required");
    const r = await this.auth.register({ email: body.email, password: body.password, name: body.name, brand: body.brand });
    this.setSession(reply, r.token, r.expiresAt);
    return { ok: true as const, mustRotate: r.mustRotate };
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post("password/forgot")
  async forgotPassword(@Body() body: Cred): Promise<{ ok: true }> {
    if (body.email) await this.auth.requestPasswordReset(body.email);
    return { ok: true };
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post("password/reset")
  async resetPassword(@Body() body: Cred): Promise<{ ok: true }> {
    if (!body.email || !body.code || !body.newPassword) throw new BadRequestException("missing_fields");
    await this.auth.resetPassword(body.email, body.code, body.newPassword);
    return { ok: true };
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post("login/code")
  async code(@Body() body: Cred, @Res({ passthrough: true }) reply: FastifyReply) {
    if (!body.email || !body.code) throw new BadRequestException("email_code_required");
    const r = await this.auth.loginWithCode(body.email, body.code);
    this.setSession(reply, r.token, r.expiresAt);
    return { ok: true as const, mustRotate: r.mustRotate };
  }

  @Post("logout")
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<{ ok: true }> {
    const token = (req as unknown as { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME];
    if (token) await this.auth.logout(token);
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    reply.clearCookie(CSRF_COOKIE, { path: "/" });
    return { ok: true };
  }

  @Post("password/rotate")
  @UseGuards(AuthGuard)
  async rotate(@Req() req: AuthedRequest, @Body() body: Cred): Promise<{ ok: true }> {
    if (!body.newPassword) throw new BadRequestException("password_required");
    await this.auth.rotatePassword(req.user.id, body.newPassword);
    return { ok: true };
  }
}