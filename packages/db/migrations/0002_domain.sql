-- Full domain schema (P2). Money = integer minor units; tenant_id + RLS on all.

DO $$ BEGIN CREATE TYPE customer_tag AS ENUM ('hot','warm','cold','vip'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE event_type AS ENUM ('joined','viewed','paid','failed','expired','renewed','vip','message'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE msg_direction AS ENUM ('in','out'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE msg_author AS ENUM ('customer','ai','human'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sub_plan AS ENUM ('start','pro','trial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sub_status AS ENUM ('trialing','active','past_due','canceled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tx_status AS ENUM ('pending','ok','fail'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pay_method AS ENUM ('zarinpal','idpay','nextpay','stripe','paypal','usdt_trc20','usdt_bep20','usdt_ton','card'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pay_kind AS ENUM ('key','wallet','manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE knowledge_source AS ENUM ('file','product'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- enrich channels (P1) with Telegram + AI config
ALTER TABLE channels ADD COLUMN IF NOT EXISTS members integer NOT NULL DEFAULT 0;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS bot_token_enc text;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS bot_secret text;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS ai_model text NOT NULL DEFAULT 'claude';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS ai_tone text;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS ai_goal text;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS ai_languages text[];
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS tenant_id uuid;

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES channels(id) ON DELETE SET NULL,
  tg_user_id bigint,
  handle text, name text NOT NULL, phone text, email text,
  tag customer_tag NOT NULL DEFAULT 'cold',
  segment text,
  intent integer NOT NULL DEFAULT 0,
  ltv_cents integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  tags text[],
  is_vip boolean NOT NULL DEFAULT false,
  vip_until timestamptz,
  ai_managed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_tenant_idx ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS customers_intent_idx ON customers(tenant_id, intent);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  type event_type NOT NULL,
  amount_cents integer, currency text,
  meta jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_tenant_at_idx ON events(tenant_id, at);
CREATE INDEX IF NOT EXISTS events_customer_idx ON events(customer_id);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES channels(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  direction msg_direction NOT NULL,
  body text NOT NULL,
  author msg_author NOT NULL,
  tg_message_id bigint,
  tokens_in integer, tokens_out integer,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_tenant_at_idx ON messages(tenant_id, at);
CREATE INDEX IF NOT EXISTS messages_customer_idx ON messages(customer_id);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  duration_days integer,
  description text, doc text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_tenant_idx ON products(tenant_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan sub_plan NOT NULL,
  status sub_status NOT NULL DEFAULT 'trialing',
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  gateway text, activation_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_tenant_idx ON subscriptions(tenant_id);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES channels(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  gateway text NOT NULL,
  status tx_status NOT NULL DEFAULT 'pending',
  provider_ref text,
  receipt jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transactions_tenant_at_idx ON transactions(tenant_id, at);
-- idempotency on provider reference (one confirmed payment per gateway ref)
CREATE UNIQUE INDEX IF NOT EXISTS transactions_provider_uq ON transactions(gateway, provider_ref) WHERE provider_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  method pay_method NOT NULL,
  kind pay_kind NOT NULL,
  secret_enc text,
  enabled boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pay_cred_tenant_idx ON payment_credentials(tenant_id);

CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  model text NOT NULL,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  cost_micro_usd bigint NOT NULL DEFAULT 0,
  request_id text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_tenant_at_idx ON ai_usage(tenant_id, at);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source knowledge_source NOT NULL,
  source_id uuid,
  chunk_text text NOT NULL,
  embedding vector(1536),
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knowledge_tenant_idx ON knowledge_chunks(tenant_id);

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  anon_id text,
  props jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_at_idx ON analytics_events(at);

-- RLS on every tenant-scoped table (DRY). analytics_events stays public.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','events','messages','products','subscriptions',
    'transactions','payment_credentials','ai_usage','knowledge_chunks'
  ] LOOP
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

-- runtime role keeps DML on the new tables (explicit; not relying on defaults)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO appido_app;

UPDATE app_meta SET value='P2', updated_at=now() WHERE key='schema_phase';
