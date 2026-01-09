// ========================================
// Mock Data - 테스트용 가짜 데이터
// ========================================

import type { GameEvent, Team, Stage, Puzzle, PuzzleHint } from './types'

// 기본 이벤트
export const mockEvent: GameEvent = {
  id: 'event-1',
  name: '셜록홈즈의 미제사건',
  durationMinutes: 60,
  status: 'waiting',
  startedAt: null,
  pausedAt: null,
  pausedDuration: 0,
  hintsPerTeam: 5,
}

// 팀 목록
export const mockTeams: Team[] = [
  { id: 'team-1', eventId: 'event-1', name: '보라팀', color: '#8b5cf6', joinCode: 'PURPLE', hintsRemaining: 5 },
  { id: 'team-2', eventId: 'event-1', name: '빨강팀', color: '#ef4444', joinCode: 'RED123', hintsRemaining: 5 },
  { id: 'team-3', eventId: 'event-1', name: '노랑팀', color: '#eab308', joinCode: 'YELLOW', hintsRemaining: 5 },
  { id: 'team-4', eventId: 'event-1', name: '파랑팀', color: '#3b82f6', joinCode: 'BLUE99', hintsRemaining: 5 },
]

// 스테이지 목록
export const mockStages: Stage[] = [
  { 
    id: 'stage-1', 
    eventId: 'event-1', 
    name: '용의자의 방', 
    entryCode: 'ROOM001',
    webtoonImageUrl: 'https://placehold.co/400x600/1a1a2e/white?text=용의자의+방'
  },
  { 
    id: 'stage-2', 
    eventId: 'event-1', 
    name: '증거물품 보관소', 
    entryCode: 'EVIDENCE',
    webtoonImageUrl: 'https://placehold.co/400x600/1a1a2e/white?text=증거물품+보관소'
  },
  { 
    id: 'stage-3', 
    eventId: 'event-1', 
    name: '런던 거리', 
    entryCode: 'LONDON',
    webtoonImageUrl: 'https://placehold.co/400x600/1a1a2e/white?text=런던+거리'
  },
  { 
    id: 'stage-4', 
    eventId: 'event-1', 
    name: '베이커가 221B', 
    entryCode: 'BAKER221',
    webtoonImageUrl: 'https://placehold.co/400x600/1a1a2e/white?text=베이커가+221B'
  },
]

// 퍼즐 목록
export const mockPuzzles: Puzzle[] = [
  { id: 'puzzle-1', eventId: 'event-1', name: '암호 해독', hintCode: 'CIPHER' },
  { id: 'puzzle-2', eventId: 'event-1', name: '숨겨진 열쇠', hintCode: 'KEY123' },
  { id: 'puzzle-3', eventId: 'event-1', name: '타임라인 퍼즐', hintCode: 'TIME99' },
  { id: 'puzzle-4', eventId: 'event-1', name: '최종 추리', hintCode: 'FINAL1' },
]

// 퍼즐 힌트
export const mockPuzzleHints: PuzzleHint[] = [
  // 암호 해독 힌트
  { id: 'hint-1-1', puzzleId: 'puzzle-1', level: 1, content: '벽에 있는 그림을 자세히 살펴보세요.', coinCost: 0 },
  { id: 'hint-1-2', puzzleId: 'puzzle-1', level: 2, content: '그림 속 숫자들을 왼쪽에서 오른쪽으로 읽어보세요.', coinCost: 1 },
  { id: 'hint-1-3', puzzleId: 'puzzle-1', level: 3, content: '정답은 3-7-2-9 입니다.', coinCost: 2 },
  
  // 숨겨진 열쇠 힌트
  { id: 'hint-2-1', puzzleId: 'puzzle-2', level: 1, content: '책장 근처를 살펴보세요.', coinCost: 0 },
  { id: 'hint-2-2', puzzleId: 'puzzle-2', level: 2, content: '빨간색 책 뒤를 확인하세요.', coinCost: 1 },
  { id: 'hint-2-3', puzzleId: 'puzzle-2', level: 3, content: '"셜록홈즈 전집" 책 뒤에 열쇠가 있습니다.', coinCost: 2 },
  
  // 타임라인 퍼즐 힌트
  { id: 'hint-3-1', puzzleId: 'puzzle-3', level: 1, content: '사건 발생 순서를 생각해보세요.', coinCost: 0 },
  { id: 'hint-3-2', puzzleId: 'puzzle-3', level: 2, content: '피해자의 일기장에 단서가 있습니다.', coinCost: 1 },
  { id: 'hint-3-3', puzzleId: 'puzzle-3', level: 3, content: '순서: 파티 → 정전 → 비명 → 발견', coinCost: 2 },
  
  // 최종 추리 힌트
  { id: 'hint-4-1', puzzleId: 'puzzle-4', level: 1, content: '모든 증거를 다시 검토하세요.', coinCost: 0 },
  { id: 'hint-4-2', puzzleId: 'puzzle-4', level: 2, content: '범인은 알리바이가 거짓인 사람입니다.', coinCost: 1 },
  { id: 'hint-4-3', puzzleId: 'puzzle-4', level: 3, content: '범인은 집사 제임스입니다.', coinCost: 2 },
]

