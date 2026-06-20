import { type DbHandle } from "@appido/db";
export interface PlanInput {
    key?: string;
    name?: string;
    descFa?: string | null;
    descEn?: string | null;
    priceCents?: number;
    annualCents?: number | null;
    currency?: string;
    periodDays?: number;
    featuresFa?: string[];
    featuresEn?: string[];
    popular?: boolean;
    active?: boolean;
    sortOrder?: number;
}
export declare class PlansService {
    private readonly dbh;
    constructor(dbh: DbHandle);
    private toPublic;
    private toAdmin;
    /** Active plans for the landing page + dashboard (public, no secrets). */
    listPublic(): Promise<{
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
    /** All plans incl. inactive — owner console. */
    listAll(): Promise<{
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
    create(input: PlanInput): Promise<{
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
    update(id: string, patch: PlanInput): Promise<{
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
    /** Soft delete — keeps existing subscriptions valid and hides the plan from landing/checkout. */
    remove(id: string): Promise<{
        ok: true;
    }>;
    /** Checkout pricing — the DB catalog is the source of truth (null if the key is unknown/inactive). */
    pricing(key: string): Promise<{
        priceCents: number;
        currency: string;
        periodDays: number;
        active: boolean;
    } | null>;
}
