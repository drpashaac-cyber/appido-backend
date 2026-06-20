import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { isPlatformRole, type Me, type RlsContext } from "@appido/types";
import { AuthService } from "./auth.service";
import { COOKIE_NAME } from "./constants";

export interface AuthedRequest extends FastifyRequest {
  user: Me;
  rls: RlsContext;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = (req as unknown as { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME];
    if (!token) throw new UnauthorizedException("no_session");
    const resolved = await this.auth.resolveSession(token);
    if (!resolved) throw new UnauthorizedException("invalid_session");
    req.user = resolved.me;
    req.rls = resolved.impersonating
      ? { platform: false, tenantId: resolved.me.tenantId }
      : isPlatformRole(resolved.me.role)
        ? { platform: true }
        : { platform: false, tenantId: resolved.me.tenantId };
    return true;
  }
}
