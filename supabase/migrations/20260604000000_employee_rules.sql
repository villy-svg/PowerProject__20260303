-- ============================================================
-- Migration: Employee Rules & Regulations
-- Created: 2026-06-04
-- Tables: rule_categories, rule_sub_categories, employee_rules
-- RLS: All authenticated users can read; only master_admin can write.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. RULE CATEGORIES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rule_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  icon        text,                  -- emoji or icon identifier
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rule_categories ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated users
CREATE POLICY "rule_categories_read_all"
  ON rule_categories FOR SELECT
  TO authenticated
  USING (true);

-- Write: master_admin only
CREATE POLICY "rule_categories_write_master_admin"
  ON rule_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role_id = 'master_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role_id = 'master_admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 2. RULE SUB-CATEGORIES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rule_sub_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES rule_categories(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rule_sub_categories_category_id_idx
  ON rule_sub_categories(category_id);

ALTER TABLE rule_sub_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rule_sub_categories_read_all"
  ON rule_sub_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rule_sub_categories_write_master_admin"
  ON rule_sub_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role_id = 'master_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role_id = 'master_admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 3. EMPLOYEE RULES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      uuid NOT NULL REFERENCES rule_categories(id) ON DELETE CASCADE,
  sub_category_id  uuid REFERENCES rule_sub_categories(id) ON DELETE SET NULL,
  title            text NOT NULL,
  content          text,              -- Markdown/plain-text body
  drive_url        text,              -- Optional: Google Drive link for full document
  effective_date   date,
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  created_by       uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employee_rules_category_id_idx
  ON employee_rules(category_id);

CREATE INDEX IF NOT EXISTS employee_rules_sub_category_id_idx
  ON employee_rules(sub_category_id);

CREATE INDEX IF NOT EXISTS employee_rules_is_active_idx
  ON employee_rules(is_active);

ALTER TABLE employee_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_rules_read_all"
  ON employee_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "employee_rules_write_master_admin"
  ON employee_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role_id = 'master_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role_id = 'master_admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 4. AUTO-UPDATE updated_at TRIGGERS
-- ────────────────────────────────────────────────────────────
-- Reuse the existing moddatetime extension if available,
-- otherwise define a simple trigger function.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER rule_categories_updated_at
  BEFORE UPDATE ON rule_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER rule_sub_categories_updated_at
  BEFORE UPDATE ON rule_sub_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER employee_rules_updated_at
  BEFORE UPDATE ON employee_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────────────────────
-- 5. SCHEMA RELOAD (Mandatory per migration policy)
-- ────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
