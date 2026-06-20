import { SettingsService } from "./settings.service";
export declare class GovernanceController {
    private readonly settings;
    constructor(settings: SettingsService);
    get(): Promise<{
        requireOptin: boolean;
        aiRequiresConsent: boolean;
        piiRedaction: string;
        dataRetentionDays: number;
        residency: string;
    }>;
}
