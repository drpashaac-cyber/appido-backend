import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { Me, SessionInfo } from "@appido/types";
import { permissionsForRole, type Permission } from "@appido/authz";
import { AuthGuard, type AuthedRequest } from "./auth.guard";
import { AuthService } from "./auth.service";
import { COOKIE_NAME } from "./constants";

@Controller()
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() req: AuthedRequest): Me & { permissions: Permission[] } {
    return { ...req.user, permissions: permissionsForRole(req.user.role) };
  }

  @Get("session")
  async session(@Req() req: FastifyRequest): Promise<SessionInfo> {
    const token = (req as unknown as { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME];
    if (!token) return { authenticated: false };
    const resolved = await this.auth.resolveSession(token);
    if (!resolved) return { authenticated: false };
    return {
      authenticated: true,
      expiresAt: resolved.expiresAt.toISOString(),
      impersonating: resolved.impersonating,
    };
  }
}
