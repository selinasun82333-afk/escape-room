-- ============================================
-- ESCAPE ROOM PLATFORM - DATABASE SCHEMA
-- Optimized for Supabase (PostgreSQL 15+)
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE event_status AS ENUM (
  'draft',
  'published',
  'active',
  'completed',
  'archived'
);

CREATE TYPE user_role AS ENUM (
  'admin',
  'player',
  'spectator'
);

CREATE TYPE stage_status AS ENUM (
  'locked',
  'unlocked',
  'in_progress',
  'completed',
  'skipped'
);

-- ============================================
-- PROFILES
-- Extends Supabase auth.users
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'player',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookup by auth user
CREATE INDEX idx_profiles_user_id ON profiles(user_id);

-- ============================================
-- EVENTS
-- Main escape room event container
-- ============================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  
  -- Event metadata
  title TEXT NOT NULL,
  description TEXT,
  status event_status NOT NULL DEFAULT 'draft',
  
  -- Timer configuration
  timer_duration_seconds INTEGER NOT NULL DEFAULT 3600, -- 1 hour default
  timer_started_at TIMESTAMPTZ,
  timer_paused_at TIMESTAMPTZ,
  timer_paused_duration_seconds INTEGER NOT NULL DEFAULT 0, -- Accumulated pause time
  
  -- Game configuration
  max_hints_per_team INTEGER NOT NULL DEFAULT 5,
  max_team_size INTEGER NOT NULL DEFAULT 6,
  allow_late_join BOOLEAN NOT NULL DEFAULT false,
  
  -- Scoring
  base_points_per_stage INTEGER NOT NULL DEFAULT 100,
  time_bonus_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  scheduled_start_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_events_admin_id ON events(admin_id);
CREATE INDEX idx_events_status ON events(status);

-- ============================================
-- STAGES
-- Individual puzzles/challenges within an event
-- ============================================

CREATE TABLE stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Stage metadata
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL, -- 1-based ordering
  
  -- Entry system (QR/code)
  entry_code TEXT NOT NULL, -- 6-char alphanumeric
  
  -- Puzzle configuration
  puzzle_type TEXT NOT NULL DEFAULT 'text', -- text, multiple_choice, numeric, etc.
  puzzle_data JSONB NOT NULL DEFAULT '{}', -- Flexible puzzle content
  correct_answer TEXT NOT NULL, -- Hashed or plaintext depending on type
  case_sensitive BOOLEAN NOT NULL DEFAULT false,
  
  -- Scoring
  max_points INTEGER NOT NULL DEFAULT 100,
  time_limit_seconds INTEGER, -- Optional per-stage time limit
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(event_id, order_index),
  UNIQUE(event_id, entry_code)
);

-- Indexes
CREATE INDEX idx_stages_event_id ON stages(event_id);
CREATE INDEX idx_stages_entry_code ON stages(entry_code);

-- ============================================
-- HINTS
-- Progressive hints for each stage
-- ============================================

CREATE TABLE hints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  
  -- Hint content
  order_index INTEGER NOT NULL, -- 1 = vague, higher = more specific
  content TEXT NOT NULL,
  
  -- Penalty for using hint
  penalty_seconds INTEGER NOT NULL DEFAULT 0,
  penalty_points INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(stage_id, order_index)
);

-- Index
CREATE INDEX idx_hints_stage_id ON hints(stage_id);

-- ============================================
-- TEAMS
-- Groups of players within an event
-- ============================================

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Team info
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE, -- 8-char code for players to join
  color TEXT DEFAULT '#6366f1', -- Team color for UI
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(event_id, name)
);

-- Indexes
CREATE INDEX idx_teams_event_id ON teams(event_id);
CREATE INDEX idx_teams_join_code ON teams(join_code);

-- ============================================
-- TEAM MEMBERS
-- Junction table: profiles <-> teams
-- ============================================

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Member info
  is_captain BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(team_id, profile_id)
);

-- Indexes
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_profile_id ON team_members(profile_id);

-- ============================================
-- TEAM PROGRESS
-- Tracks each team's progress per stage
-- ============================================

CREATE TABLE team_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  
  -- Progress state
  status stage_status NOT NULL DEFAULT 'locked',
  
  -- Timing
  unlocked_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,  -- First interaction
  completed_at TIMESTAMPTZ,
  
  -- Submission tracking
  attempts INTEGER NOT NULL DEFAULT 0,
  last_submitted_answer TEXT,
  
  -- Scoring
  points_earned INTEGER NOT NULL DEFAULT 0,
  time_penalty_seconds INTEGER NOT NULL DEFAULT 0, -- From hints
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(team_id, stage_id)
);

-- Indexes
CREATE INDEX idx_team_progress_team_id ON team_progress(team_id);
CREATE INDEX idx_team_progress_stage_id ON team_progress(stage_id);
CREATE INDEX idx_team_progress_status ON team_progress(status);

-- ============================================
-- HINT USAGE
-- Tracks which hints each team has revealed
-- ============================================

CREATE TABLE hint_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hint_id UUID NOT NULL REFERENCES hints(id) ON DELETE CASCADE,
  
  -- Usage info
  revealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revealed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Constraints
  UNIQUE(team_id, hint_id)
);

-- Indexes
CREATE INDEX idx_hint_usage_team_id ON hint_usage(team_id);
CREATE INDEX idx_hint_usage_hint_id ON hint_usage(hint_id);

-- ============================================
-- ANALYTICS EVENTS
-- Raw event stream for analytics
-- ============================================

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Context
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES stages(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Event data
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  
  -- Timestamp (use for time-series queries)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX idx_analytics_event_id ON analytics_events(event_id);
CREATE INDEX idx_analytics_team_id ON analytics_events(team_id);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);

-- Composite index for common queries
CREATE INDEX idx_analytics_event_stage ON analytics_events(event_id, stage_id);

-- ============================================
-- VIEWS
-- ============================================

-- Leaderboard view (materialized for performance)
CREATE MATERIALIZED VIEW leaderboard AS
SELECT 
  t.id AS team_id,
  t.event_id,
  t.name AS team_name,
  t.color AS team_color,
  COALESCE(SUM(tp.points_earned), 0) AS total_points,
  COUNT(CASE WHEN tp.status = 'completed' THEN 1 END) AS stages_completed,
  MAX(tp.completed_at) AS last_completion_at,
  COALESCE(SUM(tp.time_penalty_seconds), 0) AS total_time_penalty
FROM teams t
LEFT JOIN team_progress tp ON t.id = tp.team_id
GROUP BY t.id, t.event_id, t.name, t.color;

-- Index on leaderboard
CREATE INDEX idx_leaderboard_event_id ON leaderboard(event_id);
CREATE INDEX idx_leaderboard_total_points ON leaderboard(total_points DESC);

-- Stage difficulty view
CREATE VIEW stage_analytics AS
SELECT 
  s.id AS stage_id,
  s.event_id,
  s.title,
  s.order_index,
  COUNT(DISTINCT tp.team_id) AS teams_attempted,
  COUNT(DISTINCT CASE WHEN tp.status = 'completed' THEN tp.team_id END) AS teams_completed,
  AVG(CASE WHEN tp.status = 'completed' 
      THEN EXTRACT(EPOCH FROM (tp.completed_at - tp.started_at)) 
      END) AS avg_completion_seconds,
  AVG(tp.attempts) AS avg_attempts,
  COUNT(DISTINCT hu.team_id) AS teams_used_hints
FROM stages s
LEFT JOIN team_progress tp ON s.id = tp.stage_id
LEFT JOIN hints h ON s.id = h.stage_id
LEFT JOIN hint_usage hu ON h.id = hu.hint_id
GROUP BY s.id, s.event_id, s.title, s.order_index;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Generate random alphanumeric code
CREATE OR REPLACE FUNCTION generate_code(length INTEGER DEFAULT 6)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excluded confusing chars (0,O,1,I)
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Calculate remaining time for an event
CREATE OR REPLACE FUNCTION get_remaining_time(p_event_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_event events%ROWTYPE;
  v_elapsed INTEGER;
  v_remaining INTEGER;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF v_event.timer_started_at IS NULL THEN
    RETURN v_event.timer_duration_seconds;
  END IF;
  
  IF v_event.timer_paused_at IS NOT NULL THEN
    v_elapsed := EXTRACT(EPOCH FROM (v_event.timer_paused_at - v_event.timer_started_at))::INTEGER 
                 - v_event.timer_paused_duration_seconds;
  ELSE
    v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_event.timer_started_at))::INTEGER 
                 - v_event.timer_paused_duration_seconds;
  END IF;
  
  v_remaining := v_event.timer_duration_seconds - v_elapsed;
  RETURN GREATEST(0, v_remaining);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_stages_updated_at
  BEFORE UPDATE ON stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_team_progress_updated_at
  BEFORE UPDATE ON team_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-generate join code for teams
CREATE OR REPLACE FUNCTION generate_team_join_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.join_code IS NULL OR NEW.join_code = '' THEN
    NEW.join_code := generate_code(8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_teams_join_code
  BEFORE INSERT ON teams
  FOR EACH ROW EXECUTE FUNCTION generate_team_join_code();

-- Auto-generate entry code for stages
CREATE OR REPLACE FUNCTION generate_stage_entry_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entry_code IS NULL OR NEW.entry_code = '' THEN
    NEW.entry_code := generate_code(6);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_stages_entry_code
  BEFORE INSERT ON stages
  FOR EACH ROW EXECUTE FUNCTION generate_stage_entry_code();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'player')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Record analytics on progress update
CREATE OR REPLACE FUNCTION record_progress_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Stage started
  IF OLD.status = 'unlocked' AND NEW.status = 'in_progress' THEN
    INSERT INTO analytics_events (event_id, team_id, stage_id, event_type, payload)
    SELECT t.event_id, NEW.team_id, NEW.stage_id, 'stage_started', '{}'::JSONB
    FROM teams t WHERE t.id = NEW.team_id;
  END IF;
  
  -- Stage completed
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    INSERT INTO analytics_events (event_id, team_id, stage_id, event_type, payload)
    SELECT t.event_id, NEW.team_id, NEW.stage_id, 'stage_completed', 
           jsonb_build_object(
             'duration_ms', EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000,
             'attempts', NEW.attempts,
             'points_earned', NEW.points_earned
           )
    FROM teams t WHERE t.id = NEW.team_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_team_progress_analytics
  AFTER UPDATE ON team_progress
  FOR EACH ROW EXECUTE FUNCTION record_progress_analytics();

-- Refresh leaderboard on progress update
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Note: For production, consider using pg_cron for periodic refresh instead
-- CREATE TRIGGER tr_refresh_leaderboard
--   AFTER INSERT OR UPDATE OR DELETE ON team_progress
--   FOR EACH STATEMENT EXECUTE FUNCTION refresh_leaderboard();

-- ============================================
-- ENABLE REALTIME
-- Run these after creating tables in Supabase
-- ============================================

-- ALTER PUBLICATION supabase_realtime ADD TABLE events;
-- ALTER PUBLICATION supabase_realtime ADD TABLE team_progress;
-- ALTER PUBLICATION supabase_realtime ADD TABLE hint_usage;
-- ALTER PUBLICATION supabase_realtime ADD TABLE teams;

