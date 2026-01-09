-- ============================================================================
-- ESCAPE ROOM PLATFORM - COMPLETE DATABASE SETUP
-- ============================================================================
-- Run this single file to set up the entire database
-- Includes: Tables, Views, Functions, RLS Policies, Grants
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM (
    'draft', 'scheduled', 'active', 'paused', 'completed', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE stage_status AS ENUM (
    'locked', 'active', 'completed', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'admin', 'organizer', 'player'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE analytics_event_type AS ENUM (
    'event_created', 'event_started', 'event_paused', 'event_resumed',
    'event_ended', 'team_created', 'team_joined', 'member_joined',
    'stage_unlocked', 'stage_started', 'stage_completed',
    'code_attempt_success', 'code_attempt_failed',
    'hint_requested', 'hint_revealed', 'qr_scanned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role user_role NOT NULL DEFAULT 'player',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  organization_name TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 3600,
  max_teams INTEGER,
  max_team_size INTEGER DEFAULT 6,
  hints_per_team INTEGER NOT NULL DEFAULT 3,
  allow_late_join BOOLEAN NOT NULL DEFAULT FALSE,
  status event_status NOT NULL DEFAULT 'draft',
  scheduled_start TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  accumulated_pause_seconds INTEGER NOT NULL DEFAULT 0,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  unlock_code TEXT NOT NULL,
  unlock_code_hint TEXT,
  qr_code_data TEXT,
  estimated_minutes INTEGER,
  time_limit_seconds INTEGER,
  base_points INTEGER NOT NULL DEFAULT 100,
  time_bonus_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, order_index)
);

CREATE TABLE IF NOT EXISTS hints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  point_penalty INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stage_id, order_index)
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  join_code TEXT NOT NULL,
  color TEXT,
  hints_remaining INTEGER NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  current_stage_index INTEGER NOT NULL DEFAULT 0,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  disqualified BOOLEAN NOT NULL DEFAULT FALSE,
  disqualification_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, name),
  UNIQUE(event_id, join_code)
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  session_token UUID NOT NULL DEFAULT uuid_generate_v4(),
  display_name TEXT NOT NULL,
  is_captain BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(session_token)
);

CREATE TABLE IF NOT EXISTS team_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  status stage_status NOT NULL DEFAULT 'locked',
  unlocked_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  points_earned INTEGER NOT NULL DEFAULT 0,
  time_bonus INTEGER NOT NULL DEFAULT 0,
  hint_penalties INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, stage_id)
);

CREATE TABLE IF NOT EXISTS hint_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hint_id UUID NOT NULL REFERENCES hints(id) ON DELETE CASCADE,
  requested_by_session UUID,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_in_stage_seconds INTEGER,
  UNIQUE(team_id, hint_id)
);

CREATE TABLE IF NOT EXISTS code_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  submitted_code TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  submitted_by_session UUID,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_in_stage_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES stages(id) ON DELETE SET NULL,
  session_token UUID,
  event_type analytics_event_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_stages_event ON stages(event_id);
CREATE INDEX IF NOT EXISTS idx_stages_order ON stages(event_id, order_index);
CREATE INDEX IF NOT EXISTS idx_hints_stage ON hints(stage_id);
CREATE INDEX IF NOT EXISTS idx_teams_event ON teams(event_id);
CREATE INDEX IF NOT EXISTS idx_teams_join_code ON teams(join_code);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_session ON team_members(session_token);
CREATE INDEX IF NOT EXISTS idx_team_progress_team ON team_progress(team_id);
CREATE INDEX IF NOT EXISTS idx_team_progress_stage ON team_progress(stage_id);
CREATE INDEX IF NOT EXISTS idx_hint_usage_team ON hint_usage(team_id);
CREATE INDEX IF NOT EXISTS idx_hint_usage_hint ON hint_usage(hint_id);
CREATE INDEX IF NOT EXISTS idx_code_attempts_team ON code_attempts(team_id);
CREATE INDEX IF NOT EXISTS idx_code_attempts_stage ON code_attempts(stage_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_id ON analytics_events(event_id);
CREATE INDEX IF NOT EXISTS idx_analytics_team_id ON analytics_events(team_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);

-- ============================================================================
-- FUNCTIONS (must be created BEFORE RLS policies that reference them)
-- ============================================================================

-- 1. is_admin
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. is_event_organizer
CREATE OR REPLACE FUNCTION is_event_organizer(p_user_id UUID, p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM events 
    WHERE id = p_event_id AND created_by = p_user_id
  ) OR is_admin(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. validate_team_join_code
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

-- 4. get_team_by_session
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

-- 5. validate_session_for_team
CREATE OR REPLACE FUNCTION validate_session_for_team(p_session_token UUID, p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members 
    WHERE session_token = p_session_token AND team_id = p_team_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. get_team_hints
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
  content TEXT,
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
    CASE WHEN hu.id IS NOT NULL THEN h.content ELSE NULL END AS content,
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

-- 7. get_hint_content
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
    CASE WHEN hu.id IS NOT NULL THEN h.content ELSE NULL END AS content,
    h.point_penalty,
    (hu.id IS NOT NULL) AS is_used
  FROM hints h
  LEFT JOIN hint_usage hu ON hu.hint_id = h.id AND hu.team_id = p_team_id
  WHERE h.id = p_hint_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. can_use_hint
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
  SELECT hints_remaining INTO v_hints_remaining FROM teams WHERE id = p_team_id;
  IF v_hints_remaining IS NULL OR v_hints_remaining <= 0 THEN RETURN FALSE; END IF;
  
  SELECT EXISTS(SELECT 1 FROM hint_usage WHERE team_id = p_team_id AND hint_id = p_hint_id) INTO v_already_used;
  IF v_already_used THEN RETURN FALSE; END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM team_progress tp
    JOIN hints h ON h.stage_id = tp.stage_id
    WHERE tp.team_id = p_team_id AND h.id = p_hint_id AND tp.status = 'active'
  ) INTO v_stage_active;
  
  RETURN v_stage_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. calculate_remaining_time
CREATE OR REPLACE FUNCTION calculate_remaining_time(p_event_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_event events%ROWTYPE;
  v_elapsed INTEGER;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF v_event.started_at IS NULL THEN RETURN v_event.duration_seconds; END IF;
  IF v_event.status = 'completed' THEN RETURN 0; END IF;
  
  IF v_event.status = 'paused' THEN
    v_elapsed := EXTRACT(EPOCH FROM (v_event.paused_at - v_event.started_at))::INTEGER;
  ELSE
    v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_event.started_at))::INTEGER;
  END IF;
  
  v_elapsed := v_elapsed - v_event.accumulated_pause_seconds;
  RETURN GREATEST(0, v_event.duration_seconds - v_elapsed);
END;
$$ LANGUAGE plpgsql;

-- 10. generate_join_code
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
END;
$$ LANGUAGE plpgsql;

-- 11. initialize_team_progress
CREATE OR REPLACE FUNCTION initialize_team_progress(p_team_id UUID)
RETURNS VOID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT event_id INTO v_event_id FROM teams WHERE id = p_team_id;
  
  INSERT INTO team_progress (team_id, stage_id, status, unlocked_at, started_at)
  SELECT 
    p_team_id, s.id,
    CASE WHEN s.order_index = 0 THEN 'active'::stage_status ELSE 'locked'::stage_status END,
    CASE WHEN s.order_index = 0 THEN NOW() ELSE NULL END,
    CASE WHEN s.order_index = 0 THEN NOW() ELSE NULL END
  FROM stages s WHERE s.event_id = v_event_id
  ON CONFLICT (team_id, stage_id) DO NOTHING;
  
  UPDATE teams SET started_at = NOW(), updated_at = NOW()
  WHERE id = p_team_id AND started_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_team_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE teams SET 
    total_points = (SELECT COALESCE(SUM(points_earned + time_bonus - hint_penalties), 0) FROM team_progress WHERE team_id = NEW.team_id),
    current_stage_index = (SELECT COALESCE(MAX(s.order_index), 0) FROM team_progress tp JOIN stages s ON tp.stage_id = s.id WHERE tp.team_id = NEW.team_id AND tp.status = 'completed'),
    updated_at = NOW()
  WHERE id = NEW.team_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_hints_remaining()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE teams SET hints_remaining = hints_remaining - 1, updated_at = NOW()
  WHERE id = NEW.team_id AND hints_remaining > 0;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_update_team_points ON team_progress;
CREATE TRIGGER trg_update_team_points AFTER INSERT OR UPDATE ON team_progress
FOR EACH ROW EXECUTE FUNCTION update_team_points();

DROP TRIGGER IF EXISTS trg_update_hints_remaining ON hint_usage;
CREATE TRIGGER trg_update_hints_remaining AFTER INSERT ON hint_usage
FOR EACH ROW EXECUTE FUNCTION update_hints_remaining();

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_stages_updated_at ON stages;
CREATE TRIGGER trg_stages_updated_at BEFORE UPDATE ON stages
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON teams
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_team_progress_updated_at ON team_progress;
CREATE TRIGGER trg_team_progress_updated_at BEFORE UPDATE ON team_progress
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- VIEWS
-- ============================================================================

DROP VIEW IF EXISTS v_team_hints;
CREATE VIEW v_team_hints AS
SELECT 
  h.id AS hint_id, h.stage_id, h.order_index, h.title, h.point_penalty, h.created_at,
  t.id AS team_id, t.event_id, tp.status AS stage_status,
  CASE WHEN hu.id IS NOT NULL THEN h.content ELSE NULL END AS content,
  (hu.id IS NOT NULL) AS is_used, hu.used_at, hu.time_in_stage_seconds AS used_after_seconds
FROM hints h
JOIN stages s ON s.id = h.stage_id
JOIN teams t ON t.event_id = s.event_id
JOIN team_progress tp ON tp.team_id = t.id AND tp.stage_id = s.id
LEFT JOIN hint_usage hu ON hu.hint_id = h.id AND hu.team_id = t.id
WHERE tp.status IN ('active', 'completed');

DROP VIEW IF EXISTS v_leaderboard;
CREATE VIEW v_leaderboard AS
SELECT 
  t.id AS team_id, t.event_id, t.name AS team_name, t.color AS team_color,
  t.total_points, t.current_stage_index, t.finished_at, t.started_at,
  CASE WHEN t.finished_at IS NOT NULL THEN EXTRACT(EPOCH FROM (t.finished_at - t.started_at))::INTEGER ELSE NULL END AS completion_seconds,
  (SELECT COUNT(*) FROM team_progress tp WHERE tp.team_id = t.id AND tp.status = 'completed') AS stages_completed,
  (SELECT COUNT(*) FROM stages s WHERE s.event_id = t.event_id) AS total_stages,
  RANK() OVER (PARTITION BY t.event_id ORDER BY t.total_points DESC, t.finished_at ASC NULLS LAST, t.current_stage_index DESC) AS rank
FROM teams t WHERE t.is_active = TRUE AND t.disqualified = FALSE;

DROP VIEW IF EXISTS v_event_stats;
CREATE VIEW v_event_stats AS
SELECT 
  e.id AS event_id, e.name AS event_name, e.status, e.duration_seconds, e.started_at, e.ended_at,
  COUNT(DISTINCT t.id) AS total_teams,
  COUNT(DISTINCT t.id) FILTER (WHERE t.finished_at IS NOT NULL) AS finished_teams,
  COUNT(DISTINCT t.id) FILTER (WHERE t.is_active = TRUE) AS active_teams,
  COUNT(DISTINCT tm.id) AS total_members,
  COUNT(DISTINCT tm.id) FILTER (WHERE tm.is_online = TRUE) AS online_members,
  (SELECT COUNT(*) FROM stages s WHERE s.event_id = e.id) AS total_stages,
  (SELECT COUNT(*) FROM hint_usage hu JOIN teams t2 ON hu.team_id = t2.id WHERE t2.event_id = e.id) AS total_hints_used,
  (SELECT AVG(EXTRACT(EPOCH FROM (t3.finished_at - t3.started_at))) FROM teams t3 WHERE t3.event_id = e.id AND t3.finished_at IS NOT NULL)::INTEGER AS avg_completion_seconds
FROM events e
LEFT JOIN teams t ON t.event_id = e.id
LEFT JOIN team_members tm ON tm.team_id = t.id
GROUP BY e.id, e.name, e.status, e.duration_seconds, e.started_at, e.ended_at;

DROP VIEW IF EXISTS v_stage_analytics;
CREATE VIEW v_stage_analytics AS
SELECT 
  s.id AS stage_id, s.event_id, s.name AS stage_name, s.order_index, s.estimated_minutes,
  COUNT(tp.id) FILTER (WHERE tp.status = 'completed') AS completions,
  COUNT(tp.id) FILTER (WHERE tp.status = 'active') AS currently_active,
  AVG(EXTRACT(EPOCH FROM (tp.completed_at - tp.started_at))) FILTER (WHERE tp.status = 'completed')::INTEGER AS avg_completion_seconds,
  MIN(EXTRACT(EPOCH FROM (tp.completed_at - tp.started_at))) FILTER (WHERE tp.status = 'completed')::INTEGER AS fastest_completion_seconds,
  MAX(EXTRACT(EPOCH FROM (tp.completed_at - tp.started_at))) FILTER (WHERE tp.status = 'completed')::INTEGER AS slowest_completion_seconds,
  AVG(tp.attempt_count) FILTER (WHERE tp.status = 'completed')::NUMERIC(10,2) AS avg_attempts,
  (SELECT COUNT(*) FROM hint_usage hu JOIN hints h ON hu.hint_id = h.id WHERE h.stage_id = s.id) AS total_hints_used,
  (SELECT COUNT(DISTINCT hu.team_id) FROM hint_usage hu JOIN hints h ON hu.hint_id = h.id WHERE h.stage_id = s.id) AS teams_using_hints
FROM stages s LEFT JOIN team_progress tp ON tp.stage_id = s.id
GROUP BY s.id, s.event_id, s.name, s.order_index, s.estimated_minutes;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hints ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE hint_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- EVENTS
DROP POLICY IF EXISTS "Anyone can view active events" ON events;
CREATE POLICY "Anyone can view active events" ON events FOR SELECT
USING (status IN ('scheduled', 'active', 'paused', 'completed'));

DROP POLICY IF EXISTS "Admins can view all events" ON events;
CREATE POLICY "Admins can view all events" ON events FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Organizers can view own events" ON events;
CREATE POLICY "Organizers can view own events" ON events FOR SELECT USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Admins and organizers can create events" ON events;
CREATE POLICY "Admins and organizers can create events" ON events FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer')));

DROP POLICY IF EXISTS "Event owners can update events" ON events;
CREATE POLICY "Event owners can update events" ON events FOR UPDATE USING (is_event_organizer(auth.uid(), id));

DROP POLICY IF EXISTS "Admins can delete events" ON events;
CREATE POLICY "Admins can delete events" ON events FOR DELETE USING (is_admin(auth.uid()));

-- STAGES
DROP POLICY IF EXISTS "Anyone can view stages of active events" ON stages;
CREATE POLICY "Anyone can view stages of active events" ON stages FOR SELECT
USING (EXISTS (SELECT 1 FROM events e WHERE e.id = stages.event_id AND e.status IN ('scheduled', 'active', 'paused', 'completed')));

DROP POLICY IF EXISTS "Event organizers can create stages" ON stages;
CREATE POLICY "Event organizers can create stages" ON stages FOR INSERT WITH CHECK (is_event_organizer(auth.uid(), event_id));

DROP POLICY IF EXISTS "Event organizers can update stages" ON stages;
CREATE POLICY "Event organizers can update stages" ON stages FOR UPDATE USING (is_event_organizer(auth.uid(), event_id));

DROP POLICY IF EXISTS "Event organizers can delete stages" ON stages;
CREATE POLICY "Event organizers can delete stages" ON stages FOR DELETE USING (is_event_organizer(auth.uid(), event_id));

-- HINTS (content protected - use v_team_hints or get_team_hints())
DROP POLICY IF EXISTS "Only organizers can view hints directly" ON hints;
CREATE POLICY "Only organizers can view hints directly" ON hints FOR SELECT
USING (EXISTS (SELECT 1 FROM stages s WHERE s.id = hints.stage_id AND is_event_organizer(auth.uid(), s.event_id)));

DROP POLICY IF EXISTS "Event organizers can create hints" ON hints;
CREATE POLICY "Event organizers can create hints" ON hints FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM stages s WHERE s.id = hints.stage_id AND is_event_organizer(auth.uid(), s.event_id)));

DROP POLICY IF EXISTS "Event organizers can update hints" ON hints;
CREATE POLICY "Event organizers can update hints" ON hints FOR UPDATE
USING (EXISTS (SELECT 1 FROM stages s WHERE s.id = hints.stage_id AND is_event_organizer(auth.uid(), s.event_id)));

DROP POLICY IF EXISTS "Event organizers can delete hints" ON hints;
CREATE POLICY "Event organizers can delete hints" ON hints FOR DELETE
USING (EXISTS (SELECT 1 FROM stages s WHERE s.id = hints.stage_id AND is_event_organizer(auth.uid(), s.event_id)));

-- TEAMS
DROP POLICY IF EXISTS "Anyone can view teams in active events" ON teams;
CREATE POLICY "Anyone can view teams in active events" ON teams FOR SELECT
USING (EXISTS (SELECT 1 FROM events e WHERE e.id = teams.event_id AND e.status IN ('scheduled', 'active', 'paused', 'completed')));

DROP POLICY IF EXISTS "Event organizers can create teams" ON teams;
CREATE POLICY "Event organizers can create teams" ON teams FOR INSERT WITH CHECK (is_event_organizer(auth.uid(), event_id));

DROP POLICY IF EXISTS "Event organizers can update teams" ON teams;
CREATE POLICY "Event organizers can update teams" ON teams FOR UPDATE USING (is_event_organizer(auth.uid(), event_id));

DROP POLICY IF EXISTS "Event organizers can delete teams" ON teams;
CREATE POLICY "Event organizers can delete teams" ON teams FOR DELETE USING (is_event_organizer(auth.uid(), event_id));

-- TEAM_MEMBERS
DROP POLICY IF EXISTS "Anyone can view team members" ON team_members;
CREATE POLICY "Anyone can view team members" ON team_members FOR SELECT
USING (EXISTS (SELECT 1 FROM teams t JOIN events e ON e.id = t.event_id WHERE t.id = team_members.team_id AND e.status IN ('scheduled', 'active', 'paused', 'completed')));

DROP POLICY IF EXISTS "Service role can insert members" ON team_members;
CREATE POLICY "Service role can insert members" ON team_members FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role can update members" ON team_members;
CREATE POLICY "Service role can update members" ON team_members FOR UPDATE USING (TRUE);

DROP POLICY IF EXISTS "Event organizers can delete members" ON team_members;
CREATE POLICY "Event organizers can delete members" ON team_members FOR DELETE
USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND is_event_organizer(auth.uid(), t.event_id)));

-- TEAM_PROGRESS
DROP POLICY IF EXISTS "Anyone can view team progress" ON team_progress;
CREATE POLICY "Anyone can view team progress" ON team_progress FOR SELECT
USING (EXISTS (SELECT 1 FROM teams t JOIN events e ON e.id = t.event_id WHERE t.id = team_progress.team_id AND e.status IN ('active', 'paused', 'completed')));

DROP POLICY IF EXISTS "Service role manages progress" ON team_progress;
CREATE POLICY "Service role manages progress" ON team_progress FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role updates progress" ON team_progress;
CREATE POLICY "Service role updates progress" ON team_progress FOR UPDATE USING (TRUE);

-- HINT_USAGE
DROP POLICY IF EXISTS "Anyone can view hint usage" ON hint_usage;
CREATE POLICY "Anyone can view hint usage" ON hint_usage FOR SELECT
USING (EXISTS (SELECT 1 FROM teams t JOIN events e ON e.id = t.event_id WHERE t.id = hint_usage.team_id AND e.status IN ('active', 'paused', 'completed')));

DROP POLICY IF EXISTS "Service role inserts hint usage" ON hint_usage;
CREATE POLICY "Service role inserts hint usage" ON hint_usage FOR INSERT WITH CHECK (TRUE);

-- CODE_ATTEMPTS
DROP POLICY IF EXISTS "Event organizers can view code attempts" ON code_attempts;
CREATE POLICY "Event organizers can view code attempts" ON code_attempts FOR SELECT
USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = code_attempts.team_id AND is_event_organizer(auth.uid(), t.event_id)));

DROP POLICY IF EXISTS "Service role inserts code attempts" ON code_attempts;
CREATE POLICY "Service role inserts code attempts" ON code_attempts FOR INSERT WITH CHECK (TRUE);

-- ANALYTICS_EVENTS
DROP POLICY IF EXISTS "Organizers can view event analytics" ON analytics_events;
CREATE POLICY "Organizers can view event analytics" ON analytics_events FOR SELECT
USING (is_admin(auth.uid()) OR (event_id IS NOT NULL AND is_event_organizer(auth.uid(), event_id)));

DROP POLICY IF EXISTS "Anyone can log analytics" ON analytics_events;
CREATE POLICY "Anyone can log analytics" ON analytics_events FOR INSERT WITH CHECK (TRUE);

-- ============================================================================
-- REALTIME
-- ============================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE teams;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE team_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE team_progress;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE hint_usage;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Tables for anon
GRANT SELECT ON events TO anon;
GRANT SELECT ON stages TO anon;
GRANT SELECT ON teams TO anon;
GRANT SELECT ON team_members TO anon;
GRANT SELECT ON team_progress TO anon;
GRANT SELECT ON hint_usage TO anon;

-- Views for anon
GRANT SELECT ON v_leaderboard TO anon;
GRANT SELECT ON v_event_stats TO anon;
GRANT SELECT ON v_stage_analytics TO anon;
GRANT SELECT ON v_team_hints TO anon;

-- Functions for anon
GRANT EXECUTE ON FUNCTION validate_team_join_code(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION calculate_remaining_time(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_team_by_session(UUID) TO anon;
GRANT EXECUTE ON FUNCTION validate_session_for_team(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_team_hints(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_hint_content(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION can_use_hint(UUID, UUID) TO anon;

-- Functions for authenticated
GRANT EXECUTE ON FUNCTION validate_team_join_code(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_remaining_time(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_by_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_session_for_team(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_hints(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hint_content(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_use_hint(UUID, UUID) TO authenticated;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

