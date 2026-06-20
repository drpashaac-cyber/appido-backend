// Minimal Telegram Bot API types we consume. The platform calls the Bot API over
// HTTP directly (queue-based ingest), so we model only what we use.
export interface TgUser {
  id: number;
  is_bot: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}
export interface TgChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
}
export interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  date: number;
  text?: string;
  caption?: string;
  new_chat_members?: TgUser[];
  left_chat_member?: TgUser;
}
export interface TgChatMemberUpdated {
  chat: TgChat;
  from: TgUser;
  new_chat_member: { user: TgUser; status: string };
  old_chat_member: { user: TgUser; status: string };
}
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  my_chat_member?: TgChatMemberUpdated;
  chat_member?: TgChatMemberUpdated;
  callback_query?: { id: string; from: TgUser; data?: string };
}
export interface TgWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}
export interface SetWebhookParams {
  url: string;
  secretToken: string;
  allowedUpdates?: string[];
  maxConnections?: number;
  dropPendingUpdates?: boolean;
}
