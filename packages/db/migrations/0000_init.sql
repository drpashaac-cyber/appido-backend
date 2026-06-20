-- P0 init: required extensions + a meta table to prove the pipeline.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS app_meta (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_meta (key, value) VALUES ('schema_phase', 'P0')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
