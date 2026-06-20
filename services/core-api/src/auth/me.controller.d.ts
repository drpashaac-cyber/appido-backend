import type { FastifyRequest } from "fastify";
import type { Me, SessionInfo } from "@appido/types";
import { type Permission } from "@appido/authz";
import { type AuthedRequest } from "./auth.guard";
import { AuthService } from "./auth.service";
export declare class MeController {
    private readonly auth;
    constructor(auth: AuthService);
    me(req: AuthedRequest): Me & {
        permissions: Permission[];
    };
    session(req: FastifyRequest): Promise<SessionInfo>;
}
