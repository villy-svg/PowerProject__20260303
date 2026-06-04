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
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rule_categories ENABLE ROW LEVEL SECURITY;

ALTER TABLE rule_categories ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Read: all authenticated users
DROP POLICY IF EXISTS "rule_categories_read_all" ON rule_categories;
CREATE POLICY "rule_categories_read_all"
  ON rule_categories FOR SELECT
  TO authenticated
  USING (true);

-- Write: master_admin only
DROP POLICY IF EXISTS "rule_categories_write_master_admin" ON rule_categories;
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
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rule_sub_categories_category_id_idx
  ON rule_sub_categories(category_id);

ALTER TABLE rule_sub_categories ENABLE ROW LEVEL SECURITY;

ALTER TABLE rule_sub_categories ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

DROP POLICY IF EXISTS "rule_sub_categories_read_all" ON rule_sub_categories;
CREATE POLICY "rule_sub_categories_read_all"
  ON rule_sub_categories FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rule_sub_categories_write_master_admin" ON rule_sub_categories;
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
  impact           text,              -- Optional: impact of the rule
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  metadata         jsonb DEFAULT '{}'::jsonb,
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

ALTER TABLE employee_rules ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE employee_rules ADD COLUMN IF NOT EXISTS impact text;

DROP POLICY IF EXISTS "employee_rules_read_all" ON employee_rules;
CREATE POLICY "employee_rules_read_all"
  ON employee_rules FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "employee_rules_write_master_admin" ON employee_rules;
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
-- 5. SEED DATA FOR EMOLOYEE RULES (Idempotent)
-- ────────────────────────────────────────────────────────────
INSERT INTO rule_categories (id, name, icon, description, sort_order) VALUES
('a0e8f000-0000-0000-0000-000000000001', 'Safety & Security', '🛡️', 'Rules concerning safety protocol, emergency layouts, and gear usage.', 1),
('a0e8f000-0000-0000-0000-000000000002', 'Code of Conduct', '🤝', 'Professional guidelines, client communication rules, and ethical standards.', 2),
('a0e8f000-0000-0000-0000-000000000003', 'Operational Standards', '⚙️', 'Daily shift workflows, checklists, and facility maintenance rules.', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_sub_categories (id, category_id, name, sort_order) VALUES
('a0e8f000-0000-0000-0000-000000000101', 'a0e8f000-0000-0000-0000-000000000001', 'PPE Requirements', 1),
('a0e8f000-0000-0000-0000-000000000102', 'a0e8f000-0000-0000-0000-000000000001', 'Fire Safety Protocols', 2),
('a0e8f000-0000-0000-0000-000000000103', 'a0e8f000-0000-0000-0000-000000000002', 'Attendance & Punctuality', 1),
('a0e8f000-0000-0000-0000-000000000104', 'a0e8f000-0000-0000-0000-000000000002', 'Anti-Harassment', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO employee_rules (id, category_id, sub_category_id, title, content, effective_date, is_active, sort_order, impact) VALUES
('a0e8f000-0000-0000-0000-000000000201', 'a0e8f000-0000-0000-0000-000000000001', 'a0e8f000-0000-0000-0000-000000000101', 'Mandatory Helmet Usage', 'All operators must wear safety helmets inside active maintenance bays at all times.', CURRENT_DATE, true, 1, 'High'),
('a0e8f000-0000-0000-0000-000000000202', 'a0e8f000-0000-0000-0000-000000000001', 'a0e8f000-0000-0000-0000-000000000102', 'Fire Extinguisher Checks', 'Monthly check of fire extinguisher inspection labels is required for all fire wardens.', CURRENT_DATE, true, 2, 'High'),
('a0e8f000-0000-0000-0000-000000000203', 'a0e8f000-0000-0000-0000-000000000002', NULL, 'No Using Customer Vehicle/Material', '1. Do not use customer vehicles/materials.
2. ಗ್ರಾಹಕರ ವಾಹನಗಳು/ವಸ್ತುಗಳನ್ನು ಬಳಸಬೇಡಿ
3. Impact: Termination | Fine : Rs. 5,000/- | Pay Full Vehicle Repair Cost
4. ಪ್ರಭಾವ: ಉದ್ಯೋಗ ವಿಲೋಪನೆ | ದಂಡ: ರೂ. 5,000/- | ವಾಹನದ ಸಂಪೂರ್ಣ ದುರಸ್ಥಿ ವೆಚ್ಚವನ್ನು ಪಾವತಿಸಿ', CURRENT_DATE, true, 3, 'Termination | Fine : Rs. 5,000/- | Pay Full Vehicle Repair Cost')
ON CONFLICT (id) DO UPDATE SET 
  content = EXCLUDED.content,
  impact = EXCLUDED.impact;

-- ────────────────────────────────────────────────────────────
-- 6. SCHEMA RELOAD (Mandatory per migration policy)
-- ────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
