import { type AuthedRequest } from "../auth/auth.guard";
import { AuditService } from "../audit/audit.service";
import { SettingsService } from "./settings.service";
declare class GovernanceDto {
    requireOptin?: boolean;
    aiRequiresConsent?: boolean;
    piiRedaction?: string;
    dataRetentionDays?: number;
    residency?: string;
}
export declare class GovernanceAdminController {
    private readonly settings;
    private readonly audit;
    constructor(settings: SettingsService, audit: AuditService);
    get(): Promise<{
        requireOptin: boolean;
        aiRequiresConsent: boolean;
        piiRedaction: string;
        dataRetentionDays: number;
        residency: string;
    }>;
    set(req: AuthedRequest, body: GovernanceDto): Promise<{
        requireOptin: boolean;
        aiRequiresConsent: boolean;
        piiRedaction: string;
        dataRetentionDays: number;
        residency: string;
    }>;
}
export {};
