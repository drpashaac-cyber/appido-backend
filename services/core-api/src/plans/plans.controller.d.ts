import { PlansService } from "./plans.service";
export declare class PlansController {
    private readonly plans;
    constructor(plans: PlansService);
    list(): Promise<{
        key: string;
        name: string;
        descFa: string;
        descEn: string;
        priceCents: number;
        annualCents: number;
        currency: string;
        periodDays: number;
        featuresFa: string[];
        featuresEn: string[];
        popular: boolean;
    }[]>;
}
