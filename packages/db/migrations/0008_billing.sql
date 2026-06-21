-- P5b Appido subscription billing (MRR). Separate from GMV (transactions) entirely.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_ref text;

CREATE TABLE IF NOT EXISTS activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  plan sub_plan NOT NULL,
  duration_days integer NOT NULL DEFAULT 30,
  note text,
  redeemed_by_tenant uuid REFERENCES tenants(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_codes FORCE ROW LEVEL SECURITY;
-- platform-only: tenants can never enumerate codes; redemption runs via trusted server logic.
CREATE POLICY activation_codes_platform ON activation_codes
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;
UPDATE app_meta SET value='P5b', updated_at=now() WHERE key='schema_phase';
