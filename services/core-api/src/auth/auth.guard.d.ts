import { type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { type Me, type RlsContext } from "@appido/types";
import { AuthService } from "./auth.service";
export interface AuthedRequest extends FastifyRequest {
    user: Me;
    rls: RlsContext;
}
export declare class AuthGuard implements CanActivate {
    private readonly auth;
    constructor(auth: AuthService);
    canActivate(ctx: ExecutionContext): Promise<boolean>;
}
