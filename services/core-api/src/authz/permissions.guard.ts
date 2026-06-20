import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { can, type Permission } from "@appido/authz";
import { PERMISSIONS_KEY } from "./require-permissions.decorator";
import type { AuthedRequest } from "../auth/auth.guard";

/** RBAC capability gate (ABAC conditions slot into `can()` later). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const actor = { role: req.user.role, tenantId: req.user.tenantId };
    if (!required.every((p) => can(actor, p))) throw new ForbiddenException("insufficient_permissions");
    return true;
  }
}
