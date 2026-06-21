-- P19: Platform gateway policy — owner enables/disables a payment method for ALL tenants.
-- Absence of a row = enabled (registry default).
CREATE TABLE IF NOT EXISTS appido_gateway_policy (
  method text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO appido_app;
