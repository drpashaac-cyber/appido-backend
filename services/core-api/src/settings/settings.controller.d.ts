import { SettingsService } from "./settings.service";
export declare class SettingsController {
    private readonly settings;
    constructor(settings: SettingsService);
    get(): Promise<{
        trialDays: number;
    }>;
}
