-- P8 production hardening: transactional outbox (reliable event delivery) + dead-letter store.

-- Outbox: events written in the SAME tx as the state change; a relay publishes them at-least-once.
CREATE TABLE IF NOT EXISTS outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_unpublished_idx ON outbox (created_at) WHERE published_at IS NULL;

-- Dead letters: jobs that exhausted retries land here for inspection + replay (platform-only).
CREATE TABLE IF NOT EXISTS dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue text NOT NULL,
  job_name text,
  payload jsonb,
  error text,
  failed_at timestamptz NOT NULL DEFAULT now(),
  replayed_at timestamptz
);
CREATE INDEX IF NOT EXISTS dead_letters_failed_idx ON dead_letters (failed_at);

-- RLS: outbox = tenant isolation; dead_letters = platform only
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['outbox'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$CREATE POLICY tenant_isolation ON %I
      USING (current_setting('app.platform', true) = 'on' OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (current_setting('app.platform', true) = 'on' OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)$f$, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['dead_letters'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS platform_only ON %I', t);
    EXECUTE format($f$CREATE POLICY platform_only ON %I
      USING (current_setting('app.platform', true) = 'on') WITH CHECK (current_setting('app.platform', true) = 'on')$f$, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;
UPDATE app_meta SET value='P8', updated_at=now() WHERE key='schema_phase';
