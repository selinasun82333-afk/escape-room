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
// Database Types (matches actual Supabase tables)
// ========================================

// events 테이블
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

// teams 테이블
export interface DbTeam {
  id: string
  event_id: string
  name: string
  color: string
  join_code: string
  hints_remaining: number
  created_at?: string
}

// stages 테이블
export interface DbStage {
  id: string
  event_id: string
  name: string
  entry_code: string
  webtoon_image_url: string | null
  created_at?: string
}

// hints 테이블 (퍼즐 + 힌트 통합)
export interface DbHint {
  id: string
  event_id: string
  name: string           // 퍼즐 이름
  hint_code: string      // 힌트 코드
  level: number          // 1, 2, 3
  content: string        // 힌트 내용
  coin_cost: number      // 0, 1, 2
  created_at?: string
}

// team_progress 테이블 (스테이지 진행 상황)
export interface DbTeamProgress {
  id: string
  team_id: string
  stage_id: string
  completed_at?: string
  created_at?: string
}

// hint_usage 테이블
export interface DbHintUsage {
  id: string
  team_id: string
  hint_id: string
  used_at?: string
  created_at?: string
}
