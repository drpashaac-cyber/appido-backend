import { schema, type DbHandle, type RlsContext } from "@appido/db";
import { SecretCipher } from "@appido/crypto";
import { type Page } from "../common/pagination";
export declare class TenantDataService {
    private readonly dbh;
    private readonly cipher;
    constructor(dbh: DbHandle, cipher: SecretCipher);
    customers(ctx: RlsContext, limit?: number, cursor?: string): Promise<Page<typeof schema.customers.$inferSelect>>;
    customerDetail(ctx: RlsContext, id: string): Promise<{
        customer: {
            name: string;
            tenantId: string;
            id: string;
            email: string;
            createdAt: Date;
            locale: string;
            updatedAt: Date;
            channelId: string;
            tgUserId: number;
            handle: string;
            phone: string;
            tag: "hot" | "warm" | "cold" | "vip";
            segment: string;
            intent: number;
            ltvCents: number;
            points: number;
            tags: string[];
            isVip: boolean;
            vipUntil: Date;
            profile: Record<string, unknown>;
            aiManaged: boolean;
        };
        timeline: {
            at: Date;
            tenantId: string;
            id: string;
            meta: unknown;
            type: string;
            currency: string;
            customerId: string;
            amountCents: number;
        }[];
    }>;
    products(ctx: RlsContext): Promise<{
        id: string;
        name: string;
        priceCents: number;
        currency: string;
        durationDays: number;
        description: string;
        doc: string;
        active: boolean;
        createdAt: Date;
        sales: number;
    }[]>;
    transactions(ctx: RlsContext, limit?: number, cursor?: string): Promise<Page<{
        id: string;
        amountCents: number;
        currency: string;
        gateway: string;
        status: "ok" | "pending" | "fail";
        customerId: string;
        productId: string;
        customerName: string;
        at: Date;
    }>>;
    inbox(ctx: RlsContext, limit?: number): Promise<{
        customerId: string;
        name: string;
        handle: string | null;
        tag: string;
        intent: number;
        segment: string | null;
        aiManaged: boolean;
        isVip: boolean;
        last: string | null;
        author: string | null;
        direction: string | null;
        at: string | null;
        unread: number;
    }[]>;
    messages(ctx: RlsContext, id: string, limit?: number): Promise<{
        id: string;
        direction: "in" | "out";
        author: "customer" | "ai" | "human";
        body: string;
        at: Date;
    }[]>;
    sendReply(ctx: RlsContext, customerId: string, text: string): Promise<{
        id: string;
        at: Date;
        direction: string;
        author: string;
        body: string;
    }>;
    markRead(ctx: RlsContext, customerId: string): Promise<{
        ok: boolean;
    }>;
    listConsent(ctx: RlsContext, customerId: string): Promise<{
        purpose: string;
        granted: boolean;
        source: string;
        at: Date;
    }[]>;
    setConsent(ctx: RlsContext, customerId: string, input: {
        purpose: string;
        granted: boolean;
        source?: string;
    }): Promise<{
        purpose: string;
        granted: boolean;
        source: string;
        at: Date;
    }[]>;
    exportCustomer(ctx: RlsContext, customerId: string): Promise<{
        exportedAt: string;
        customer: {
            id: string;
            name: string;
            handle: string;
            phone: string;
            email: string;
            tag: "hot" | "warm" | "cold" | "vip";
            intent: number;
            locale: string;
            profile: Record<string, unknown>;
            createdAt: Date;
        };
        messages: {
            direction: "in" | "out";
            body: string;
            author: "customer" | "ai" | "human";
            at: Date;
        }[];
        events: {
            type: string;
            amountCents: number;
            currency: string;
            meta: unknown;
            at: Date;
        }[];
        consent: {
            purpose: string;
            granted: boolean;
            source: string;
            at: Date;
        }[];
        transactions: {
            status: "ok" | "pending" | "fail";
            amountCents: number;
            currency: string;
            at: any;
        }[];
    }>;
    deleteCustomer(ctx: RlsContext, customerId: string): Promise<{
        ok: true;
        deleted: string;
    }>;
}
