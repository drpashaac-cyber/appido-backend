-- P4 AI Core: per-tenant AI budget, channel AI guardrails/toggle, vector index.

-- per-tenant monthly AI budget (enforced from our ai_usage ledger) + key seam
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_budget_cents integer NOT NULL DEFAULT 1000; -- $10/mo
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_virtual_key_enc text; -- future: LiteLLM per-tenant key

-- channel-level agent controls (model/tone/goal/languages already exist)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS ai_guardrails text;

-- ANN index for RAG cosine similarity (pgvector HNSW)
CREATE INDEX IF NOT EXISTS knowledge_embedding_hnsw
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;

UPDATE app_meta SET value='P4', updated_at=now() WHERE key='schema_phase';
