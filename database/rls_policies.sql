-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- Escape Room Platform
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hints ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE hint_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================

-- Get current user's profile ID
CREATE OR REPLACE FUNCTION auth.profile_id()
RETURNS UUID AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is admin of an event
CREATE OR REPLACE FUNCTION is_event_admin(p_event_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM events e
    JOIN profiles p ON e.admin_id = p.id
    WHERE e.id = p_event_id AND p.user_id = auth.uid()
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is member of a team
CREATE OR REPLACE FUNCTION is_team_member(p_team_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members tm
    JOIN profiles p ON tm.profile_id = p.id
    WHERE tm.team_id = p_team_id AND p.user_id = auth.uid()
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is member of any team in an event
CREATE OR REPLACE FUNCTION is_event_participant(p_event_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    JOIN profiles p ON tm.profile_id = p.id
    WHERE t.event_id = p_event_id AND p.user_id = auth.uid()
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Get user's team ID for an event
CREATE OR REPLACE FUNCTION get_user_team_id(p_event_id UUID)
RETURNS UUID AS $$
  SELECT t.id FROM teams t
  JOIN team_members tm ON t.id = tm.team_id
  JOIN profiles p ON tm.profile_id = p.id
  WHERE t.event_id = p_event_id AND p.user_id = auth.uid()
  LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read all profiles (for display names, etc.)
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Profiles are created by trigger, no direct insert
CREATE POLICY "profiles_insert_none"
  ON profiles FOR INSERT
  WITH CHECK (false);

-- ============================================
-- EVENTS POLICIES
-- ============================================

-- Anyone can read published/active/completed events
-- Admins can read their own draft events
CREATE POLICY "events_select"
  ON events FOR SELECT
  USING (
    status IN ('published', 'active', 'completed', 'archived')
    OR is_event_admin(id)
  );

-- Only admins (role = admin) can create events
CREATE POLICY "events_insert"
  ON events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    AND admin_id = auth.profile_id()
  );

-- Only event admin can update their events
CREATE POLICY "events_update"
  ON events FOR UPDATE
  USING (is_event_admin(id))
  WITH CHECK (is_event_admin(id));

-- Only event admin can delete (only drafts)
CREATE POLICY "events_delete"
  ON events FOR DELETE
  USING (is_event_admin(id) AND status = 'draft');

-- ============================================
-- STAGES POLICIES
-- ============================================

-- Event admins and participants can read stages
-- But only for active events or admin's own events
CREATE POLICY "stages_select"
  ON stages FOR SELECT
  USING (
    is_event_admin(event_id)
    OR (
      is_event_participant(event_id)
      AND EXISTS (
        SELECT 1 FROM events WHERE id = event_id AND status = 'active'
      )
    )
  );

-- Only event admin can manage stages
CREATE POLICY "stages_insert"
  ON stages FOR INSERT
  WITH CHECK (is_event_admin(event_id));

CREATE POLICY "stages_update"
  ON stages FOR UPDATE
  USING (is_event_admin(event_id))
  WITH CHECK (is_event_admin(event_id));

CREATE POLICY "stages_delete"
  ON stages FOR DELETE
  USING (is_event_admin(event_id));

-- ============================================
-- HINTS POLICIES
-- ============================================

-- Admins can see all hints for their events
-- Players can only see hints they've revealed
CREATE POLICY "hints_select_admin"
  ON hints FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stages s
      WHERE s.id = stage_id AND is_event_admin(s.event_id)
    )
  );

CREATE POLICY "hints_select_revealed"
  ON hints FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hint_usage hu
      WHERE hu.hint_id = id AND is_team_member(hu.team_id)
    )
  );

-- Only event admin can manage hints
CREATE POLICY "hints_insert"
  ON hints FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stages s
      WHERE s.id = stage_id AND is_event_admin(s.event_id)
    )
  );

CREATE POLICY "hints_update"
  ON hints FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM stages s
      WHERE s.id = stage_id AND is_event_admin(s.event_id)
    )
  );

CREATE POLICY "hints_delete"
  ON hints FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM stages s
      WHERE s.id = stage_id AND is_event_admin(s.event_id)
    )
  );

-- ============================================
-- TEAMS POLICIES
-- ============================================

-- Event admins and team members can read team info
-- Public can read team names for published events (leaderboard)
CREATE POLICY "teams_select"
  ON teams FOR SELECT
  USING (
    is_event_admin(event_id)
    OR is_team_member(id)
    OR EXISTS (
      SELECT 1 FROM events 
      WHERE id = event_id AND status IN ('published', 'active', 'completed')
    )
  );

-- Anyone can create a team for a published event
CREATE POLICY "teams_insert"
  ON teams FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events 
      WHERE id = event_id AND status = 'published'
    )
  );

-- Event admin or team captain can update team
CREATE POLICY "teams_update"
  ON teams FOR UPDATE
  USING (
    is_event_admin(event_id)
    OR EXISTS (
      SELECT 1 FROM team_members tm
      JOIN profiles p ON tm.profile_id = p.id
      WHERE tm.team_id = id AND tm.is_captain AND p.user_id = auth.uid()
    )
  );

-- Only event admin can delete teams
CREATE POLICY "teams_delete"
  ON teams FOR DELETE
  USING (is_event_admin(event_id));

-- ============================================
-- TEAM MEMBERS POLICIES
-- ============================================

-- Team members and event admins can see membership
CREATE POLICY "team_members_select"
  ON team_members FOR SELECT
  USING (
    is_team_member(team_id)
    OR EXISTS (
      SELECT 1 FROM teams t WHERE t.id = team_id AND is_event_admin(t.event_id)
    )
  );

-- Anyone can join a team (validated by join code in RPC)
CREATE POLICY "team_members_insert"
  ON team_members FOR INSERT
  WITH CHECK (profile_id = auth.profile_id());

-- Event admin can remove members, members can leave
CREATE POLICY "team_members_delete"
  ON team_members FOR DELETE
  USING (
    profile_id = auth.profile_id()
    OR EXISTS (
      SELECT 1 FROM teams t WHERE t.id = team_id AND is_event_admin(t.event_id)
    )
  );

-- ============================================
-- TEAM PROGRESS POLICIES
-- ============================================

-- Team members and event admins can view progress
CREATE POLICY "team_progress_select"
  ON team_progress FOR SELECT
  USING (
    is_team_member(team_id)
    OR EXISTS (
      SELECT 1 FROM teams t WHERE t.id = team_id AND is_event_admin(t.event_id)
    )
  );

-- Progress is created by RPC functions, not directly
CREATE POLICY "team_progress_insert"
  ON team_progress FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t WHERE t.id = team_id AND is_event_admin(t.event_id)
    )
  );

-- Team members can update their own progress (answer submissions)
-- Event admin can also update (for overrides)
CREATE POLICY "team_progress_update"
  ON team_progress FOR UPDATE
  USING (
    is_team_member(team_id)
    OR EXISTS (
      SELECT 1 FROM teams t WHERE t.id = team_id AND is_event_admin(t.event_id)
    )
  )
  WITH CHECK (
    is_team_member(team_id)
    OR EXISTS (
      SELECT 1 FROM teams t WHERE t.id = team_id AND is_event_admin(t.event_id)
    )
  );

-- ============================================
-- HINT USAGE POLICIES
-- ============================================

-- Team members and event admins can view hint usage
CREATE POLICY "hint_usage_select"
  ON hint_usage FOR SELECT
  USING (
    is_team_member(team_id)
    OR EXISTS (
      SELECT 1 FROM teams t WHERE t.id = team_id AND is_event_admin(t.event_id)
    )
  );

-- Team members can reveal hints (validated by RPC for limits)
CREATE POLICY "hint_usage_insert"
  ON hint_usage FOR INSERT
  WITH CHECK (
    is_team_member(team_id)
    AND revealed_by = auth.profile_id()
  );

-- ============================================
-- ANALYTICS EVENTS POLICIES
-- ============================================

-- Only event admins can read analytics
CREATE POLICY "analytics_select"
  ON analytics_events FOR SELECT
  USING (
    is_event_admin(event_id)
  );

-- Analytics are inserted by triggers/RPCs with SECURITY DEFINER
CREATE POLICY "analytics_insert"
  ON analytics_events FOR INSERT
  WITH CHECK (false); -- Use SECURITY DEFINER functions instead

-- ============================================
-- SERVICE ROLE BYPASS
-- For server-side operations
-- ============================================

-- Note: Supabase service role automatically bypasses RLS
-- Use service role for:
-- - Background jobs (pg_cron)
-- - Admin operations
-- - Analytics aggregation

