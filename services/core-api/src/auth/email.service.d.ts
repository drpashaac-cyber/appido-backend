import type { AppConfig } from "@appido/config";
export declare abstract class EmailService {
    abstract sendLoginCode(to: string, code: string, purpose: "login" | "twofa" | "reset"): Promise<void>;
}
/** Dev transport — logs the code. Used when RESEND_API_KEY is unset. */
export declare class ConsoleEmailService extends EmailService {
    private readonly log;
    sendLoginCode(to: string, code: string, purpose: "login" | "twofa" | "reset"): Promise<void>;
}
/** Production transport — sends via Resend's HTTP API (no extra dependency). */
export declare class ResendEmailService extends EmailService {
    private readonly config;
    private readonly log;
    constructor(config: AppConfig);
    sendLoginCode(to: string, code: string, purpose: "login" | "twofa" | "reset"): Promise<void>;
}
