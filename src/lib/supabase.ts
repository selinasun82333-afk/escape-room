// ========================================
// Supabase Client Configuration
// ========================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://djtluyohbotooazkjsok.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdGx1eW9oYm90b29hemtqc29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NTk1NjcsImV4cCI6MjA4MzUzNTU2N30.egieLN_BUAMuTK45TN55TT4hPCPqjOHcU3DzkDVkKH0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// ========================================
// Database Types (matches our simplified schema)
// ========================================

export interface DbEvent {
  id: string
  name: string
  duration_minutes: number
  status: 'waiting' | 'running' | 'paused' | 'finished'
  started_at: string | null
  paused_at: string | null
  paused_duration: number
  hints_per_team: number
  created_at?: string
}

export interface DbTeam {
  id: string
  event_id: string
  name: string
  color: string
  join_code: string
  hints_remaining: number
  created_at?: string
}

export interface DbStage {
  id: string
  event_id: string
  name: string
  entry_code: string
  webtoon_image_url: string
  created_at?: string
}

export interface DbPuzzle {
  id: string
  event_id: string
  name: string
  hint_code: string
  created_at?: string
}

export interface DbPuzzleHint {
  id: string
  puzzle_id: string
  level: number
  content: string
  coin_cost: number
  created_at?: string
}

export interface DbTeamStageView {
  id: string
  team_id: string
  stage_id: string
  viewed_at: string
}

export interface DbTeamHintUsage {
  id: string
  team_id: string
  puzzle_hint_id: string
  used_at: string
}
