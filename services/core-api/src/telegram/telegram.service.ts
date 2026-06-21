import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { TelegramApi } from "@appido/telegram";
import { SecretCipher } from "@appido/crypto";
import { runWithRls, schema, type DbHandle, type RlsContext } from "@appido/db";
import type { AppConfig } from "@appido/config";
import { DB } from "../db/db.module";
import { APP_CONFIG } from "../config/config.module";
import { SECRET_CIPHER } from "../crypto/crypto.module";
import { AuditService } from "../audit/audit.service";

const ALLOWED_UPDATES = ["message", "edited_message", "my_chat_member", "chat_member", "callback_query"];

export interface ConnectInput {
  token: string;
  name?: string;
}

@Injectable()
export class TelegramService {
  constructor(
    @Inject(DB) private readonly dbh: DbHandle,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  private api(token: string): TelegramApi {
    return new TelegramApi(token, this.config.TELEGRAM_API_BASE);
  }

  /** Step in the ChannelWizard: prove the pasted token is a real, live bot. */
  async verifyToken(token: string): Promise<{ botId: number; username?: string; firstName?: string }> {
    const me = await this.api(token).getMe();
    return { botId: me.id, username: me.username, firstName: me.first_name };
  }

  /** Create the channel, store the token encrypted, and register the webhook. */
  async connect(ctx: RlsContext, actorUserId: string, dto: ConnectInput) {
    if (!ctx.tenantId) throw new BadRequestException("connect must run in a tenant context");
    const me = await this.api(dto.token).getMe();
    const secret = randomBytes(32).toString("base64url"); // valid Telegram secret_token charset
    const tokenEnc = this.cipher.encrypt(dto.token);

    const channelId = await runWithRls(this.dbh.pool, ctx, async (tx) => {
      const [row] = await tx
        .insert(schema.channels)
        .values({
          tenantId: ctx.tenantId!,
          name: dto.name ?? me.username ?? "Telegram bot",
          username: me.username ? `@${me.username}` : null,
          botTokenEnc: tokenEnc,
          botSecret: secret,
          botId: me.id,
          botUsername: me.username ?? null,
          aiModel: "claude",
          connectedAt: new Date(),
        })
        .returning({ id: schema.channels.id });
      return row.id;
    });

    const webhookUrl = `${this.config.PUBLIC_BASE_URL}/tg/${channelId}`;
    await this.api(dto.token).setWebhook({
      url: webhookUrl,
      secretToken: secret,
      allowedUpdates: ALLOWED_UPDATES,
      dropPendingUpdates: true,
    });
    const info = await this.api(dto.token).getWebhookInfo();
    await this.audit.record({
      actorUserId,
      tenantId: ctx.tenantId,
      action: "telegram.connect",
      target: channelId,
      meta: { botId: me.id, username: me.username },
    });
    return { channelId, webhookUrl, ok: info.url === webhookUrl, botUsername: me.username ?? null };
  }

  async status(ctx: RlsContext, channelId: string) {
    const token = await this.tokenFor(ctx, channelId);
    const info = await this.api(token).getWebhookInfo();
    return {
      url: info.url,
      pendingUpdates: info.pending_update_count,
      lastError: info.last_error_message ?? null,
    };
  }

  async disconnect(ctx: RlsContext, actorUserId: string, channelId: string): Promise<{ ok: true }> {
    const token = await this.tokenFor(ctx, channelId);
    await this.api(token).deleteWebhook(true);
    await runWithRls(this.dbh.pool, ctx, (tx) =>
      tx.update(schema.channels).set({ botSecret: null, connectedAt: null }).where(eq(schema.channels.id, channelId)),
    );
    await this.audit.record({ actorUserId, tenantId: ctx.tenantId ?? null, action: "telegram.disconnect", target: channelId });
    return { ok: true };
  }

  private async tokenFor(ctx: RlsContext, channelId: string): Promise<string> {
    const enc = await runWithRls(this.dbh.pool, ctx, async (tx) => {
      const [row] = await tx
        .select({ enc: schema.channels.botTokenEnc })
        .from(schema.channels)
        .where(eq(schema.channels.id, channelId))
        .limit(1);
      return row?.enc ?? null;
    });
    if (!enc) throw new NotFoundException("channel_or_token_not_found");
    return this.cipher.decrypt(enc);
  }

  /** Webhook resolver — trusted system path, platform RLS context. */
  async getChannelForWebhook(channelId: string): Promise<{ tenantId: string; botSecret: string | null } | null> {
    const rows = await runWithRls(this.dbh.pool, { platform: true }, (tx) =>
      tx
        .select({ tenantId: schema.channels.tenantId, botSecret: schema.channels.botSecret })
        .from(schema.channels)
        .where(eq(schema.channels.id, channelId))
        .limit(1),
    );
    return rows[0] ?? null;
  }
}
