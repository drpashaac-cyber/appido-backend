import { SecretCipher } from "@appido/crypto";
import { type DbHandle, type RlsContext } from "@appido/db";
import type { AppConfig } from "@appido/config";
import { AuditService } from "../audit/audit.service";
export interface ConnectInput {
    token: string;
    name?: string;
}
export declare class TelegramService {
    private readonly dbh;
    private readonly cipher;
    private readonly config;
    private readonly audit;
    constructor(dbh: DbHandle, cipher: SecretCipher, config: AppConfig, audit: AuditService);
    private api;
    /** Step in the ChannelWizard: prove the pasted token is a real, live bot. */
    verifyToken(token: string): Promise<{
        botId: number;
        username?: string;
        firstName?: string;
    }>;
    /** Create the channel, store the token encrypted, and register the webhook. */
    connect(ctx: RlsContext, actorUserId: string, dto: ConnectInput): Promise<{
        channelId: string;
        webhookUrl: string;
        ok: boolean;
        botUsername: string;
    }>;
    status(ctx: RlsContext, channelId: string): Promise<{
        url: string;
        pendingUpdates: number;
        lastError: string;
    }>;
    disconnect(ctx: RlsContext, actorUserId: string, channelId: string): Promise<{
        ok: true;
    }>;
    private tokenFor;
    /** Webhook resolver — trusted system path, platform RLS context. */
    getChannelForWebhook(channelId: string): Promise<{
        tenantId: string;
        botSecret: string | null;
    } | null>;
}
