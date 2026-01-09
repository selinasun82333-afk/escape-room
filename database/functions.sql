-- ============================================
-- RPC FUNCTIONS
-- Escape Room Platform
-- ============================================

-- ============================================
-- TEAM MANAGEMENT
-- ============================================

-- Create a new team and become captain
CREATE OR REPLACE FUNCTION create_team(
  p_event_id UUID,
  p_team_name TEXT
)
RETURNS JSON AS $$
DECLARE
  v_team teams%ROWTYPE;
  v_profile_id UUID;
  v_event events%ROWTYPE;
BEGIN
  -- Get caller's profile
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  -- Check event exists and is published
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  IF v_event.status != 'published' THEN
    RAISE EXCEPTION 'Event is not accepting new teams';
  END IF;
  
  -- Check user isn't already in a team for this event
  IF EXISTS (
    SELECT 1 FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    WHERE t.event_id = p_event_id AND tm.profile_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'Already in a team for this event';
  END IF;
  
  -- Create team
  INSERT INTO teams (event_id, name)
  VALUES (p_event_id, p_team_name)
  RETURNING * INTO v_team;
  
  -- Add creator as captain
  INSERT INTO team_members (team_id, profile_id, is_captain)
  VALUES (v_team.id, v_profile_id, true);
  
  -- Initialize progress for all stages (locked)
  INSERT INTO team_progress (team_id, stage_id, status)
  SELECT v_team.id, s.id, 
    CASE WHEN s.order_index = 1 THEN 'unlocked'::stage_status ELSE 'locked'::stage_status END
  FROM stages s
  WHERE s.event_id = p_event_id;
  
  -- Record analytics
  INSERT INTO analytics_events (event_id, team_id, profile_id, event_type, payload)
  VALUES (p_event_id, v_team.id, v_profile_id, 'team_created', 
          jsonb_build_object('team_name', p_team_name));
  
  RETURN json_build_object(
    'team_id', v_team.id,
    'join_code', v_team.join_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Join an existing team with join code
CREATE OR REPLACE FUNCTION join_team(
  p_join_code TEXT
)
RETURNS JSON AS $$
DECLARE
  v_team teams%ROWTYPE;
  v_profile_id UUID;
  v_event events%ROWTYPE;
  v_member_count INTEGER;
BEGIN
  -- Get caller's profile
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  -- Find team by join code
  SELECT * INTO v_team FROM teams WHERE join_code = UPPER(p_join_code);
  IF v_team IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;
  
  -- Check event status
  SELECT * INTO v_event FROM events WHERE id = v_team.event_id;
  IF v_event.status NOT IN ('published', 'active') THEN
    RAISE EXCEPTION 'Event is not accepting new players';
  END IF;
  IF v_event.status = 'active' AND NOT v_event.allow_late_join THEN
    RAISE EXCEPTION 'Event has started, late joining not allowed';
  END IF;
  
  -- Check team size limit
  SELECT COUNT(*) INTO v_member_count FROM team_members WHERE team_id = v_team.id;
  IF v_member_count >= v_event.max_team_size THEN
    RAISE EXCEPTION 'Team is full';
  END IF;
  
  -- Check user isn't already in a team for this event
  IF EXISTS (
    SELECT 1 FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    WHERE t.event_id = v_team.event_id AND tm.profile_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'Already in a team for this event';
  END IF;
  
  -- Add to team
  INSERT INTO team_members (team_id, profile_id, is_captain)
  VALUES (v_team.id, v_profile_id, false);
  
  -- Record analytics
  INSERT INTO analytics_events (event_id, team_id, profile_id, event_type, payload)
  VALUES (v_team.event_id, v_team.id, v_profile_id, 'player_joined', '{}');
  
  RETURN json_build_object(
    'team_id', v_team.id,
    'team_name', v_team.name,
    'event_id', v_team.event_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STAGE PROGRESSION
-- ============================================

-- Validate entry code (QR scan) and unlock stage
CREATE OR REPLACE FUNCTION validate_entry_code(
  p_team_id UUID,
  p_entry_code TEXT
)
RETURNS JSON AS $$
DECLARE
  v_stage stages%ROWTYPE;
  v_progress team_progress%ROWTYPE;
  v_event events%ROWTYPE;
BEGIN
  -- Verify user is team member
  IF NOT is_team_member(p_team_id) THEN
    RAISE EXCEPTION 'Not a member of this team';
  END IF;
  
  -- Find stage by entry code
  SELECT s.* INTO v_stage 
  FROM stages s
  JOIN teams t ON s.event_id = t.event_id
  WHERE s.entry_code = UPPER(p_entry_code) AND t.id = p_team_id;
  
  IF v_stage IS NULL THEN
    RAISE EXCEPTION 'Invalid entry code';
  END IF;
  
  -- Check event is active
  SELECT * INTO v_event FROM events WHERE id = v_stage.event_id;
  IF v_event.status != 'active' THEN
    RAISE EXCEPTION 'Event is not active';
  END IF;
  
  -- Get current progress
  SELECT * INTO v_progress 
  FROM team_progress 
  WHERE team_id = p_team_id AND stage_id = v_stage.id;
  
  -- Check if stage is accessible (unlocked or later)
  IF v_progress.status = 'locked' THEN
    -- Check if previous stage is completed
    IF v_stage.order_index > 1 THEN
      IF NOT EXISTS (
        SELECT 1 FROM team_progress tp
        JOIN stages s ON tp.stage_id = s.id
        WHERE tp.team_id = p_team_id 
          AND s.event_id = v_stage.event_id 
          AND s.order_index = v_stage.order_index - 1
          AND tp.status = 'completed'
      ) THEN
        RAISE EXCEPTION 'Previous stage not completed';
      END IF;
    END IF;
    
    -- Unlock this stage
    UPDATE team_progress
    SET status = 'unlocked', unlocked_at = NOW()
    WHERE team_id = p_team_id AND stage_id = v_stage.id;
  END IF;
  
  -- Record analytics
  INSERT INTO analytics_events (event_id, team_id, stage_id, event_type, payload)
  VALUES (v_stage.event_id, p_team_id, v_stage.id, 'qr_scanned', 
          jsonb_build_object('entry_code', p_entry_code));
  
  RETURN json_build_object(
    'stage_id', v_stage.id,
    'stage_title', v_stage.title,
    'stage_order', v_stage.order_index,
    'status', COALESCE(
      (SELECT status FROM team_progress WHERE team_id = p_team_id AND stage_id = v_stage.id),
      'unlocked'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit an answer for a stage
CREATE OR REPLACE FUNCTION submit_answer(
  p_team_id UUID,
  p_stage_id UUID,
  p_answer TEXT
)
RETURNS JSON AS $$
DECLARE
  v_stage stages%ROWTYPE;
  v_progress team_progress%ROWTYPE;
  v_event events%ROWTYPE;
  v_is_correct BOOLEAN;
  v_points INTEGER;
  v_next_stage stages%ROWTYPE;
BEGIN
  -- Verify user is team member
  IF NOT is_team_member(p_team_id) THEN
    RAISE EXCEPTION 'Not a member of this team';
  END IF;
  
  -- Get stage
  SELECT * INTO v_stage FROM stages WHERE id = p_stage_id;
  IF v_stage IS NULL THEN
    RAISE EXCEPTION 'Stage not found';
  END IF;
  
  -- Check event is active
  SELECT * INTO v_event FROM events WHERE id = v_stage.event_id;
  IF v_event.status != 'active' THEN
    RAISE EXCEPTION 'Event is not active';
  END IF;
  
  -- Check timer hasn't expired
  IF get_remaining_time(v_event.id) <= 0 THEN
    RAISE EXCEPTION 'Time has expired';
  END IF;
  
  -- Get progress
  SELECT * INTO v_progress 
  FROM team_progress 
  WHERE team_id = p_team_id AND stage_id = p_stage_id;
  
  IF v_progress.status NOT IN ('unlocked', 'in_progress') THEN
    RAISE EXCEPTION 'Stage is not accessible';
  END IF;
  
  -- Start progress if first attempt
  IF v_progress.status = 'unlocked' THEN
    UPDATE team_progress
    SET status = 'in_progress', started_at = NOW()
    WHERE team_id = p_team_id AND stage_id = p_stage_id;
  END IF;
  
  -- Check answer
  IF v_stage.case_sensitive THEN
    v_is_correct := (p_answer = v_stage.correct_answer);
  ELSE
    v_is_correct := (LOWER(TRIM(p_answer)) = LOWER(TRIM(v_stage.correct_answer)));
  END IF;
  
  -- Update progress
  IF v_is_correct THEN
    -- Calculate points (base - penalties + time bonus)
    v_points := v_stage.max_points - v_progress.time_penalty_seconds;
    IF v_event.time_bonus_enabled THEN
      -- Bonus for quick completion (up to 50% extra)
      v_points := v_points + (v_stage.max_points * 0.5 * 
        (get_remaining_time(v_event.id)::DECIMAL / v_event.timer_duration_seconds))::INTEGER;
    END IF;
    v_points := GREATEST(v_points, 0);
    
    UPDATE team_progress
    SET 
      status = 'completed',
      completed_at = NOW(),
      attempts = attempts + 1,
      last_submitted_answer = p_answer,
      points_earned = v_points
    WHERE team_id = p_team_id AND stage_id = p_stage_id;
    
    -- Unlock next stage
    SELECT * INTO v_next_stage 
    FROM stages 
    WHERE event_id = v_stage.event_id AND order_index = v_stage.order_index + 1;
    
    IF v_next_stage IS NOT NULL THEN
      UPDATE team_progress
      SET status = 'unlocked', unlocked_at = NOW()
      WHERE team_id = p_team_id AND stage_id = v_next_stage.id;
    END IF;
    
    -- Refresh leaderboard
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard;
    
  ELSE
    -- Wrong answer
    UPDATE team_progress
    SET 
      attempts = attempts + 1,
      last_submitted_answer = p_answer
    WHERE team_id = p_team_id AND stage_id = p_stage_id;
    
    -- Record analytics
    INSERT INTO analytics_events (event_id, team_id, stage_id, event_type, payload)
    VALUES (v_stage.event_id, p_team_id, p_stage_id, 'wrong_answer', 
            jsonb_build_object('answer', p_answer));
  END IF;
  
  RETURN json_build_object(
    'correct', v_is_correct,
    'attempts', (SELECT attempts FROM team_progress WHERE team_id = p_team_id AND stage_id = p_stage_id),
    'points_earned', CASE WHEN v_is_correct THEN v_points ELSE 0 END,
    'next_stage_id', v_next_stage.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HINT SYSTEM
-- ============================================

-- Reveal next hint for a stage
CREATE OR REPLACE FUNCTION reveal_hint(
  p_team_id UUID,
  p_stage_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_event events%ROWTYPE;
  v_stage stages%ROWTYPE;
  v_progress team_progress%ROWTYPE;
  v_hint hints%ROWTYPE;
  v_used_hints INTEGER;
  v_profile_id UUID;
BEGIN
  -- Get caller's profile
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
  
  -- Verify user is team member
  IF NOT is_team_member(p_team_id) THEN
    RAISE EXCEPTION 'Not a member of this team';
  END IF;
  
  -- Get stage and event
  SELECT * INTO v_stage FROM stages WHERE id = p_stage_id;
  SELECT * INTO v_event FROM events WHERE id = v_stage.event_id;
  
  IF v_event.status != 'active' THEN
    RAISE EXCEPTION 'Event is not active';
  END IF;
  
  -- Count team's total used hints
  SELECT COUNT(*) INTO v_used_hints
  FROM hint_usage hu
  JOIN hints h ON hu.hint_id = h.id
  JOIN stages s ON h.stage_id = s.id
  WHERE hu.team_id = p_team_id AND s.event_id = v_event.id;
  
  IF v_used_hints >= v_event.max_hints_per_team THEN
    RAISE EXCEPTION 'Hint limit reached';
  END IF;
  
  -- Get next unrevealed hint for this stage
  SELECT h.* INTO v_hint
  FROM hints h
  WHERE h.stage_id = p_stage_id
    AND NOT EXISTS (
      SELECT 1 FROM hint_usage hu WHERE hu.hint_id = h.id AND hu.team_id = p_team_id
    )
  ORDER BY h.order_index
  LIMIT 1;
  
  IF v_hint IS NULL THEN
    RAISE EXCEPTION 'No more hints available for this stage';
  END IF;
  
  -- Record hint usage
  INSERT INTO hint_usage (team_id, hint_id, revealed_by)
  VALUES (p_team_id, v_hint.id, v_profile_id);
  
  -- Apply time penalty
  UPDATE team_progress
  SET time_penalty_seconds = time_penalty_seconds + v_hint.penalty_seconds
  WHERE team_id = p_team_id AND stage_id = p_stage_id;
  
  -- Record analytics
  INSERT INTO analytics_events (event_id, team_id, stage_id, profile_id, event_type, payload)
  VALUES (v_event.id, p_team_id, p_stage_id, v_profile_id, 'hint_revealed', 
          jsonb_build_object('hint_order', v_hint.order_index, 'penalty_seconds', v_hint.penalty_seconds));
  
  RETURN json_build_object(
    'hint_id', v_hint.id,
    'hint_content', v_hint.content,
    'hint_order', v_hint.order_index,
    'penalty_seconds', v_hint.penalty_seconds,
    'total_hints_used', v_used_hints + 1,
    'hints_remaining', v_event.max_hints_per_team - v_used_hints - 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TIMER CONTROL (Admin Only)
-- ============================================

-- Start the event timer
CREATE OR REPLACE FUNCTION start_timer(
  p_event_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_event events%ROWTYPE;
BEGIN
  -- Check admin
  IF NOT is_event_admin(p_event_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF v_event.status != 'published' THEN
    RAISE EXCEPTION 'Event must be published to start';
  END IF;
  
  UPDATE events
  SET 
    status = 'active',
    timer_started_at = NOW(),
    timer_paused_at = NULL
  WHERE id = p_event_id;
  
  -- Record analytics
  INSERT INTO analytics_events (event_id, event_type, payload)
  VALUES (p_event_id, 'timer_started', '{}');
  
  RETURN json_build_object(
    'status', 'active',
    'started_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pause the event timer
CREATE OR REPLACE FUNCTION pause_timer(
  p_event_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_event events%ROWTYPE;
BEGIN
  -- Check admin
  IF NOT is_event_admin(p_event_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF v_event.status != 'active' OR v_event.timer_paused_at IS NOT NULL THEN
    RAISE EXCEPTION 'Timer is not running';
  END IF;
  
  UPDATE events
  SET timer_paused_at = NOW()
  WHERE id = p_event_id;
  
  -- Record analytics
  INSERT INTO analytics_events (event_id, event_type, payload)
  VALUES (p_event_id, 'timer_paused', 
          jsonb_build_object('remaining_seconds', get_remaining_time(p_event_id)));
  
  RETURN json_build_object(
    'paused', true,
    'remaining_seconds', get_remaining_time(p_event_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resume the event timer
CREATE OR REPLACE FUNCTION resume_timer(
  p_event_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_event events%ROWTYPE;
  v_pause_duration INTEGER;
BEGIN
  -- Check admin
  IF NOT is_event_admin(p_event_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF v_event.timer_paused_at IS NULL THEN
    RAISE EXCEPTION 'Timer is not paused';
  END IF;
  
  -- Calculate pause duration
  v_pause_duration := EXTRACT(EPOCH FROM (NOW() - v_event.timer_paused_at))::INTEGER;
  
  UPDATE events
  SET 
    timer_paused_at = NULL,
    timer_paused_duration_seconds = timer_paused_duration_seconds + v_pause_duration
  WHERE id = p_event_id;
  
  -- Record analytics
  INSERT INTO analytics_events (event_id, event_type, payload)
  VALUES (p_event_id, 'timer_resumed', 
          jsonb_build_object('pause_duration_seconds', v_pause_duration));
  
  RETURN json_build_object(
    'resumed', true,
    'remaining_seconds', get_remaining_time(p_event_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End the event
CREATE OR REPLACE FUNCTION end_event(
  p_event_id UUID
)
RETURNS JSON AS $$
BEGIN
  -- Check admin
  IF NOT is_event_admin(p_event_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  UPDATE events
  SET status = 'completed'
  WHERE id = p_event_id AND status = 'active';
  
  -- Final leaderboard refresh
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard;
  
  -- Record analytics
  INSERT INTO analytics_events (event_id, event_type, payload)
  VALUES (p_event_id, 'event_ended', '{}');
  
  RETURN json_build_object('status', 'completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- LEADERBOARD & ANALYTICS
-- ============================================

-- Get event leaderboard
CREATE OR REPLACE FUNCTION get_leaderboard(
  p_event_id UUID
)
RETURNS TABLE (
  rank BIGINT,
  team_id UUID,
  team_name TEXT,
  team_color TEXT,
  total_points INTEGER,
  stages_completed BIGINT,
  total_time_penalty INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (
      ORDER BY l.total_points DESC, l.stages_completed DESC, l.last_completion_at ASC
    ) AS rank,
    l.team_id,
    l.team_name,
    l.team_color,
    l.total_points::INTEGER,
    l.stages_completed,
    l.total_time_penalty::INTEGER
  FROM leaderboard l
  WHERE l.event_id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get stage analytics for admin
CREATE OR REPLACE FUNCTION get_stage_analytics(
  p_event_id UUID
)
RETURNS TABLE (
  stage_id UUID,
  title TEXT,
  order_index INTEGER,
  teams_attempted BIGINT,
  teams_completed BIGINT,
  completion_rate DECIMAL,
  avg_completion_seconds DECIMAL,
  avg_attempts DECIMAL,
  hint_usage_rate DECIMAL
) AS $$
BEGIN
  -- Check admin
  IF NOT is_event_admin(p_event_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  RETURN QUERY
  SELECT 
    sa.stage_id,
    sa.title,
    sa.order_index,
    sa.teams_attempted,
    sa.teams_completed,
    CASE WHEN sa.teams_attempted > 0 
      THEN (sa.teams_completed::DECIMAL / sa.teams_attempted * 100)
      ELSE 0 
    END AS completion_rate,
    COALESCE(sa.avg_completion_seconds, 0) AS avg_completion_seconds,
    COALESCE(sa.avg_attempts, 0) AS avg_attempts,
    CASE WHEN sa.teams_attempted > 0 
      THEN (sa.teams_used_hints::DECIMAL / sa.teams_attempted * 100)
      ELSE 0 
    END AS hint_usage_rate
  FROM stage_analytics sa
  WHERE sa.event_id = p_event_id
  ORDER BY sa.order_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

