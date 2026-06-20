import { SettingsService } from "./settings.service";
declare class SettingsDto {
    trialDays?: number;
}
export declare class SettingsAdminController {
    private readonly settings;
    constructor(settings: SettingsService);
    get(): Promise<{
        trialDays: number;
    }>;
    set(body: SettingsDto): Promise<{
        trialDays: number;
    }>;
}
export {};
