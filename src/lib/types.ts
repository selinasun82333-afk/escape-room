// ============================================
// TypeScript Types for Escape Room Platform
// Generated from database schema
// ============================================

// ============================================
// ENUMS
// ============================================

export type EventStatus = 'draft' | 'published' | 'active' | 'completed' | 'archived';
export type UserRole = 'admin' | 'player' | 'spectator';
export type StageStatus = 'locked' | 'unlocked' | 'in_progress' | 'completed' | 'skipped';

// ============================================
// DATABASE TABLES
// ============================================

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  admin_id: string;
  title: string;
  description: string | null;
  status: EventStatus;
  timer_duration_seconds: number;
  timer_started_at: string | null;
  timer_paused_at: string | null;
  timer_paused_duration_seconds: number;
  max_hints_per_team: number;
  max_team_size: number;
  allow_late_join: boolean;
  base_points_per_stage: number;
  time_bonus_enabled: boolean;
  scheduled_start_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Stage {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  order_index: number;
  entry_code: string;
  puzzle_type: string;
  puzzle_data: Record<string, unknown>;
  correct_answer: string;
  case_sensitive: boolean;
  max_points: number;
  time_limit_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface Hint {
  id: string;
  stage_id: string;
  order_index: number;
  content: string;
  penalty_seconds: number;
  penalty_points: number;
  created_at: string;
}

export interface Team {
  id: string;
  event_id: string;
  name: string;
  join_code: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  profile_id: string;
  is_captain: boolean;
  joined_at: string;
}

export interface TeamProgress {
  id: string;
  team_id: string;
  stage_id: string;
  status: StageStatus;
  unlocked_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  attempts: number;
  last_submitted_answer: string | null;
  points_earned: number;
  time_penalty_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface HintUsage {
  id: string;
  team_id: string;
  hint_id: string;
  revealed_at: string;
  revealed_by: string | null;
}

export interface AnalyticsEvent {
  id: string;
  event_id: string | null;
  team_id: string | null;
  stage_id: string | null;
  profile_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

// ============================================
// VIEW TYPES
// ============================================

export interface LeaderboardEntry {
  rank: number;
  team_id: string;
  team_name: string;
  team_color: string;
  total_points: number;
  stages_completed: number;
  total_time_penalty: number;
}

export interface StageAnalytics {
  stage_id: string;
  title: string;
  order_index: number;
  teams_attempted: number;
  teams_completed: number;
  completion_rate: number;
  avg_completion_seconds: number;
  avg_attempts: number;
  hint_usage_rate: number;
}

// ============================================
// RPC FUNCTION RESPONSES
// ============================================

export interface CreateTeamResponse {
  team_id: string;
  join_code: string;
}

export interface JoinTeamResponse {
  team_id: string;
  team_name: string;
  event_id: string;
}

export interface ValidateEntryCodeResponse {
  stage_id: string;
  stage_title: string;
  stage_order: number;
  status: StageStatus;
}

export interface SubmitAnswerResponse {
  correct: boolean;
  attempts: number;
  points_earned: number;
  next_stage_id: string | null;
}

export interface RevealHintResponse {
  hint_id: string;
  hint_content: string;
  hint_order: number;
  penalty_seconds: number;
  total_hints_used: number;
  hints_remaining: number;
}

export interface TimerResponse {
  status?: EventStatus;
  started_at?: string;
  paused?: boolean;
  resumed?: boolean;
  remaining_seconds?: number;
}

// ============================================
// COMPOSITE TYPES (with relations)
// ============================================

export interface EventWithStages extends Event {
  stages: Stage[];
}

export interface TeamWithMembers extends Team {
  members: (TeamMember & { profile: Profile })[];
}

export interface TeamWithProgress extends Team {
  progress: TeamProgress[];
  hint_usage: HintUsage[];
}

export interface StageWithHints extends Stage {
  hints: Hint[];
}

export interface GameState {
  event: Event;
  team: TeamWithMembers;
  stages: StageWithHints[];
  progress: Map<string, TeamProgress>; // keyed by stage_id
  revealedHints: Map<string, Hint[]>; // keyed by stage_id
  remainingTime: number;
  hintsRemaining: number;
}

// ============================================
// REALTIME PAYLOAD TYPES
// ============================================

export interface RealtimeEventPayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Event | null;
  old: Event | null;
}

export interface RealtimeProgressPayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: TeamProgress | null;
  old: TeamProgress | null;
}

export interface RealtimeHintUsagePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: HintUsage | null;
  old: HintUsage | null;
}

// ============================================
// FORM / INPUT TYPES
// ============================================

export interface CreateEventInput {
  title: string;
  description?: string;
  timer_duration_seconds?: number;
  max_hints_per_team?: number;
  max_team_size?: number;
  allow_late_join?: boolean;
  base_points_per_stage?: number;
  time_bonus_enabled?: boolean;
  scheduled_start_at?: string;
}

export interface CreateStageInput {
  event_id: string;
  title: string;
  description?: string;
  order_index: number;
  puzzle_type?: string;
  puzzle_data?: Record<string, unknown>;
  correct_answer: string;
  case_sensitive?: boolean;
  max_points?: number;
  time_limit_seconds?: number;
}

export interface CreateHintInput {
  stage_id: string;
  order_index: number;
  content: string;
  penalty_seconds?: number;
  penalty_points?: number;
}

export interface UpdateEventInput extends Partial<CreateEventInput> {
  status?: EventStatus;
}

// ============================================
// ANALYTICS TYPES
// ============================================

export type AnalyticsEventType =
  | 'team_created'
  | 'player_joined'
  | 'stage_started'
  | 'stage_completed'
  | 'hint_revealed'
  | 'wrong_answer'
  | 'qr_scanned'
  | 'timer_started'
  | 'timer_paused'
  | 'timer_resumed'
  | 'event_ended';

export interface EventAnalyticsSummary {
  event_id: string;
  total_teams: number;
  total_players: number;
  avg_completion_rate: number;
  avg_time_to_complete: number;
  total_hints_used: number;
  stage_analytics: StageAnalytics[];
}

// ============================================
// UTILITY TYPES
// ============================================

export type UUID = string;

// Database operation result
export interface DbResult<T> {
  data: T | null;
  error: Error | null;
}

// Timer state for UI
export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  startedAt: Date | null;
  pausedAt: Date | null;
}

