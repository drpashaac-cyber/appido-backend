-- P18: Appido subscription plan catalog — the single source of truth shared by the owner console
-- (manage), the landing page (display), and the dashboard (display + checkout).

-- Allow owner-defined plan keys to be subscribable (validated against appido_plans in app code).
ALTER TABLE subscriptions ALTER COLUMN plan TYPE text USING plan::text;

CREATE TABLE IF NOT EXISTS appido_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  desc_fa text,
  desc_en text,
  price_cents integer NOT NULL DEFAULT 0,
  annual_cents integer,
  currency text NOT NULL DEFAULT 'USD',
  period_days integer NOT NULL DEFAULT 30,
  features_fa jsonb NOT NULL DEFAULT '[]'::jsonb,
  features_en jsonb NOT NULL DEFAULT '[]'::jsonb,
  popular boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Canonical plans (idempotent). Prices in cents; annual = ~20% off twelve months.
INSERT INTO appido_plans (key, name, desc_en, desc_fa, price_cents, annual_cents, currency, period_days, features_en, features_fa, popular, sort_order)
VALUES
  ('start','Start','Everything to start selling','هرچه برای شروعِ فروش لازم است', 7900, 75840, 'USD', 30,
   '["Sales & membership bot","Auto payment confirm","Auto product delivery","Channel access management","Inbox & basic CRM"]'::jsonb,
   '["رباتِ فروش و عضویت","تأییدِ خودکارِ پرداخت","تحویلِ خودکارِ محصول","مدیریتِ دسترسیِ کانال","صندوقِ پیام و CRM پایه"]'::jsonb,
   false, 1),
  ('pro','Pro','AI that sells for you 24/7','هوشِ مصنوعی که 24 ساعته برایت می‌فروشد', 17900, 171840, 'USD', 30,
   '["24/7 AI seller","Smart customer support","Smart marketer","Smart campaign manager","Smart CRM"]'::jsonb,
   '["فروشندهٔ هوشمندِ 24ساعته","پشتیبانِ هوشمندِ مشتریان","مارکترِ هوشمند","مدیر و مجریِ هوشمندِ کمپین","CRM هوشمند"]'::jsonb,
   true, 2)
ON CONFLICT (key) DO NOTHING;

-- Re-grant so the app role can read/write the new table (matches the project's migration pattern).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appido_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO appido_app;
