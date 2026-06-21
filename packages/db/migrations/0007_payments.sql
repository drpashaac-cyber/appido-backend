-- P5a customer→tenant payments (GMV). transactions already carry gateway/provider_ref/
-- status/receipt; add an expiry so the watcher can time out unpaid crypto checkouts.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions (status, gateway);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;
UPDATE app_meta SET value='P5a', updated_at=now() WHERE key='schema_phase';
