-- P20: Platform settings as a reusable key-value store (owner manages; some keys public).
CREATE TABLE IF NOT EXISTS appido_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Free-trial length (days). Shared by the landing + dashboard; editable in the owner console.
INSERT INTO appido_settings (key, value) VALUES ('trial_days', '14'::jsonb)
ON CONFLICT (key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO appido_app;
