ALTER TABLE channels ADD COLUMN IF NOT EXISTS ai_budget_cents integer NOT NULL DEFAULT 0;
