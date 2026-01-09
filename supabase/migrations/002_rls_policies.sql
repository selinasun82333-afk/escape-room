-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================
-- Simplified RLS for session-based player auth
-- Only admins use Supabase Auth; players use session tokens
-- ============================================================================

-- Enable RLS on all tables
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

-- ============================================================================
-- PROFILES POLICIES (Admin only)
-- ============================================================================

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- EVENTS POLICIES
-- ============================================================================

-- Public read for active events (players need this)
CREATE POLICY "Anyone can view active events"
  ON events FOR SELECT
  USING (status IN ('scheduled', 'active', 'paused', 'completed'));

-- Admins can see all events including drafts
CREATE POLICY "Admins can view all events"
  ON events FOR SELECT
  USING (is_admin(auth.uid()));

-- Organizers can see their own drafts
CREATE POLICY "Organizers can view own events"
  ON events FOR SELECT
  USING (created_by = auth.uid());

-- Admin/Organizer can create events
CREATE POLICY "Admins and organizers can create events"
  ON events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'organizer')
    )
  );

-- Event owners can update
CREATE POLICY "Event owners can update events"
  ON events FOR UPDATE
  USING (is_event_organizer(auth.uid(), id));

-- Only admins can delete
CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  USING (is_admin(auth.uid()));

-- ============================================================================
-- STAGES POLICIES
-- ============================================================================

-- Public read for stages of active events (players need this)
CREATE POLICY "Anyone can view stages of active events"
  ON stages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = stages.event_id
      AND e.status IN ('scheduled', 'active', 'paused', 'completed')
    )
  );

-- Event organizers can manage stages
CREATE POLICY "Event organizers can create stages"
  ON stages FOR INSERT
  WITH CHECK (is_event_organizer(auth.uid(), event_id));

CREATE POLICY "Event organizers can update stages"
  ON stages FOR UPDATE
  USING (is_event_organizer(auth.uid(), event_id));

CREATE POLICY "Event organizers can delete stages"
  ON stages FOR DELETE
  USING (is_event_organizer(auth.uid(), event_id));

-- ============================================================================
-- HINTS POLICIES
-- ============================================================================
-- IMPORTANT: Hint CONTENT must be hidden until used!
-- Players should only see metadata. Content comes from:
-- 1. The v_team_hints view (content is NULL until used)
-- 2. The get_team_hints() function
-- 3. The use-hint Edge Function response

-- Block direct SELECT on hints table for non-admins
-- This prevents seeing the content column directly
-- Players must use the secure view/function instead
CREATE POLICY "Only organizers can view hints directly"
  ON hints FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stages s
      WHERE s.id = hints.stage_id
      AND is_event_organizer(auth.uid(), s.event_id)
    )
  );

CREATE POLICY "Event organizers can create hints"
  ON hints FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stages s
      WHERE s.id = hints.stage_id
      AND is_event_organizer(auth.uid(), s.event_id)
    )
  );

CREATE POLICY "Event organizers can update hints"
  ON hints FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM stages s
      WHERE s.id = hints.stage_id
      AND is_event_organizer(auth.uid(), s.event_id)
    )
  );

CREATE POLICY "Event organizers can delete hints"
  ON hints FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM stages s
      WHERE s.id = hints.stage_id
      AND is_event_organizer(auth.uid(), s.event_id)
    )
  );

-- ============================================================================
-- TEAMS POLICIES
-- ============================================================================

-- Public read for teams in active events (for leaderboard)
CREATE POLICY "Anyone can view teams in active events"
  ON teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = teams.event_id
      AND e.status IN ('scheduled', 'active', 'paused', 'completed')
    )
  );

-- Event organizers can manage teams
CREATE POLICY "Event organizers can create teams"
  ON teams FOR INSERT
  WITH CHECK (is_event_organizer(auth.uid(), event_id));

CREATE POLICY "Event organizers can update teams"
  ON teams FOR UPDATE
  USING (is_event_organizer(auth.uid(), event_id));

CREATE POLICY "Event organizers can delete teams"
  ON teams FOR DELETE
  USING (is_event_organizer(auth.uid(), event_id));

-- ============================================================================
-- TEAM_MEMBERS POLICIES
-- ============================================================================

-- Public read for team members (show teammates)
CREATE POLICY "Anyone can view team members"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN events e ON e.id = t.event_id
      WHERE t.id = team_members.team_id
      AND e.status IN ('scheduled', 'active', 'paused', 'completed')
    )
  );

-- Insert handled by Edge Function (join-team)
-- But allow service role and admins
CREATE POLICY "Service role can insert members"
  ON team_members FOR INSERT
  WITH CHECK (TRUE); -- Controlled by Edge Function

-- Members update handled by Edge Function
CREATE POLICY "Service role can update members"
  ON team_members FOR UPDATE
  USING (TRUE); -- Controlled by Edge Function

-- Event organizers can delete members
CREATE POLICY "Event organizers can delete members"
  ON team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id
      AND is_event_organizer(auth.uid(), t.event_id)
    )
  );

-- ============================================================================
-- TEAM_PROGRESS POLICIES
-- ============================================================================

-- Public read for progress (for leaderboard/display)
CREATE POLICY "Anyone can view team progress"
  ON team_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN events e ON e.id = t.event_id
      WHERE t.id = team_progress.team_id
      AND e.status IN ('active', 'paused', 'completed')
    )
  );

-- Insert/Update handled by Edge Functions
CREATE POLICY "Service role manages progress"
  ON team_progress FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Service role updates progress"
  ON team_progress FOR UPDATE
  USING (TRUE);

-- ============================================================================
-- HINT_USAGE POLICIES
-- ============================================================================

-- Public read for hint usage (show which hints team used)
CREATE POLICY "Anyone can view hint usage"
  ON hint_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN events e ON e.id = t.event_id
      WHERE t.id = hint_usage.team_id
      AND e.status IN ('active', 'paused', 'completed')
    )
  );

-- Insert handled by Edge Function
CREATE POLICY "Service role inserts hint usage"
  ON hint_usage FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================================
-- CODE_ATTEMPTS POLICIES
-- ============================================================================

-- Only organizers can view code attempts (analytics)
CREATE POLICY "Event organizers can view code attempts"
  ON code_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = code_attempts.team_id
      AND is_event_organizer(auth.uid(), t.event_id)
    )
  );

-- Insert handled by Edge Function
CREATE POLICY "Service role inserts code attempts"
  ON code_attempts FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================================
-- ANALYTICS_EVENTS POLICIES
-- ============================================================================

-- Only admins and event organizers can view analytics
CREATE POLICY "Organizers can view event analytics"
  ON analytics_events FOR SELECT
  USING (
    is_admin(auth.uid())
    OR (event_id IS NOT NULL AND is_event_organizer(auth.uid(), event_id))
  );

-- Anyone can insert analytics (via Edge Function)
CREATE POLICY "Anyone can log analytics"
  ON analytics_events FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE team_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE hint_usage;

-- ============================================================================
-- NOTE: GRANTS ARE IN 003_functions_and_grants.sql
-- ============================================================================
-- Run 003_functions_and_grants.sql AFTER this file to set up:
-- - validate_team_join_code function (required for team join)
-- - get_team_hints, get_hint_content, can_use_hint functions
-- - v_team_hints view
-- - All GRANT statements for anon/authenticated roles
