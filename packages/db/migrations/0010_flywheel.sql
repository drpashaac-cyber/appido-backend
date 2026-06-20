-- P7 flywheel: attribute real outcomes back onto the AI ledger + eval harness.
ALTER TABLE campaign_sends ADD COLUMN IF NOT EXISTS converted_at timestamptz;
CREATE INDEX IF NOT EXISTS ai_usage_customer_idx ON ai_usage (customer_id);

-- owner-curated regression sets (platform-only)
CREATE TABLE IF NOT EXISTS golden_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task text NOT NULL,
  input text NOT NULL,
  expected text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS golden_cases_task_idx ON golden_cases (task);

CREATE TABLE IF NOT EXISTS eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task text NOT NULL,
  model text NOT NULL,
  total integer NOT NULL DEFAULT 0,
  passed integer NOT NULL DEFAULT 0,
  avg_score integer NOT NULL DEFAULT 0,
  detail jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eval_runs_task_idx ON eval_runs (task, at);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['golden_cases','eval_runs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS platform_only ON %I', t);
    EXECUTE format($f$CREATE POLICY platform_only ON %I
      USING (current_setting('app.platform', true) = 'on')
      WITH CHECK (current_setting('app.platform', true) = 'on')$f$, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;
UPDATE app_meta SET value='P7', updated_at=now() WHERE key='schema_phase';
