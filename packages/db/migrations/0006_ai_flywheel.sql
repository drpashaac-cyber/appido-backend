-- P4.5 Managed-Hybrid: enrich the AI ledger into the training/eval dataset (the moat).
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS task text;        -- chat | advisor | score_lead | ...
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS tier text;        -- fast | smart | embed
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS latency_ms integer;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS outcome text;     -- paid | churn | escalate | ... (labelled later)

CREATE INDEX IF NOT EXISTS ai_usage_task_idx ON ai_usage (tenant_id, task);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;

UPDATE app_meta SET value='P4.5', updated_at=now() WHERE key='schema_phase';
