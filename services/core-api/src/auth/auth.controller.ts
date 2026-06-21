import { BadRequestException, Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config"; // <--- اضافه کنید
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "@appido/config";
import { AuthService } from "./auth.service";
import { AuthGuard, type AuthedRequest } from "./auth.guard";
import { COOKIE_NAME } from "./constants";
import { CSRF_COOKIE } from "../security/csrf.constants";
import { randomBytes } from "node:crypto";
import { Throttle } from "@nestjs/throttler";

// ... بقیه کد ...

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly configService: ConfigService, // <--- تغییر
  ) {}

  private get config(): AppConfig {
    return this.configService.get<AppConfig>("config")!;
  }

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

  // ... بقیه متدها ...
}