-- P3.5 Foundation Hardening: customer-360 identity seam, locale/region fields,
-- and an OPEN event taxonomy (events.type: enum -> text).

-- 1) tenant operating context (i18n now; multi-region infra deferred)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- 2) per-customer locale (populated from Telegram language_code on ingest)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS locale text;

-- 3) open event taxonomy — events store is the analytics + workflow-trigger backbone
ALTER TABLE events ALTER COLUMN type TYPE text USING type::text;
DROP TYPE IF EXISTS event_type;

-- 4) Customer-360 identity seam: one canonical customer <- many channel identities
CREATE TABLE IF NOT EXISTS customer_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind text NOT NULL,            -- telegram | email | phone | web | whatsapp | ...
  value text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_identity_uq ON customer_identities(tenant_id, kind, value);
CREATE INDEX IF NOT EXISTS customer_identity_customer_idx ON customer_identities(customer_id);

-- backfill existing Telegram customers into the identity graph
INSERT INTO customer_identities (tenant_id, customer_id, kind, value, verified)
SELECT tenant_id, id, 'telegram', tg_user_id::text, true
FROM customers WHERE tg_user_id IS NOT NULL
ON CONFLICT (tenant_id, kind, value) DO NOTHING;

-- RLS (tenant-scoped, same policy form as the rest of the domain)
ALTER TABLE customer_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_identities FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON customer_identities;
CREATE POLICY tenant_isolation ON customer_identities
  USING (current_setting('app.platform', true) = 'on'
         OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (current_setting('app.platform', true) = 'on'
         OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;

UPDATE app_meta SET value='P3.5', updated_at=now() WHERE key='schema_phase';
