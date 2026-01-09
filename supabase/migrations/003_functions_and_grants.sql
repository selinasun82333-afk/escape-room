-- ============================================================================
-- FUNCTIONS AND GRANTS
-- ============================================================================
-- Run this AFTER 001_initial_schema.sql and BEFORE or INSTEAD OF the grants
-- in 002_rls_policies.sql
-- ============================================================================

-- ============================================================================
-- 1. VALIDATE TEAM JOIN CODE (was missing!)
-- ============================================================================
-- Secure function to validate team join code (prevents enumeration)
CREATE OR REPLACE FUNCTION validate_team_join_code(
  p_event_id UUID,
  p_join_code TEXT
)
RETURNS UUID AS $$
DECLARE
  v_team_id UUID;
BEGIN
  SELECT id INTO v_team_id
  FROM teams
  WHERE event_id = p_event_id
  AND UPPER(join_code) = UPPER(p_join_code)
  AND is_active = TRUE;
  
  RETURN v_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. GET TEAM BY SESSION
-- ============================================================================
CREATE OR REPLACE FUNCTION get_team_by_session(p_session_token UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT tm.team_id
    FROM team_members tm
    WHERE tm.session_token = p_session_token
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. VALIDATE SESSION FOR TEAM
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_session_for_team(p_session_token UUID, p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members 
    WHERE session_token = p_session_token AND team_id = p_team_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. GET TEAM HINTS (with conditional content)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_team_hints(
  p_team_id UUID,
  p_stage_id UUID DEFAULT NULL
)
RETURNS TABLE (
  hint_id UUID,
  stage_id UUID,
  order_index INTEGER,
  title TEXT,
  point_penalty INTEGER,
  content TEXT,  -- NULL if not used
  is_used BOOLEAN,
  used_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id AS hint_id,
    h.stage_id,
    h.order_index,
    h.title,
    h.point_penalty,
    -- Only return content if hint has been used
    CASE 
      WHEN hu.id IS NOT NULL THEN h.content
      ELSE NULL
    END AS content,
    (hu.id IS NOT NULL) AS is_used,
    hu.used_at
  FROM hints h
  JOIN stages s ON s.id = h.stage_id
  JOIN teams t ON t.event_id = s.event_id AND t.id = p_team_id
  JOIN team_progress tp ON tp.team_id = t.id AND tp.stage_id = s.id
  LEFT JOIN hint_usage hu ON hu.hint_id = h.id AND hu.team_id = p_team_id
  WHERE tp.status IN ('active', 'completed')
    AND (p_stage_id IS NULL OR h.stage_id = p_stage_id)
  ORDER BY h.stage_id, h.order_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. GET HINT CONTENT (only if used)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_hint_content(
  p_team_id UUID,
  p_hint_id UUID
)
RETURNS TABLE (
  hint_id UUID,
  title TEXT,
  content TEXT,
  point_penalty INTEGER,
  is_used BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id AS hint_id,
    h.title,
    -- Only return content if hint has been used by this team
    CASE 
      WHEN hu.id IS NOT NULL THEN h.content
      ELSE NULL
    END AS content,
    h.point_penalty,
    (hu.id IS NOT NULL) AS is_used
  FROM hints h
  LEFT JOIN hint_usage hu ON hu.hint_id = h.id AND hu.team_id = p_team_id
  WHERE h.id = p_hint_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. CAN USE HINT (validation check)
-- ============================================================================
CREATE OR REPLACE FUNCTION can_use_hint(
  p_team_id UUID,
  p_hint_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_hints_remaining INTEGER;
  v_already_used BOOLEAN;
  v_stage_active BOOLEAN;
BEGIN
  -- Check hints remaining
  SELECT hints_remaining INTO v_hints_remaining
  FROM teams WHERE id = p_team_id;
  
  IF v_hints_remaining IS NULL OR v_hints_remaining <= 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Check if already used
  SELECT EXISTS(
    SELECT 1 FROM hint_usage
    WHERE team_id = p_team_id AND hint_id = p_hint_id
  ) INTO v_already_used;
  
  IF v_already_used THEN
    RETURN FALSE;
  END IF;
  
  -- Check if stage is active for this team
  SELECT EXISTS(
    SELECT 1 FROM team_progress tp
    JOIN hints h ON h.stage_id = tp.stage_id
    WHERE tp.team_id = p_team_id
    AND h.id = p_hint_id
    AND tp.status = 'active'
  ) INTO v_stage_active;
  
  RETURN v_stage_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. V_TEAM_HINTS VIEW (recreate to ensure it exists)
-- ============================================================================
DROP VIEW IF EXISTS v_team_hints;

CREATE VIEW v_team_hints AS
SELECT 
  h.id AS hint_id,
  h.stage_id,
  h.order_index,
  h.title,
  h.point_penalty,
  h.created_at,
  t.id AS team_id,
  t.event_id,
  tp.status AS stage_status,
  -- Only show content if hint has been used by this team
  CASE 
    WHEN hu.id IS NOT NULL THEN h.content
    ELSE NULL
  END AS content,
  -- Indicate if hint has been used
  (hu.id IS NOT NULL) AS is_used,
  hu.used_at,
  hu.time_in_stage_seconds AS used_after_seconds
FROM hints h
JOIN stages s ON s.id = h.stage_id
JOIN teams t ON t.event_id = s.event_id
JOIN team_progress tp ON tp.team_id = t.id AND tp.stage_id = s.id
LEFT JOIN hint_usage hu ON hu.hint_id = h.id AND hu.team_id = t.id
WHERE tp.status IN ('active', 'completed');

-- ============================================================================
-- GRANTS TO ANON ROLE
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Tables
GRANT SELECT ON events TO anon;
GRANT SELECT ON stages TO anon;
GRANT SELECT ON teams TO anon;
GRANT SELECT ON team_members TO anon;
GRANT SELECT ON team_progress TO anon;
GRANT SELECT ON hint_usage TO anon;
-- NO direct SELECT on hints for anon! Use v_team_hints or get_team_hints()

-- Views
GRANT SELECT ON v_leaderboard TO anon;
GRANT SELECT ON v_event_stats TO anon;
GRANT SELECT ON v_stage_analytics TO anon;
GRANT SELECT ON v_team_hints TO anon;

-- Functions
GRANT EXECUTE ON FUNCTION validate_team_join_code(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION calculate_remaining_time(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_team_by_session(UUID) TO anon;
GRANT EXECUTE ON FUNCTION validate_session_for_team(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_team_hints(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_hint_content(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION can_use_hint(UUID, UUID) TO anon;

-- Also grant to authenticated role
GRANT EXECUTE ON FUNCTION validate_team_join_code(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_remaining_time(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_by_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_session_for_team(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_hints(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hint_content(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_use_hint(UUID, UUID) TO authenticated;

