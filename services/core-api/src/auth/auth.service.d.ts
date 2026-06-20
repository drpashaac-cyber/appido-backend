import { type DbHandle } from "@appido/db";
import type { AppConfig } from "@appido/config";
import type { Me } from "@appido/types";
import { PasswordService } from "./password.service";
import { EmailService } from "./email.service";
export interface SessionResult {
    token: string;
    expiresAt: Date;
    mustRotate: boolean;
}
export declare class AuthService {
    private readonly dbh;
    private readonly config;
    private readonly passwords;
    private readonly email;
    constructor(dbh: DbHandle, config: AppConfig, passwords: PasswordService, email: EmailService);
    private get db();
    private findUserByEmail;
    /** Neutral by design — never reveals whether the email exists. */
    startLogin(email: string): Promise<void>;
    loginWithPassword(email: string, password: string): Promise<{
        next: "twofa";
    } | SessionResult>;
    loginWithCode(email: string, code: string): Promise<SessionResult>;
    register(input: {
        email: string;
        password: string;
        name?: string;
        brand?: string;
    }): Promise<SessionResult>;
    requestPasswordReset(email: string): Promise<void>;
    resetPassword(email: string, code: string, newPassword: string): Promise<void>;
    private issueCode;
    private createSession;
    resolveSession(token: string): Promise<{
        me: Me;
        impersonating: boolean;
        expiresAt: Date;
    } | null>;
    logout(token: string): Promise<void>;
    rotatePassword(userId: string, newPassword: string): Promise<void>;
}
