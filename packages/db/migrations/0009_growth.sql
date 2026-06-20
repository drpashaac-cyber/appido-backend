-- P6 growth/automation engine: segments, campaigns, broadcast sends.
-- Lead score reuses customers.intent (0..100) + customers.tag + tags; no new customer column.
DO $$ BEGIN CREATE TYPE campaign_status AS ENUM ('draft','scheduled','sending','sent','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS segments_tenant_idx ON segments (tenant_id);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES channels(id) ON DELETE SET NULL,
  name text NOT NULL,
  goal text,
  body text,
  segment_id uuid REFERENCES segments(id) ON DELETE SET NULL,
  criteria jsonb,
  status campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_tenant_idx ON campaigns (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS campaign_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  error text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_sends_campaign_idx ON campaign_sends (campaign_id, status);

-- RLS: identical tenant-isolation policy as the P2 domain tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['segments','campaigns','campaign_sends'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      $f$CREATE POLICY tenant_isolation ON %I
         USING (current_setting('app.platform', true) = 'on'
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
         WITH CHECK (current_setting('app.platform', true) = 'on'
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)$f$, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;
UPDATE app_meta SET value='P6', updated_at=now() WHERE key='schema_phase';
