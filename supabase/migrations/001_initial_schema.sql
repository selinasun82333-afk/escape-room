-- ============================================================================
-- ESCAPE ROOM PLATFORM - DATABASE SCHEMA
-- ============================================================================
-- Supabase PostgreSQL Schema with RLS
-- Version: 1.0.0
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CUSTOM TYPES (with IF NOT EXISTS pattern)
-- ============================================================================

-- Event lifecycle states
DO $$ BEGIN
  CREATE TYPE event_status AS ENUM (
    'draft',      -- Event being configured
    'scheduled',  -- Ready to start, teams can join
    'active',     -- Timer running, game in progress
    'paused',     -- Timer paused by admin
    'completed',  -- Event finished
    'archived'    -- Moved to cold storage
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Team progress states per stage
DO $$ BEGIN
  CREATE TYPE stage_status AS ENUM (
    'locked',     -- Not yet accessible
    'active',     -- Currently working on
    'completed',  -- Successfully finished
    'skipped'     -- Skipped by admin override
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User roles
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'admin',      -- Full platform access
    'organizer',  -- Can create/manage own events
    'player'      -- Team member
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Analytics event types
DO $$ BEGIN
  CREATE TYPE analytics_event_type AS ENUM (
    'event_created',
    'event_started',
    'event_paused',
    'event_resumed',
    'event_ended',
    'team_created',
    'team_joined',
    'member_joined',
    'stage_unlocked',
    'stage_started',
    'stage_completed',
    'code_attempt_success',
    'code_attempt_failed',
    'hint_requested',
    'hint_revealed',
    'qr_scanned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROFILES (extends Supabase auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role user_role NOT NULL DEFAULT 'player',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- ----------------------------------------------------------------------------
-- EVENTS (top-level game sessions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE, -- URL-friendly identifier
  
  -- Ownership
  created_by UUID NOT NULL REFERENCES profiles(id),
  organization_name TEXT, -- For corporate events
  
  -- Configuration
  duration_seconds INTEGER NOT NULL DEFAULT 3600, -- Default 1 hour
  max_teams INTEGER, -- NULL = unlimited
  max_team_size INTEGER DEFAULT 6,
  hints_per_team INTEGER NOT NULL DEFAULT 3,
  allow_late_join BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Lifecycle
  status event_status NOT NULL DEFAULT 'draft',
  scheduled_start TIMESTAMPTZ,
  
  -- Timer state (server-authoritative)
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  accumulated_pause_seconds INTEGER NOT NULL DEFAULT 0,
  ended_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_scheduled ON events(scheduled_start) WHERE status = 'scheduled';

-- ----------------------------------------------------------------------------
-- STAGES (puzzles within an event)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Ordering
  order_index INTEGER NOT NULL,
  
  -- Content
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT, -- Detailed puzzle instructions
  
  -- Unlock mechanism
  unlock_code TEXT NOT NULL, -- Code to complete this stage
  unlock_code_hint TEXT, -- Optional hint about code format
  qr_code_data TEXT, -- If using QR codes
  
  -- Timing
  estimated_minutes INTEGER, -- For analytics comparison
  time_limit_seconds INTEGER, -- Optional per-stage time limit
  
  -- Points/scoring
  base_points INTEGER NOT NULL DEFAULT 100,
  time_bonus_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(event_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_stages_event ON stages(event_id);
CREATE INDEX IF NOT EXISTS idx_stages_order ON stages(event_id, order_index);

-- ----------------------------------------------------------------------------
-- HINTS (per stage)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  
  -- Ordering (hints revealed in sequence)
  order_index INTEGER NOT NULL,
  
  -- Content
  title TEXT, -- Optional label like "Hint 1"
  content TEXT NOT NULL,
  
  -- Cost (can vary per hint)
  point_penalty INTEGER NOT NULL DEFAULT 10,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(stage_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_hints_stage ON hints(stage_id);

-- ----------------------------------------------------------------------------
-- TEAMS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Identity
  name TEXT NOT NULL,
  join_code TEXT NOT NULL, -- Code to join this team
  color TEXT, -- Team color for UI
  
  -- Hint budget (copied from event, can be adjusted)
  hints_remaining INTEGER NOT NULL,
  
  -- Scoring
  total_points INTEGER NOT NULL DEFAULT 0,
  current_stage_index INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ, -- When team actually started playing
  finished_at TIMESTAMPTZ, -- When team completed all stages
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  disqualified BOOLEAN NOT NULL DEFAULT FALSE,
  disqualification_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(event_id, name),
  UNIQUE(event_id, join_code)
);

CREATE INDEX IF NOT EXISTS idx_teams_event ON teams(event_id);
CREATE INDEX IF NOT EXISTS idx_teams_join_code ON teams(join_code);
CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(event_id, is_active) WHERE is_active = TRUE;

-- ----------------------------------------------------------------------------
-- TEAM MEMBERS (session-based, no auth required)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  
  -- Session-based identity (stored in localStorage)
  session_token UUID NOT NULL DEFAULT uuid_generate_v4(),
  
  -- Player info
  display_name TEXT NOT NULL,
  
  -- Role within team
  is_captain BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Session tracking
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  
  UNIQUE(session_token)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_session ON team_members(session_token);
CREATE INDEX IF NOT EXISTS idx_team_members_online ON team_members(team_id, is_online) WHERE is_online = TRUE;

-- ----------------------------------------------------------------------------
-- TEAM PROGRESS (per stage)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  
  -- Status
  status stage_status NOT NULL DEFAULT 'locked',
  
  -- Timing
  unlocked_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Attempts
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  
  -- Scoring
  points_earned INTEGER NOT NULL DEFAULT 0,
  time_bonus INTEGER NOT NULL DEFAULT 0,
  hint_penalties INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(team_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_team_progress_team ON team_progress(team_id);
CREATE INDEX IF NOT EXISTS idx_team_progress_stage ON team_progress(stage_id);
CREATE INDEX IF NOT EXISTS idx_team_progress_status ON team_progress(team_id, status);

-- ----------------------------------------------------------------------------
-- HINT USAGE (tracking which hints were used)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hint_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hint_id UUID NOT NULL REFERENCES hints(id) ON DELETE CASCADE,
  
  -- Who requested it (session token reference)
  requested_by_session UUID,
  
  -- Timing context
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_in_stage_seconds INTEGER, -- How long team was stuck before using hint
  
  UNIQUE(team_id, hint_id)
);

CREATE INDEX IF NOT EXISTS idx_hint_usage_team ON hint_usage(team_id);
CREATE INDEX IF NOT EXISTS idx_hint_usage_hint ON hint_usage(hint_id);

-- ----------------------------------------------------------------------------
-- CODE ATTEMPTS (for analytics and rate limiting)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS code_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  
  -- Attempt details
  submitted_code TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  
  -- Who submitted (session token reference)
  submitted_by_session UUID,
  
  -- Context
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_in_stage_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_code_attempts_team ON code_attempts(team_id);
CREATE INDEX IF NOT EXISTS idx_code_attempts_stage ON code_attempts(stage_id);
CREATE INDEX IF NOT EXISTS idx_code_attempts_time ON code_attempts(attempted_at);

-- ----------------------------------------------------------------------------
-- ANALYTICS EVENTS (granular tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Context
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES stages(id) ON DELETE SET NULL,
  
  -- Session reference (for player actions)
  session_token UUID,
  
  -- Event details
  event_type analytics_event_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  
  -- Timestamp
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Client info
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_id ON analytics_events(event_id);
CREATE INDEX IF NOT EXISTS idx_analytics_team_id ON analytics_events(team_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_time ON analytics_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_composite ON analytics_events(event_id, event_type, occurred_at);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TEAM HINTS VIEW (shows content only if hint has been used)
-- ----------------------------------------------------------------------------
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
WHERE tp.status IN ('active', 'completed');  -- Only show hints for unlocked stages

-- ----------------------------------------------------------------------------
-- LEADERBOARD VIEW
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS v_leaderboard;
CREATE VIEW v_leaderboard AS
SELECT 
  t.id AS team_id,
  t.event_id,
  t.name AS team_name,
  t.color AS team_color,
  t.total_points,
  t.current_stage_index,
  t.finished_at,
  t.started_at,
  -- Calculate completion time
  CASE 
    WHEN t.finished_at IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (t.finished_at - t.started_at))::INTEGER
    ELSE NULL
  END AS completion_seconds,
  -- Count completed stages
  (
    SELECT COUNT(*) 
    FROM team_progress tp 
    WHERE tp.team_id = t.id AND tp.status = 'completed'
  ) AS stages_completed,
  -- Count total stages
  (
    SELECT COUNT(*) 
    FROM stages s 
    WHERE s.event_id = t.event_id
  ) AS total_stages,
  -- Rank within event
  RANK() OVER (
    PARTITION BY t.event_id 
    ORDER BY 
      t.total_points DESC,
      t.finished_at ASC NULLS LAST,
      t.current_stage_index DESC
  ) AS rank
FROM teams t
WHERE t.is_active = TRUE AND t.disqualified = FALSE;

-- ----------------------------------------------------------------------------
-- EVENT STATISTICS VIEW
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS v_event_stats;
CREATE VIEW v_event_stats AS
SELECT 
  e.id AS event_id,
  e.name AS event_name,
  e.status,
  e.duration_seconds,
  e.started_at,
  e.ended_at,
  -- Team counts
  COUNT(DISTINCT t.id) AS total_teams,
  COUNT(DISTINCT t.id) FILTER (WHERE t.finished_at IS NOT NULL) AS finished_teams,
  COUNT(DISTINCT t.id) FILTER (WHERE t.is_active = TRUE) AS active_teams,
  -- Member counts
  COUNT(DISTINCT tm.id) AS total_members,
  COUNT(DISTINCT tm.id) FILTER (WHERE tm.is_online = TRUE) AS online_members,
  -- Stage progress
  (
    SELECT COUNT(*) FROM stages s WHERE s.event_id = e.id
  ) AS total_stages,
  -- Hint usage
  (
    SELECT COUNT(*) FROM hint_usage hu
    JOIN teams t2 ON hu.team_id = t2.id
    WHERE t2.event_id = e.id
  ) AS total_hints_used,
  -- Average completion
  (
    SELECT AVG(EXTRACT(EPOCH FROM (t3.finished_at - t3.started_at)))
    FROM teams t3
    WHERE t3.event_id = e.id AND t3.finished_at IS NOT NULL
  )::INTEGER AS avg_completion_seconds
FROM events e
LEFT JOIN teams t ON t.event_id = e.id
LEFT JOIN team_members tm ON tm.team_id = t.id
GROUP BY e.id, e.name, e.status, e.duration_seconds, e.started_at, e.ended_at;

-- ----------------------------------------------------------------------------
-- STAGE ANALYTICS VIEW
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS v_stage_analytics;
CREATE VIEW v_stage_analytics AS
SELECT 
  s.id AS stage_id,
  s.event_id,
  s.name AS stage_name,
  s.order_index,
  s.estimated_minutes,
  -- Completion stats
  COUNT(tp.id) FILTER (WHERE tp.status = 'completed') AS completions,
  COUNT(tp.id) FILTER (WHERE tp.status = 'active') AS currently_active,
  -- Timing
  AVG(
    EXTRACT(EPOCH FROM (tp.completed_at - tp.started_at))
  ) FILTER (WHERE tp.status = 'completed')::INTEGER AS avg_completion_seconds,
  MIN(
    EXTRACT(EPOCH FROM (tp.completed_at - tp.started_at))
  ) FILTER (WHERE tp.status = 'completed')::INTEGER AS fastest_completion_seconds,
  MAX(
    EXTRACT(EPOCH FROM (tp.completed_at - tp.started_at))
  ) FILTER (WHERE tp.status = 'completed')::INTEGER AS slowest_completion_seconds,
  -- Attempts
  AVG(tp.attempt_count) FILTER (WHERE tp.status = 'completed')::NUMERIC(10,2) AS avg_attempts,
  -- Hints
  (
    SELECT COUNT(*) FROM hint_usage hu
    JOIN hints h ON hu.hint_id = h.id
    WHERE h.stage_id = s.id
  ) AS total_hints_used,
  -- Hint breakdown
  (
    SELECT COUNT(DISTINCT hu.team_id) FROM hint_usage hu
    JOIN hints h ON hu.hint_id = h.id
    WHERE h.stage_id = s.id
  ) AS teams_using_hints
FROM stages s
LEFT JOIN team_progress tp ON tp.stage_id = s.id
GROUP BY s.id, s.event_id, s.name, s.order_index, s.estimated_minutes;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Calculate remaining event time
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_remaining_time(p_event_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_event events%ROWTYPE;
  v_elapsed INTEGER;
  v_remaining INTEGER;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF v_event.started_at IS NULL THEN
    RETURN v_event.duration_seconds;
  END IF;
  
  IF v_event.status = 'paused' THEN
    v_elapsed := EXTRACT(EPOCH FROM (v_event.paused_at - v_event.started_at))::INTEGER;
  ELSIF v_event.status = 'completed' THEN
    RETURN 0;
  ELSE
    v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_event.started_at))::INTEGER;
  END IF;
  
  v_elapsed := v_elapsed - v_event.accumulated_pause_seconds;
  v_remaining := v_event.duration_seconds - v_elapsed;
  
  RETURN GREATEST(0, v_remaining);
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Update team total points
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_team_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE teams
  SET 
    total_points = (
      SELECT COALESCE(SUM(points_earned + time_bonus - hint_penalties), 0)
      FROM team_progress
      WHERE team_id = NEW.team_id
    ),
    current_stage_index = (
      SELECT COALESCE(MAX(s.order_index), 0)
      FROM team_progress tp
      JOIN stages s ON tp.stage_id = s.id
      WHERE tp.team_id = NEW.team_id AND tp.status = 'completed'
    ),
    updated_at = NOW()
  WHERE id = NEW.team_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_team_points ON team_progress;
CREATE TRIGGER trg_update_team_points
AFTER INSERT OR UPDATE ON team_progress
FOR EACH ROW EXECUTE FUNCTION update_team_points();

-- ----------------------------------------------------------------------------
-- Update hints remaining when hint is used
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_hints_remaining()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE teams
  SET 
    hints_remaining = hints_remaining - 1,
    updated_at = NOW()
  WHERE id = NEW.team_id AND hints_remaining > 0;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_hints_remaining ON hint_usage;
CREATE TRIGGER trg_update_hints_remaining
AFTER INSERT ON hint_usage
FOR EACH ROW EXECUTE FUNCTION update_hints_remaining();

-- ----------------------------------------------------------------------------
-- Auto-update timestamps
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_stages_updated_at ON stages;
CREATE TRIGGER trg_stages_updated_at
BEFORE UPDATE ON stages
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;
CREATE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON teams
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_team_progress_updated_at ON team_progress;
CREATE TRIGGER trg_team_progress_updated_at
BEFORE UPDATE ON team_progress
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- Initialize team progress when event starts
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION initialize_team_progress(p_team_id UUID)
RETURNS VOID AS $$
DECLARE
  v_event_id UUID;
  v_first_stage_id UUID;
BEGIN
  -- Get event ID
  SELECT event_id INTO v_event_id FROM teams WHERE id = p_team_id;
  
  -- Get first stage
  SELECT id INTO v_first_stage_id 
  FROM stages 
  WHERE event_id = v_event_id 
  ORDER BY order_index 
  LIMIT 1;
  
  -- Create progress records for all stages
  INSERT INTO team_progress (team_id, stage_id, status, unlocked_at, started_at)
  SELECT 
    p_team_id,
    s.id,
    CASE WHEN s.order_index = 0 THEN 'active'::stage_status ELSE 'locked'::stage_status END,
    CASE WHEN s.order_index = 0 THEN NOW() ELSE NULL END,
    CASE WHEN s.order_index = 0 THEN NOW() ELSE NULL END
  FROM stages s
  WHERE s.event_id = v_event_id
  ON CONFLICT (team_id, stage_id) DO NOTHING;
  
  -- Update team started_at
  UPDATE teams 
  SET started_at = NOW(), updated_at = NOW()
  WHERE id = p_team_id AND started_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Check if user is admin
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Check if user is event organizer
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_event_organizer(p_user_id UUID, p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM events 
    WHERE id = p_event_id AND created_by = p_user_id
  ) OR is_admin(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Validate session token and get team member
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_member_by_session(p_session_token UUID)
RETURNS TABLE(member_id UUID, team_id UUID, display_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT tm.id, tm.team_id, tm.display_name
  FROM team_members tm
  WHERE tm.session_token = p_session_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Get team ID from session token
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Validate session belongs to team
-- ----------------------------------------------------------------------------
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
-- SEED DATA HELPER (for development)
-- ============================================================================

-- Function to generate a random join code
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Validate team join code (returns team_id if valid)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Get hints for a team (with conditional content)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Get specific hint content (only if used)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Check if team can use a hint (budget + not already used + stage active)
-- ----------------------------------------------------------------------------
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

