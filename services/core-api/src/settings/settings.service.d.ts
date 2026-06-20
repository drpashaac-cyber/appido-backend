import { type DbHandle } from "@appido/db";
export declare class SettingsService {
    private readonly dbh;
    constructor(dbh: DbHandle);
    private raw;
    private setRaw;
    trialDays(): Promise<number>;
    /** Public-safe settings for the landing + dashboard. */
    publicView(): Promise<{
        trialDays: number;
    }>;
    /** Owner view (same shape today; extend as more settings are added). */
    ownerView(): Promise<{
        trialDays: number;
    }>;
    setTrialDays(days: number): Promise<{
        trialDays: number;
    }>;
    private boolKey;
    private strKey;
    private intKey;
    governanceView(): Promise<{
        requireOptin: boolean;
        aiRequiresConsent: boolean;
        piiRedaction: string;
        dataRetentionDays: number;
        residency: string;
    }>;
    setGovernance(patch: Partial<{
        requireOptin: boolean;
        aiRequiresConsent: boolean;
        piiRedaction: string;
        dataRetentionDays: number;
        residency: string;
    }>): Promise<{
        requireOptin: boolean;
        aiRequiresConsent: boolean;
        piiRedaction: string;
        dataRetentionDays: number;
        residency: string;
    }>;
}
