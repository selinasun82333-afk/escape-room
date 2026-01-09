// ========================================
// 방탈출 힌트 시스템 - 타입 정의
// ========================================

// 이벤트 상태
export type EventStatus = 'waiting' | 'running' | 'paused' | 'finished'

// 이벤트 (게임 세션)
export interface GameEvent {
  id: string
  name: string
  durationMinutes: number
  status: EventStatus
  startedAt: number | null  // timestamp
  pausedAt: number | null   // timestamp
  pausedDuration: number    // 일시정지된 총 시간 (초)
  hintsPerTeam: number
}

// 팀
export interface Team {
  id: string
  eventId: string
  name: string
  color: string
  joinCode: string
  hintsRemaining: number
}

// 스테이지 (웹툰)
export interface Stage {
  id: string
  eventId: string
  name: string
  entryCode: string
  webtoonImageUrl: string
}

// 퍼즐
export interface Puzzle {
  id: string
  eventId: string
  name: string
  hintCode: string
}

// 퍼즐 힌트
export interface PuzzleHint {
  id: string
  puzzleId: string
  level: 1 | 2 | 3
  content: string
  coinCost: number  // 0, 1, 2
}

// 팀 스테이지 조회 기록
export interface TeamStageView {
  id: string
  teamId: string
  stageId: string
  viewedAt: number
}

// 팀 힌트 사용 기록
export interface TeamHintUsage {
  id: string
  teamId: string
  puzzleHintId: string
  usedAt: number
}

