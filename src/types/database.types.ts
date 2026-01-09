// ============================================================================
// DATABASE TYPES
// ============================================================================
// Types for Supabase tables - Session-based player auth model
// Generate fresh types with: npx supabase gen types typescript --local
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================================================
// ENUMS
// ============================================================================

export type EventStatus = 
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived'

export type StageStatus = 
  | 'locked'
  | 'active'
  | 'completed'
  | 'skipped'

export type UserRole = 
  | 'admin'
  | 'organizer'
  | 'player'

export type AnalyticsEventType =
  | 'event_created'
  | 'event_started'
  | 'event_paused'
  | 'event_resumed'
  | 'event_ended'
  | 'team_created'
  | 'team_joined'
  | 'member_joined'
  | 'stage_unlocked'
  | 'stage_started'
  | 'stage_completed'
  | 'code_attempt_success'
  | 'code_attempt_failed'
  | 'hint_requested'
  | 'hint_revealed'
  | 'qr_scanned'

// ============================================================================
// TABLE TYPES
// ============================================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          role: UserRole
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          role?: UserRole
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          role?: UserRole
          avatar_url?: string | null
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          name: string
          description: string | null
          slug: string | null
          created_by: string
          organization_name: string | null
          duration_seconds: number
          max_teams: number | null
          max_team_size: number
          hints_per_team: number
          allow_late_join: boolean
          status: EventStatus
          scheduled_start: string | null
          started_at: string | null
          paused_at: string | null
          accumulated_pause_seconds: number
          ended_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          slug?: string | null
          created_by: string
          organization_name?: string | null
          duration_seconds?: number
          max_teams?: number | null
          max_team_size?: number
          hints_per_team?: number
          allow_late_join?: boolean
          status?: EventStatus
          scheduled_start?: string | null
          started_at?: string | null
          paused_at?: string | null
          accumulated_pause_seconds?: number
          ended_at?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          slug?: string | null
          organization_name?: string | null
          duration_seconds?: number
          max_teams?: number | null
          max_team_size?: number
          hints_per_team?: number
          allow_late_join?: boolean
          status?: EventStatus
          scheduled_start?: string | null
          started_at?: string | null
          paused_at?: string | null
          accumulated_pause_seconds?: number
          ended_at?: string | null
          updated_at?: string
        }
      }
      stages: {
        Row: {
          id: string
          event_id: string
          order_index: number
          name: string
          description: string | null
          instructions: string | null
          unlock_code: string
          unlock_code_hint: string | null
          qr_code_data: string | null
          estimated_minutes: number | null
          time_limit_seconds: number | null
          base_points: number
          time_bonus_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          order_index: number
          name: string
          description?: string | null
          instructions?: string | null
          unlock_code: string
          unlock_code_hint?: string | null
          qr_code_data?: string | null
          estimated_minutes?: number | null
          time_limit_seconds?: number | null
          base_points?: number
          time_bonus_enabled?: boolean
        }
        Update: {
          order_index?: number
          name?: string
          description?: string | null
          instructions?: string | null
          unlock_code?: string
          unlock_code_hint?: string | null
          qr_code_data?: string | null
          estimated_minutes?: number | null
          time_limit_seconds?: number | null
          base_points?: number
          time_bonus_enabled?: boolean
          updated_at?: string
        }
      }
      hints: {
        Row: {
          id: string
          stage_id: string
          order_index: number
          title: string | null
          content: string
          point_penalty: number
          created_at: string
        }
        Insert: {
          id?: string
          stage_id: string
          order_index: number
          title?: string | null
          content: string
          point_penalty?: number
        }
        Update: {
          order_index?: number
          title?: string | null
          content?: string
          point_penalty?: number
        }
      }
      teams: {
        Row: {
          id: string
          event_id: string
          name: string
          join_code: string
          color: string | null
          hints_remaining: number
          total_points: number
          current_stage_index: number
          registered_at: string
          started_at: string | null
          finished_at: string | null
          is_active: boolean
          disqualified: boolean
          disqualification_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          join_code: string
          color?: string | null
          hints_remaining: number
          total_points?: number
          current_stage_index?: number
          registered_at?: string
          started_at?: string | null
          finished_at?: string | null
          is_active?: boolean
          disqualified?: boolean
          disqualification_reason?: string | null
        }
        Update: {
          name?: string
          color?: string | null
          hints_remaining?: number
          total_points?: number
          current_stage_index?: number
          started_at?: string | null
          finished_at?: string | null
          is_active?: boolean
          disqualified?: boolean
          disqualification_reason?: string | null
          updated_at?: string
        }
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          session_token: string
          display_name: string
          is_captain: boolean
          joined_at: string
          last_active_at: string
          is_online: boolean
        }
        Insert: {
          id?: string
          team_id: string
          session_token?: string
          display_name: string
          is_captain?: boolean
          joined_at?: string
          last_active_at?: string
          is_online?: boolean
        }
        Update: {
          display_name?: string
          is_captain?: boolean
          last_active_at?: string
          is_online?: boolean
        }
      }
      team_progress: {
        Row: {
          id: string
          team_id: string
          stage_id: string
          status: StageStatus
          unlocked_at: string | null
          started_at: string | null
          completed_at: string | null
          attempt_count: number
          last_attempt_at: string | null
          points_earned: number
          time_bonus: number
          hint_penalties: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          stage_id: string
          status?: StageStatus
          unlocked_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          attempt_count?: number
          last_attempt_at?: string | null
          points_earned?: number
          time_bonus?: number
          hint_penalties?: number
        }
        Update: {
          status?: StageStatus
          unlocked_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          attempt_count?: number
          last_attempt_at?: string | null
          points_earned?: number
          time_bonus?: number
          hint_penalties?: number
          updated_at?: string
        }
      }
      hint_usage: {
        Row: {
          id: string
          team_id: string
          hint_id: string
          requested_by_session: string | null
          used_at: string
          time_in_stage_seconds: number | null
        }
        Insert: {
          id?: string
          team_id: string
          hint_id: string
          requested_by_session?: string | null
          used_at?: string
          time_in_stage_seconds?: number | null
        }
        Update: never
      }
      code_attempts: {
        Row: {
          id: string
          team_id: string
          stage_id: string
          submitted_code: string
          is_correct: boolean
          submitted_by_session: string | null
          attempted_at: string
          time_in_stage_seconds: number | null
        }
        Insert: {
          id?: string
          team_id: string
          stage_id: string
          submitted_code: string
          is_correct: boolean
          submitted_by_session?: string | null
          attempted_at?: string
          time_in_stage_seconds?: number | null
        }
        Update: never
      }
      analytics_events: {
        Row: {
          id: string
          event_id: string | null
          team_id: string | null
          stage_id: string | null
          session_token: string | null
          event_type: AnalyticsEventType
          payload: Json
          occurred_at: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          event_id?: string | null
          team_id?: string | null
          stage_id?: string | null
          session_token?: string | null
          event_type: AnalyticsEventType
          payload?: Json
          occurred_at?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: never
      }
    }
    Views: {
      v_leaderboard: {
        Row: {
          team_id: string
          event_id: string
          team_name: string
          team_color: string | null
          total_points: number
          current_stage_index: number
          finished_at: string | null
          started_at: string | null
          completion_seconds: number | null
          stages_completed: number
          total_stages: number
          rank: number
        }
      }
      v_event_stats: {
        Row: {
          event_id: string
          event_name: string
          status: EventStatus
          duration_seconds: number
          started_at: string | null
          ended_at: string | null
          total_teams: number
          finished_teams: number
          active_teams: number
          total_members: number
          online_members: number
          total_stages: number
          total_hints_used: number
          avg_completion_seconds: number | null
        }
      }
      v_stage_analytics: {
        Row: {
          stage_id: string
          event_id: string
          stage_name: string
          order_index: number
          estimated_minutes: number | null
          completions: number
          currently_active: number
          avg_completion_seconds: number | null
          fastest_completion_seconds: number | null
          slowest_completion_seconds: number | null
          avg_attempts: number | null
          total_hints_used: number
          teams_using_hints: number
        }
      }
      v_team_hints: {
        Row: {
          hint_id: string
          stage_id: string
          order_index: number
          title: string | null
          point_penalty: number
          created_at: string
          team_id: string
          event_id: string
          stage_status: StageStatus
          content: string | null  // NULL until hint is used!
          is_used: boolean
          used_at: string | null
          used_after_seconds: number | null
        }
      }
    }
    Functions: {
      calculate_remaining_time: {
        Args: { p_event_id: string }
        Returns: number
      }
      is_admin: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_event_organizer: {
        Args: { p_user_id: string; p_event_id: string }
        Returns: boolean
      }
      get_team_by_session: {
        Args: { p_session_token: string }
        Returns: string | null
      }
      validate_session_for_team: {
        Args: { p_session_token: string; p_team_id: string }
        Returns: boolean
      }
      validate_team_join_code: {
        Args: { p_event_id: string; p_join_code: string }
        Returns: string | null
      }
      can_use_hint: {
        Args: { p_team_id: string; p_hint_id: string }
        Returns: boolean
      }
      get_team_hints: {
        Args: { p_team_id: string; p_stage_id?: string }
        Returns: {
          hint_id: string
          stage_id: string
          order_index: number
          title: string | null
          point_penalty: number
          content: string | null  // NULL until used
          is_used: boolean
          used_at: string | null
        }[]
      }
      get_hint_content: {
        Args: { p_team_id: string; p_hint_id: string }
        Returns: {
          hint_id: string
          title: string | null
          content: string | null  // NULL until used
          point_penalty: number
          is_used: boolean
        }[]
      }
      generate_join_code: {
        Args: Record<string, never>
        Returns: string
      }
      initialize_team_progress: {
        Args: { p_team_id: string }
        Returns: void
      }
    }
  }
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row']

export type InsertTables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Insert']

export type UpdateTables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Update']

export type Views<T extends keyof Database['public']['Views']> = 
  Database['public']['Views'][T]['Row']

// Convenience aliases
export type Profile = Tables<'profiles'>
export type Event = Tables<'events'>
export type Stage = Tables<'stages'>
export type Hint = Tables<'hints'>
export type Team = Tables<'teams'>
export type TeamMember = Tables<'team_members'>
export type TeamProgress = Tables<'team_progress'>
export type HintUsage = Tables<'hint_usage'>
export type CodeAttempt = Tables<'code_attempts'>
export type AnalyticsEvent = Tables<'analytics_events'>

// View types
export type LeaderboardEntry = Views<'v_leaderboard'>
export type EventStats = Views<'v_event_stats'>
export type StageAnalytics = Views<'v_stage_analytics'>
export type TeamHint = Views<'v_team_hints'>

// ============================================================================
// EXTENDED TYPES (with relations)
// ============================================================================

export interface EventWithStages extends Event {
  stages: Stage[]
}

export interface StageWithHints extends Stage {
  hints: Hint[]
}

export interface TeamWithMembers extends Team {
  team_members: TeamMember[]
}

export interface TeamWithProgress extends Team {
  team_progress: TeamProgress[]
  team_members: TeamMember[]
}

export interface EventWithTeams extends Event {
  teams: TeamWithMembers[]
  stages: StageWithHints[]
}

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface PlayerSession {
  sessionToken: string
  teamId: string
  teamName: string
  eventId: string
  eventName: string
  memberId: string
  displayName: string
  isCaptain: boolean
  joinedAt: string
}

// Storage key for localStorage
export const SESSION_STORAGE_KEY = 'escape_room_session'

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface JoinTeamResponse {
  success: boolean
  message: string
  session_token?: string
  team_id?: string
  team_name?: string
  event_name?: string
  member_id?: string
  is_captain?: boolean
}

export interface ValidateCodeResponse {
  success: boolean
  message: string
  next_stage_id?: string
  points_earned?: number
  time_bonus?: number
  is_final_stage?: boolean
}

export interface UseHintResponse {
  success: boolean
  message: string
  hint_content?: string
  hint_title?: string
  remaining_hints?: number
  point_penalty?: number
}

export interface EventControlResponse {
  success: boolean
  message: string
  event_status?: EventStatus
  started_at?: string
  remaining_seconds?: number
}

// ============================================================================
// REALTIME PAYLOAD TYPES
// ============================================================================

export interface TimerPayload {
  event_id: string
  remaining_seconds: number
  status: EventStatus
  started_at: string | null
  paused_at: string | null
}

export interface ProgressPayload {
  team_id: string
  stage_id: string
  status: StageStatus
  points_earned: number
  time_bonus: number
}

export interface HintUsedPayload {
  team_id: string
  hint_id: string
  stage_id: string
  remaining_hints: number
}

export interface TeamUpdatePayload {
  team_id: string
  team_name: string
  total_points: number
  current_stage_index: number
  finished_at: string | null
}
