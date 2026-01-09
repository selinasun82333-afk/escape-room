// ========================================
// Supabase 실시간 동기화 스토어
// ========================================

import { create } from 'zustand'
import { supabase, DbEvent, DbTeam, DbStage, DbPuzzle, DbPuzzleHint, DbTeamStageView, DbTeamHintUsage } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Mock 데이터 (Supabase 연결 실패 시 사용)
const mockEvent: DbEvent = {
  id: 'mock-event-1',
  name: '셜록홈즈의 미제사건',
  duration_minutes: 60,
  status: 'waiting',
  started_at: null,
  paused_at: null,
  paused_duration: 0,
  hints_per_team: 5,
}

const mockTeams: DbTeam[] = [
  { id: 'team-1', event_id: 'mock-event-1', name: '보라팀', color: '#8b5cf6', join_code: 'PURPLE', hints_remaining: 5 },
  { id: 'team-2', event_id: 'mock-event-1', name: '빨강팀', color: '#ef4444', join_code: 'RED123', hints_remaining: 5 },
  { id: 'team-3', event_id: 'mock-event-1', name: '노랑팀', color: '#eab308', join_code: 'YELLOW', hints_remaining: 5 },
  { id: 'team-4', event_id: 'mock-event-1', name: '파랑팀', color: '#3b82f6', join_code: 'BLUE99', hints_remaining: 5 },
]

const mockStages: DbStage[] = [
  { id: 'stage-1', event_id: 'mock-event-1', name: '용의자의 방', entry_code: 'ROOM001', webtoon_image_url: 'https://placehold.co/400x600/1a1a2e/white?text=용의자의+방' },
  { id: 'stage-2', event_id: 'mock-event-1', name: '증거물품 보관소', entry_code: 'EVIDENCE', webtoon_image_url: 'https://placehold.co/400x600/1a1a2e/white?text=증거물품+보관소' },
  { id: 'stage-3', event_id: 'mock-event-1', name: '런던 거리', entry_code: 'LONDON', webtoon_image_url: 'https://placehold.co/400x600/1a1a2e/white?text=런던+거리' },
  { id: 'stage-4', event_id: 'mock-event-1', name: '베이커가 221B', entry_code: 'BAKER221', webtoon_image_url: 'https://placehold.co/400x600/1a1a2e/white?text=베이커가+221B' },
]

const mockPuzzles: DbPuzzle[] = [
  { id: 'puzzle-1', event_id: 'mock-event-1', name: '암호 해독', hint_code: 'CIPHER' },
  { id: 'puzzle-2', event_id: 'mock-event-1', name: '숨겨진 열쇠', hint_code: 'KEY123' },
  { id: 'puzzle-3', event_id: 'mock-event-1', name: '타임라인 퍼즐', hint_code: 'TIME99' },
  { id: 'puzzle-4', event_id: 'mock-event-1', name: '최종 추리', hint_code: 'FINAL1' },
]

const mockPuzzleHints: DbPuzzleHint[] = [
  // 암호 해독
  { id: 'hint-1-1', puzzle_id: 'puzzle-1', level: 1, content: '벽에 있는 그림을 자세히 살펴보세요.', coin_cost: 0 },
  { id: 'hint-1-2', puzzle_id: 'puzzle-1', level: 2, content: '그림 속 숫자들을 왼쪽에서 오른쪽으로 읽어보세요.', coin_cost: 1 },
  { id: 'hint-1-3', puzzle_id: 'puzzle-1', level: 3, content: '정답은 3-7-2-9 입니다.', coin_cost: 2 },
  // 숨겨진 열쇠
  { id: 'hint-2-1', puzzle_id: 'puzzle-2', level: 1, content: '책장 근처를 살펴보세요.', coin_cost: 0 },
  { id: 'hint-2-2', puzzle_id: 'puzzle-2', level: 2, content: '빨간색 책 뒤를 확인하세요.', coin_cost: 1 },
  { id: 'hint-2-3', puzzle_id: 'puzzle-2', level: 3, content: '"셜록홈즈 전집" 책 뒤에 열쇠가 있습니다.', coin_cost: 2 },
  // 타임라인 퍼즐
  { id: 'hint-3-1', puzzle_id: 'puzzle-3', level: 1, content: '사건 발생 순서를 생각해보세요.', coin_cost: 0 },
  { id: 'hint-3-2', puzzle_id: 'puzzle-3', level: 2, content: '피해자의 일기장에 단서가 있습니다.', coin_cost: 1 },
  { id: 'hint-3-3', puzzle_id: 'puzzle-3', level: 3, content: '순서: 파티 → 정전 → 비명 → 발견', coin_cost: 2 },
  // 최종 추리
  { id: 'hint-4-1', puzzle_id: 'puzzle-4', level: 1, content: '모든 증거를 다시 검토하세요.', coin_cost: 0 },
  { id: 'hint-4-2', puzzle_id: 'puzzle-4', level: 2, content: '범인은 알리바이가 거짓인 사람입니다.', coin_cost: 1 },
  { id: 'hint-4-3', puzzle_id: 'puzzle-4', level: 3, content: '범인은 집사 제임스입니다.', coin_cost: 2 },
]

interface SupabaseStore {
  // 연결 상태
  isConnected: boolean
  isLoading: boolean
  isInitialized: boolean  // 초기화 완료 여부 (mock 데이터 포함)
  error: string | null
  useMockData: boolean
  
  // 데이터
  event: DbEvent | null
  teams: DbTeam[]
  stages: DbStage[]
  puzzles: DbPuzzle[]
  puzzleHints: DbPuzzleHint[]
  stageViews: DbTeamStageView[]
  hintUsages: DbTeamHintUsage[]
  
  // 채널
  channel: RealtimeChannel | null
  
  // 초기화 및 구독
  initialize: (eventId?: string) => Promise<void>
  refreshData: () => Promise<void>
  subscribe: () => void
  unsubscribe: () => void
  
  // 이벤트 액션
  updateEvent: (updates: Partial<DbEvent>) => Promise<void>
  startTimer: () => Promise<void>
  pauseTimer: () => Promise<void>
  resumeTimer: () => Promise<void>
  resetTimer: () => Promise<void>
  
  // 팀 액션 (Admin CRUD)
  addTeam: (team: Omit<DbTeam, 'id' | 'created_at'>) => Promise<void>
  updateTeam: (teamId: string, updates: Partial<DbTeam>) => Promise<void>
  deleteTeam: (teamId: string) => Promise<void>
  useHintCoin: (teamId: string, cost: number) => Promise<boolean>
  getTeamByCode: (code: string) => DbTeam | undefined
  
  // 스테이지 액션 (Admin CRUD)
  addStage: (stage: Omit<DbStage, 'id' | 'created_at'>) => Promise<void>
  updateStage: (stageId: string, updates: Partial<DbStage>) => Promise<void>
  deleteStage: (stageId: string) => Promise<void>
  uploadStageImage: (stageId: string, file: File) => Promise<string | null>
  viewStage: (teamId: string, stageId: string) => Promise<void>
  getStageByCode: (code: string) => DbStage | undefined
  hasViewedStage: (teamId: string, stageId: string) => boolean
  
  // 퍼즐/힌트 액션 (Admin CRUD)
  addPuzzle: (puzzle: Omit<DbPuzzle, 'id' | 'created_at'>) => Promise<string | null>
  updatePuzzle: (puzzleId: string, updates: Partial<DbPuzzle>) => Promise<void>
  deletePuzzle: (puzzleId: string) => Promise<void>
  addPuzzleHint: (hint: Omit<DbPuzzleHint, 'id' | 'created_at'>) => Promise<void>
  updatePuzzleHint: (hintId: string, updates: Partial<DbPuzzleHint>) => Promise<void>
  deletePuzzleHint: (hintId: string) => Promise<void>
  getPuzzleByCode: (code: string) => DbPuzzle | undefined
  getHintsForPuzzle: (puzzleId: string) => DbPuzzleHint[]
  useHint: (teamId: string, puzzleHintId: string) => Promise<void>
  hasUsedHint: (teamId: string, puzzleHintId: string) => boolean
}

export const useSupabaseStore = create<SupabaseStore>((set, get) => ({
  isConnected: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  useMockData: false,
  
  event: null,
  teams: [],
  stages: [],
  puzzles: [],
  puzzleHints: [],
  stageViews: [],
  hintUsages: [],
  
  channel: null,
  
  // 초기화 - 데이터 로드
  initialize: async (eventId?: string) => {
    // 이미 초기화되었거나 로딩 중이면 무시 (무한 루프 방지)
    // 단, eventId가 제공되면 강제 새로고침
    if (!eventId && (get().isInitialized || get().isLoading)) return
    
    set({ isLoading: true, error: null })
    
    try {
      // 이벤트 로드 시도
      let eventQuery = supabase.from('events').select('*')
      if (eventId) {
        eventQuery = eventQuery.eq('id', eventId)
      }
      const { data: events, error: eventError } = await eventQuery.limit(1).single()
      
      if (eventError) {
        // 테이블이 없거나 데이터가 없으면 Mock 데이터 사용
        console.warn('Supabase 연결 실패, Mock 데이터 사용:', eventError.message)
        set({
          useMockData: true,
          event: mockEvent,
          teams: [...mockTeams],
          stages: [...mockStages],
          puzzles: [...mockPuzzles],
          puzzleHints: [...mockPuzzleHints],
          stageViews: [],
          hintUsages: [],
          isLoading: false,
          isConnected: false,
          isInitialized: true,
        })
        return
      }
      
      const currentEventId = events.id
      
      // 관련 데이터 로드
      const [teamsRes, stagesRes, puzzlesRes, hintsRes, viewsRes, usagesRes] = await Promise.all([
        supabase.from('teams').select('*').eq('event_id', currentEventId),
        supabase.from('stages').select('*').eq('event_id', currentEventId),
        supabase.from('puzzles').select('*').eq('event_id', currentEventId),
        supabase.from('puzzle_hints').select('*'),
        supabase.from('team_stage_views').select('*'),
        supabase.from('team_hint_usage').select('*'),
      ])
      
      set({
        useMockData: false,
        event: events,
        teams: teamsRes.data || [],
        stages: stagesRes.data || [],
        puzzles: puzzlesRes.data || [],
        puzzleHints: hintsRes.data || [],
        stageViews: viewsRes.data || [],
        hintUsages: usagesRes.data || [],
        isLoading: false,
        isConnected: true,
        isInitialized: true,
      })
      
      // 실시간 구독 시작
      get().subscribe()
      
    } catch (err: any) {
      console.error('Supabase initialize error:', err)
      // 에러 발생 시 Mock 데이터로 폴백
      set({
        useMockData: true,
        event: mockEvent,
        teams: [...mockTeams],
        stages: [...mockStages],
        puzzles: [...mockPuzzles],
        puzzleHints: [...mockPuzzleHints],
        stageViews: [],
        hintUsages: [],
        error: err.message,
        isLoading: false,
        isConnected: false,
        isInitialized: true,
      })
    }
  },
  
  // 데이터 새로고침 (강제)
  refreshData: async () => {
    const { event } = get()
    if (event) {
      set({ isInitialized: false })
      await get().initialize(event.id)
    }
  },
  
  // 실시간 구독
  subscribe: () => {
    const { event, useMockData } = get()
    if (!event || useMockData) return
    
    const channel = supabase
      .channel('game-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `id=eq.${event.id}` },
        (payload) => {
          console.log('Event change:', payload)
          if (payload.eventType === 'UPDATE') {
            set({ event: payload.new as DbEvent })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `event_id=eq.${event.id}` },
        (payload) => {
          console.log('Team change:', payload)
          const teams = get().teams
          if (payload.eventType === 'INSERT') {
            set({ teams: [...teams, payload.new as DbTeam] })
          } else if (payload.eventType === 'UPDATE') {
            set({ teams: teams.map(t => t.id === payload.new.id ? payload.new as DbTeam : t) })
          } else if (payload.eventType === 'DELETE') {
            set({ teams: teams.filter(t => t.id !== payload.old.id) })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_stage_views' },
        (payload) => {
          console.log('Stage view change:', payload)
          const views = get().stageViews
          if (payload.eventType === 'INSERT') {
            set({ stageViews: [...views, payload.new as DbTeamStageView] })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_hint_usage' },
        (payload) => {
          console.log('Hint usage change:', payload)
          const usages = get().hintUsages
          if (payload.eventType === 'INSERT') {
            set({ hintUsages: [...usages, payload.new as DbTeamHintUsage] })
          }
        }
      )
      .subscribe()
    
    set({ channel })
  },
  
  unsubscribe: () => {
    const { channel } = get()
    if (channel) {
      supabase.removeChannel(channel)
      set({ channel: null, isConnected: false })
    }
  },
  
  // 이벤트 업데이트
  updateEvent: async (updates) => {
    const { event, useMockData } = get()
    if (!event) return
    
    if (useMockData) {
      // Mock 모드: 로컬에서만 업데이트
      set({ event: { ...event, ...updates } as DbEvent })
      return
    }
    
    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', event.id)
    
    if (error) {
      console.error('Update event error:', error)
      throw error
    }
  },
  
  startTimer: async () => {
    await get().updateEvent({
      status: 'running',
      started_at: new Date().toISOString(),
      paused_at: null,
      paused_duration: 0,
    })
  },
  
  pauseTimer: async () => {
    await get().updateEvent({
      status: 'paused',
      paused_at: new Date().toISOString(),
    })
  },
  
  resumeTimer: async () => {
    const { event } = get()
    if (!event || !event.paused_at) return
    
    const pausedDuration = (event.paused_duration || 0) + 
      (new Date().getTime() - new Date(event.paused_at).getTime())
    
    await get().updateEvent({
      status: 'running',
      paused_at: null,
      paused_duration: pausedDuration,
    })
  },
  
  resetTimer: async () => {
    await get().updateEvent({
      status: 'waiting',
      started_at: null,
      paused_at: null,
      paused_duration: 0,
    })
  },
  
  // 힌트 코인 사용
  useHintCoin: async (teamId, cost) => {
    const { useMockData } = get()
    const team = get().teams.find(t => t.id === teamId)
    if (!team || team.hints_remaining < cost) return false
    
    if (useMockData) {
      // Mock 모드: 로컬에서만 업데이트
      set({
        teams: get().teams.map(t => 
          t.id === teamId ? { ...t, hints_remaining: t.hints_remaining - cost } : t
        )
      })
      return true
    }
    
    const { error } = await supabase
      .from('teams')
      .update({ hints_remaining: team.hints_remaining - cost })
      .eq('id', teamId)
    
    if (error) {
      console.error('Use hint coin error:', error)
      return false
    }
    
    return true
  },
  
  getTeamByCode: (code) => {
    return get().teams.find(t => t.join_code.toUpperCase() === code.toUpperCase())
  },
  
  // Admin: 팀 추가
  addTeam: async (team) => {
    const { useMockData } = get()
    
    if (useMockData) {
      const newTeam: DbTeam = {
        ...team,
        id: `team-${Date.now()}`,
        created_at: new Date().toISOString(),
      }
      set({ teams: [...get().teams, newTeam] })
      return
    }
    
    const { error } = await supabase.from('teams').insert(team)
    if (error) {
      console.error('Add team error:', error)
      throw error
    }
    await get().refreshData()
  },
  
  // Admin: 팀 수정
  updateTeam: async (teamId, updates) => {
    const { useMockData } = get()
    
    if (useMockData) {
      set({
        teams: get().teams.map(t => t.id === teamId ? { ...t, ...updates } : t)
      })
      return
    }
    
    const { error } = await supabase.from('teams').update(updates).eq('id', teamId)
    if (error) {
      console.error('Update team error:', error)
      throw error
    }
    await get().refreshData()
  },
  
  // Admin: 팀 삭제
  deleteTeam: async (teamId) => {
    const { useMockData } = get()
    
    if (useMockData) {
      set({ teams: get().teams.filter(t => t.id !== teamId) })
      return
    }
    
    const { error } = await supabase.from('teams').delete().eq('id', teamId)
    if (error) {
      console.error('Delete team error:', error)
      throw error
    }
    await get().refreshData()
  },
  
  // 스테이지 조회
  viewStage: async (teamId, stageId) => {
    const { useMockData } = get()
    if (get().hasViewedStage(teamId, stageId)) return
    
    if (useMockData) {
      // Mock 모드: 로컬에서만 추가
      set({
        stageViews: [...get().stageViews, {
          id: `view-${Date.now()}`,
          team_id: teamId,
          stage_id: stageId,
          viewed_at: new Date().toISOString(),
        }]
      })
      return
    }
    
    const { error } = await supabase
      .from('team_stage_views')
      .insert({ team_id: teamId, stage_id: stageId })
    
    if (error) {
      console.error('View stage error:', error)
    }
  },
  
  getStageByCode: (code) => {
    return get().stages.find(s => s.entry_code.toUpperCase() === code.toUpperCase())
  },
  
  hasViewedStage: (teamId, stageId) => {
    return get().stageViews.some(sv => sv.team_id === teamId && sv.stage_id === stageId)
  },
  
  // Admin: 스테이지 추가
  addStage: async (stage) => {
    const { useMockData } = get()
    
    if (useMockData) {
      const newStage: DbStage = {
        ...stage,
        id: `stage-${Date.now()}`,
        created_at: new Date().toISOString(),
      }
      set({ stages: [...get().stages, newStage] })
      return
    }
    
    const { error } = await supabase.from('stages').insert(stage)
    if (error) {
      console.error('Add stage error:', error)
      throw error
    }
    await get().refreshData()
  },
  
  // Admin: 스테이지 수정
  updateStage: async (stageId, updates) => {
    const { useMockData } = get()
    
    if (useMockData) {
      set({
        stages: get().stages.map(s => s.id === stageId ? { ...s, ...updates } : s)
      })
      return
    }
    
    const { error } = await supabase.from('stages').update(updates).eq('id', stageId)
    if (error) {
      console.error('Update stage error:', error)
      throw error
    }
    await get().refreshData()
  },
  
  // Admin: 스테이지 삭제
  deleteStage: async (stageId) => {
    const { useMockData } = get()
    
    if (useMockData) {
      set({ stages: get().stages.filter(s => s.id !== stageId) })
      return
    }
    
    // 이미지도 삭제
    await supabase.storage.from('webtoons').remove([`${stageId}`])
    
    const { error } = await supabase.from('stages').delete().eq('id', stageId)
    if (error) {
      console.error('Delete stage error:', error)
      throw error
    }
    await get().refreshData()
  },
  
  // Admin: 스테이지 이미지 업로드
  uploadStageImage: async (stageId, file) => {
    const { useMockData } = get()
    
    console.log('📤 이미지 업로드 시작:', { stageId, fileName: file.name, fileSize: file.size, fileType: file.type })
    
    if (useMockData) {
      // Mock 모드: 로컬 URL 생성 (blob URL)
      console.log('🔶 Mock 모드 - blob URL 생성')
      const url = URL.createObjectURL(file)
      set({
        stages: get().stages.map(s => 
          s.id === stageId ? { ...s, webtoon_image_url: url } : s
        )
      })
      console.log('✅ Mock 이미지 URL:', url)
      return url
    }
    
    try {
      // 파일 이름 생성 (특수문자 제거)
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${stageId}/${Date.now()}.${fileExt}`
      
      console.log('📁 업로드 경로:', fileName)
      
      // 기존 이미지 삭제 시도 (에러 무시)
      try {
        const { data: existingFiles } = await supabase.storage.from('webtoons').list(stageId)
        console.log('📋 기존 파일 목록:', existingFiles)
        if (existingFiles && existingFiles.length > 0) {
          const removeResult = await supabase.storage.from('webtoons').remove(
            existingFiles.map(f => `${stageId}/${f.name}`)
          )
          console.log('🗑️ 기존 파일 삭제 결과:', removeResult)
        }
      } catch (listError) {
        console.warn('기존 파일 목록 조회 실패 (무시):', listError)
      }
      
      // 새 이미지 업로드
      console.log('⏳ Supabase Storage에 업로드 중...')
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('webtoons')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        })
      
      if (uploadError) {
        console.error('❌ 업로드 실패:', uploadError)
        console.error('에러 상세:', JSON.stringify(uploadError, null, 2))
        throw new Error(`업로드 실패: ${uploadError.message}`)
      }
      
      console.log('✅ 업로드 성공:', uploadData)
      
      // Public URL 생성
      const { data: publicUrl } = supabase.storage
        .from('webtoons')
        .getPublicUrl(fileName)
      
      console.log('🔗 Public URL:', publicUrl.publicUrl)
      
      // 스테이지에 URL 저장
      console.log('💾 stages 테이블 업데이트 중...')
      const { error: updateError } = await supabase
        .from('stages')
        .update({ webtoon_image_url: publicUrl.publicUrl })
        .eq('id', stageId)
      
      if (updateError) {
        console.error('❌ stages 테이블 업데이트 실패:', updateError)
        throw new Error(`DB 업데이트 실패: ${updateError.message}`)
      }
      
      console.log('✅ 이미지 업로드 완료!')
      
      // 로컬 상태도 즉시 업데이트
      set({
        stages: get().stages.map(s => 
          s.id === stageId ? { ...s, webtoon_image_url: publicUrl.publicUrl } : s
        )
      })
      
      return publicUrl.publicUrl
    } catch (error) {
      console.error('❌ uploadStageImage 에러:', error)
      throw error
    }
  },
  
  // 퍼즐/힌트
  getPuzzleByCode: (code) => {
    return get().puzzles.find(p => p.hint_code.toUpperCase() === code.toUpperCase())
  },
  
  getHintsForPuzzle: (puzzleId) => {
    return get().puzzleHints
      .filter(h => h.puzzle_id === puzzleId)
      .sort((a, b) => a.level - b.level)
  },
  
  useHint: async (teamId, puzzleHintId) => {
    const { useMockData } = get()
    if (get().hasUsedHint(teamId, puzzleHintId)) return
    
    if (useMockData) {
      // Mock 모드: 로컬에서만 추가
      set({
        hintUsages: [...get().hintUsages, {
          id: `usage-${Date.now()}`,
          team_id: teamId,
          puzzle_hint_id: puzzleHintId,
          used_at: new Date().toISOString(),
        }]
      })
      return
    }
    
    const { error } = await supabase
      .from('team_hint_usage')
      .insert({ team_id: teamId, puzzle_hint_id: puzzleHintId })
    
    if (error) {
      console.error('Use hint error:', error)
    }
  },
  
  hasUsedHint: (teamId, puzzleHintId) => {
    return get().hintUsages.some(hu => hu.team_id === teamId && hu.puzzle_hint_id === puzzleHintId)
  },
  
  // Admin: 퍼즐 추가
  addPuzzle: async (puzzle) => {
    const { useMockData } = get()
    
    if (useMockData) {
      const newPuzzle: DbPuzzle = {
        ...puzzle,
        id: `puzzle-${Date.now()}`,
        created_at: new Date().toISOString(),
      }
      set({ puzzles: [...get().puzzles, newPuzzle] })
      return newPuzzle.id
    }
    
    const { data, error } = await supabase.from('puzzles').insert(puzzle).select().single()
    if (error) {
      console.error('Add puzzle error:', error)
      throw error
    }
    await get().refreshData()
    return data?.id || null
  },
  
  // Admin: 퍼즐 수정
  updatePuzzle: async (puzzleId, updates) => {
    const { useMockData } = get()
    
    if (useMockData) {
      set({
        puzzles: get().puzzles.map(p => p.id === puzzleId ? { ...p, ...updates } : p)
      })
      return
    }
    
    const { error } = await supabase.from('puzzles').update(updates).eq('id', puzzleId)
    if (error) {
      console.error('Update puzzle error:', error)
      throw error
    }
    await get().refreshData()
  },
  
  // Admin: 퍼즐 삭제
  deletePuzzle: async (puzzleId) => {
    const { useMockData } = get()
    
    if (useMockData) {
      set({ 
        puzzles: get().puzzles.filter(p => p.id !== puzzleId),
        puzzleHints: get().puzzleHints.filter(h => h.puzzle_id !== puzzleId)
      })
      return
    }
    
    const { error } = await supabase.from('puzzles').delete().eq('id', puzzleId)
    if (error) {
      console.error('Delete puzzle error:', error)
      throw error
    }
    await get().refreshData()
  },
  
  // Admin: 힌트 추가
  addPuzzleHint: async (hint) => {
    const { useMockData } = get()
    
    if (useMockData) {
      const newHint: DbPuzzleHint = {
        ...hint,
        id: `hint-${Date.now()}`,
        created_at: new Date().toISOString(),
      }
      set({ puzzleHints: [...get().puzzleHints, newHint] })
      return
    }
    
    const { error } = await supabase.from('puzzle_hints').insert(hint)
    if (error) {
      console.error('Add puzzle hint error:', error)
      throw error
    }
    await get().refreshData()
  },
  
  // Admin: 힌트 수정
  updatePuzzleHint: async (hintId, updates) => {
    const { useMockData } = get()
    
    if (useMockData) {
      set({
        puzzleHints: get().puzzleHints.map(h => h.id === hintId ? { ...h, ...updates } : h)
      })
      return
    }
    
    const { error } = await supabase.from('puzzle_hints').update(updates).eq('id', hintId)
    if (error) {
      console.error('Update puzzle hint error:', error)
      throw error
    }
    await get().refreshData()
  },
  
  // Admin: 힌트 삭제
  deletePuzzleHint: async (hintId) => {
    const { useMockData } = get()
    
    if (useMockData) {
      set({ puzzleHints: get().puzzleHints.filter(h => h.id !== hintId) })
      return
    }
    
    const { error } = await supabase.from('puzzle_hints').delete().eq('id', hintId)
    if (error) {
      console.error('Delete puzzle hint error:', error)
      throw error
    }
    await get().refreshData()
  },
}))
