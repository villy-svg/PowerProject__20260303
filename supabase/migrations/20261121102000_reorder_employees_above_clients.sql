-- =============================================================================
-- Migration: Reorder EMPLOYEES vertical above CLIENTS vertical
-- =============================================================================
-- Moves EMPLOYEES to display position 2 (directly beneath CHARGING_HUBS)
-- and CLIENTS to display position 3 so main sidebar navigation matches
-- active vertical priority and MobileBottomNav ordering.
-- =============================================================================

UPDATE public.verticals
SET "order" = CASE id
  WHEN 'EMPLOYEES' THEN 2
  WHEN 'CLIENTS'   THEN 3
END
WHERE id IN ('EMPLOYEES', 'CLIENTS');

NOTIFY pgrst, 'reload schema';
