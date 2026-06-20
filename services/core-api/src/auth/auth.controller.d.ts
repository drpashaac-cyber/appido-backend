import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "@appido/config";
import { AuthService } from "./auth.service";
import { type AuthedRequest } from "./auth.guard";
interface Cred {
    email?: string;
    password?: string;
    code?: string;
    newPassword?: string;
    name?: string;
    brand?: string;
}
export declare class AuthController {
    private readonly auth;
    private readonly config;
    constructor(auth: AuthService, config: AppConfig);
    private setSession;
    csrf(reply: FastifyReply): {
        ok: true;
    };
    start(body: Cred): Promise<{
        ok: true;
    }>;
    password(body: Cred, reply: FastifyReply): Promise<{
        ok: true;
        next: "twofa";
        mustRotate?: undefined;
    } | {
        ok: true;
        mustRotate: boolean;
        next?: undefined;
    }>;
    register(body: Cred, reply: FastifyReply): Promise<{
        ok: true;
        mustRotate: boolean;
    }>;
    forgotPassword(body: Cred): Promise<{
        ok: true;
    }>;
    resetPassword(body: Cred): Promise<{
        ok: true;
    }>;
    code(body: Cred, reply: FastifyReply): Promise<{
        ok: true;
        mustRotate: boolean;
    }>;
    logout(req: FastifyRequest, reply: FastifyReply): Promise<{
        ok: true;
    }>;
    rotate(req: AuthedRequest, body: Cred): Promise<{
        ok: true;
    }>;
}
export {};
