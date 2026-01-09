// ========================================
// 게임 상태 관리 (공유 데이터)
// ========================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameEvent, Team, Stage, Puzzle, PuzzleHint, TeamStageView, TeamHintUsage } from './types'
import { mockEvent, mockTeams, mockStages, mockPuzzles, mockPuzzleHints } from './mockData'

interface GameStore {
  // 데이터
  event: GameEvent
  teams: Team[]
  stages: Stage[]
  puzzles: Puzzle[]
  puzzleHints: PuzzleHint[]
  stageViews: TeamStageView[]
  hintUsages: TeamHintUsage[]
  
  // 이벤트 관리
  updateEvent: (updates: Partial<GameEvent>) => void
  startTimer: () => void
  pauseTimer: () => void
  resumeTimer: () => void
  resetTimer: () => void
  
  // 팀 관리
  addTeam: (name: string, color: string) => void
  removeTeam: (teamId: string) => void
  updateTeam: (teamId: string, updates: Partial<Team>) => void
  useHintCoin: (teamId: string, cost: number) => boolean
  
  // 스테이지 관리
  addStage: (name: string, entryCode: string, imageUrl: string) => void
  removeStage: (stageId: string) => void
  updateStage: (stageId: string, updates: Partial<Stage>) => void
  
  // 퍼즐 관리
  addPuzzle: (name: string, hintCode: string) => void
  removePuzzle: (puzzleId: string) => void
  updatePuzzle: (puzzleId: string, updates: Partial<Puzzle>) => void
  
  // 힌트 관리
  updatePuzzleHint: (hintId: string, content: string) => void
  
  // 팀 진행상황
  viewStage: (teamId: string, stageId: string) => void
  useHint: (teamId: string, puzzleHintId: string) => void
  getTeamStageViews: (teamId: string) => TeamStageView[]
  getTeamHintUsages: (teamId: string) => TeamHintUsage[]
  hasViewedStage: (teamId: string, stageId: string) => boolean
  hasUsedHint: (teamId: string, puzzleHintId: string) => boolean
  
  // 유틸리티
  getTeamByCode: (code: string) => Team | undefined
  getStageByCode: (code: string) => Stage | undefined
  getPuzzleByCode: (code: string) => Puzzle | undefined
  getHintsForPuzzle: (puzzleId: string) => PuzzleHint[]
  
  // 초기화
  resetAll: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 9)
const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase()

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // 초기 데이터
      event: mockEvent,
      teams: mockTeams,
      stages: mockStages,
      puzzles: mockPuzzles,
      puzzleHints: mockPuzzleHints,
      stageViews: [],
      hintUsages: [],
      
      // 이벤트 관리
      updateEvent: (updates) => set((state) => ({
        event: { ...state.event, ...updates }
      })),
      
      startTimer: () => set((state) => ({
        event: {
          ...state.event,
          status: 'running',
          startedAt: Date.now(),
          pausedAt: null,
          pausedDuration: 0,
        }
      })),
      
      pauseTimer: () => set((state) => ({
        event: {
          ...state.event,
          status: 'paused',
          pausedAt: Date.now(),
        }
      })),
      
      resumeTimer: () => set((state) => {
        const pausedDuration = state.event.pausedAt 
          ? state.event.pausedDuration + (Date.now() - state.event.pausedAt)
          : state.event.pausedDuration
        return {
          event: {
            ...state.event,
            status: 'running',
            pausedAt: null,
            pausedDuration,
          }
        }
      }),
      
      resetTimer: () => set((state) => ({
        event: {
          ...state.event,
          status: 'waiting',
          startedAt: null,
          pausedAt: null,
          pausedDuration: 0,
        }
      })),
      
      // 팀 관리
      addTeam: (name, color) => set((state) => ({
        teams: [...state.teams, {
          id: `team-${generateId()}`,
          eventId: state.event.id,
          name,
          color,
          joinCode: generateCode(),
          hintsRemaining: state.event.hintsPerTeam,
        }]
      })),
      
      removeTeam: (teamId) => set((state) => ({
        teams: state.teams.filter(t => t.id !== teamId),
        stageViews: state.stageViews.filter(sv => sv.teamId !== teamId),
        hintUsages: state.hintUsages.filter(hu => hu.teamId !== teamId),
      })),
      
      updateTeam: (teamId, updates) => set((state) => ({
        teams: state.teams.map(t => t.id === teamId ? { ...t, ...updates } : t)
      })),
      
      useHintCoin: (teamId, cost) => {
        const team = get().teams.find(t => t.id === teamId)
        if (!team || team.hintsRemaining < cost) return false
        set((state) => ({
          teams: state.teams.map(t => 
            t.id === teamId 
              ? { ...t, hintsRemaining: t.hintsRemaining - cost }
              : t
          )
        }))
        return true
      },
      
      // 스테이지 관리
      addStage: (name, entryCode, imageUrl) => set((state) => ({
        stages: [...state.stages, {
          id: `stage-${generateId()}`,
          eventId: state.event.id,
          name,
          entryCode: entryCode.toUpperCase(),
          webtoonImageUrl: imageUrl || `https://placehold.co/400x600/1a1a2e/white?text=${encodeURIComponent(name)}`,
        }]
      })),
      
      removeStage: (stageId) => set((state) => ({
        stages: state.stages.filter(s => s.id !== stageId),
        stageViews: state.stageViews.filter(sv => sv.stageId !== stageId),
      })),
      
      updateStage: (stageId, updates) => set((state) => ({
        stages: state.stages.map(s => s.id === stageId ? { ...s, ...updates } : s)
      })),
      
      // 퍼즐 관리
      addPuzzle: (name, hintCode) => {
        const puzzleId = `puzzle-${generateId()}`
        set((state) => ({
          puzzles: [...state.puzzles, {
            id: puzzleId,
            eventId: state.event.id,
            name,
            hintCode: hintCode.toUpperCase(),
          }],
          puzzleHints: [
            ...state.puzzleHints,
            { id: `hint-${generateId()}`, puzzleId, level: 1, content: '1단계 힌트를 입력하세요', coinCost: 0 },
            { id: `hint-${generateId()}`, puzzleId, level: 2, content: '2단계 힌트를 입력하세요', coinCost: 1 },
            { id: `hint-${generateId()}`, puzzleId, level: 3, content: '3단계 힌트를 입력하세요', coinCost: 2 },
          ]
        }))
      },
      
      removePuzzle: (puzzleId) => set((state) => ({
        puzzles: state.puzzles.filter(p => p.id !== puzzleId),
        puzzleHints: state.puzzleHints.filter(h => h.puzzleId !== puzzleId),
      })),
      
      updatePuzzle: (puzzleId, updates) => set((state) => ({
        puzzles: state.puzzles.map(p => p.id === puzzleId ? { ...p, ...updates } : p)
      })),
      
      // 힌트 관리
      updatePuzzleHint: (hintId, content) => set((state) => ({
        puzzleHints: state.puzzleHints.map(h => h.id === hintId ? { ...h, content } : h)
      })),
      
      // 팀 진행상황
      viewStage: (teamId, stageId) => {
        if (get().hasViewedStage(teamId, stageId)) return
        set((state) => ({
          stageViews: [...state.stageViews, {
            id: `view-${generateId()}`,
            teamId,
            stageId,
            viewedAt: Date.now(),
          }]
        }))
      },
      
      useHint: (teamId, puzzleHintId) => {
        if (get().hasUsedHint(teamId, puzzleHintId)) return
        set((state) => ({
          hintUsages: [...state.hintUsages, {
            id: `usage-${generateId()}`,
            teamId,
            puzzleHintId,
            usedAt: Date.now(),
          }]
        }))
      },
      
      getTeamStageViews: (teamId) => get().stageViews.filter(sv => sv.teamId === teamId),
      getTeamHintUsages: (teamId) => get().hintUsages.filter(hu => hu.teamId === teamId),
      hasViewedStage: (teamId, stageId) => get().stageViews.some(sv => sv.teamId === teamId && sv.stageId === stageId),
      hasUsedHint: (teamId, puzzleHintId) => get().hintUsages.some(hu => hu.teamId === teamId && hu.puzzleHintId === puzzleHintId),
      
      // 유틸리티
      getTeamByCode: (code) => get().teams.find(t => t.joinCode.toUpperCase() === code.toUpperCase()),
      getStageByCode: (code) => get().stages.find(s => s.entryCode.toUpperCase() === code.toUpperCase()),
      getPuzzleByCode: (code) => get().puzzles.find(p => p.hintCode.toUpperCase() === code.toUpperCase()),
      getHintsForPuzzle: (puzzleId) => get().puzzleHints.filter(h => h.puzzleId === puzzleId).sort((a, b) => a.level - b.level),
      
      // 초기화
      resetAll: () => set({
        event: mockEvent,
        teams: mockTeams.map(t => ({ ...t, hintsRemaining: mockEvent.hintsPerTeam })),
        stages: mockStages,
        puzzles: mockPuzzles,
        puzzleHints: mockPuzzleHints,
        stageViews: [],
        hintUsages: [],
      }),
    }),
    {
      name: 'escape-room-game',
    }
  )
)

