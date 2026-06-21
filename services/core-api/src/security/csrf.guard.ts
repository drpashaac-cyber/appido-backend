import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { COOKIE_NAME } from "../auth/constants";
import { CSRF_COOKIE, SKIP_CSRF } from "./csrf.constants";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Double-submit CSRF protection. Enforced only for cookie-authenticated, state-changing
// requests: a readable `appido_csrf` cookie must match the `X-CSRF-Token` header. Requests
// without a session cookie (public/webhook/API) carry no ambient auth, so CSRF does not apply.
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() !== "http") return true;
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, [ctx.getHandler(), ctx.getClass()])) return true;

    const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies ?? {};
    if (!cookies[COOKIE_NAME]) return true; // not cookie-authenticated → CSRF not applicable

    const header = (req.headers["x-csrf-token"] as string | undefined) ?? "";
    const cookie = cookies[CSRF_COOKIE] ?? "";
    if (!cookie || !header || header !== cookie) throw new ForbiddenException("csrf_failed");
    return true;
  }
}
