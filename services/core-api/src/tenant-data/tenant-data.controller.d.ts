import { type AuthedRequest } from "../auth/auth.guard";
import { PageQueryDto } from "../common/dto/page-query.dto";
import { AuditService } from "../audit/audit.service";
import { TenantDataService } from "./tenant-data.service";
declare class ReplyDto {
    text: string;
}
declare class ConsentDto {
    purpose: string;
    granted: boolean;
    source?: string;
}
export declare class TenantDataController {
    private readonly data;
    private readonly audit;
    constructor(data: TenantDataService, audit: AuditService);
    customers(req: AuthedRequest, q: PageQueryDto): Promise<import("../common/pagination").Page<{
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
    }>>;
    customer(req: AuthedRequest, id: string): Promise<{
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
    messages(req: AuthedRequest, id: string, q: PageQueryDto): Promise<{
        id: string;
        direction: "in" | "out";
        author: "customer" | "ai" | "human";
        body: string;
        at: Date;
    }[]>;
    reply(req: AuthedRequest, id: string, body: ReplyDto): Promise<{
        id: string;
        at: Date;
        direction: string;
        author: string;
        body: string;
    }>;
    read(req: AuthedRequest, id: string): Promise<{
        ok: boolean;
    }>;
    listConsent(req: AuthedRequest, id: string): Promise<{
        purpose: string;
        granted: boolean;
        source: string;
        at: Date;
    }[]>;
    setConsent(req: AuthedRequest, id: string, body: ConsentDto): Promise<{
        purpose: string;
        granted: boolean;
        source: string;
        at: Date;
    }[]>;
    exportCustomer(req: AuthedRequest, id: string): Promise<{
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
    deleteCustomer(req: AuthedRequest, id: string): Promise<{
        ok: true;
        deleted: string;
    }>;
    products(req: AuthedRequest): Promise<{
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
    transactions(req: AuthedRequest, q: PageQueryDto): Promise<import("../common/pagination").Page<{
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
    inbox(req: AuthedRequest, q: PageQueryDto): Promise<{
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
    usage(req: AuthedRequest): any;
    summary(req: AuthedRequest): any;
}
export {};
