import type { TgUser, TgChat, TgWebhookInfo, SetWebhookParams } from "./types";

const DEFAULT_BASE = "https://api.telegram.org";

/** Thin Bot API client. One instance per bot token. */
export class TelegramApi {
  constructor(
    private readonly token: string,
    private readonly base: string = DEFAULT_BASE,
  ) {}

  private async call<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.base}/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) throw new Error(`telegram ${method} failed: ${json.description ?? res.statusText}`);
    return json.result as T;
  }

  getMe(): Promise<TgUser> {
    return this.call<TgUser>("getMe");
  }
  setWebhook(p: SetWebhookParams): Promise<boolean> {
    return this.call<boolean>("setWebhook", {
      url: p.url,
      secret_token: p.secretToken,
      allowed_updates: p.allowedUpdates,
      max_connections: p.maxConnections,
      drop_pending_updates: p.dropPendingUpdates,
    });
  }
  getWebhookInfo(): Promise<TgWebhookInfo> {
    return this.call<TgWebhookInfo>("getWebhookInfo");
  }
  deleteWebhook(dropPending = false): Promise<boolean> {
    return this.call<boolean>("deleteWebhook", { drop_pending_updates: dropPending });
  }
  sendMessage(chatId: number | string, text: string, extra?: Record<string, unknown>): Promise<unknown> {
    return this.call("sendMessage", { chat_id: chatId, text, ...extra });
  }
  /** Shows a transient status (e.g. "typing") to the user; lasts ~5s or until a message arrives. */
  sendChatAction(chatId: number | string, action: string = "typing"): Promise<unknown> {
    return this.call("sendChatAction", { chat_id: chatId, action });
  }
  getChat(chatId: number | string): Promise<TgChat> {
    return this.call<TgChat>("getChat", { chat_id: chatId });
  }
  createChatInviteLink(chatId: number | string, extra?: Record<string, unknown>): Promise<{ invite_link: string }> {
    return this.call("createChatInviteLink", { chat_id: chatId, ...extra });
  }
  banChatMember(chatId: number | string, userId: number): Promise<boolean> {
    return this.call<boolean>("banChatMember", { chat_id: chatId, user_id: userId });
  }
  unbanChatMember(chatId: number | string, userId: number): Promise<boolean> {
    return this.call<boolean>("unbanChatMember", { chat_id: chatId, user_id: userId, only_if_banned: true });
  }
}

/** Telegram bot-token format (validated in the ChannelWizard before connect). */
export const BOT_TOKEN_RE = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/;
