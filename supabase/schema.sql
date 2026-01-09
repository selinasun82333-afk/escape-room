-- ========================================
-- 방탈출 힌트 시스템 - Simplified Schema
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- EVENTS (게임 세션)
-- ========================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT '방탈출 게임',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'running', 'paused', 'finished')),
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  paused_duration INTEGER NOT NULL DEFAULT 0,
  hints_per_team INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- TEAMS (팀)
-- ========================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  join_code TEXT NOT NULL,
  hints_remaining INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, join_code)
);

-- ========================================
-- STAGES (스테이지/웹툰)
-- ========================================
CREATE TABLE IF NOT EXISTS stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entry_code TEXT NOT NULL,
  webtoon_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, entry_code)
);

-- ========================================
-- PUZZLES (퍼즐)
-- ========================================
CREATE TABLE IF NOT EXISTS puzzles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hint_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, hint_code)
);

-- ========================================
-- PUZZLE_HINTS (퍼즐 힌트)
-- ========================================
CREATE TABLE IF NOT EXISTS puzzle_hints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  puzzle_id UUID NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  content TEXT NOT NULL,
  coin_cost INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(puzzle_id, level)
);

-- ========================================
-- TEAM_STAGE_VIEWS (팀 스테이지 조회 기록)
-- ========================================
CREATE TABLE IF NOT EXISTS team_stage_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, stage_id)
);

-- ========================================
-- TEAM_HINT_USAGE (팀 힌트 사용 기록)
-- ========================================
CREATE TABLE IF NOT EXISTS team_hint_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  puzzle_hint_id UUID NOT NULL REFERENCES puzzle_hints(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, puzzle_hint_id)
);

-- ========================================
-- INDEXES
-- ========================================
CREATE INDEX IF NOT EXISTS idx_teams_event_id ON teams(event_id);
CREATE INDEX IF NOT EXISTS idx_teams_join_code ON teams(join_code);
CREATE INDEX IF NOT EXISTS idx_stages_event_id ON stages(event_id);
CREATE INDEX IF NOT EXISTS idx_stages_entry_code ON stages(entry_code);
CREATE INDEX IF NOT EXISTS idx_puzzles_event_id ON puzzles(event_id);
CREATE INDEX IF NOT EXISTS idx_puzzles_hint_code ON puzzles(hint_code);
CREATE INDEX IF NOT EXISTS idx_puzzle_hints_puzzle_id ON puzzle_hints(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_team_stage_views_team_id ON team_stage_views(team_id);
CREATE INDEX IF NOT EXISTS idx_team_hint_usage_team_id ON team_hint_usage(team_id);

-- ========================================
-- ENABLE REALTIME
-- ========================================
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE team_stage_views;
ALTER PUBLICATION supabase_realtime ADD TABLE team_hint_usage;

-- ========================================
-- RLS POLICIES (simple - allow all for anon)
-- ========================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_hints ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_stage_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_hint_usage ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (simplify for demo)
CREATE POLICY "Allow all on events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on teams" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on stages" ON stages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on puzzles" ON puzzles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on puzzle_hints" ON puzzle_hints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on team_stage_views" ON team_stage_views FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on team_hint_usage" ON team_hint_usage FOR ALL USING (true) WITH CHECK (true);

