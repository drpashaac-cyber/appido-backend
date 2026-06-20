-- P21: Onboarding AI script (platform-curated) + lead-answer enrichment + channel opt-out.
CREATE TABLE IF NOT EXISTS appido_script (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'onboard',
  question_fa text NOT NULL,
  question_en text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appido_script_order_idx ON appido_script (sort_order);

-- Lead answers the AI collects, keyed by appido_script.key.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Per-channel opt-out of the platform onboarding script.
ALTER TABLE channels ADD COLUMN IF NOT EXISTS onboarding_enabled boolean NOT NULL DEFAULT true;

-- Seed a sensible default playbook (English-only digits; bilingual copy).
INSERT INTO appido_script (key, category, question_fa, question_en, sort_order) VALUES
  ('use_case',   'onboard', 'دنبالِ حلِ چه چیزی هستید؟', 'What are you hoping to solve or achieve?', 1),
  ('timeline',   'qualify', 'برای شروع چه بازهٔ زمانی‌ای در نظر دارید؟', 'What timeline do you have in mind to get started?', 2),
  ('budget_fit', 'qualify', 'کدام پلن به نیازتان نزدیک‌تر است؟', 'Which plan feels closest to your needs?', 3)
ON CONFLICT (key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO appido_app;
