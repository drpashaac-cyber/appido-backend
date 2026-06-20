import { PlansService } from "./plans.service";
declare class PlanDto {
    key?: string;
    name?: string;
    descFa?: string;
    descEn?: string;
    priceCents?: number;
    annualCents?: number;
    currency?: string;
    periodDays?: number;
    featuresFa?: string[];
    featuresEn?: string[];
    popular?: boolean;
    active?: boolean;
    sortOrder?: number;
}
export declare class PlansAdminController {
    private readonly plans;
    constructor(plans: PlansService);
    list(): Promise<{
        active: boolean;
        sortOrder: number;
        updatedAt: Date;
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
        id: string;
    }[]>;
    create(body: PlanDto): Promise<{
        active: boolean;
        sortOrder: number;
        updatedAt: Date;
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
        id: string;
    }>;
    update(id: string, body: PlanDto): Promise<{
        active: boolean;
        sortOrder: number;
        updatedAt: Date;
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
        id: string;
    }>;
    remove(id: string): Promise<{
        ok: true;
    }>;
}
export {};
