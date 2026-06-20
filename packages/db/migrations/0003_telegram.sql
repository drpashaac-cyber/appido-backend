-- Telegram connect metadata + idempotent webhook dedup (P3).

ALTER TABLE channels ADD COLUMN IF NOT EXISTS bot_id bigint;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS bot_username text;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS tg_chat_id bigint;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS connected_at timestamptz;

-- Dedup table: Telegram retries updates; we process each (channel, update_id) once.
-- System table (no tenant scope / no RLS) — keyed by channel; touched by the
-- webhook + worker under trusted context only.
CREATE TABLE IF NOT EXISTS tg_processed_updates (
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  update_id bigint NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, update_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;

UPDATE app_meta SET value='P3', updated_at=now() WHERE key='schema_phase';
